//! Aquarius ladder vault.
//!
//! Depositors put in ONE token (`underlying`). The vault splits it across a LADDER of adjacent Aquarius
//! concentrated-liquidity ranges ("rungs") around the current price, earns swap fees and AQUA, and a keeper
//! recentres the ladder when the price drifts. Shares are priced against the vault's net asset value (NAV),
//! marked at the pool's own spot price.
//!
//! Built to be deployed by `vault-factory` (constructor = owner-set config, all bounds enforced here) and to
//! plug into a Peridot market as a DeFindex-shaped yield vault with NO market-factory change: it exposes
//! `get_assets`, `get_asset_amounts_per_shares`, `balance`, `total_supply`, `deposit(amounts_desired,
//! amounts_min, from, invest)` and `withdraw(shares, min_amounts_out, from)`.
//!
//! TRUST MODEL (see docs/ui/VAULTS-UI.md):
//! - There is NO function that lets the owner or keeper move depositor funds to an arbitrary address. The
//!   only token outflows are: share redemptions to the redeemer, pool interactions (deposit/withdraw
//!   position, swap) with the configured pool, and `sweep_extra` for tokens that are not the pool pair.
//! - The contract has no upgrade path (immutable). Config is fixed at creation except: keeper, deposit cap
//!   (any value), performance fee (can only go down), pause, and the one-time market binding.
//! - Pause blocks deposits and rebalances only. Withdrawals (and in-kind exits) are always open.
//! - The keeper can only call `rebalance` and `harvest`, both bounded by the owner-set cooldown, trigger and
//!   slippage guard; it cannot choose ranges, amounts or destinations.
//! - NAV is marked at the pool's spot price, so a manipulated pool price moves the share price. Mitigations:
//!   deposit cap, swap slippage guard on every swap, in-kind exit, and the dead-share first deposit.
#![no_std]

mod ladder;
mod pool;

use ladder::{align_down, ladder as build_ladder, Rung};
use peridot_interfaces::VaultState;
use pool::ConcentratedPoolClient;
use soroban_sdk::{
    auth::{ContractContext, InvokerContractAuthEntry, SubContractInvocation},
    contract, contracterror, contractevent, contractimpl, contracttype, symbol_short, token, vec, Address,
    Env, IntoVal, String, Symbol, Val, Vec, U256,
};

#[cfg(test)]
mod test;

const TTL_THRESHOLD: u32 = 100_000;
const TTL_EXTEND_TO: u32 = 400_000;

/// First deposit must be at least this many raw units; `DEAD_SHARES` of it are locked forever (share inflation guard).
pub const MIN_FIRST_DEPOSIT: i128 = 100_000;
pub const DEAD_SHARES: i128 = 1_000;
/// Rebalances also deploy idle funds once idle exceeds this share of NAV (bps).
const IDLE_REDEPLOY_BPS: i128 = 100;
const SCALE: i128 = 1_000_000_000_000; // price-per-share scale for the performance fee high-water mark

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum Error {
    BadConfig = 1,
    NotOwner = 2,
    NotKeeper = 3,
    Paused = 4,
    NotMarket = 5,
    MarketAlreadyBound = 6,
    InvalidAmount = 7,
    CapExceeded = 8,
    Slippage = 9,
    InsufficientShares = 10,
    ZeroShares = 11,
    PriceUnavailable = 12,
    PoolUnavailable = 13,
    NotDue = 14,
    LossTooHigh = 15,
    UnexpectedBalance = 16,
    FirstDepositTooSmall = 17,
    FeeCanOnlyDecrease = 18,
    ProtectedToken = 19,
    Impaired = 20,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Config {
    pub owner: Address,
    pub pool: Address,
    pub underlying: Address,
    pub other: Address,
    /// Index of `underlying` in the pool's sorted token pair (0 or 1).
    pub u_idx: u32,
    pub rungs: u32,
    pub width_sp: u32,
    pub step_sp: u32,
    pub shape: u32,
    pub recenter_sp: u32,
    pub cooldown: u32,
    pub slippage_bps: u32,
    pub spacing: i32,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RungPos {
    pub lower: i32,
    pub upper: i32,
    pub liquidity: u128,
}

/// DeFindex-shaped asset descriptor so `market-factory.check_defindex` accepts this vault.
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

#[contracttype]
#[derive(Clone)]
enum DataKey {
    Config,
    Keeper,
    Market,
    Paused,
    Cap,
    FeeBps,
    TotalShares,
    Shares(Address),
    IdleU,
    IdleO,
    Rungs,
    LastRebalance,
    Center,
    Hwm,
    LastNav,
}

#[contractevent(topics = ["deposit"])]
pub struct DepositEvent {
    #[topic]
    pub from: Address,
    pub amount: i128,
    pub shares: i128,
}
#[contractevent(topics = ["withdraw"])]
pub struct WithdrawEvent {
    #[topic]
    pub from: Address,
    pub shares: i128,
    pub underlying_out: i128,
    pub other_out: i128,
}
#[contractevent(topics = ["rebalanced"])]
pub struct RebalancedEvent {
    pub by: Address,
    pub center_tick: i32,
    pub rungs: u32,
    pub value_in_ladder: i128,
    pub idle_value: i128,
}
#[contractevent(topics = ["harvest"])]
pub struct HarvestEvent {
    pub reward: i128,
}
#[contractevent(topics = ["fee"])]
pub struct FeeEvent {
    pub shares: i128,
}
#[contractevent(topics = ["set"])]
pub struct SettingEvent {
    pub name: Symbol,
}

#[contract]
pub struct AquariusVault;

// ------------------------------------------------------------------ storage helpers

fn bump(env: &Env) {
    env.storage().instance().extend_ttl(TTL_THRESHOLD, TTL_EXTEND_TO);
}
fn cfg(env: &Env) -> Config {
    env.storage().instance().get(&DataKey::Config).expect("not initialized")
}
fn get_i128(env: &Env, k: &DataKey) -> i128 {
    env.storage().instance().get(k).unwrap_or(0)
}
fn set_i128(env: &Env, k: &DataKey, v: i128) {
    env.storage().instance().set(k, &v);
}
fn paused(env: &Env) -> bool {
    env.storage().instance().get(&DataKey::Paused).unwrap_or(false)
}
fn total_shares(env: &Env) -> i128 {
    get_i128(env, &DataKey::TotalShares)
}
fn shares_of(env: &Env, a: &Address) -> i128 {
    env.storage().persistent().get(&DataKey::Shares(a.clone())).unwrap_or(0)
}
fn set_shares(env: &Env, a: &Address, v: i128) {
    let k = DataKey::Shares(a.clone());
    env.storage().persistent().set(&k, &v);
    env.storage().persistent().extend_ttl(&k, TTL_THRESHOLD, TTL_EXTEND_TO);
}
fn rungs(env: &Env) -> Vec<RungPos> {
    env.storage().instance().get(&DataKey::Rungs).unwrap_or(Vec::new(env))
}
fn bal(env: &Env, t: &Address) -> i128 {
    token::Client::new(env, t).balance(&env.current_contract_address())
}
fn mul_div(env: &Env, a: i128, b: i128, c: i128) -> Option<i128> {
    if a < 0 || b < 0 || c <= 0 {
        return None;
    }
    let r = U256::from_u128(env, a as u128).mul(&U256::from_u128(env, b as u128)).div(&U256::from_u128(env, c as u128));
    r.to_u128().and_then(|v| i128::try_from(v).ok())
}
fn require_owner(env: &Env, who: &Address) -> Result<Config, Error> {
    let c = cfg(env);
    if c.owner != *who {
        return Err(Error::NotOwner);
    }
    who.require_auth();
    Ok(c)
}

// ------------------------------------------------------------------ price maths

/// Spot sqrt price (Q96) and tick from the pool. Rejects prices outside 2^-32..2^32 so the U256 maths cannot overflow.
fn spot(env: &Env, c: &Config) -> Result<(U256, i32), Error> {
    let s0 = match ConcentratedPoolClient::new(env, &c.pool).try_get_slot0() {
        Ok(Ok(s)) => s,
        _ => return Err(Error::PoolUnavailable),
    };
    let lo = U256::from_u32(env, 1).shl(80);
    let hi = U256::from_u32(env, 1).shl(112);
    if s0.sqrt_price_x96 < lo || s0.sqrt_price_x96 > hi {
        return Err(Error::PriceUnavailable);
    }
    Ok((s0.sqrt_price_x96, s0.tick))
}
/// token0 amount -> token1 amount at the spot price.
fn mul_p(env: &Env, amount: i128, sqrt: &U256) -> Result<i128, Error> {
    if amount < 0 || amount > (1i128 << 100) {
        return Err(Error::PriceUnavailable);
    }
    let t1 = U256::from_u128(env, amount as u128).mul(sqrt).shr(96);
    let t2 = t1.mul(sqrt).shr(96);
    t2.to_u128().and_then(|v| i128::try_from(v).ok()).ok_or(Error::PriceUnavailable)
}
/// token1 amount -> token0 amount at the spot price.
fn div_p(env: &Env, amount: i128, sqrt: &U256) -> Result<i128, Error> {
    if amount < 0 || amount > (1i128 << 100) {
        return Err(Error::PriceUnavailable);
    }
    let t1 = U256::from_u128(env, amount as u128).shl(96).div(sqrt);
    let t2 = t1.shl(96).div(sqrt);
    t2.to_u128().and_then(|v| i128::try_from(v).ok()).ok_or(Error::PriceUnavailable)
}
fn other_to_u(env: &Env, c: &Config, amount_o: i128, sqrt: &U256) -> Result<i128, Error> {
    if amount_o == 0 {
        return Ok(0);
    }
    if c.u_idx == 0 { div_p(env, amount_o, sqrt) } else { mul_p(env, amount_o, sqrt) }
}
fn u_to_other(env: &Env, c: &Config, amount_u: i128, sqrt: &U256) -> Result<i128, Error> {
    if amount_u == 0 {
        return Ok(0);
    }
    if c.u_idx == 0 { mul_p(env, amount_u, sqrt) } else { div_p(env, amount_u, sqrt) }
}
/// (amount of underlying, amount of other) from a pool-ordered `[a0, a1]` pair.
fn split(c: &Config, v: &Vec<u128>) -> (i128, i128) {
    let a0 = v.get(0).unwrap_or(0) as i128;
    let a1 = v.get(1).unwrap_or(0) as i128;
    if c.u_idx == 0 { (a0, a1) } else { (a1, a0) }
}
/// pool-ordered pair from (underlying, other)
fn order(env: &Env, c: &Config, u: i128, o: i128) -> Vec<u128> {
    if c.u_idx == 0 { vec![env, u as u128, o as u128] } else { vec![env, o as u128, u as u128] }
}

/// Net asset value in underlying units: idle + unclaimed fees + every rung at the spot price.
fn nav(env: &Env, c: &Config, sqrt: &U256) -> Result<i128, Error> {
    let pool = ConcentratedPoolClient::new(env, &c.pool);
    let me = env.current_contract_address();
    let mut u = get_i128(env, &DataKey::IdleU);
    let mut o = get_i128(env, &DataKey::IdleO);
    for r in rungs(env).iter() {
        if r.liquidity == 0 {
            continue;
        }
        match pool.try_estimate_withdraw_position(&me, &r.lower, &r.upper, &r.liquidity) {
            Ok(Ok(v)) => {
                let (a, b) = split(c, &v);
                u += a;
                o += b;
            }
            _ => return Err(Error::PoolUnavailable),
        }
    }
    if !rungs(env).is_empty() {
        if let Ok(Ok(f)) = pool.try_get_all_position_fees(&me) {
            let (a, b) = split(c, &f);
            u += a;
            o += b;
        }
    }
    Ok(u + other_to_u(env, c, o, sqrt)?)
}

fn auth_transfer(env: &Env, tok: &Address, to: &Address, amount: i128) -> InvokerContractAuthEntry {
    let args: Vec<Val> = (env.current_contract_address(), to.clone(), amount).into_val(env);
    InvokerContractAuthEntry::Contract(SubContractInvocation {
        context: ContractContext { contract: tok.clone(), fn_name: symbol_short!("transfer"), args },
        sub_invocations: Vec::new(env),
    })
}

/// Swap `amount_in` of `in_tok` through the configured pool. The Aquarius pool does not call `require_auth`
/// on swap, so the token transfer entry sits at the ROOT of the authorization list. Output must be at least
/// `expected_out * (1 - slippage)` where `expected_out` is the spot-priced value. Returns the amount received.
fn swap_guarded(env: &Env, c: &Config, in_is_underlying: bool, amount_in: i128, expected_out: i128) -> Result<i128, Error> {
    if amount_in <= 0 {
        return Ok(0);
    }
    let pool = ConcentratedPoolClient::new(env, &c.pool);
    let (in_idx, out_idx, in_tok, out_tok) = if in_is_underlying {
        (c.u_idx, 1 - c.u_idx, &c.underlying, &c.other)
    } else {
        (1 - c.u_idx, c.u_idx, &c.other, &c.underlying)
    };
    let est = match pool.try_estimate_swap(&in_idx, &out_idx, &(amount_in as u128)) {
        Ok(Ok(v)) => v as i128,
        _ => return Err(Error::PoolUnavailable),
    };
    let floor = mul_div(env, expected_out, 10_000 - c.slippage_bps as i128, 10_000).ok_or(Error::PriceUnavailable)?;
    if est < floor {
        return Err(Error::Slippage);
    }
    let out_min = est.min(floor.max(1));
    let before_in = bal(env, in_tok);
    let before_out = bal(env, out_tok);
    env.authorize_as_current_contract(vec![env, auth_transfer(env, in_tok, &c.pool, amount_in)]);
    let me = env.current_contract_address();
    match pool.try_swap(&me, &in_idx, &out_idx, &(amount_in as u128), &(out_min as u128)) {
        Ok(Ok(_)) => {}
        _ => return Err(Error::PoolUnavailable),
    }
    let spent = before_in - bal(env, in_tok);
    let got = bal(env, out_tok) - before_out;
    if spent != amount_in || got < floor {
        return Err(Error::UnexpectedBalance);
    }
    Ok(got)
}

/// Mints performance-fee shares to the owner when price-per-share exceeds the high-water mark.
fn accrue_fee(env: &Env, c: &Config, nav_now: i128) {
    let ts = total_shares(env);
    let fee_bps = get_i128(env, &DataKey::FeeBps);
    if ts <= 0 || nav_now <= 0 {
        return;
    }
    let pps = match mul_div(env, nav_now, SCALE, ts) {
        Some(v) => v,
        None => return,
    };
    let hwm = get_i128(env, &DataKey::Hwm);
    if hwm == 0 || fee_bps == 0 {
        set_i128(env, &DataKey::Hwm, pps.max(hwm));
        return;
    }
    if pps <= hwm {
        return;
    }
    let gain = mul_div(env, pps - hwm, ts, SCALE).unwrap_or(0);
    let fee_value = mul_div(env, gain, fee_bps, 10_000).unwrap_or(0);
    if fee_value <= 0 || fee_value >= nav_now {
        return;
    }
    let fee_shares = mul_div(env, fee_value, ts, nav_now - fee_value).unwrap_or(0);
    if fee_shares <= 0 {
        return;
    }
    set_shares(env, &c.owner, shares_of(env, &c.owner) + fee_shares);
    let new_ts = ts + fee_shares;
    set_i128(env, &DataKey::TotalShares, new_ts);
    set_i128(env, &DataKey::Hwm, mul_div(env, nav_now, SCALE, new_ts).unwrap_or(pps));
    FeeEvent { shares: fee_shares }.publish(env);
}

fn deposit_inner(env: &Env, from: &Address, amount: i128, min_shares: i128) -> Result<i128, Error> {
    let c = cfg(env);
    if paused(env) {
        return Err(Error::Paused);
    }
    if amount <= 0 {
        return Err(Error::InvalidAmount);
    }
    if let Some(m) = env.storage().instance().get::<_, Address>(&DataKey::Market) {
        if m != *from {
            return Err(Error::NotMarket);
        }
    }
    bump(env);
    let (sqrt, _) = spot(env, &c)?;
    let ts = total_shares(env);
    let nav_before = if ts == 0 { 0 } else { nav(env, &c, &sqrt)? };
    if ts > 0 {
        accrue_fee(env, &c, nav_before);
    }
    let ts = total_shares(env);
    let cap = get_i128(env, &DataKey::Cap);
    if nav_before + amount > cap {
        return Err(Error::CapExceeded);
    }
    let shares = if ts == 0 {
        if amount < MIN_FIRST_DEPOSIT {
            return Err(Error::FirstDepositTooSmall);
        }
        // Lock DEAD_SHARES to the vault itself so the share price cannot be inflated by a donation.
        set_shares(env, &env.current_contract_address(), DEAD_SHARES);
        set_i128(env, &DataKey::TotalShares, DEAD_SHARES);
        amount - DEAD_SHARES
    } else {
        if nav_before <= 0 {
            return Err(Error::Impaired);
        }
        mul_div(env, amount, ts, nav_before).ok_or(Error::InvalidAmount)?
    };
    if shares <= 0 {
        return Err(Error::ZeroShares);
    }
    if shares < min_shares {
        return Err(Error::Slippage);
    }
    let tok = token::Client::new(env, &c.underlying);
    let before = bal(env, &c.underlying);
    tok.transfer(from, &env.current_contract_address(), &amount);
    if bal(env, &c.underlying) - before != amount {
        return Err(Error::UnexpectedBalance);
    }
    set_i128(env, &DataKey::IdleU, get_i128(env, &DataKey::IdleU) + amount);
    set_shares(env, from, shares_of(env, from) + shares);
    set_i128(env, &DataKey::TotalShares, total_shares(env) + shares);
    let nav_after = nav_before + amount;
    set_i128(env, &DataKey::LastNav, nav_after);
    if get_i128(env, &DataKey::Hwm) == 0 {
        set_i128(env, &DataKey::Hwm, mul_div(env, nav_after, SCALE, total_shares(env)).unwrap_or(0));
    }
    DepositEvent { from: from.clone(), amount, shares }.publish(env);
    Ok(shares)
}

/// Shared by `withdraw` (underlying out, swapping the other side) and `redeem_in_kind` (both tokens, no swap).
fn withdraw_inner(env: &Env, from: &Address, shares: i128, in_kind: bool) -> Result<(i128, i128), Error> {
    let c = cfg(env);
    if shares <= 0 {
        return Err(Error::InvalidAmount);
    }
    if shares_of(env, from) < shares {
        return Err(Error::InsufficientShares);
    }
    bump(env);
    let me = env.current_contract_address();
    let pool = ConcentratedPoolClient::new(env, &c.pool);
    let have_ladder = !rungs(env).is_empty();
    // Price is only needed to value fee accrual and the swap guard. In-kind exits must work even when it is unavailable.
    let sqrt = spot(env, &c).ok().map(|s| s.0);
    if let Some(s) = &sqrt {
        if let Ok(n) = nav(env, &c, s) {
            accrue_fee(env, &c, n);
        }
    }
    let ts = total_shares(env);

    // 1. collect every rung's accrued fees into idle so they are shared pro rata, not taken by the exiter.
    let bu0 = bal(env, &c.underlying);
    let bo0 = bal(env, &c.other);
    if have_ladder {
        if let Ok(Ok(f)) = pool.try_get_all_position_fees(&me) {
            if f.get(0).unwrap_or(0) + f.get(1).unwrap_or(0) > 0 {
                let _ = pool.try_claim_all_position_fees(&me);
            }
        }
    }
    let idle_u1 = get_i128(env, &DataKey::IdleU) + (bal(env, &c.underlying) - bu0);
    let idle_o1 = get_i128(env, &DataKey::IdleO) + (bal(env, &c.other) - bo0);

    // 2. burn the exiter's fraction of every rung (principal only: fees were just collected).
    let bu1 = bal(env, &c.underlying);
    let bo1 = bal(env, &c.other);
    let mut rs = rungs(env);
    for i in 0..rs.len() {
        let mut r = rs.get(i).unwrap();
        let burn = mul_div(env, r.liquidity as i128, shares, ts).unwrap_or(0) as u128;
        if burn == 0 {
            continue;
        }
        let min = vec![env, 0u128, 0u128];
        match pool.try_withdraw_position(&me, &r.lower, &r.upper, &burn, &min) {
            Ok(Ok(_)) => {}
            _ => return Err(Error::PoolUnavailable),
        }
        r.liquidity -= burn;
        rs.set(i, r);
    }
    let burned_u = bal(env, &c.underlying) - bu1;
    let burned_o = bal(env, &c.other) - bo1;

    // 3. entitlement = fraction of idle (incl. just-collected fees) + burned principal.
    let take_u = mul_div(env, idle_u1, shares, ts).unwrap_or(0);
    let take_o = mul_div(env, idle_o1, shares, ts).unwrap_or(0);
    let pay_u = take_u + burned_u;
    let pay_o = take_o + burned_o;
    set_i128(env, &DataKey::IdleU, idle_u1 - take_u);
    set_i128(env, &DataKey::IdleO, idle_o1 - take_o);
    env.storage().instance().set(&DataKey::Rungs, &rs);
    set_shares(env, from, shares_of(env, from) - shares);
    set_i128(env, &DataKey::TotalShares, ts - shares);

    let (out_u, out_o) = if in_kind {
        (pay_u, pay_o)
    } else if pay_o > 0 {
        let s = sqrt.clone().ok_or(Error::PriceUnavailable)?;
        let expected = other_to_u(env, &c, pay_o, &s)?;
        let got = swap_guarded(env, &c, false, pay_o, expected)?;
        (pay_u + got, 0)
    } else {
        (pay_u, 0)
    };
    if out_u > 0 {
        token::Client::new(env, &c.underlying).transfer(&me, from, &out_u);
    }
    if out_o > 0 {
        token::Client::new(env, &c.other).transfer(&me, from, &out_o);
    }
    if let Some(s) = &sqrt {
        if let Ok(n) = nav(env, &c, s) {
            set_i128(env, &DataKey::LastNav, n);
        }
    }
    WithdrawEvent { from: from.clone(), shares, underlying_out: out_u, other_out: out_o }.publish(env);
    Ok((out_u, out_o))
}

#[contractimpl]
impl AquariusVault {
    /// Owner-set configuration, validated against hard bounds. Any violation reverts the whole `create_vault`.
    /// Order (app: `kinds/aquarius.ts`): owner, pool, underlying, keeper, rungs, width_sp, step_sp, shape,
    /// recenter_sp, cooldown_secs, fee_bps, deposit_cap, slippage_bps.
    #[allow(clippy::too_many_arguments)]
    pub fn __constructor(
        env: Env,
        owner: Address,
        pool: Address,
        underlying: Address,
        keeper: Address,
        rungs: u32,
        width_sp: u32,
        step_sp: u32,
        shape: u32,
        recenter_sp: u32,
        cooldown_secs: u32,
        fee_bps: u32,
        deposit_cap: i128,
        slippage_bps: u32,
    ) -> Result<(), Error> {
        use ladder::*;
        if rungs == 0 || rungs > MAX_RUNGS || width_sp == 0 || width_sp > MAX_WIDTH_SP || step_sp == 0 || step_sp > MAX_STEP_SP
            || shape > 2 || recenter_sp == 0 || recenter_sp > MAX_RECENTER_SP
            || cooldown_secs < MIN_COOLDOWN_SECS || cooldown_secs > MAX_COOLDOWN_SECS
            || fee_bps > MAX_FEE_BPS || slippage_bps < MIN_SLIPPAGE_BPS || slippage_bps > MAX_SLIPPAGE_BPS
            || deposit_cap <= 0
        {
            return Err(Error::BadConfig);
        }
        if recenter_sp > max_recenter(rungs, width_sp, step_sp) {
            return Err(Error::BadConfig);
        }
        let p = ConcentratedPoolClient::new(&env, &pool);
        match p.try_pool_type() {
            Ok(Ok(t)) if t == Symbol::new(&env, "concentrated") => {}
            _ => return Err(Error::BadConfig),
        }
        let tokens = match p.try_get_tokens() {
            Ok(Ok(t)) if t.len() == 2 => t,
            _ => return Err(Error::BadConfig),
        };
        let (u_idx, other) = if tokens.get(0).unwrap() == underlying {
            (0u32, tokens.get(1).unwrap())
        } else if tokens.get(1).unwrap() == underlying {
            (1u32, tokens.get(0).unwrap())
        } else {
            return Err(Error::BadConfig);
        };
        let spacing = match p.try_get_tick_spacing() {
            Ok(Ok(s)) if s > 0 => s,
            _ => return Err(Error::BadConfig),
        };
        let half = ((rungs as i64 - 1) * step_sp as i64 + width_sp as i64) * spacing as i64 / 2;
        if half > MAX_HALF_SPAN_TICKS {
            return Err(Error::BadConfig);
        }
        let s = env.storage().instance();
        s.set(
            &DataKey::Config,
            &Config { owner, pool, underlying, other, u_idx, rungs, width_sp, step_sp, shape, recenter_sp, cooldown: cooldown_secs, slippage_bps, spacing },
        );
        s.set(&DataKey::Keeper, &keeper);
        s.set(&DataKey::Paused, &false);
        s.set(&DataKey::Cap, &deposit_cap);
        s.set(&DataKey::FeeBps, &(fee_bps as i128));
        s.set(&DataKey::TotalShares, &0i128);
        s.set(&DataKey::IdleU, &0i128);
        s.set(&DataKey::IdleO, &0i128);
        s.set(&DataKey::Rungs, &Vec::<RungPos>::new(&env));
        s.set(&DataKey::LastRebalance, &0u64);
        bump(&env);
        Ok(())
    }

    // ------------------------------------------------------------ shares (SEP-41 style reads)

    pub fn balance(env: Env, id: Address) -> i128 {
        shares_of(&env, &id)
    }
    pub fn total_supply(env: Env) -> i128 {
        total_shares(&env)
    }

    // ------------------------------------------------------------ deposits

    /// Wallet deposit of the underlying token. Open to anyone unless the vault is bound to a market.
    pub fn deposit_underlying(env: Env, from: Address, amount: i128, min_shares: i128) -> Result<i128, Error> {
        from.require_auth();
        deposit_inner(&env, &from, amount, min_shares)
    }

    /// DeFindex-shaped deposit used by a Peridot receipt-vault (`from` is the market). Pulls exactly
    /// `token.transfer(from, this, amounts_desired[0])`, the call the receipt-vault pre-authorizes.
    pub fn deposit(env: Env, amounts_desired: Vec<i128>, amounts_min: Vec<i128>, from: Address, _invest: bool) -> Result<Vec<i128>, Error> {
        from.require_auth();
        if amounts_desired.len() != 1 {
            return Err(Error::InvalidAmount);
        }
        let amount = amounts_desired.get(0).unwrap_or(0);
        if amounts_min.get(0).unwrap_or(0) > amount {
            return Err(Error::Slippage);
        }
        deposit_inner(&env, &from, amount, 0)?;
        Ok(vec![&env, amount])
    }

    // ------------------------------------------------------------ withdrawals (always open)

    /// Burns `shares` of `from` and pays the underlying token (the other side is swapped, guarded by the slippage cap).
    pub fn withdraw(env: Env, shares: i128, min_amounts_out: Vec<i128>, from: Address) -> Result<Vec<i128>, Error> {
        from.require_auth();
        let (u, _) = withdraw_inner(&env, &from, shares, false)?;
        if u < min_amounts_out.get(0).unwrap_or(0) {
            return Err(Error::Slippage);
        }
        Ok(vec![&env, u])
    }

    /// Wallet redemption, same as `withdraw` with a single minimum.
    pub fn redeem(env: Env, from: Address, shares: i128, min_underlying_out: i128) -> Result<i128, Error> {
        from.require_auth();
        let (u, _) = withdraw_inner(&env, &from, shares, false)?;
        if u < min_underlying_out {
            return Err(Error::Slippage);
        }
        Ok(u)
    }

    /// Emergency exit with no swap: pays the pro-rata share in BOTH pool tokens. Never blocked by pause or by a stressed pool price.
    pub fn redeem_in_kind(env: Env, from: Address, shares: i128) -> Result<(i128, i128), Error> {
        from.require_auth();
        withdraw_inner(&env, &from, shares, true)
    }

    /// `[underlying]`, never panics. Zero shares quote `[0]` (the receipt-vault probes the shape with 0).
    pub fn get_asset_amounts_per_shares(env: Env, shares: i128) -> Vec<i128> {
        let zero = vec![&env, 0i128];
        let ts = total_shares(&env);
        if shares <= 0 || ts <= 0 {
            return zero;
        }
        let Some(c) = env.storage().instance().get::<_, Config>(&DataKey::Config) else { return zero };
        let value = spot(&env, &c).and_then(|(s, _)| nav(&env, &c, &s)).unwrap_or_else(|_| get_i128(&env, &DataKey::LastNav));
        vec![&env, mul_div(&env, shares, value, ts).unwrap_or(0)]
    }

    // ------------------------------------------------------------ ladder management

    /// Owner or keeper. (Re)builds the ladder around the current price: withdraws every rung, swaps to the
    /// token mix the new rungs need, and deposits. Allowed when there is no ladder yet, or after the cooldown
    /// when the price drifted `recenter_sp` spacings from the ladder centre, or when idle funds exceed 1% of NAV.
    /// Reverts unless the swap loss stays within the slippage cap. Returns true when it rebuilt.
    pub fn rebalance(env: Env, caller: Address) -> Result<bool, Error> {
        caller.require_auth();
        let c = cfg(&env);
        let keeper: Address = env.storage().instance().get(&DataKey::Keeper).unwrap();
        if caller != c.owner && caller != keeper {
            return Err(Error::NotKeeper);
        }
        if paused(&env) {
            return Err(Error::Paused);
        }
        bump(&env);
        let pool = ConcentratedPoolClient::new(&env, &c.pool);
        let me = env.current_contract_address();
        let (sqrt, tick) = spot(&env, &c)?;
        let old = rungs(&env);
        let now = env.ledger().timestamp();
        let nav_now = nav(&env, &c, &sqrt)?;
        if nav_now <= 0 {
            return Err(Error::NotDue);
        }
        if !old.is_empty() {
            let last: u64 = env.storage().instance().get(&DataKey::LastRebalance).unwrap_or(0);
            if now < last + c.cooldown as u64 {
                return Err(Error::NotDue);
            }
            let center: i32 = env.storage().instance().get(&DataKey::Center).unwrap_or(0);
            let drift = (tick - center).abs() as i64;
            let drifted = drift >= c.recenter_sp as i64 * c.spacing as i64;
            let idle_val = get_i128(&env, &DataKey::IdleU) + other_to_u(&env, &c, get_i128(&env, &DataKey::IdleO), &sqrt)?;
            let idle_heavy = idle_val * 10_000 >= nav_now * IDLE_REDEPLOY_BPS;
            if !drifted && !idle_heavy {
                return Err(Error::NotDue);
            }
        }
        match pool.try_get_is_killed_deposit() {
            Ok(Ok(false)) => {}
            _ => return Err(Error::PoolUnavailable),
        }
        accrue_fee(&env, &c, nav_now);

        // 1. pull everything out of the old ladder (fees included) into idle.
        let (bu, bo) = (bal(&env, &c.underlying), bal(&env, &c.other));
        for r in old.iter() {
            if r.liquidity == 0 {
                continue;
            }
            let min = vec![&env, 0u128, 0u128];
            match pool.try_withdraw_position(&me, &r.lower, &r.upper, &r.liquidity, &min) {
                Ok(Ok(_)) => {}
                _ => return Err(Error::PoolUnavailable),
            }
        }
        // claim any fees still owed on already-empty positions is unnecessary: a full withdraw pays them out.
        let mut idle_u = get_i128(&env, &DataKey::IdleU) + (bal(&env, &c.underlying) - bu);
        let mut idle_o = get_i128(&env, &DataKey::IdleO) + (bal(&env, &c.other) - bo);
        let total_value = idle_u + other_to_u(&env, &c, idle_o, &sqrt)?;
        if total_value <= 0 {
            return Err(Error::NotDue);
        }

        // 2. new ladder around the aligned current tick.
        let base = align_down(tick, c.spacing);
        let mut lad = [Rung { lower: 0, upper: 0, weight_bps: 0 }; 7];
        build_ladder(c.rungs, c.width_sp, c.step_sp, c.shape, c.spacing, base, &mut lad);
        let n = c.rungs as usize;

        // 3. each rung's underlying share of its value: all-underlying above/below the price depending on the side, probe the straddling rung.
        let mut u_part = [0i128; 7];
        let mut o_part = [0i128; 7];
        let mut want_o_value = 0i128;
        for i in 0..n {
            let v = mul_div(&env, total_value, lad[i].weight_bps as i128, 10_000).unwrap();
            // rung entirely above the price holds token0 only; entirely below holds token1 only.
            let above = lad[i].lower > tick;
            let below = lad[i].upper <= tick;
            let u_frac_bps: i128 = if above {
                if c.u_idx == 0 { 10_000 } else { 0 }
            } else if below {
                if c.u_idx == 1 { 10_000 } else { 0 }
            } else {
                // straddling: ask the pool for the composition of a probe deposit
                let probe: u128 = 1_000_000_000_000u128;
                let q = match pool.try_estimate_deposit_position(&lad[i].lower, &lad[i].upper, &vec![&env, probe, probe]) {
                    Ok(Ok((a, _))) => a,
                    _ => return Err(Error::PoolUnavailable),
                };
                let (qu, qo) = split(&c, &q);
                let qo_val = other_to_u(&env, &c, qo, &sqrt)?;
                if qu + qo_val <= 0 {
                    return Err(Error::PoolUnavailable);
                }
                mul_div(&env, qu, 10_000, qu + qo_val).unwrap()
            };
            u_part[i] = mul_div(&env, v, u_frac_bps, 10_000).unwrap();
            o_part[i] = v - u_part[i];
            want_o_value += o_part[i];
        }

        // 4. one guarded swap to reach the token mix the ladder needs.
        let have_o_value = other_to_u(&env, &c, idle_o, &sqrt)?;
        if want_o_value > have_o_value + 1 {
            let spend = (want_o_value - have_o_value).min(idle_u);
            let expected = u_to_other(&env, &c, spend, &sqrt)?;
            let (b_u, b_o) = (bal(&env, &c.underlying), bal(&env, &c.other));
            swap_guarded(&env, &c, true, spend, expected)?;
            idle_u += bal(&env, &c.underlying) - b_u;
            idle_o += bal(&env, &c.other) - b_o;
        } else if have_o_value > want_o_value + 1 {
            let sell_value = have_o_value - want_o_value;
            let sell = u_to_other(&env, &c, sell_value, &sqrt)?.min(idle_o);
            let expected = other_to_u(&env, &c, sell, &sqrt)?;
            let (b_u, b_o) = (bal(&env, &c.underlying), bal(&env, &c.other));
            swap_guarded(&env, &c, false, sell, expected)?;
            idle_u += bal(&env, &c.underlying) - b_u;
            idle_o += bal(&env, &c.other) - b_o;
        }

        // 5. deposit each rung. Offered amounts are the rung's proportional share of what we actually hold.
        let sum_u: i128 = u_part[..n].iter().sum();
        let sum_o: i128 = o_part[..n].iter().sum();
        let mut new_rungs: Vec<RungPos> = Vec::new(&env);
        let mut in_ladder_value = 0i128;
        let (start_u, start_o) = (idle_u, idle_o);
        for i in 0..n {
            let du = if sum_u > 0 { mul_div(&env, start_u, u_part[i], sum_u).unwrap() } else { 0 };
            let dob = if sum_o > 0 { mul_div(&env, start_o, o_part[i], sum_o).unwrap() } else { 0 };
            let desired = order(&env, &c, du, dob);
            if du == 0 && dob == 0 {
                continue;
            }
            let (est_amts, est_liq) = match pool.try_estimate_deposit_position(&lad[i].lower, &lad[i].upper, &desired) {
                Ok(Ok(v)) => v,
                _ => continue, // leave this rung's cash idle; the next rebalance retries
            };
            let (au, ao) = split(&c, &est_amts);
            if est_liq == 0 || au > du || ao > dob || (au == 0 && ao == 0) {
                continue;
            }
            let min_liq = est_liq * (10_000 - c.slippage_bps as u128) / 10_000;
            let mut auths: Vec<InvokerContractAuthEntry> = Vec::new(&env);
            if au > 0 {
                auths.push_back(auth_transfer(&env, &c.underlying, &c.pool, au));
            }
            if ao > 0 {
                auths.push_back(auth_transfer(&env, &c.other, &c.pool, ao));
            }
            let (b_u, b_o) = (bal(&env, &c.underlying), bal(&env, &c.other));
            env.authorize_as_current_contract(auths);
            let minted = match pool.try_deposit_position(&me, &lad[i].lower, &lad[i].upper, &est_amts, &min_liq) {
                Ok(Ok((_, l))) => l,
                _ => return Err(Error::PoolUnavailable),
            };
            let spent_u = b_u - bal(&env, &c.underlying);
            let spent_o = b_o - bal(&env, &c.other);
            if spent_u != au || spent_o != ao || spent_u < 0 || spent_o < 0 {
                return Err(Error::UnexpectedBalance);
            }
            idle_u -= spent_u;
            idle_o -= spent_o;
            in_ladder_value += spent_u + other_to_u(&env, &c, spent_o, &sqrt)?;
            new_rungs.push_back(RungPos { lower: lad[i].lower, upper: lad[i].upper, liquidity: minted });
        }

        // 6. loss guard: swap fees and impact may cost at most the slippage cap; otherwise nothing happens.
        let idle_value = idle_u + other_to_u(&env, &c, idle_o, &sqrt)?;
        let after = in_ladder_value + idle_value;
        if after * 10_000 < total_value * (10_000 - c.slippage_bps as i128) {
            return Err(Error::LossTooHigh);
        }
        if new_rungs.is_empty() && !old.is_empty() {
            // nothing could be redeployed: keep the funds idle but do not pretend a ladder exists
        }
        set_i128(&env, &DataKey::IdleU, idle_u);
        set_i128(&env, &DataKey::IdleO, idle_o);
        env.storage().instance().set(&DataKey::Rungs, &new_rungs);
        env.storage().instance().set(&DataKey::LastRebalance, &now);
        let center_tick = (lad[0].lower + lad[n - 1].upper) / 2;
        env.storage().instance().set(&DataKey::Center, &center_tick);
        set_i128(&env, &DataKey::LastNav, after);
        RebalancedEvent { by: caller, center_tick: base, rungs: new_rungs.len(), value_in_ladder: in_ladder_value, idle_value }.publish(&env);
        Ok(true)
    }

    /// Owner or keeper. Claims AQUA emissions for the vault's positions. AQUA stays in the vault (see `sweep_extra`).
    pub fn harvest(env: Env, keeper: Address, _min_out: i128) -> Result<i128, Error> {
        keeper.require_auth();
        let c = cfg(&env);
        let k: Address = env.storage().instance().get(&DataKey::Keeper).unwrap();
        if keeper != c.owner && keeper != k {
            return Err(Error::NotKeeper);
        }
        bump(&env);
        let amount = match ConcentratedPoolClient::new(&env, &c.pool).try_claim(&env.current_contract_address()) {
            Ok(Ok(a)) => a as i128,
            _ => 0,
        };
        HarvestEvent { reward: amount }.publish(&env);
        Ok(amount)
    }

    /// Owner only. Sends any token that is NOT one of the pool pair (AQUA rewards, airdrops, mistaken transfers) to `to`.
    /// The two pool tokens can never leave through this function.
    pub fn sweep_extra(env: Env, owner: Address, tok: Address, to: Address) -> Result<i128, Error> {
        let c = require_owner(&env, &owner)?;
        if tok == c.underlying || tok == c.other {
            return Err(Error::ProtectedToken);
        }
        let amount = bal(&env, &tok);
        if amount > 0 {
            token::Client::new(&env, &tok).transfer(&env.current_contract_address(), &to, &amount);
        }
        Ok(amount)
    }

    // ------------------------------------------------------------ owner settings (bounded)

    pub fn set_keeper(env: Env, owner: Address, keeper: Address) -> Result<(), Error> {
        require_owner(&env, &owner)?;
        bump(&env);
        env.storage().instance().set(&DataKey::Keeper, &keeper);
        SettingEvent { name: Symbol::new(&env, "keeper") }.publish(&env);
        Ok(())
    }
    pub fn set_paused(env: Env, owner: Address, value: bool) -> Result<(), Error> {
        require_owner(&env, &owner)?;
        bump(&env);
        env.storage().instance().set(&DataKey::Paused, &value);
        SettingEvent { name: Symbol::new(&env, "paused") }.publish(&env);
        Ok(())
    }
    /// Peridot-style alias used by the YieldVault interface.
    pub fn pause(env: Env, admin: Address, paused_value: bool) -> Result<(), Error> {
        Self::set_paused(env, admin, paused_value)
    }
    pub fn set_cap(env: Env, owner: Address, cap: i128) -> Result<(), Error> {
        require_owner(&env, &owner)?;
        if cap <= 0 {
            return Err(Error::BadConfig);
        }
        bump(&env);
        env.storage().instance().set(&DataKey::Cap, &cap);
        SettingEvent { name: Symbol::new(&env, "cap") }.publish(&env);
        Ok(())
    }
    /// The performance fee can only be lowered after creation.
    pub fn lower_fee(env: Env, owner: Address, fee_bps: u32) -> Result<(), Error> {
        require_owner(&env, &owner)?;
        if fee_bps as i128 > get_i128(&env, &DataKey::FeeBps) {
            return Err(Error::FeeCanOnlyDecrease);
        }
        bump(&env);
        set_i128(&env, &DataKey::FeeBps, fee_bps as i128);
        SettingEvent { name: Symbol::new(&env, "fee") }.publish(&env);
        Ok(())
    }
    /// One time: restrict deposits to a Peridot market's receipt-vault. Cannot be changed afterwards.
    pub fn bind_market(env: Env, owner: Address, market: Address) -> Result<(), Error> {
        require_owner(&env, &owner)?;
        if env.storage().instance().has(&DataKey::Market) {
            return Err(Error::MarketAlreadyBound);
        }
        bump(&env);
        env.storage().instance().set(&DataKey::Market, &market);
        SettingEvent { name: Symbol::new(&env, "market") }.publish(&env);
        Ok(())
    }

    // ------------------------------------------------------------ views and DeFindex-shaped surface

    /// What `market-factory.check_defindex` reads: one asset (the underlying) with one strategy (this vault).
    pub fn get_assets(env: Env) -> Vec<AssetStrategySet> {
        let c = cfg(&env);
        vec![
            &env,
            AssetStrategySet {
                address: c.underlying,
                strategies: vec![
                    &env,
                    Strategy { address: env.current_contract_address(), name: String::from_str(&env, "aquarius-ladder"), paused: paused(&env) },
                ],
            },
        ]
    }
    pub fn underlying(env: Env) -> Address {
        cfg(&env).underlying
    }
    pub fn kind(_env: Env) -> Symbol {
        symbol_short!("aquarius")
    }
    /// The bound market, or this vault itself when unbound.
    pub fn market(env: Env) -> Address {
        env.storage().instance().get(&DataKey::Market).unwrap_or(env.current_contract_address())
    }
    pub fn owner(env: Env) -> Address {
        cfg(&env).owner
    }
    pub fn keeper(env: Env) -> Address {
        env.storage().instance().get(&DataKey::Keeper).unwrap()
    }
    pub fn get_config(env: Env) -> Config {
        cfg(&env)
    }
    pub fn get_rungs(env: Env) -> Vec<RungPos> {
        rungs(&env)
    }
    pub fn get_cap(env: Env) -> i128 {
        get_i128(&env, &DataKey::Cap)
    }
    pub fn get_fee_bps(env: Env) -> u32 {
        get_i128(&env, &DataKey::FeeBps) as u32
    }
    pub fn get_idle(env: Env) -> (i128, i128) {
        (get_i128(&env, &DataKey::IdleU), get_i128(&env, &DataKey::IdleO))
    }
    pub fn get_last_rebalance(env: Env) -> u64 {
        env.storage().instance().get(&DataKey::LastRebalance).unwrap_or(0)
    }
    pub fn is_paused(env: Env) -> bool {
        paused(&env)
    }
    /// Live NAV in underlying units. Errors if the pool is unreadable (use `get_state` for a fail-soft view).
    pub fn total_value(env: Env) -> Result<i128, Error> {
        let c = cfg(&env);
        let (s, _) = spot(&env, &c)?;
        nav(&env, &c, &s)
    }
    /// Cheap read for keepers: would `rebalance` do anything now?
    pub fn needs_rebalance(env: Env) -> bool {
        let c = cfg(&env);
        let Ok((s, tick)) = spot(&env, &c) else { return false };
        if paused(&env) {
            return false;
        }
        let old = rungs(&env);
        if old.is_empty() {
            return get_i128(&env, &DataKey::IdleU) > 0 || get_i128(&env, &DataKey::IdleO) > 0;
        }
        let now = env.ledger().timestamp();
        let last: u64 = env.storage().instance().get(&DataKey::LastRebalance).unwrap_or(0);
        if now < last + c.cooldown as u64 {
            return false;
        }
        let center: i32 = env.storage().instance().get(&DataKey::Center).unwrap_or(0);
        if ((tick - center).abs() as i64) >= c.recenter_sp as i64 * c.spacing as i64 {
            return true;
        }
        let Ok(n) = nav(&env, &c, &s) else { return false };
        let idle = get_i128(&env, &DataKey::IdleU) + other_to_u(&env, &c, get_i128(&env, &DataKey::IdleO), &s).unwrap_or(0);
        n > 0 && idle * 10_000 >= n * IDLE_REDEPLOY_BPS
    }
    pub fn get_state(env: Env) -> VaultState {
        let c = cfg(&env);
        let value = spot(&env, &c).and_then(|(s, _)| nav(&env, &c, &s)).unwrap_or_else(|_| get_i128(&env, &DataKey::LastNav));
        VaultState {
            kind: symbol_short!("aquarius"),
            underlying: c.underlying,
            total_shares: total_shares(&env),
            total_value: value,
            principal: 0,
            reserve: 0,
            last_harvest_ts: 0,
            last_harvest_amount: 0,
            apy_hint_bps: 0,
            paused: paused(&env),
        }
    }
}
