//! Blend route: a `YieldVault` (00 section 6.1) adapter over a Blend fee vault (script3/fee-vault).
//!
//! One adapter instance serves exactly one Peridot market (the receipt-vault of that market is the only
//! depositor). Inside the Blend fee vault the adapter is a single `user`: its position is
//! `fee_vault.get_underlying_tokens(underlying, adapter)`. The adapter keeps its own SEP-41 style share
//! ledger on top (the receipt-vault reads `balance` and `total_supply` of the boosted vault).
//!
//! Auth: the fee vault calls `user.require_auth()` with the adapter as `user`. That call is made by the
//! adapter itself, so it needs no entry. The nested `pool.submit(fee_vault, adapter, adapter, [Supply])`
//! and its child `underlying.transfer(adapter, pool, amount)` do need the adapter's authorization, which the
//! adapter grants with `authorize_as_current_contract` immediately before `fee_vault.deposit`. Withdrawals
//! need no pre-authorization (the pool authorizes the fee vault as its direct invoker).
//!
//! BLND emissions: the fee vault only exposes `claim_emissions` to ITS admin (positions are owned by the
//! fee vault, not by depositors), so nothing accrues to this adapter and `harvest` returns 0.
#![no_std]

use peridot_interfaces::VaultState;
use soroban_sdk::{
    auth::{ContractContext, InvokerContractAuthEntry, SubContractInvocation},
    contract, contractclient, contracterror, contractevent, contractimpl, contracttype,
    symbol_short, token, vec, Address, BytesN, Env, IntoVal, Symbol, Val, Vec, U256,
};

#[cfg(test)]
mod test;

const DAY_LEDGERS: u32 = 17_280;
const TTL_THRESHOLD: u32 = 30 * DAY_LEDGERS;
const TTL_BUMP: u32 = 60 * DAY_LEDGERS;

/// Blend `Request` type 0: supply (non-collateral lending position).
const REQUEST_SUPPLY: u32 = 0;

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
    /// The share price cannot be computed (shares outstanding but zero value). Deposits are refused.
    VaultImpaired = 11,
    /// The fee vault could not be read.
    BlendUnavailable = 12,
    /// The Blend pool lacks the liquidity for this withdrawal. No state was changed.
    LiquidityShortfall = 13,
    BlendDepositFailed = 14,
    /// The token balance moved by a different amount than requested (fee on transfer or a faulty fee vault).
    UnexpectedBalance = 15,
    PoolMismatch = 16,
    ReserveNotEnabled = 17,
}

/// Constructor configuration. `blend_pool` must equal `fee_vault.get_pool()` (checked in the constructor).
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct BlendAdapterConfig {
    pub fee_vault: Address,
    pub blend_pool: Address,
}

/// Mirror of Blend's pool `Request` (blend-contract-sdk 2.22). Field names and types must match exactly.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Request {
    pub address: Address,
    pub amount: i128,
    pub request_type: u32,
}

/// Mirror of the fee vault's `ReserveVault` (script3/fee-vault 1ab9835).
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct FeeVaultReserve {
    pub accrued_fees: i128,
    pub address: Address,
    pub b_rate: i128,
    pub last_update_timestamp: u64,
    pub total_b_tokens: i128,
    pub total_shares: i128,
}

/// The subset of the Blend fee vault the adapter calls.
#[contractclient(name = "FeeVaultClient")]
pub trait FeeVaultApi {
    fn deposit(env: Env, reserve: Address, user: Address, amount: i128) -> i128;
    fn withdraw(env: Env, reserve: Address, user: Address, amount: i128) -> i128;
    fn get_underlying_tokens(env: Env, reserve: Address, user: Address) -> i128;
    fn get_pool(env: Env) -> Address;
    fn get_reserve_vault(env: Env, reserve: Address) -> FeeVaultReserve;
}

#[contracttype]
#[derive(Clone)]
enum DataKey {
    Admin,
    Market,
    Underlying,
    Config,
    Keeper,
    Paused,
    TotalShares,
    /// Underlying deposited and not yet withdrawn (pro rata), for yield reporting only.
    Principal,
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

#[contractevent(topics = ["upgraded"])]
pub struct UpgradedEvent {
    pub new_wasm_hash: BytesN<32>,
}

#[contract]
pub struct BlendVaultAdapter;

fn bump_instance(env: &Env) {
    env.storage().instance().extend_ttl(TTL_THRESHOLD, TTL_BUMP);
}

fn get_addr(env: &Env, key: &DataKey) -> Address {
    env.storage().instance().get(key).expect("not initialized")
}

fn config(env: &Env) -> BlendAdapterConfig {
    env.storage()
        .instance()
        .get(&DataKey::Config)
        .expect("not initialized")
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

fn shares_of(env: &Env, id: &Address) -> i128 {
    env.storage()
        .persistent()
        .get(&DataKey::Shares(id.clone()))
        .unwrap_or(0)
}

fn set_shares(env: &Env, id: &Address, amount: i128) {
    let key = DataKey::Shares(id.clone());
    env.storage().persistent().set(&key, &amount);
    env.storage()
        .persistent()
        .extend_ttl(&key, TTL_THRESHOLD, TTL_BUMP);
}

fn require_admin(env: &Env, admin: &Address) -> Result<(), Error> {
    let stored: Address = get_addr(env, &DataKey::Admin);
    if &stored != admin {
        return Err(Error::NotAdmin);
    }
    admin.require_auth();
    Ok(())
}

/// `a * b / c` rounded down, without intermediate overflow. `None` on a non-positive divisor, a negative
/// input or a result that does not fit in i128.
fn mul_div_floor(env: &Env, a: i128, b: i128, c: i128) -> Option<i128> {
    if a < 0 || b < 0 || c <= 0 {
        return None;
    }
    let r = U256::from_u128(env, a as u128)
        .mul(&U256::from_u128(env, b as u128))
        .div(&U256::from_u128(env, c as u128));
    r.to_u128().and_then(|v| i128::try_from(v).ok())
}

/// The adapter's position in the fee vault, in underlying (rounded down by the fee vault). `None` if the
/// fee vault cannot be read.
fn position_value(env: &Env, cfg: &BlendAdapterConfig, underlying: &Address) -> Option<i128> {
    let client = FeeVaultClient::new(env, &cfg.fee_vault);
    match client.try_get_underlying_tokens(underlying, &env.current_contract_address()) {
        Ok(Ok(v)) if v >= 0 => Some(v),
        _ => None,
    }
}

#[contractimpl]
impl BlendVaultAdapter {
    /// `admin` is the market-factory. Verifies the fee vault wraps `cfg.blend_pool` and has a reserve vault
    /// for `underlying`, so a misconfigured adapter can never be deployed.
    pub fn __constructor(
        env: Env,
        admin: Address,
        market: Address,
        underlying: Address,
        cfg: BlendAdapterConfig,
    ) -> Result<(), Error> {
        let fv = FeeVaultClient::new(&env, &cfg.fee_vault);
        match fv.try_get_pool() {
            Ok(Ok(pool)) if pool == cfg.blend_pool => {}
            _ => return Err(Error::PoolMismatch),
        }
        match fv.try_get_reserve_vault(&underlying) {
            Ok(Ok(_)) => {}
            _ => return Err(Error::ReserveNotEnabled),
        }
        let s = env.storage().instance();
        s.set(&DataKey::Admin, &admin);
        s.set(&DataKey::Market, &market);
        s.set(&DataKey::Underlying, &underlying);
        s.set(&DataKey::Config, &cfg);
        s.set(&DataKey::Paused, &false);
        s.set(&DataKey::TotalShares, &0i128);
        s.set(&DataKey::Principal, &0i128);
        bump_instance(&env);
        Ok(())
    }

    // ---------------------------------------------------------------- YieldVault

    /// SEP-41 style share balance.
    pub fn balance(env: Env, id: Address) -> i128 {
        shares_of(&env, &id)
    }

    /// SEP-41 style total share supply. The receipt-vault calls this when it redeems (not part of the
    /// `YieldVault` trait; see the SPECS "Blend route" section).
    pub fn total_supply(env: Env) -> i128 {
        total_shares(&env)
    }

    /// Only the market can deposit. Pulls exactly `token.transfer(market, this, amounts_desired[0])` (the
    /// call the receipt-vault pre-authorizes), supplies it to the Blend fee vault and mints shares against
    /// the position value measured BEFORE the supply. `invest` is ignored (always invests).
    pub fn deposit(
        env: Env,
        amounts_desired: Vec<i128>,
        amounts_min: Vec<i128>,
        from: Address,
        _invest: bool,
    ) -> Result<Vec<i128>, Error> {
        let market: Address = get_addr(&env, &DataKey::Market);
        if from != market {
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

        // Shares are priced against the value BEFORE this deposit (round down).
        let ts = total_shares(&env);
        let shares = if ts == 0 {
            amount
        } else {
            let value = position_value(&env, &cfg, &underlying).ok_or(Error::BlendUnavailable)?;
            if value == 0 {
                return Err(Error::VaultImpaired);
            }
            mul_div_floor(&env, amount, ts, value).ok_or(Error::Overflow)?
        };
        if shares <= 0 {
            return Err(Error::ZeroShares);
        }

        let tok = token::Client::new(&env, &underlying);
        let bal_before = tok.balance(&this);
        // Exactly the transfer the receipt-vault authorizes.
        tok.transfer(&from, &this, &amount);
        if tok.balance(&this) - bal_before != amount {
            return Err(Error::UnexpectedBalance);
        }

        // Nested authorization: pool.submit(fee_vault, this, this, [Supply]) -> underlying.transfer(this, pool, amount).
        let requests: Vec<Request> = vec![
            &env,
            Request {
                address: underlying.clone(),
                amount,
                request_type: REQUEST_SUPPLY,
            },
        ];
        let submit_args: Vec<Val> = (
            cfg.fee_vault.clone(),
            this.clone(),
            this.clone(),
            requests,
        )
            .into_val(&env);
        let transfer_args: Vec<Val> = (this.clone(), cfg.blend_pool.clone(), amount).into_val(&env);
        let auths = vec![
            &env,
            InvokerContractAuthEntry::Contract(SubContractInvocation {
                context: ContractContext {
                    contract: cfg.blend_pool.clone(),
                    fn_name: Symbol::new(&env, "submit"),
                    args: submit_args,
                },
                sub_invocations: vec![
                    &env,
                    InvokerContractAuthEntry::Contract(SubContractInvocation {
                        context: ContractContext {
                            contract: underlying.clone(),
                            fn_name: symbol_short!("transfer"),
                            args: transfer_args,
                        },
                        sub_invocations: Vec::new(&env),
                    }),
                ],
            }),
        ];
        env.authorize_as_current_contract(auths);
        let fv = FeeVaultClient::new(&env, &cfg.fee_vault);
        match fv.try_deposit(&underlying, &this, &amount) {
            Ok(Ok(minted)) if minted > 0 => {}
            _ => return Err(Error::BlendDepositFailed),
        }
        if tok.balance(&this) != bal_before {
            return Err(Error::UnexpectedBalance);
        }

        let new_total = ts.checked_add(shares).ok_or(Error::Overflow)?;
        let new_bal = shares_of(&env, &from)
            .checked_add(shares)
            .ok_or(Error::Overflow)?;
        let new_principal = principal(&env)
            .checked_add(amount)
            .ok_or(Error::Overflow)?;
        set_shares(&env, &from, new_bal);
        env.storage().instance().set(&DataKey::TotalShares, &new_total);
        env.storage().instance().set(&DataKey::Principal, &new_principal);
        DepositEvent {
            from,
            amount,
            shares,
        }
        .publish(&env);
        Ok(vec![&env, amount])
    }

    /// Burns `shares` of `from` and pays the pro-rata underlying (round down) to `from`. Withdrawals stay
    /// open while paused. Fails with `LiquidityShortfall` (and changes nothing) if the Blend pool cannot
    /// release the funds.
    pub fn withdraw(
        env: Env,
        shares: i128,
        min_amounts_out: Vec<i128>,
        from: Address,
    ) -> Result<Vec<i128>, Error> {
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
        let this = env.current_contract_address();

        let value = position_value(&env, &cfg, &underlying).ok_or(Error::BlendUnavailable)?;
        let out = mul_div_floor(&env, shares, value, ts).ok_or(Error::Overflow)?;
        if out <= 0 {
            return Err(Error::InvalidAmount);
        }
        if min_amounts_out.get(0).unwrap_or(0) > out {
            return Err(Error::SlippageExceeded);
        }

        let tok = token::Client::new(&env, &underlying);
        let bal_before = tok.balance(&this);
        let fv = FeeVaultClient::new(&env, &cfg.fee_vault);
        match fv.try_withdraw(&underlying, &this, &out) {
            Ok(Ok(_)) => {}
            _ => return Err(Error::LiquidityShortfall),
        }
        if tok.balance(&this) - bal_before != out {
            return Err(Error::UnexpectedBalance);
        }

        let principal_now = principal(&env);
        let principal_out = mul_div_floor(&env, principal_now, shares, ts)
            .unwrap_or(0)
            .min(principal_now);
        set_shares(&env, &from, bal - shares);
        env.storage().instance().set(&DataKey::TotalShares, &(ts - shares));
        env.storage()
            .instance()
            .set(&DataKey::Principal, &(principal_now - principal_out));
        tok.transfer(&this, &from, &out);
        WithdrawEvent {
            from,
            shares,
            amount: out,
        }
        .publish(&env);
        Ok(vec![&env, out])
    }

    /// `[underlying]`. Never panics: any read failure or empty vault quotes `[0]`.
    pub fn get_asset_amounts_per_shares(env: Env, shares: i128) -> Vec<i128> {
        let zero = vec![&env, 0i128];
        let ts = total_shares(&env);
        if shares <= 0 || ts <= 0 {
            return zero;
        }
        let (Some(underlying), Some(cfg)) = (
            env.storage().instance().get::<_, Address>(&DataKey::Underlying),
            env.storage()
                .instance()
                .get::<_, BlendAdapterConfig>(&DataKey::Config),
        ) else {
            return zero;
        };
        let Some(value) = position_value(&env, &cfg, &underlying) else {
            return zero;
        };
        vec![&env, mul_div_floor(&env, shares, value, ts).unwrap_or(0)]
    }

    // ------------------------------------------------------- Peridot extensions

    pub fn underlying(env: Env) -> Address {
        get_addr(&env, &DataKey::Underlying)
    }

    pub fn kind(_env: Env) -> Symbol {
        symbol_short!("blend")
    }

    pub fn market(env: Env) -> Address {
        get_addr(&env, &DataKey::Market)
    }

    pub fn admin(env: Env) -> Address {
        get_addr(&env, &DataKey::Admin)
    }

    pub fn keeper(env: Env) -> Option<Address> {
        env.storage().instance().get(&DataKey::Keeper)
    }

    pub fn config(env: Env) -> BlendAdapterConfig {
        config(&env)
    }

    /// `principal` is the underlying still deposited (pro rata), so `total_value - principal` is the net
    /// yield after the fee vault's take rate. `apy_hint_bps` is 0: the fee vault does not expose a rate.
    pub fn get_state(env: Env) -> VaultState {
        let underlying: Address = get_addr(&env, &DataKey::Underlying);
        let cfg = config(&env);
        VaultState {
            kind: symbol_short!("blend"),
            underlying: underlying.clone(),
            total_shares: total_shares(&env),
            total_value: position_value(&env, &cfg, &underlying).unwrap_or(0),
            principal: principal(&env),
            reserve: 0,
            last_harvest_ts: 0,
            last_harvest_amount: 0,
            apy_hint_bps: 0,
            paused: is_paused(&env),
        }
    }

    /// BLND emissions are claimable only by the fee-vault admin (`claim_emissions` is admin only), never by
    /// a depositor, so there is nothing to harvest here. Returns 0.
    pub fn harvest(env: Env, keeper: Address, _min_out: i128) -> Result<i128, Error> {
        keeper.require_auth();
        let stored: Option<Address> = env.storage().instance().get(&DataKey::Keeper);
        if stored != Some(keeper) {
            return Err(Error::NotKeeper);
        }
        Ok(0)
    }

    pub fn set_keeper(env: Env, admin: Address, keeper: Address) -> Result<(), Error> {
        require_admin(&env, &admin)?;
        bump_instance(&env);
        env.storage().instance().set(&DataKey::Keeper, &keeper);
        KeeperEvent { keeper }.publish(&env);
        Ok(())
    }

    /// Pausing blocks new deposits only. Withdrawals stay open so the market can always redeem.
    pub fn pause(env: Env, admin: Address, paused: bool) -> Result<(), Error> {
        require_admin(&env, &admin)?;
        bump_instance(&env);
        env.storage().instance().set(&DataKey::Paused, &paused);
        PausedEvent { paused }.publish(&env);
        Ok(())
    }

    /// Immediate, no timelock.
    pub fn upgrade(env: Env, admin: Address, new_wasm_hash: BytesN<32>) -> Result<(), Error> {
        require_admin(&env, &admin)?;
        UpgradedEvent {
            new_wasm_hash: new_wasm_hash.clone(),
        }
        .publish(&env);
        env.deployer().update_current_contract_wasm(new_wasm_hash);
        Ok(())
    }
}
