//! XOXNO Lending route: a customizable, factory-deployable `YieldVault` (00 section 6.1) over
//! XOXNO Lending (Stellar). Supply-only: the vault owns one XOXNO account (u64 id plus position NFT) and
//! never borrows. It implements the SAME interface as `blend-vault-adapter`, so Peridot markets consume it
//! through `attach_yield` without a market-factory change.
//!
//! Ownership and auth (XOXNO SDK README rules): the vault itself is the XOXNO `caller`, payer and receiver,
//! so the position NFT is held by this contract. A public entrypoint that spends vault funds must not
//! authenticate an arbitrary address: `deposit` only accepts `from == depositor` (the Peridot market, or the
//! owner's wallet for a standalone vault) and `withdraw` burns the caller's own shares. XOXNO's pool pulls the
//! supplied tokens with `underlying.transfer(vault, pool, amount)`, which the vault pre-authorizes with
//! `authorize_as_current_contract` (entry at the ROOT, like the XOXNO SDK `authorize_transfers_as_current`).
//!
//! Per-vault customization (constructor, all bounded): owner, depositor, underlying, hub and spoke id, keeper,
//! deposit cap, min deposit, performance fee. The XOXNO controller and the protocol admin are baked at
//! compile time (`XOXNO_VAULT_CONTROLLER`, `XOXNO_VAULT_INIT_ADMIN`) so a vault can never be pointed at a
//! hostile lending contract.
//!
//! Admin powers: the OWNER may pause deposits, rotate the keeper, lower the cap to any value above zero and
//! set the fee within `MAX_FEE_BPS`. The baked protocol ADMIN may pause deposits and `upgrade` the code
//! (immediate, no timelock, like every Peridot adapter). Nobody can move funds except share holders.
#![no_std]

use peridot_interfaces::VaultState;
use soroban_sdk::{
    auth::{ContractContext, InvokerContractAuthEntry, SubContractInvocation},
    contract, contractclient, contracterror, contractevent, contractimpl, contracttype, symbol_short,
    vec, Address, BytesN, Env, IntoVal, String, Symbol, Vec, U256,
};

#[cfg(test)]
mod test;

const TTL_THRESHOLD: u32 = 100_000;
const TTL_BUMP: u32 = 400_000;

/// Hard bound for the performance fee on yield (20%).
pub const MAX_FEE_BPS: u32 = 2_000;
const BPS: i128 = 10_000;
/// Share price scale (value per share, 1e18 = 1:1).
const PRICE_SCALE: i128 = 1_000_000_000_000_000_000;
/// XOXNO `NEW_ACCOUNT` sentinel and `WITHDRAW_ALL` amount.
const NEW_ACCOUNT: u64 = 0;
const WITHDRAW_ALL: i128 = 0;

pub const DEFAULT_INIT_ADMIN: &str = "CANYX4H5FXYBQKA4UF4NDUDAGRX3W5XXVZSJUGL5DNBLJUELNS6ALSXY";
/// XOXNO testnet controller (used only by tests and `test-defaults` builds).
pub const DEFAULT_CONTROLLER: &str = "CCXRWJ6SIU2WPFEGLFGJVITPL57QAYIMIO6OAM2NBGNDQSSCK2FFV3F3";

fn baked_admin() -> &'static str {
    if cfg!(any(test, feature = "test-defaults")) {
        option_env!("XOXNO_VAULT_INIT_ADMIN").unwrap_or(DEFAULT_INIT_ADMIN)
    } else {
        option_env!("XOXNO_VAULT_INIT_ADMIN").expect("XOXNO_VAULT_INIT_ADMIN must be set at build time")
    }
}

fn baked_controller() -> &'static str {
    if cfg!(any(test, feature = "test-defaults")) {
        option_env!("XOXNO_VAULT_CONTROLLER").unwrap_or(DEFAULT_CONTROLLER)
    } else {
        option_env!("XOXNO_VAULT_CONTROLLER").expect("XOXNO_VAULT_CONTROLLER must be set at build time")
    }
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum Error {
    NotAdmin = 1,
    NotDepositor = 2,
    NotKeeper = 3,
    Paused = 4,
    InvalidAmount = 5,
    InvalidVector = 6,
    SlippageExceeded = 7,
    InsufficientShares = 8,
    ZeroShares = 9,
    Overflow = 10,
    /// Shares outstanding but zero value: deposits are refused.
    VaultImpaired = 11,
    XoxnoUnavailable = 12,
    /// XOXNO lacks the liquidity for this withdrawal. No state was changed.
    LiquidityShortfall = 13,
    XoxnoSupplyFailed = 14,
    /// The token balance moved by a different amount than requested.
    UnexpectedBalance = 15,
    MarketNotListed = 16,
    InvalidConfig = 17,
    CapExceeded = 18,
    BelowMinDeposit = 19,
    NotOwner = 20,
    /// `bind_market` is one-time and only while the vault holds no shares.
    AlreadyBound = 21,
    HasShares = 22,
}

/// XOXNO market key (mirrors the controller spec).
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct HubAssetKey {
    pub asset: Address,
    pub hub_id: u32,
}

/// Mirror of the controller `SpokeAssetConfig`.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct SpokeAssetConfig {
    pub borrow_cap: i128,
    pub frozen: bool,
    pub is_borrowable: bool,
    pub is_collateralizable: bool,
    pub liquidation_bonus: u32,
    pub liquidation_fees: u32,
    pub liquidation_threshold: u32,
    pub loan_to_value: u32,
    pub no_seize: bool,
    pub paused: bool,
    pub supply_cap: i128,
}

/// The subset of the XOXNO controller the vault calls.
#[contractclient(name = "XoxnoClient")]
pub trait XoxnoApi {
    fn supply(
        env: Env,
        caller: Address,
        account_id: u64,
        spoke_id: u32,
        assets: Vec<(HubAssetKey, i128)>,
    ) -> u64;
    fn withdraw(
        env: Env,
        caller: Address,
        account_id: u64,
        withdrawals: Vec<(HubAssetKey, i128)>,
        to: Option<Address>,
    ) -> Vec<(HubAssetKey, i128)>;
    fn get_collateral_amount(env: Env, account_id: u64, hub_asset: HubAssetKey) -> i128;
    fn account_exists(env: Env, account_id: u64) -> bool;
    fn get_pool_address(env: Env) -> Address;
    fn get_spoke_asset(env: Env, spoke_id: u32, hub_asset: HubAssetKey) -> SpokeAssetConfig;
}

/// DeFindex-shaped views read by `market-factory.check_defindex` (field names and order must match).
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Strategy {
    pub address: Address,
    pub name: String,
    pub paused: bool,
}
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AssetStrategySet {
    pub address: Address,
    pub strategies: Vec<Strategy>,
}

/// Read-only view of the customizable parameters.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct VaultParams {
    pub owner: Address,
    pub depositor: Address,
    pub underlying: Address,
    pub controller: Address,
    pub pool: Address,
    pub hub_id: u32,
    pub spoke_id: u32,
    pub keeper: Address,
    pub deposit_cap: i128,
    pub min_deposit: i128,
    pub fee_bps: u32,
}

#[contracttype]
#[derive(Clone)]
enum DataKey {
    Admin,
    Owner,
    Depositor,
    Underlying,
    Controller,
    Pool,
    HubId,
    SpokeId,
    Keeper,
    Cap,
    MinDeposit,
    FeeBps,
    Paused,
    Bound,
    TotalShares,
    Principal,
    /// XOXNO account id; absent until the first deposit and after the account closes.
    Account,
    /// High-water share price (PRICE_SCALE).
    Hwm,
    LastHarvestTs,
    LastHarvestAmount,
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
#[contractevent(topics = ["paused"])]
pub struct PausedEvent {
    pub paused: bool,
}
#[contractevent(topics = ["keeper"])]
pub struct KeeperEvent {
    pub keeper: Address,
}
#[contractevent(topics = ["cap"])]
pub struct CapEvent {
    pub cap: i128,
}
#[contractevent(topics = ["fee"])]
pub struct FeeEvent {
    pub fee_bps: u32,
}
#[contractevent(topics = ["harvest"])]
pub struct HarvestEvent {
    pub fee_value: i128,
    pub fee_shares: i128,
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
pub struct XoxnoVault;

fn bump_instance(env: &Env) {
    env.storage().instance().extend_ttl(TTL_THRESHOLD, TTL_BUMP);
}

fn addr(env: &Env, key: DataKey) -> Address {
    env.storage().instance().get(&key).expect("not initialized")
}
fn get_i128(env: &Env, key: DataKey) -> i128 {
    env.storage().instance().get(&key).unwrap_or(0)
}
fn get_u32(env: &Env, key: DataKey) -> u32 {
    env.storage().instance().get(&key).unwrap_or(0)
}
fn is_paused(env: &Env) -> bool {
    env.storage().instance().get(&DataKey::Paused).unwrap_or(false)
}
fn total_shares(env: &Env) -> i128 {
    get_i128(env, DataKey::TotalShares)
}
fn account(env: &Env) -> Option<u64> {
    env.storage().instance().get(&DataKey::Account)
}
fn hub_key(env: &Env) -> HubAssetKey {
    HubAssetKey {
        asset: addr(env, DataKey::Underlying),
        hub_id: get_u32(env, DataKey::HubId),
    }
}
fn shares_of(env: &Env, id: &Address) -> i128 {
    env.storage().persistent().get(&DataKey::Shares(id.clone())).unwrap_or(0)
}
fn set_shares(env: &Env, id: &Address, amount: i128) {
    let key = DataKey::Shares(id.clone());
    env.storage().persistent().set(&key, &amount);
    env.storage().persistent().extend_ttl(&key, TTL_THRESHOLD, TTL_BUMP);
}

/// Owner or the baked protocol admin.
fn require_owner_or_admin(env: &Env, who: &Address) -> Result<(), Error> {
    if who != &addr(env, DataKey::Owner) && who != &addr(env, DataKey::Admin) {
        return Err(Error::NotAdmin);
    }
    who.require_auth();
    Ok(())
}
fn require_owner(env: &Env, who: &Address) -> Result<(), Error> {
    if who != &addr(env, DataKey::Owner) {
        return Err(Error::NotOwner);
    }
    who.require_auth();
    Ok(())
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

/// The vault's position in XOXNO in underlying. `Some(0)` with no account, `None` if XOXNO cannot be read.
fn position_value(env: &Env) -> Option<i128> {
    let Some(id) = account(env) else { return Some(0) };
    let client = XoxnoClient::new(env, &addr(env, DataKey::Controller));
    match client.try_get_collateral_amount(&id, &hub_key(env)) {
        Ok(Ok(v)) if v >= 0 => Some(v),
        _ => None,
    }
}

fn validate_params(cap: i128, min_deposit: i128, fee_bps: u32) -> Result<(), Error> {
    if cap <= 0 || min_deposit <= 0 || min_deposit > cap || fee_bps > MAX_FEE_BPS {
        return Err(Error::InvalidConfig);
    }
    Ok(())
}

/// Crystallizes the performance fee on the gain above the high-water share price by minting dilution shares
/// to the owner. Returns `(fee_value, fee_shares)`. A fee of zero or no gain changes only the high-water mark.
fn accrue_fee(env: &Env, value: i128) -> Result<(i128, i128), Error> {
    let ts = total_shares(env);
    if ts <= 0 || value <= 0 {
        return Ok((0, 0));
    }
    let hwm: i128 = env.storage().instance().get(&DataKey::Hwm).unwrap_or(PRICE_SCALE);
    let price = mul_div_floor(env, value, PRICE_SCALE, ts).ok_or(Error::Overflow)?;
    if price <= hwm {
        return Ok((0, 0));
    }
    let fee_bps = get_u32(env, DataKey::FeeBps) as i128;
    let gain = mul_div_floor(env, price - hwm, ts, PRICE_SCALE).ok_or(Error::Overflow)?;
    let fee_value = gain * fee_bps / BPS;
    let mut fee_shares = 0;
    if fee_value > 0 && fee_value < value {
        fee_shares = mul_div_floor(env, fee_value, ts, value - fee_value).ok_or(Error::Overflow)?;
    }
    let new_ts = ts + fee_shares;
    if fee_shares > 0 {
        let owner = addr(env, DataKey::Owner);
        set_shares(env, &owner, shares_of(env, &owner) + fee_shares);
        env.storage().instance().set(&DataKey::TotalShares, &new_ts);
    }
    let new_price = mul_div_floor(env, value, PRICE_SCALE, new_ts).ok_or(Error::Overflow)?;
    env.storage().instance().set(&DataKey::Hwm, &new_price);
    Ok((if fee_shares > 0 { fee_value } else { 0 }, fee_shares))
}

#[contractimpl]
impl XoxnoVault {
    /// Factory entrypoint. Args (in this order, used as `init_args`): owner, depositor, underlying, hub_id,
    /// spoke_id, keeper, deposit_cap, min_deposit, fee_bps. Verifies the (hub, spoke, underlying) market is
    /// listed and enabled on the baked XOXNO controller, so a misconfigured vault can never be created.
    pub fn __constructor(
        env: Env,
        owner: Address,
        depositor: Address,
        underlying: Address,
        hub_id: u32,
        spoke_id: u32,
        keeper: Address,
        deposit_cap: i128,
        min_deposit: i128,
        fee_bps: u32,
    ) -> Result<(), Error> {
        validate_params(deposit_cap, min_deposit, fee_bps)?;
        let controller = Address::from_str(&env, baked_controller());
        let xc = XoxnoClient::new(&env, &controller);
        let key = HubAssetKey {
            asset: underlying.clone(),
            hub_id,
        };
        let pool = match xc.try_get_pool_address() {
            Ok(Ok(p)) => p,
            _ => return Err(Error::XoxnoUnavailable),
        };
        match xc.try_get_spoke_asset(&spoke_id, &key) {
            Ok(Ok(cfg)) if !cfg.paused && !cfg.frozen => {}
            _ => return Err(Error::MarketNotListed),
        }
        let s = env.storage().instance();
        s.set(&DataKey::Admin, &Address::from_str(&env, baked_admin()));
        s.set(&DataKey::Owner, &owner);
        s.set(&DataKey::Depositor, &depositor);
        s.set(&DataKey::Underlying, &underlying);
        s.set(&DataKey::Controller, &controller);
        s.set(&DataKey::Pool, &pool);
        s.set(&DataKey::HubId, &hub_id);
        s.set(&DataKey::SpokeId, &spoke_id);
        s.set(&DataKey::Keeper, &keeper);
        s.set(&DataKey::Cap, &deposit_cap);
        s.set(&DataKey::MinDeposit, &min_deposit);
        s.set(&DataKey::FeeBps, &fee_bps);
        s.set(&DataKey::Paused, &false);
        s.set(&DataKey::TotalShares, &0i128);
        s.set(&DataKey::Principal, &0i128);
        s.set(&DataKey::Hwm, &PRICE_SCALE);
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

    /// Only the depositor can deposit. Pulls exactly `token.transfer(depositor, this, amounts_desired[0])`,
    /// supplies it to XOXNO and mints shares against the position value measured BEFORE the supply.
    pub fn deposit(
        env: Env,
        amounts_desired: Vec<i128>,
        amounts_min: Vec<i128>,
        from: Address,
        _invest: bool,
    ) -> Result<Vec<i128>, Error> {
        if from != addr(&env, DataKey::Depositor) {
            return Err(Error::NotDepositor);
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
        if amount < get_i128(&env, DataKey::MinDeposit) {
            return Err(Error::BelowMinDeposit);
        }
        if amounts_min.get(0).unwrap_or(0) > amount {
            return Err(Error::SlippageExceeded);
        }
        bump_instance(&env);

        let underlying = addr(&env, DataKey::Underlying);
        let controller = addr(&env, DataKey::Controller);
        let pool = addr(&env, DataKey::Pool);
        let this = env.current_contract_address();

        let value = position_value(&env).ok_or(Error::XoxnoUnavailable)?;
        if value.checked_add(amount).ok_or(Error::Overflow)? > get_i128(&env, DataKey::Cap) {
            return Err(Error::CapExceeded);
        }
        // Take the fee on gains so far before the new deposit changes the share count.
        accrue_fee(&env, value)?;
        let ts = total_shares(&env);
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

        let tok = soroban_sdk::token::Client::new(&env, &underlying);
        let bal_before = tok.balance(&this);
        tok.transfer(&from, &this, &amount);
        if tok.balance(&this) - bal_before != amount {
            return Err(Error::UnexpectedBalance);
        }

        let xc = XoxnoClient::new(&env, &controller);
        let stored = account(&env);
        let acct_in = match stored {
            Some(id) if xc.try_account_exists(&id).map(|r| r.unwrap_or(false)).unwrap_or(false) => id,
            _ => NEW_ACCOUNT,
        };
        // Any contract call made between `authorize_as_current_contract` and the supply would consume the
        // entry, so resolve the account first and authorize immediately before `supply`.
        // XOXNO pool pulls `transfer(this, pool, amount)`: pre-authorize at the root.
        let transfer_args: Vec<soroban_sdk::Val> = (this.clone(), pool, amount).into_val(&env);
        env.authorize_as_current_contract(vec![
            &env,
            InvokerContractAuthEntry::Contract(SubContractInvocation {
                context: ContractContext {
                    contract: underlying.clone(),
                    fn_name: symbol_short!("transfer"),
                    args: transfer_args,
                },
                sub_invocations: Vec::new(&env),
            }),
        ]);
        let assets = vec![&env, (hub_key(&env), amount)];
        let acct = match xc.try_supply(&this, &acct_in, &get_u32(&env, DataKey::SpokeId), &assets) {
            Ok(Ok(id)) if id != 0 => id,
            _ => return Err(Error::XoxnoSupplyFailed),
        };
        if tok.balance(&this) != bal_before {
            return Err(Error::UnexpectedBalance);
        }
        env.storage().instance().set(&DataKey::Account, &acct);

        let new_total = total_shares(&env).checked_add(shares).ok_or(Error::Overflow)?;
        let new_bal = shares_of(&env, &from).checked_add(shares).ok_or(Error::Overflow)?;
        let new_principal = get_i128(&env, DataKey::Principal)
            .checked_add(amount)
            .ok_or(Error::Overflow)?;
        set_shares(&env, &from, new_bal);
        env.storage().instance().set(&DataKey::TotalShares, &new_total);
        env.storage().instance().set(&DataKey::Principal, &new_principal);
        DepositEvent { from, amount, shares }.publish(&env);
        Ok(vec![&env, amount])
    }

    /// Burns `shares` of `from` and pays the pro-rata underlying (round down) to `from`. Withdrawals stay
    /// open while paused. Fails with `LiquidityShortfall`, changing nothing, if XOXNO cannot release funds.
    pub fn withdraw(env: Env, shares: i128, min_amounts_out: Vec<i128>, from: Address) -> Result<Vec<i128>, Error> {
        from.require_auth();
        if shares <= 0 {
            return Err(Error::InvalidAmount);
        }
        bump_instance(&env);
        let value0 = position_value(&env).ok_or(Error::XoxnoUnavailable)?;
        // Crystallize the fee first so the redeemer pays its share of the performance fee.
        accrue_fee(&env, value0)?;
        let bal = shares_of(&env, &from);
        let ts = total_shares(&env);
        if shares > bal || shares > ts {
            return Err(Error::InsufficientShares);
        }
        let this = env.current_contract_address();
        let acct = account(&env).ok_or(Error::InsufficientShares)?;
        let out = mul_div_floor(&env, shares, value0, ts).ok_or(Error::Overflow)?;
        if out <= 0 {
            return Err(Error::InvalidAmount);
        }
        if min_amounts_out.get(0).unwrap_or(0) > out {
            return Err(Error::SlippageExceeded);
        }

        let underlying = addr(&env, DataKey::Underlying);
        let tok = soroban_sdk::token::Client::new(&env, &underlying);
        let bal_before = tok.balance(&this);
        let xc = XoxnoClient::new(&env, &addr(&env, DataKey::Controller));
        // Redeeming every share drains the position (WITHDRAW_ALL) so no dust is stranded in XOXNO.
        let ask = if shares == ts { WITHDRAW_ALL } else { out };
        let assets = vec![&env, (hub_key(&env), ask)];
        match xc.try_withdraw(&this, &acct, &assets, &None) {
            Ok(Ok(_)) => {}
            _ => return Err(Error::LiquidityShortfall),
        }
        let received = tok.balance(&this) - bal_before;
        if ask == out {
            if received != out {
                return Err(Error::UnexpectedBalance);
            }
        } else {
            // Full exit: XOXNO rounds the position in its own favour, so allow at most 1 part per million
            // (plus 2 units) below the quoted value; the caller's min_amounts_out is the real protection.
            let tolerance = out / 1_000_000 + 2;
            if received < out - tolerance || received > out + tolerance {
                return Err(Error::UnexpectedBalance);
            }
        }
        // The caller's minimum applies to what was actually received, not to the quote.
        if min_amounts_out.get(0).unwrap_or(0) > received {
            return Err(Error::SlippageExceeded);
        }
        // Drop the stored account if XOXNO closed it (the NFT is burned when the position empties).
        if !xc.try_account_exists(&acct).map(|r| r.unwrap_or(false)).unwrap_or(true) {
            env.storage().instance().remove(&DataKey::Account);
        }

        let principal_now = get_i128(&env, DataKey::Principal);
        let principal_out = mul_div_floor(&env, principal_now, shares, ts)
            .unwrap_or(0)
            .min(principal_now);
        set_shares(&env, &from, bal - shares);
        env.storage().instance().set(&DataKey::TotalShares, &(ts - shares));
        env.storage()
            .instance()
            .set(&DataKey::Principal, &(principal_now - principal_out));
        if ts == shares {
            env.storage().instance().set(&DataKey::Hwm, &PRICE_SCALE);
        }
        tok.transfer(&this, &from, &received);
        WithdrawEvent {
            from,
            shares,
            amount: received,
        }
        .publish(&env);
        Ok(vec![&env, received])
    }

    /// `[underlying]`. Never panics: any read failure or empty vault quotes `[0]`.
    pub fn get_asset_amounts_per_shares(env: Env, shares: i128) -> Vec<i128> {
        let zero = vec![&env, 0i128];
        let ts = total_shares(&env);
        if shares <= 0 || ts <= 0 || env.storage().instance().get::<_, Address>(&DataKey::Controller).is_none() {
            return zero;
        }
        let Some(value) = position_value(&env) else { return zero };
        vec![&env, mul_div_floor(&env, shares, value, ts).unwrap_or(0)]
    }

    // ------------------------------------------------------- Peridot extensions

    pub fn underlying(env: Env) -> Address {
        addr(&env, DataKey::Underlying)
    }
    pub fn kind(_env: Env) -> Symbol {
        symbol_short!("xoxno")
    }
    /// The only address allowed to deposit (a Peridot receipt-vault market, or the owner's wallet).
    pub fn market(env: Env) -> Address {
        addr(&env, DataKey::Depositor)
    }
    pub fn owner(env: Env) -> Address {
        addr(&env, DataKey::Owner)
    }
    pub fn admin(env: Env) -> Address {
        addr(&env, DataKey::Admin)
    }
    pub fn keeper(env: Env) -> Address {
        addr(&env, DataKey::Keeper)
    }
    /// The XOXNO account id (position NFT token id) held by this vault, if any.
    pub fn account_id(env: Env) -> Option<u64> {
        account(&env)
    }
    pub fn params(env: Env) -> VaultParams {
        VaultParams {
            owner: addr(&env, DataKey::Owner),
            depositor: addr(&env, DataKey::Depositor),
            underlying: addr(&env, DataKey::Underlying),
            controller: addr(&env, DataKey::Controller),
            pool: addr(&env, DataKey::Pool),
            hub_id: get_u32(&env, DataKey::HubId),
            spoke_id: get_u32(&env, DataKey::SpokeId),
            keeper: addr(&env, DataKey::Keeper),
            deposit_cap: get_i128(&env, DataKey::Cap),
            min_deposit: get_i128(&env, DataKey::MinDeposit),
            fee_bps: get_u32(&env, DataKey::FeeBps),
        }
    }

    /// `apy_hint_bps` is 0: reading XOXNO's pool rate needs the pool ABI and is not part of the interface.
    pub fn get_state(env: Env) -> VaultState {
        VaultState {
            kind: symbol_short!("xoxno"),
            underlying: addr(&env, DataKey::Underlying),
            total_shares: total_shares(&env),
            total_value: position_value(&env).unwrap_or(0),
            principal: get_i128(&env, DataKey::Principal),
            reserve: 0,
            last_harvest_ts: env.storage().instance().get(&DataKey::LastHarvestTs).unwrap_or(0),
            last_harvest_amount: get_i128(&env, DataKey::LastHarvestAmount),
            apy_hint_bps: 0,
            paused: is_paused(&env),
        }
    }

    /// Interest accrues inside the XOXNO position, so there is nothing to claim. The keeper call crystallizes
    /// the performance fee: dilution shares are minted to the owner. Returns the fee value in underlying.
    pub fn harvest(env: Env, keeper: Address, _min_out: i128) -> Result<i128, Error> {
        keeper.require_auth();
        if keeper != addr(&env, DataKey::Keeper) {
            return Err(Error::NotKeeper);
        }
        bump_instance(&env);
        let value = position_value(&env).ok_or(Error::XoxnoUnavailable)?;
        let (fee_value, fee_shares) = accrue_fee(&env, value)?;
        env.storage().instance().set(&DataKey::LastHarvestTs, &env.ledger().timestamp());
        env.storage().instance().set(&DataKey::LastHarvestAmount, &fee_value);
        HarvestEvent { fee_value, fee_shares }.publish(&env);
        Ok(fee_value)
    }

    /// Owner or protocol admin.
    pub fn set_keeper(env: Env, admin: Address, keeper: Address) -> Result<(), Error> {
        require_owner_or_admin(&env, &admin)?;
        bump_instance(&env);
        env.storage().instance().set(&DataKey::Keeper, &keeper);
        KeeperEvent { keeper }.publish(&env);
        Ok(())
    }

    /// Pausing blocks new deposits only. Withdrawals stay open. Owner or protocol admin.
    pub fn pause(env: Env, admin: Address, paused: bool) -> Result<(), Error> {
        require_owner_or_admin(&env, &admin)?;
        bump_instance(&env);
        env.storage().instance().set(&DataKey::Paused, &paused);
        PausedEvent { paused }.publish(&env);
        Ok(())
    }

    /// Owner only. Any value above zero (and `min_deposit` stays valid). Lowering below the current value
    /// only blocks new deposits.
    pub fn set_deposit_cap(env: Env, owner: Address, cap: i128) -> Result<(), Error> {
        require_owner(&env, &owner)?;
        validate_params(cap, get_i128(&env, DataKey::MinDeposit), get_u32(&env, DataKey::FeeBps))?;
        bump_instance(&env);
        env.storage().instance().set(&DataKey::Cap, &cap);
        CapEvent { cap }.publish(&env);
        Ok(())
    }

    /// Owner only, at most `MAX_FEE_BPS`. Accrued fee at the old rate is crystallized first, so a change never
    /// applies retroactively.
    pub fn set_fee_bps(env: Env, owner: Address, fee_bps: u32) -> Result<(), Error> {
        require_owner(&env, &owner)?;
        validate_params(get_i128(&env, DataKey::Cap), get_i128(&env, DataKey::MinDeposit), fee_bps)?;
        bump_instance(&env);
        let value = position_value(&env).ok_or(Error::XoxnoUnavailable)?;
        accrue_fee(&env, value)?;
        env.storage().instance().set(&DataKey::FeeBps, &fee_bps);
        FeeEvent { fee_bps }.publish(&env);
        Ok(())
    }

    /// One-time, owner only, only while the vault holds no shares: makes `market` (a Peridot receipt-vault)
    /// the only depositor, so the vault can serve as that market's yield route. Peridot's market factory
    /// additionally requires the admin to allowlist this vault (`set_yield_vault_allowed`).
    pub fn bind_market(env: Env, owner: Address, market: Address) -> Result<(), Error> {
        require_owner(&env, &owner)?;
        if env.storage().instance().get(&DataKey::Bound).unwrap_or(false) {
            return Err(Error::AlreadyBound);
        }
        if total_shares(&env) != 0 {
            return Err(Error::HasShares);
        }
        bump_instance(&env);
        env.storage().instance().set(&DataKey::Depositor, &market);
        env.storage().instance().set(&DataKey::Bound, &true);
        BoundEvent { market }.publish(&env);
        Ok(())
    }

    /// What `market-factory.check_defindex` reads: one asset (the underlying) with one strategy (this vault).
    pub fn get_assets(env: Env) -> Vec<AssetStrategySet> {
        vec![
            &env,
            AssetStrategySet {
                address: addr(&env, DataKey::Underlying),
                strategies: vec![
                    &env,
                    Strategy {
                        address: env.current_contract_address(),
                        name: String::from_str(&env, "xoxno-lending"),
                        paused: is_paused(&env),
                    },
                ],
            },
        ]
    }

    /// Baked protocol admin only. Immediate, no timelock.
    pub fn upgrade(env: Env, admin: Address, new_wasm_hash: BytesN<32>) -> Result<(), Error> {
        if admin != addr(&env, DataKey::Admin) {
            return Err(Error::NotAdmin);
        }
        admin.require_auth();
        UpgradedEvent {
            new_wasm_hash: new_wasm_hash.clone(),
        }
        .publish(&env);
        env.deployer().update_current_contract_wasm(new_wasm_hash);
        Ok(())
    }
}
