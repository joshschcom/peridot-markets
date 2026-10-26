//! Zenex vault: an async-buffer `YieldVault` over Zenex's perps strategy vault (docs.zenex.trade).
//!
//! Peridot's receipt-vault calls `deposit` / `withdraw` synchronously, but Zenex settles both through
//! vault orders on the Zenex market that a Zenex keeper fills in a later ledger (redeems wait >= 1 hour).
//! So this contract is a buffer: deposits and withdrawals are served from a local USDC buffer, and a keeper
//! calls `sync` to move the excess into Zenex (deposit order) or pull funds back when the buffer runs low
//! (redeem order). It implements the same read/write surface as `blend-vault-adapter` plus the DeFindex
//! shaped `get_assets`, so the existing market-factory `Defindex` route can attach it unchanged
//! (admin allow-lists the vault with `set_yield_vault_allowed`, owner binds the market with `bind_market`).
//!
//! Constructor (this order is the `init_args` schema the app encodes, one Val each):
//!   `(owner: Address, market: Address, underlying: Address, cfg: ZenexConfig)`
//! `market` is the only address that may deposit (the receipt-vault of the Peridot market). If it is not
//! known yet pass `owner` and call `bind_market` once later.
//!
//! Trust model: funds can only ever move (a) to the depositor on `withdraw` and (b) to the fixed Zenex
//! market through vault orders created by `sync`. The keeper and owner cannot send funds anywhere else.
//! Owner: keeper, bounded params (raise-only haircut), pause, one-time `bind_market`, cancel orders.
//! Platform admin (compile-time `ZENEX_VAULT_INIT_ADMIN`): `upgrade` (immediate), pause. The upgrade key is
//! therefore the trust root, exactly as for the other Peridot adapters.
//!
//! Valuation never overstates: `total_value = buffer + (pending deposit principal + preview_redeem of all
//! Zenex shares incl. shares in a pending redeem) * (1 - haircut)`. Order existence is read live from the
//! Zenex market, so a filled order cannot be counted twice.
#![no_std]

use peridot_interfaces::VaultState;
use soroban_sdk::{
    auth::{ContractContext, InvokerContractAuthEntry, SubContractInvocation},
    contract, contractclient, contracterror, contractevent, contractimpl, contracttype, symbol_short,
    token, vec, Address, BytesN, Env, Error as HostError, IntoVal, Map, String, Symbol, TryFromVal, Val,
    Vec, U256,
};

#[cfg(test)]
mod test;

const TTL_THRESHOLD: u32 = 100_000;
const TTL_BUMP: u32 = 400_000;

pub const MIN_TARGET_BUFFER_BPS: u32 = 2_000;
pub const MIN_BUFFER_FLOOR_BPS: u32 = 500;
pub const MIN_SLIPPAGE_BPS: u32 = 50;
pub const MAX_SLIPPAGE_BPS: u32 = 500;
pub const MIN_HAIRCUT_BPS: u32 = 50;
pub const MAX_HAIRCUT_BPS: u32 = 2_000;
/// Minimum seconds between two order-creating syncs (bounds exec-fee bleed from rejected fills).
pub const SYNC_COOLDOWN_SECS: u64 = 300;
const ZENEX_ORDER_NOT_FOUND: u32 = 750;
const BPS: i128 = 10_000;

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum Error {
    NotAdmin = 1,
    NotMarket = 2,
    NotKeeper = 3,
    Paused = 4,
    InvalidAmount = 5,
    InvalidVector = 6,
    SlippageExceeded = 7,
    InsufficientShares = 8,
    ZeroShares = 9,
    Overflow = 10,
    VaultImpaired = 11,
    ZenexUnavailable = 12,
    /// The local buffer cannot pay this withdrawal. No state was changed.
    LiquidityShortfall = 13,
    UnexpectedBalance = 14,
    InvalidConfig = 15,
    CapExceeded = 16,
    NothingToDo = 17,
    OrderPending = 18,
    Cooldown = 19,
    AlreadyBound = 20,
    NotOwner = 21,
    NoOpenOrder = 22,
    /// Deposits are refused until the depositing market is bound.
    NotBound = 23,
}

/// Per-vault customization. All bounds are enforced in the constructor and `set_params`.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ZenexConfig {
    pub zenex_market: Address,
    pub zenex_vault: Address,
    pub keeper: Address,
    /// Share of total value kept as local USDC buffer, >= 2000 (20%).
    pub target_buffer_bps: u32,
    /// Below this a redeem order is created, 500 <= min < target.
    pub min_buffer_bps: u32,
    /// Slippage tolerance applied to `min_out`, 50..=500 (covers the 0.1%/0.25% Zenex fees).
    pub slippage_bps: u32,
    /// Valuation haircut on everything held in Zenex, 50..=2000 (default 200). Owner may only raise it.
    pub haircut_bps: u32,
    /// Maximum total value (token units), between Zenex min deposit and Zenex max vault balance.
    pub cap: i128,
}

/// Zenex `VaultOrder` (verified against mainnet CAOZCITW... get_vault_order).
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct VaultOrder {
    pub amount: i128,
    pub created_at: u64,
    pub exec_fee: i128,
    pub kind: u32,
    pub min_out: i128,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Strategy {
    pub address: Address,
    pub name: String,
    pub paused: bool,
}

/// DeFindex `get_assets` shape, so the market-factory `Defindex` attach check accepts this vault.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AssetStrategySet {
    pub address: Address,
    pub strategies: Vec<Strategy>,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ZenexState {
    pub buffer: i128,
    pub zenex_shares: i128,
    pub pending_deposit_id: u32,
    pub pending_redeem_id: u32,
    pub next_sync_after: u64,
    pub bound: bool,
}

#[contractclient(name = "ZxMarketClient")]
pub trait ZenexMarketApi {
    fn create_vault_order(env: Env, user: Address, kind: u32, amount: i128, min_out: i128) -> u32;
    fn cancel_vault_order(env: Env, user: Address, id: u32) -> i128;
    fn get_vault_order(env: Env, user: Address, id: u32) -> VaultOrder;
    fn get_vault(env: Env) -> Address;
    fn get_token(env: Env) -> Address;
    fn get_status(env: Env) -> u32;
    fn get_claimable_credit(env: Env, user: Address) -> i128;
    fn claim_credit(env: Env, user: Address) -> i128;
    fn get_config(env: Env) -> Map<Symbol, Val>;
}

#[contractclient(name = "ZxVaultClient")]
pub trait ZenexVaultApi {
    fn balance(env: Env, account: Address) -> i128;
    fn total_assets(env: Env) -> i128;
    fn query_asset(env: Env) -> Address;
    fn preview_deposit(env: Env, assets: i128, net_pnl: i128) -> i128;
    fn preview_redeem(env: Env, shares: i128, net_pnl: i128) -> i128;
}

#[contracttype]
#[derive(Clone)]
enum DataKey {
    Admin,
    Owner,
    Market,
    Bound,
    Underlying,
    Config,
    Paused,
    TotalShares,
    Principal,
    PendingDeposit,
    PendingRedeem,
    NextSync,
    Shares(Address),
}

#[contractevent(topics = ["deposit"])]
pub struct DepositEvent {
    pub from: Address,
    pub amount: i128,
    pub shares: i128,
}
#[contractevent(topics = ["withdraw"])]
pub struct WithdrawEvent {
    pub from: Address,
    pub shares: i128,
    pub amount: i128,
}
#[contractevent(topics = ["order"])]
pub struct OrderEvent {
    pub kind: u32,
    pub id: u32,
    pub amount: i128,
    pub min_out: i128,
}
#[contractevent(topics = ["cancel"])]
pub struct CancelEvent {
    pub id: u32,
    pub amount: i128,
}
#[contractevent(topics = ["paused"])]
pub struct PausedEvent {
    pub paused: bool,
}
#[contractevent(topics = ["params"])]
pub struct ParamsEvent {
    pub target_buffer_bps: u32,
    pub min_buffer_bps: u32,
    pub slippage_bps: u32,
    pub haircut_bps: u32,
    pub cap: i128,
}
#[contractevent(topics = ["keeper"])]
pub struct KeeperEvent {
    pub keeper: Address,
}
#[contractevent(topics = ["bound"])]
pub struct BoundEvent {
    pub market: Address,
}
#[contractevent(topics = ["upgraded"])]
pub struct UpgradedEvent {
    pub new_wasm_hash: BytesN<32>,
}

#[contract]
pub struct ZenexVault;

// ------------------------------------------------------------------ helpers

fn default_admin() -> &'static str {
    // test-only fixed admin; production builds must set ZENEX_VAULT_INIT_ADMIN
    "GBZ7C3N43KURCM3DWN4LOOKR5XWHNU6EZEJQT5VGRLHKUUQQYL7UXFMJ"
}

fn baked_admin() -> &'static str {
    if cfg!(test) {
        option_env!("ZENEX_VAULT_INIT_ADMIN").unwrap_or(default_admin())
    } else {
        option_env!("ZENEX_VAULT_INIT_ADMIN").expect("ZENEX_VAULT_INIT_ADMIN must be set at build time")
    }
}

fn bump_instance(env: &Env) {
    env.storage().instance().extend_ttl(TTL_THRESHOLD, TTL_BUMP);
}

fn get_addr(env: &Env, key: &DataKey) -> Address {
    env.storage().instance().get(key).expect("not initialized")
}

fn config(env: &Env) -> ZenexConfig {
    env.storage().instance().get(&DataKey::Config).expect("not initialized")
}

fn is_paused(env: &Env) -> bool {
    env.storage().instance().get(&DataKey::Paused).unwrap_or(false)
}

fn total_shares(env: &Env) -> i128 {
    env.storage().instance().get(&DataKey::TotalShares).unwrap_or(0)
}

fn principal(env: &Env) -> i128 {
    env.storage().instance().get(&DataKey::Principal).unwrap_or(0)
}

fn pending(env: &Env, key: &DataKey) -> u32 {
    env.storage().instance().get(key).unwrap_or(0)
}

fn shares_of(env: &Env, id: &Address) -> i128 {
    env.storage().persistent().get(&DataKey::Shares(id.clone())).unwrap_or(0)
}

fn set_shares(env: &Env, id: &Address, amount: i128) {
    let key = DataKey::Shares(id.clone());
    env.storage().persistent().set(&key, &amount);
    env.storage().persistent().extend_ttl(&key, TTL_THRESHOLD, TTL_BUMP);
}

fn mul_div_floor(env: &Env, a: i128, b: i128, c: i128) -> Option<i128> {
    if a < 0 || b < 0 || c <= 0 {
        return None;
    }
    let r = U256::from_u128(env, a as u128)
        .mul(&U256::from_u128(env, b as u128))
        .div(&U256::from_u128(env, c as u128));
    r.to_u128().and_then(|v| i128::try_from(v).ok())
}

fn mul_div_ceil(env: &Env, a: i128, b: i128, c: i128) -> Option<i128> {
    let f = mul_div_floor(env, a, b, c)?;
    let back = mul_div_floor(env, f, c, b.max(1))?;
    if b > 0 && back < a {
        f.checked_add(1)
    } else {
        Some(f)
    }
}

fn bps(env: &Env, v: i128, b: u32) -> i128 {
    mul_div_floor(env, v, b as i128, BPS).unwrap_or(0)
}

fn require_owner(env: &Env, who: &Address) -> Result<(), Error> {
    if &get_addr(env, &DataKey::Owner) != who {
        return Err(Error::NotOwner);
    }
    who.require_auth();
    Ok(())
}

fn require_admin(env: &Env, who: &Address) -> Result<(), Error> {
    if &get_addr(env, &DataKey::Admin) != who {
        return Err(Error::NotAdmin);
    }
    who.require_auth();
    Ok(())
}

fn require_operator(env: &Env, who: &Address) -> Result<(), Error> {
    let cfg = config(env);
    if who != &cfg.keeper && who != &get_addr(env, &DataKey::Owner) {
        return Err(Error::NotKeeper);
    }
    who.require_auth();
    Ok(())
}

fn validate_params(
    target: u32,
    min_buf: u32,
    slippage: u32,
    haircut: u32,
) -> Result<(), Error> {
    if !(MIN_TARGET_BUFFER_BPS..=10_000).contains(&target)
        || min_buf < MIN_BUFFER_FLOOR_BPS
        || min_buf >= target
        || !(MIN_SLIPPAGE_BPS..=MAX_SLIPPAGE_BPS).contains(&slippage)
        || !(MIN_HAIRCUT_BPS..=MAX_HAIRCUT_BPS).contains(&haircut)
    {
        return Err(Error::InvalidConfig);
    }
    Ok(())
}

fn map_i128(env: &Env, m: &Map<Symbol, Val>, name: &str) -> Option<i128> {
    let v = m.get(Symbol::new(env, name))?;
    i128::try_from_val(env, &v).ok()
}

/// Live Zenex limits: (exec_fee, min_deposit, max_vault_balance). Decoded as a map so a Zenex upgrade that
/// adds Config fields does not break the adapter.
fn zenex_limits(env: &Env, market: &Address) -> Option<(i128, i128, i128)> {
    match ZxMarketClient::new(env, market).try_get_config() {
        Ok(Ok(m)) => Some((
            map_i128(env, &m, "exec_fee")?,
            map_i128(env, &m, "min_deposit")?,
            map_i128(env, &m, "max_vault_balance")?,
        )),
        _ => None,
    }
}

enum OrderState {
    Gone,
    Open(VaultOrder),
    Unknown,
}

fn order_state(env: &Env, cfg: &ZenexConfig, id: u32) -> OrderState {
    if id == 0 {
        return OrderState::Gone;
    }
    match ZxMarketClient::new(env, &cfg.zenex_market)
        .try_get_vault_order(&env.current_contract_address(), &id)
    {
        Ok(Ok(o)) => OrderState::Open(o),
        Err(Ok(e)) if e == HostError::from_contract_error(ZENEX_ORDER_NOT_FOUND) => OrderState::Gone,
        _ => OrderState::Unknown,
    }
}

/// (pending deposit principal, shares held + shares escrowed in a pending redeem). `None` if Zenex cannot
/// be read, in which case callers fail closed.
fn exposure(env: &Env, cfg: &ZenexConfig) -> Option<(i128, i128)> {
    let this = env.current_contract_address();
    let mut dep = 0i128;
    let mut shares = match ZxVaultClient::new(env, &cfg.zenex_vault).try_balance(&this) {
        Ok(Ok(b)) if b >= 0 => b,
        _ => return None,
    };
    match order_state(env, cfg, pending(env, &DataKey::PendingDeposit)) {
        OrderState::Open(o) => dep = o.amount,
        OrderState::Gone => {}
        OrderState::Unknown => return None,
    }
    match order_state(env, cfg, pending(env, &DataKey::PendingRedeem)) {
        OrderState::Open(o) => shares = shares.checked_add(o.amount)?,
        OrderState::Gone => {}
        OrderState::Unknown => return None,
    }
    Some((dep, shares))
}

/// The tracked order id if that order is still open on Zenex, else 0.
fn open_id(env: &Env, cfg: &ZenexConfig, key: &DataKey) -> u32 {
    let id = pending(env, key);
    match order_state(env, cfg, id) {
        OrderState::Gone => 0,
        _ => id,
    }
}

fn zenex_gross_value(env: &Env, cfg: &ZenexConfig, shares: i128) -> Option<i128> {
    if shares == 0 {
        return Some(0);
    }
    match ZxVaultClient::new(env, &cfg.zenex_vault).try_preview_redeem(&shares, &0) {
        Ok(Ok(v)) if v >= 0 => Some(v),
        _ => None,
    }
}

/// Conservative total value in underlying. `None` if Zenex cannot be read.
fn total_value(env: &Env, cfg: &ZenexConfig, underlying: &Address) -> Option<i128> {
    let buffer = token::Client::new(env, underlying).balance(&env.current_contract_address());
    let (dep, shares) = exposure(env, cfg)?;
    let gross = zenex_gross_value(env, cfg, shares)?.checked_add(dep)?;
    let net = gross.checked_sub(bps(env, gross, cfg.haircut_bps))?;
    // A Zenex payout that failed to transfer is parked as a claimable credit: it is ours, count it at face.
    let credit = match ZxMarketClient::new(env, &cfg.zenex_market).try_get_claimable_credit(&env.current_contract_address()) {
        Ok(Ok(c)) if c > 0 => c,
        _ => 0,
    };
    buffer.checked_add(net)?.checked_add(credit)
}

fn authorize_transfers(env: &Env, calls: Vec<(Address, Address, i128)>) {
    // (token contract, to, amount); `from` is always this contract
    let this = env.current_contract_address();
    let mut auths: Vec<InvokerContractAuthEntry> = Vec::new(env);
    for (tok, to, amount) in calls.iter() {
        let args: Vec<Val> = (this.clone(), to, amount).into_val(env);
        auths.push_back(InvokerContractAuthEntry::Contract(SubContractInvocation {
            context: ContractContext { contract: tok, fn_name: symbol_short!("transfer"), args },
            sub_invocations: Vec::new(env),
        }));
    }
    env.authorize_as_current_contract(auths);
}

/// Creates a Zenex redeem order that refills the buffer to `target`. Shared by `sync` and `unwind`.
fn create_redeem(
    env: &Env,
    cfg: &ZenexConfig,
    underlying: &Address,
    buffer: i128,
    target: i128,
    exec_fee: i128,
    now: u64,
) -> Result<u32, Error> {
    let this = env.current_contract_address();
    let (_dep, held) = exposure(env, cfg).ok_or(Error::ZenexUnavailable)?;
    if held <= 0 || buffer < exec_fee {
        return Err(Error::NothingToDo);
    }
    let gross = zenex_gross_value(env, cfg, held).ok_or(Error::ZenexUnavailable)?;
    if gross <= 0 {
        return Err(Error::NothingToDo);
    }
    let need = (target - buffer).max(0).saturating_add(exec_fee).max(1);
    let need_gross = mul_div_ceil(env, need, BPS, BPS - cfg.slippage_bps as i128).ok_or(Error::Overflow)?;
    let mut shares = mul_div_ceil(env, need_gross, held, gross).ok_or(Error::Overflow)?;
    if shares > held {
        shares = held;
    }
    let zvault = ZxVaultClient::new(env, &cfg.zenex_vault);
    let quote = match zvault.try_preview_redeem(&shares, &0) {
        Ok(Ok(q)) => q,
        _ => return Err(Error::ZenexUnavailable),
    };
    let min_out = quote - bps(env, quote, cfg.slippage_bps);
    if min_out <= 0 {
        return Err(Error::NothingToDo);
    }
    let mut calls = vec![env, (cfg.zenex_vault.clone(), cfg.zenex_market.clone(), shares)];
    if exec_fee > 0 {
        calls.push_back((underlying.clone(), cfg.zenex_market.clone(), exec_fee));
    }
    authorize_transfers(env, calls);
    let id = ZxMarketClient::new(env, &cfg.zenex_market).create_vault_order(&this, &1u32, &shares, &min_out);
    let st = env.storage().instance();
    st.set(&DataKey::PendingRedeem, &id);
    st.set(&DataKey::NextSync, &(now + SYNC_COOLDOWN_SECS));
    OrderEvent { kind: 1, id, amount: shares, min_out }.publish(env);
    Ok(id)
}

#[contractimpl]
impl ZenexVault {
    pub fn __constructor(
        env: Env,
        owner: Address,
        market: Address,
        underlying: Address,
        cfg: ZenexConfig,
    ) -> Result<(), Error> {
        validate_params(cfg.target_buffer_bps, cfg.min_buffer_bps, cfg.slippage_bps, cfg.haircut_bps)?;
        // live integrity checks: this is Zenex's market for exactly this vault and token
        let zm = ZxMarketClient::new(&env, &cfg.zenex_market);
        match zm.try_get_vault() {
            Ok(Ok(v)) if v == cfg.zenex_vault => {}
            _ => return Err(Error::InvalidConfig),
        }
        match zm.try_get_token() {
            Ok(Ok(t)) if t == underlying => {}
            _ => return Err(Error::InvalidConfig),
        }
        match ZxVaultClient::new(&env, &cfg.zenex_vault).try_query_asset() {
            Ok(Ok(a)) if a == underlying => {}
            _ => return Err(Error::InvalidConfig),
        }
        let (_fee, min_deposit, max_vault) = zenex_limits(&env, &cfg.zenex_market).ok_or(Error::InvalidConfig)?;
        if cfg.cap < min_deposit || cfg.cap > max_vault {
            return Err(Error::InvalidConfig);
        }
        let s = env.storage().instance();
        s.set(&DataKey::Admin, &Address::from_str(&env, baked_admin()));
        s.set(&DataKey::Owner, &owner);
        s.set(&DataKey::Bound, &(market != owner));
        s.set(&DataKey::Market, &market);
        s.set(&DataKey::Underlying, &underlying);
        s.set(&DataKey::Config, &cfg);
        s.set(&DataKey::Paused, &false);
        s.set(&DataKey::TotalShares, &0i128);
        s.set(&DataKey::Principal, &0i128);
        s.set(&DataKey::NextSync, &0u64);
        bump_instance(&env);
        Ok(())
    }

    // ---------------------------------------------------------------- YieldVault

    pub fn balance(env: Env, id: Address) -> i128 {
        shares_of(&env, &id)
    }

    pub fn total_supply(env: Env) -> i128 {
        total_shares(&env)
    }

    /// Only the bound market deposits. Funds go to the local buffer; nothing is sent to Zenex here.
    pub fn deposit(
        env: Env,
        amounts_desired: Vec<i128>,
        amounts_min: Vec<i128>,
        from: Address,
        invest: bool,
    ) -> Result<Vec<i128>, Error> {
        let _ = invest; // always buffered; the keeper decides when to invest
        if !env.storage().instance().get(&DataKey::Bound).unwrap_or(false) {
            return Err(Error::NotBound);
        }
        if from != get_addr(&env, &DataKey::Market) {
            return Err(Error::NotMarket);
        }
        if is_paused(&env) {
            return Err(Error::Paused);
        }
        if amounts_desired.len() != 1 {
            return Err(Error::InvalidVector);
        }
        let amount = amounts_desired.get(0).unwrap_or(0);
        if amount <= 0 {
            return Err(Error::InvalidAmount);
        }
        if amounts_min.get(0).unwrap_or(0) > amount {
            return Err(Error::SlippageExceeded);
        }
        bump_instance(&env);
        let underlying: Address = get_addr(&env, &DataKey::Underlying);
        let cfg = config(&env);
        let this = env.current_contract_address();
        let ts = total_shares(&env);
        let value = total_value(&env, &cfg, &underlying).ok_or(Error::ZenexUnavailable)?;
        if value.checked_add(amount).ok_or(Error::Overflow)? > cfg.cap {
            return Err(Error::CapExceeded);
        }
        let shares = if ts == 0 {
            amount
        } else {
            if value == 0 {
                return Err(Error::VaultImpaired);
            }
            mul_div_floor(&env, amount, ts, value).ok_or(Error::Overflow)?
        };
        if shares <= 0 {
            return Err(Error::ZeroShares);
        }
        let tok = token::Client::new(&env, &underlying);
        let before = tok.balance(&this);
        tok.transfer(&from, &this, &amount);
        if tok.balance(&this) - before != amount {
            return Err(Error::UnexpectedBalance);
        }
        set_shares(&env, &from, shares_of(&env, &from).checked_add(shares).ok_or(Error::Overflow)?);
        env.storage().instance().set(&DataKey::TotalShares, &ts.checked_add(shares).ok_or(Error::Overflow)?);
        env.storage()
            .instance()
            .set(&DataKey::Principal, &principal(&env).checked_add(amount).ok_or(Error::Overflow)?);
        DepositEvent { from, amount, shares }.publish(&env);
        Ok(vec![&env, amount])
    }

    /// Pays only from the local buffer. `LiquidityShortfall` (no state change) if the buffer is short.
    /// Stays open while paused.
    pub fn withdraw(env: Env, shares: i128, min_amounts_out: Vec<i128>, from: Address) -> Result<Vec<i128>, Error> {
        from.require_auth();
        if shares <= 0 {
            return Err(Error::InvalidAmount);
        }
        bump_instance(&env);
        let bal = shares_of(&env, &from);
        let ts = total_shares(&env);
        if shares > bal || shares > ts {
            return Err(Error::InsufficientShares);
        }
        let underlying: Address = get_addr(&env, &DataKey::Underlying);
        let cfg = config(&env);
        let value = total_value(&env, &cfg, &underlying).ok_or(Error::ZenexUnavailable)?;
        let out = mul_div_floor(&env, shares, value, ts).ok_or(Error::Overflow)?;
        if out <= 0 {
            return Err(Error::InvalidAmount);
        }
        if min_amounts_out.get(0).unwrap_or(0) > out {
            return Err(Error::SlippageExceeded);
        }
        let tok = token::Client::new(&env, &underlying);
        if tok.balance(&env.current_contract_address()) < out {
            return Err(Error::LiquidityShortfall);
        }
        let p = principal(&env);
        let p_out = mul_div_floor(&env, p, shares, ts).unwrap_or(0).min(p);
        set_shares(&env, &from, bal - shares);
        env.storage().instance().set(&DataKey::TotalShares, &(ts - shares));
        env.storage().instance().set(&DataKey::Principal, &(p - p_out));
        tok.transfer(&env.current_contract_address(), &from, &out);
        WithdrawEvent { from, shares, amount: out }.publish(&env);
        Ok(vec![&env, out])
    }

    /// `[underlying]`. Never panics: any read failure or empty vault quotes `[0]`.
    pub fn get_asset_amounts_per_shares(env: Env, shares: i128) -> Vec<i128> {
        let zero = vec![&env, 0i128];
        let ts = total_shares(&env);
        if shares <= 0 || ts <= 0 {
            return zero;
        }
        let (Some(u), Some(cfg)) = (
            env.storage().instance().get::<_, Address>(&DataKey::Underlying),
            env.storage().instance().get::<_, ZenexConfig>(&DataKey::Config),
        ) else {
            return zero;
        };
        let Some(value) = total_value(&env, &cfg, &u) else { return zero };
        vec![&env, mul_div_floor(&env, shares, value, ts).unwrap_or(0)]
    }

    /// DeFindex `get_assets` shape (one asset, one strategy = this contract).
    pub fn get_assets(env: Env) -> Vec<AssetStrategySet> {
        vec![
            &env,
            AssetStrategySet {
                address: get_addr(&env, &DataKey::Underlying),
                strategies: vec![
                    &env,
                    Strategy {
                        address: env.current_contract_address(),
                        name: String::from_str(&env, "zenex"),
                        paused: is_paused(&env),
                    },
                ],
            },
        ]
    }

    // ----------------------------------------------------------------- keeper

    /// Keeper (or owner). One order at a time, at most one per `SYNC_COOLDOWN_SECS`. Returns the Zenex
    /// order id created. Deposit orders are blocked while paused; redeem orders never are.
    pub fn sync(env: Env, caller: Address) -> Result<u32, Error> {
        require_operator(&env, &caller)?;
        bump_instance(&env);
        let cfg = config(&env);
        let underlying: Address = get_addr(&env, &DataKey::Underlying);
        let this = env.current_contract_address();
        let st = env.storage().instance();
        // clear finished orders
        for key in [DataKey::PendingDeposit, DataKey::PendingRedeem] {
            let id = pending(&env, &key);
            match order_state(&env, &cfg, id) {
                OrderState::Gone => st.set(&key, &0u32),
                OrderState::Open(_) => return Err(Error::OrderPending),
                OrderState::Unknown => return Err(Error::ZenexUnavailable),
            }
        }
        let now = env.ledger().timestamp();
        let next: u64 = st.get(&DataKey::NextSync).unwrap_or(0);
        if now < next {
            return Err(Error::Cooldown);
        }
        let (exec_fee, min_deposit, max_vault) =
            zenex_limits(&env, &cfg.zenex_market).ok_or(Error::ZenexUnavailable)?;
        let tok = token::Client::new(&env, &underlying);
        let buffer = tok.balance(&this);
        let value = total_value(&env, &cfg, &underlying).ok_or(Error::ZenexUnavailable)?;
        let market = ZxMarketClient::new(&env, &cfg.zenex_market);
        let zvault = ZxVaultClient::new(&env, &cfg.zenex_vault);
        let target = bps(&env, value, cfg.target_buffer_bps);
        let floor = bps(&env, value, cfg.min_buffer_bps);

        if buffer > target + exec_fee && !is_paused(&env) {
            // deposit the excess, within Zenex's vault cap
            let mut excess = buffer - target - exec_fee;
            let headroom = match zvault.try_total_assets() {
                Ok(Ok(t)) => max_vault.saturating_sub(t),
                _ => return Err(Error::ZenexUnavailable),
            };
            excess = excess.min(headroom);
            if excess < min_deposit {
                return Err(Error::NothingToDo);
            }
            let quote = match zvault.try_preview_deposit(&excess, &0) {
                Ok(Ok(q)) => q,
                _ => return Err(Error::ZenexUnavailable),
            };
            let min_out = quote - bps(&env, quote, cfg.slippage_bps);
            if min_out <= 0 {
                return Err(Error::NothingToDo);
            }
            authorize_transfers(&env, vec![&env, (underlying.clone(), cfg.zenex_market.clone(), excess + exec_fee)]);
            let id = market.create_vault_order(&this, &0u32, &excess, &min_out);
            if buffer - tok.balance(&this) != excess + exec_fee {
                return Err(Error::UnexpectedBalance);
            }
            st.set(&DataKey::PendingDeposit, &id);
            st.set(&DataKey::NextSync, &(now + SYNC_COOLDOWN_SECS));
            OrderEvent { kind: 0, id, amount: excess, min_out }.publish(&env);
            return Ok(id);
        }

        if buffer < floor {
            return create_redeem(&env, &cfg, &underlying, buffer, target, exec_fee, now);
        }
        Err(Error::NothingToDo)
    }

    /// Owner or keeper: unwind from Zenex until the buffer reaches `want_buffer` (token units), regardless of the
    /// refill threshold. For an oversized withdrawal that failed with `LiquidityShortfall`, or to wind the vault
    /// down. One order at a time; the owner may top the buffer up with a plain USDC transfer to cover the fee.
    pub fn unwind(env: Env, caller: Address, want_buffer: i128) -> Result<u32, Error> {
        require_operator(&env, &caller)?;
        bump_instance(&env);
        let cfg = config(&env);
        let underlying: Address = get_addr(&env, &DataKey::Underlying);
        let st = env.storage().instance();
        for key in [DataKey::PendingDeposit, DataKey::PendingRedeem] {
            match order_state(&env, &cfg, pending(&env, &key)) {
                OrderState::Gone => st.set(&key, &0u32),
                OrderState::Open(_) => return Err(Error::OrderPending),
                OrderState::Unknown => return Err(Error::ZenexUnavailable),
            }
        }
        let now = env.ledger().timestamp();
        if now < st.get(&DataKey::NextSync).unwrap_or(0) {
            return Err(Error::Cooldown);
        }
        let (exec_fee, _min, _max) = zenex_limits(&env, &cfg.zenex_market).ok_or(Error::ZenexUnavailable)?;
        let buffer = token::Client::new(&env, &underlying).balance(&env.current_contract_address());
        if want_buffer <= buffer {
            return Err(Error::NothingToDo);
        }
        create_redeem(&env, &cfg, &underlying, buffer, want_buffer, exec_fee, now)
    }

    /// Owner or keeper: claim a Zenex credit parked after a failed payout into the buffer.
    pub fn claim_zenex_credit(env: Env, caller: Address) -> Result<i128, Error> {
        require_operator(&env, &caller)?;
        bump_instance(&env);
        let cfg = config(&env);
        Ok(ZxMarketClient::new(&env, &cfg.zenex_market).claim_credit(&env.current_contract_address()))
    }

    /// Cancels the open order (owner or keeper). Zenex refunds principal and exec fee. For a stuck order,
    /// e.g. a deposit that would exceed Zenex's vault cap or a redeem blocked by pending PnL.
    pub fn cancel_pending(env: Env, caller: Address, kind: u32) -> Result<i128, Error> {
        require_operator(&env, &caller)?;
        bump_instance(&env);
        let cfg = config(&env);
        let key = if kind == 0 { DataKey::PendingDeposit } else { DataKey::PendingRedeem };
        let id = pending(&env, &key);
        match order_state(&env, &cfg, id) {
            OrderState::Open(_) => {}
            OrderState::Gone => {
                env.storage().instance().set(&key, &0u32);
                return Err(Error::NoOpenOrder);
            }
            OrderState::Unknown => return Err(Error::ZenexUnavailable),
        }
        let amount = ZxMarketClient::new(&env, &cfg.zenex_market)
            .cancel_vault_order(&env.current_contract_address(), &id);
        env.storage().instance().set(&key, &0u32);
        CancelEvent { id, amount }.publish(&env);
        Ok(amount)
    }

    // ------------------------------------------------------- Peridot extensions

    pub fn underlying(env: Env) -> Address {
        get_addr(&env, &DataKey::Underlying)
    }
    pub fn kind(_env: Env) -> Symbol {
        symbol_short!("zenex")
    }
    pub fn market(env: Env) -> Address {
        get_addr(&env, &DataKey::Market)
    }
    pub fn owner(env: Env) -> Address {
        get_addr(&env, &DataKey::Owner)
    }
    pub fn admin(env: Env) -> Address {
        get_addr(&env, &DataKey::Admin)
    }
    pub fn keeper(env: Env) -> Address {
        config(&env).keeper
    }
    pub fn config(env: Env) -> ZenexConfig {
        config(&env)
    }

    pub fn get_zenex_state(env: Env) -> ZenexState {
        let cfg = config(&env);
        let u: Address = get_addr(&env, &DataKey::Underlying);
        let this = env.current_contract_address();
        ZenexState {
            buffer: token::Client::new(&env, &u).balance(&this),
            zenex_shares: ZxVaultClient::new(&env, &cfg.zenex_vault)
                .try_balance(&this)
                .ok()
                .and_then(|r| r.ok())
                .unwrap_or(0),
            pending_deposit_id: open_id(&env, &cfg, &DataKey::PendingDeposit),
            pending_redeem_id: open_id(&env, &cfg, &DataKey::PendingRedeem),
            next_sync_after: env.storage().instance().get(&DataKey::NextSync).unwrap_or(0),
            bound: env.storage().instance().get(&DataKey::Bound).unwrap_or(false),
        }
    }

    pub fn get_state(env: Env) -> VaultState {
        let underlying: Address = get_addr(&env, &DataKey::Underlying);
        let cfg = config(&env);
        VaultState {
            kind: symbol_short!("zenex"),
            underlying: underlying.clone(),
            total_shares: total_shares(&env),
            total_value: total_value(&env, &cfg, &underlying).unwrap_or(0),
            principal: principal(&env),
            reserve: 0,
            last_harvest_ts: 0,
            last_harvest_amount: 0,
            apy_hint_bps: 0,
            paused: is_paused(&env),
        }
    }

    /// Fees accrue inside the Zenex vault share price; there is nothing to claim. Returns 0.
    pub fn harvest(env: Env, keeper: Address, _min_out: i128) -> Result<i128, Error> {
        require_operator(&env, &keeper)?;
        Ok(0)
    }

    /// One-time: bind the depositing market once its receipt-vault exists.
    pub fn bind_market(env: Env, owner: Address, market: Address) -> Result<(), Error> {
        require_owner(&env, &owner)?;
        if env.storage().instance().get(&DataKey::Bound).unwrap_or(false) {
            return Err(Error::AlreadyBound);
        }
        if total_shares(&env) != 0 {
            return Err(Error::InvalidConfig);
        }
        env.storage().instance().set(&DataKey::Market, &market);
        env.storage().instance().set(&DataKey::Bound, &true);
        bump_instance(&env);
        BoundEvent { market }.publish(&env);
        Ok(())
    }

    pub fn set_keeper(env: Env, owner: Address, keeper: Address) -> Result<(), Error> {
        require_owner(&env, &owner)?;
        bump_instance(&env);
        let mut cfg = config(&env);
        cfg.keeper = keeper.clone();
        env.storage().instance().set(&DataKey::Config, &cfg);
        KeeperEvent { keeper }.publish(&env);
        Ok(())
    }

    /// Bounded parameter update. The haircut can only be raised (never loosened) so the owner cannot
    /// inflate the reported value.
    pub fn set_params(
        env: Env,
        owner: Address,
        target_buffer_bps: u32,
        min_buffer_bps: u32,
        slippage_bps: u32,
        haircut_bps: u32,
        cap: i128,
    ) -> Result<(), Error> {
        require_owner(&env, &owner)?;
        let mut cfg = config(&env);
        validate_params(target_buffer_bps, min_buffer_bps, slippage_bps, haircut_bps)?;
        if haircut_bps < cfg.haircut_bps {
            return Err(Error::InvalidConfig);
        }
        let (_f, min_deposit, max_vault) = zenex_limits(&env, &cfg.zenex_market).ok_or(Error::ZenexUnavailable)?;
        if cap < min_deposit || cap > max_vault {
            return Err(Error::InvalidConfig);
        }
        cfg.target_buffer_bps = target_buffer_bps;
        cfg.min_buffer_bps = min_buffer_bps;
        cfg.slippage_bps = slippage_bps;
        cfg.haircut_bps = haircut_bps;
        cfg.cap = cap;
        env.storage().instance().set(&DataKey::Config, &cfg);
        bump_instance(&env);
        ParamsEvent { target_buffer_bps, min_buffer_bps, slippage_bps, haircut_bps, cap }.publish(&env);
        Ok(())
    }

    /// Owner or platform admin. Blocks new deposits and new deposit orders only; withdrawals and redeem
    /// orders stay open.
    pub fn pause(env: Env, caller: Address, paused: bool) -> Result<(), Error> {
        if caller == get_addr(&env, &DataKey::Admin) {
            require_admin(&env, &caller)?;
        } else {
            require_owner(&env, &caller)?;
        }
        bump_instance(&env);
        env.storage().instance().set(&DataKey::Paused, &paused);
        PausedEvent { paused }.publish(&env);
        Ok(())
    }

    /// Platform admin only, immediate, no timelock.
    pub fn upgrade(env: Env, admin: Address, new_wasm_hash: BytesN<32>) -> Result<(), Error> {
        require_admin(&env, &admin)?;
        UpgradedEvent { new_wasm_hash: new_wasm_hash.clone() }.publish(&env);
        env.deployer().update_current_contract_wasm(new_wasm_hash);
        Ok(())
    }
}
