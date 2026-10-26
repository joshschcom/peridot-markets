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
/// Idle value (raw underlying units) below which a rebalance step is not worth a transaction.
const MIN_DEPLOY_VALUE: i128 = 100_000;
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
    /// This exit needs more pool unwinding than one transaction allows. Exit in smaller parts, or after wind-down.
    LiquidityBusy = 21,
    /// The pool price is outside the ladder: deposits wait for a rebalance (limits price-manipulation exposure).
    OutOfRange = 22,
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
    pub weight_bps: u32,
}

/// A rung of the target ladder that has not been funded yet.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PlanRung {
    pub lower: i32,
    pub upper: i32,
    pub weight_bps: u32,
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
    Plan,
    Unwinding,
    WindDown,
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
    // `estimate_withdraw_position` already includes the fees accrued by each position (verified on the deployed pool).
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
    if paused(env) || env.storage().instance().get::<_, bool>(&DataKey::WindDown).unwrap_or(false) {
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
    let (sqrt, tick) = spot(env, &c)?;
    let live = rungs(env);
    // Between rebalance steps part of the funds sit in the other token, valued at spot: deposits wait until the ladder is whole.
    let staged = env.storage().instance().get::<_, bool>(&DataKey::Unwinding).unwrap_or(false)
        || !env.storage().instance().get::<_, Vec<PlanRung>>(&DataKey::Plan).unwrap_or(Vec::new(env)).is_empty()
        || (live.is_empty() && other_to_u(env, &c, get_i128(env, &DataKey::IdleO), &sqrt)? >= MIN_DEPLOY_VALUE);
    if staged {
        return Err(Error::OutOfRange);
    }
    if !live.is_empty() {
        // Deposits are priced at the pool's spot, so refuse them while the price sits outside every rung: a manipulated
        // price inside the ladder moves NAV only slightly, one beyond it moves NAV a lot.
        let mut lo = i32::MAX;
        let mut hi = i32::MIN;
        for r in live.iter() {
            lo = lo.min(r.lower);
            hi = hi.max(r.upper);
        }
        if tick < lo || tick >= hi {
            return Err(Error::OutOfRange);
        }
    }
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

/// Pool burns allowed in one withdrawal. Concentrated-liquidity operations are expensive, so a withdrawal is paid from
/// idle funds first and then from at most this many rungs (the ones holding the most underlying, which also need no swap).
/// Larger exits are made in parts, or after the owner starts a wind-down (all rungs idle, atomic exits).
const MAX_BURNS_PER_WITHDRAW: u32 = 2;

/// Shared by `withdraw` (underlying out, other side swapped) and `redeem_in_kind` (tokens as they come, no swap).
/// The exiter is owed `shares / total_shares` of NAV. NAV counts idle funds, every rung at the spot price and unclaimed
/// fees. Whatever the pool pays beyond that stays in the vault for the remaining holders.
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
    let (sqrt, _) = spot(env, &c)?;
    let mut rs = rungs(env);
    let mut idle_u = get_i128(env, &DataKey::IdleU);
    let mut idle_o = get_i128(env, &DataKey::IdleO);

    // NAV, with each rung valued separately so the cheapest ones can be chosen.
    let mut rung_val = [0i128; 7];
    let mut rung_ufrac = [0i128; 7];
    let mut total = idle_u + other_to_u(env, &c, idle_o, &sqrt)?;
    for i in 0..rs.len() {
        let r = rs.get(i).unwrap();
        if r.liquidity == 0 {
            continue;
        }
        match pool.try_estimate_withdraw_position(&me, &r.lower, &r.upper, &r.liquidity) {
            Ok(Ok(v)) => {
                let (a, b) = split(&c, &v);
                let val = a + other_to_u(env, &c, b, &sqrt)?;
                rung_val[i as usize] = val;
                rung_ufrac[i as usize] = if val > 0 { a * 10_000 / val } else { 0 };
                total += val;
            }
            _ => return Err(Error::PoolUnavailable),
        }
    }
    accrue_fee(env, &c, total);
    let ts = total_shares(env);
    let pay_value = mul_div(env, total, shares, ts).ok_or(Error::InvalidAmount)?;

    // Burn the rungs holding the most underlying, at most MAX_BURNS_PER_WITHDRAW, until the idle funds cover the exit.
    let haircut = |v: i128| v * (10_000 - c.slippage_bps as i128) / 10_000;
    let covered = |iu: i128, io: i128| -> Result<i128, Error> {
        Ok(if in_kind { iu + other_to_u(env, &c, io, &sqrt)? } else { iu + haircut(other_to_u(env, &c, io, &sqrt)?) })
    };
    let mut burned = [false; 7];
    let mut burns = 0u32;
    while covered(idle_u, idle_o)? < pay_value && burns < MAX_BURNS_PER_WITHDRAW {
        let mut best: Option<usize> = None;
        for i in 0..rs.len() as usize {
            if burned[i] || rung_val[i] <= 0 || rs.get(i as u32).unwrap().liquidity == 0 {
                continue;
            }
            if best.map_or(true, |b| rung_ufrac[i] > rung_ufrac[b]) {
                best = Some(i);
            }
        }
        let Some(k) = best else { break };
        burned[k] = true;
        burns += 1;
        let need = pay_value - covered(idle_u, idle_o)?;
        let frac_bps = (need * 10_000 / rung_val[k] + 100).min(10_000);
        let mut r = rs.get(k as u32).unwrap();
        let burn = mul_div(env, r.liquidity as i128, frac_bps, 10_000).unwrap_or(0) as u128;
        if burn == 0 {
            continue;
        }
        let (bu, bo) = (bal(env, &c.underlying), bal(env, &c.other));
        let min = vec![env, 0u128, 0u128];
        match pool.try_withdraw_position(&me, &r.lower, &r.upper, &burn, &min) {
            Ok(Ok(_)) => {}
            _ => return Err(Error::PoolUnavailable),
        }
        idle_u += bal(env, &c.underlying) - bu;
        idle_o += bal(env, &c.other) - bo;
        r.liquidity -= burn;
        rs.set(k as u32, r);
    }

    let (out_u, out_o);
    if in_kind {
        let u = idle_u.min(pay_value);
        let rest = pay_value - u;
        let o = if rest > 0 { u_to_other(env, &c, rest, &sqrt)?.min(idle_o) } else { 0 };
        if u + other_to_u(env, &c, o, &sqrt)? < haircut(pay_value) {
            return Err(Error::LiquidityBusy);
        }
        out_u = u;
        out_o = o;
        idle_u -= u;
        idle_o -= o;
    } else {
        let mut loss = 0i128;
        if idle_u < pay_value && idle_o > 0 {
            let need_u = pay_value - idle_u;
            let sell = u_to_other(env, &c, need_u * 10_000 / (10_000 - c.slippage_bps as i128), &sqrt)?.min(idle_o);
            if sell > 0 {
                let expected = other_to_u(env, &c, sell, &sqrt)?;
                let got = swap_guarded(env, &c, false, sell, expected)?;
                idle_u += got;
                idle_o -= sell;
                // the exiter pays for the conversion (fee and price impact), not the holders who stay
                loss = (expected - got).max(0);
            }
        }
        let u = idle_u.min((pay_value - loss).max(0));
        if u < haircut(pay_value) {
            return Err(Error::LiquidityBusy);
        }
        out_u = u;
        out_o = 0;
        idle_u -= u;
    }
    set_i128(env, &DataKey::IdleU, idle_u);
    set_i128(env, &DataKey::IdleO, idle_o);
    // drop rungs that were burned completely (the pool rejects a zero-liquidity withdrawal later)
    let mut kept: Vec<RungPos> = Vec::new(env);
    for r in rs.iter() {
        if r.liquidity > 0 {
            kept.push_back(r);
        }
    }
    env.storage().instance().set(&DataKey::Rungs, &kept);
    set_shares(env, from, shares_of(env, from) - shares);
    set_i128(env, &DataKey::TotalShares, ts - shares);
    set_i128(env, &DataKey::LastNav, (total - pay_value).max(0));
    if out_u > 0 {
        token::Client::new(env, &c.underlying).transfer(&me, from, &out_u);
    }
    if out_o > 0 {
        token::Client::new(env, &c.other).transfer(&me, from, &out_o);
    }
    WithdrawEvent { from: from.clone(), shares, underlying_out: out_u, other_out: out_o }.publish(env);
    Ok((out_u, out_o))
}

/// sqrt(1.0001) in Q96 (floor), so sqrt(1.0001^t) = R96^t.
const R96: u128 = 79232123823359799118286999567;
/// Largest |tick| the in-contract price maths supports (price between about 2e-6 and 5e5).
const MAX_MATH_TICK: i32 = 131_000;

/// sqrt(1.0001^tick) as a Q96 number by square-and-multiply, accurate to about 1e-27 relative. No cross-contract call.
fn sqrt_at_tick(env: &Env, tick: i32) -> Result<U256, Error> {
    if tick.abs() > MAX_MATH_TICK {
        return Err(Error::PriceUnavailable);
    }
    let mut result = U256::from_u32(env, 1).shl(96);
    let mut base = U256::from_u128(env, R96);
    let mut t = tick.unsigned_abs();
    while t > 0 {
        if t & 1 == 1 {
            result = result.mul(&base).shr(96);
        }
        t >>= 1;
        if t > 0 {
            base = base.mul(&base).shr(96);
        }
    }
    if tick < 0 {
        result = U256::from_u32(env, 1).shl(192).div(&result);
    }
    Ok(result)
}

/// Per rung: how much of its target value (weight * total) is held in underlying vs other, at the given price.
/// Rungs entirely above the price hold token0 only, entirely below hold token1 only; the straddling rung's
/// composition is computed from the Uniswap v3 liquidity formulas (pure maths, no pool call).
#[allow(clippy::too_many_arguments)]
fn compose(
    env: &Env,
    c: &Config,
    lad: &[Rung; 7],
    bounds: &Vec<(U256, U256)>,
    n: usize,
    sqrt: &U256,
    total_value: i128,
) -> Result<([i128; 7], [i128; 7], i128), Error> {
    let mut u_part = [0i128; 7];
    let mut o_part = [0i128; 7];
    let mut want_o_value = 0i128;
    for i in 0..n {
        let v = mul_div(env, total_value, lad[i].weight_bps as i128, 10_000).unwrap_or(0);
        let (sa, sb) = bounds.get(i as u32).ok_or(Error::PriceUnavailable)?;
        let u_frac_bps: i128 = if *sqrt <= sa {
            if c.u_idx == 0 { 10_000 } else { 0 }
        } else if *sqrt >= sb {
            if c.u_idx == 1 { 10_000 } else { 0 }
        } else {
            let l = U256::from_u128(env, 1_000_000_000_000_000_000u128);
            let a1 = l.mul(&sqrt.sub(&sa)).shr(96).to_u128().ok_or(Error::PriceUnavailable)? as i128;
            let a0 = l.mul(&sb.sub(sqrt)).div(sqrt).shl(96).div(&sb).to_u128().ok_or(Error::PriceUnavailable)? as i128;
            let (qu, qo) = if c.u_idx == 0 { (a0, a1) } else { (a1, a0) };
            let qo_val = other_to_u(env, c, qo, sqrt)?;
            if qu + qo_val <= 0 {
                return Err(Error::PriceUnavailable);
            }
            mul_div(env, qu, 10_000, qu + qo_val).unwrap_or(0)
        };
        u_part[i] = mul_div(env, v, u_frac_bps, 10_000).unwrap_or(0);
        o_part[i] = v - u_part[i];
        want_o_value += o_part[i];
    }
    Ok((u_part, o_part, want_o_value))
}

const MAX_WITHDRAWS_PER_TX: u32 = 3;
const MAX_DEPOSITS_PER_TX: u32 = 2;

fn fresh_plan(env: &Env, c: &Config, tick: i32) -> Vec<PlanRung> {
    let base = align_down(tick, c.spacing);
    let mut lad = [Rung { lower: 0, upper: 0, weight_bps: 0 }; 7];
    build_ladder(c.rungs, c.width_sp, c.step_sp, c.shape, c.spacing, base, &mut lad);
    let mut plan = Vec::new(env);
    for r in lad.iter().take(c.rungs as usize) {
        plan.push_back(PlanRung { lower: r.lower, upper: r.upper, weight_bps: r.weight_bps });
    }
    plan
}
fn plan_center(plan: &Vec<PlanRung>) -> i32 {
    (plan.get(0).unwrap().lower + plan.get(plan.len() - 1).unwrap().upper) / 2
}

/// One funding transaction: at most one guarded swap, then up to MAX_DEPOSITS_PER_TX rungs of `plan` are deposited and
/// removed from it. Rungs the pool refuses are dropped from the plan (their share stays idle for a later top-up).
/// Returns the value (in underlying) deposited.
fn fund_step(env: &Env, c: &Config, pool: &ConcentratedPoolClient, plan: &mut Vec<PlanRung>) -> Result<i128, Error> {
    let me = env.current_contract_address();
    let (sqrt, _tick) = spot(env, c)?;
    let n = plan.len() as usize;
    if n == 0 {
        return Ok(0);
    }
    // weights renormalised over the rungs still to fund
    let wsum: u32 = plan.iter().map(|r| r.weight_bps).sum();
    let mut lad = [Rung { lower: 0, upper: 0, weight_bps: 0 }; 7];
    let mut acc = 0u32;
    for (i, r) in plan.iter().enumerate() {
        let w = if wsum == 0 { 10_000 / n as u32 } else { r.weight_bps * 10_000 / wsum };
        lad[i] = Rung { lower: r.lower, upper: r.upper, weight_bps: w };
        acc += w;
    }
    lad[0].weight_bps += 10_000 - acc;
    let mut bounds: Vec<(U256, U256)> = Vec::new(env);
    for r in lad.iter().take(n) {
        bounds.push_back((sqrt_at_tick(env, r.lower)?, sqrt_at_tick(env, r.upper)?));
    }
    let mut idle_u = get_i128(env, &DataKey::IdleU);
    let mut idle_o = get_i128(env, &DataKey::IdleO);
    let total_value = idle_u + other_to_u(env, c, idle_o, &sqrt)?;
    if total_value <= 0 {
        *plan = Vec::new(env);
        return Ok(0);
    }
    // one swap pass towards the mix the plan needs
    let (_, _, want_o_value) = compose(env, c, &lad, &bounds, n, &sqrt, total_value)?;
    let have_o_value = other_to_u(env, c, idle_o, &sqrt)?;
    let diff = want_o_value - have_o_value;
    let mut sqrt = sqrt;
    if diff.abs() * 10_000 >= total_value * 100 {
        let (b_u, b_o) = (bal(env, &c.underlying), bal(env, &c.other));
        if diff > 0 {
            let spend = diff.min(idle_u);
            let expected = u_to_other(env, c, spend, &sqrt)?;
            swap_guarded(env, c, true, spend, expected)?;
        } else {
            let sell = u_to_other(env, c, -diff, &sqrt)?.min(idle_o);
            let expected = other_to_u(env, c, sell, &sqrt)?;
            swap_guarded(env, c, false, sell, expected)?;
        }
        idle_u += bal(env, &c.underlying) - b_u;
        idle_o += bal(env, &c.other) - b_o;
        sqrt = spot(env, c)?.0;
    }
    let total_value = idle_u + other_to_u(env, c, idle_o, &sqrt)?;
    let (u_part, o_part, _) = compose(env, c, &lad, &bounds, n, &sqrt, total_value)?;
    let sum_u: i128 = u_part[..n].iter().sum();
    let sum_o: i128 = o_part[..n].iter().sum();
    let (start_u, start_o) = (idle_u, idle_o);
    let mut rs = rungs(env);
    let mut deposited = 0i128;
    let mut tries = 0u32;
    let mut remaining: Vec<PlanRung> = Vec::new(env);
    for i in 0..n {
        let r = plan.get(i as u32).unwrap();
        if tries >= MAX_DEPOSITS_PER_TX {
            remaining.push_back(r);
            continue;
        }
        tries += 1;
        let du = if sum_u > 0 { mul_div(env, start_u, u_part[i], sum_u).unwrap_or(0) } else { 0 };
        let dob = if sum_o > 0 { mul_div(env, start_o, o_part[i], sum_o).unwrap_or(0) } else { 0 };
        if du == 0 && dob == 0 {
            continue;
        }
        let desired = order(env, c, du, dob);
        let mut quote = match pool.try_estimate_deposit_position(&r.lower, &r.upper, &desired) {
            Ok(Ok(v)) => v,
            _ => continue,
        };
        // The pool rounds amounts up, so a quote can overshoot the offer by a unit. Offer 0.1% less and quote again.
        let overshoots = |q: &(Vec<u128>, u128)| {
            let (qu, qo) = split(c, &q.0);
            qu > du || qo > dob
        };
        if overshoots(&quote) {
            let less = order(env, c, du * 9_990 / 10_000, dob * 9_990 / 10_000);
            quote = match pool.try_estimate_deposit_position(&r.lower, &r.upper, &less) {
                Ok(Ok(v)) => v,
                _ => continue,
            };
        }
        let (est_amts, est_liq) = (quote.0.clone(), quote.1);
        let (au, ao) = split(c, &est_amts);
        if est_liq == 0 || au > du || ao > dob || (au == 0 && ao == 0) {
            continue;
        }
        let min_liq = est_liq * (10_000 - c.slippage_bps as u128) / 10_000;
        let mut auths: Vec<InvokerContractAuthEntry> = Vec::new(env);
        if au > 0 {
            auths.push_back(auth_transfer(env, &c.underlying, &c.pool, au));
        }
        if ao > 0 {
            auths.push_back(auth_transfer(env, &c.other, &c.pool, ao));
        }
        let (b_u, b_o) = (bal(env, &c.underlying), bal(env, &c.other));
        env.authorize_as_current_contract(auths);
        let minted = match pool.try_deposit_position(&me, &r.lower, &r.upper, &est_amts, &min_liq) {
            Ok(Ok((_, l))) => l,
            _ => return Err(Error::PoolUnavailable),
        };
        let spent_u = b_u - bal(env, &c.underlying);
        let spent_o = b_o - bal(env, &c.other);
        if spent_u != au || spent_o != ao || spent_u < 0 || spent_o < 0 {
            return Err(Error::UnexpectedBalance);
        }
        idle_u -= spent_u;
        idle_o -= spent_o;
        deposited += spent_u + other_to_u(env, c, spent_o, &sqrt)?;
        // add to an existing rung with the same range, or append a new one
        let mut found = false;
        for k in 0..rs.len() {
            let mut e = rs.get(k).unwrap();
            if e.lower == r.lower && e.upper == r.upper {
                e.liquidity += minted;
                rs.set(k, e);
                found = true;
                break;
            }
        }
        if !found {
            rs.push_back(RungPos { lower: r.lower, upper: r.upper, liquidity: minted, weight_bps: r.weight_bps });
        }
    }
    set_i128(env, &DataKey::IdleU, idle_u);
    set_i128(env, &DataKey::IdleO, idle_o);
    env.storage().instance().set(&DataKey::Rungs, &rs);
    *plan = remaining;
    Ok(deposited)
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
        s.set(&DataKey::Plan, &Vec::<PlanRung>::new(&env));
        s.set(&DataKey::Unwinding, &false);
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
        // A market must never be blocked by this vault: when deposits are closed (paused, wind-down, cap reached, price outside
        // the ladder) the call succeeds without taking funds, and the market keeps them as idle cash.
        match deposit_inner(&env, &from, amount, 0) {
            Ok(_) => Ok(vec![&env, amount]),
            Err(Error::Paused) | Err(Error::OutOfRange) | Err(Error::CapExceeded) => Ok(vec![&env, 0]),
            Err(e) => Err(e),
        }
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

    /// Exit with no swap: pays the share in BOTH pool tokens (still valued at the pool price, like every exit). Never blocked by pause.
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
        // Fails closed: when the pool price cannot be read the quote is 0 (integrators keep their last good value).
        let value = spot(&env, &c).and_then(|(s, _)| nav(&env, &c, &s)).unwrap_or(0);
        vec![&env, mul_div(&env, shares, value, ts).unwrap_or(0)]
    }

    // ------------------------------------------------------------ ladder management

    /// Owner or keeper. One STEP of ladder maintenance; call it again while `needs_rebalance()` is true. Pool operations on
    /// concentrated liquidity are expensive, so work is split into transactions of at most 3 withdrawals (unwinding the old
    /// ladder) or 2 deposits plus one guarded swap (funding the new one):
    /// 1. while unwinding: withdraw up to 3 old rungs into idle; when none is left, the new ladder is planned around the price.
    /// 2. while a plan exists: swap towards the token mix the planned rungs need, deposit up to 2 of them.
    /// 3. otherwise, after the cooldown and when the price drifted `recenter_sp` spacings from the ladder centre, start
    ///    unwinding; or, when idle funds exceed 1% of NAV, plan a top-up of the existing rungs.
    /// Returns true when it did something. Each swap is bounded by the owner-set slippage cap.
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
        let (sqrt, tick) = spot(&env, &c)?;
        let now = env.ledger().timestamp();
        let mut unwinding: bool = env.storage().instance().get(&DataKey::Unwinding).unwrap_or(false);
        let mut plan: Vec<PlanRung> = env.storage().instance().get(&DataKey::Plan).unwrap_or(Vec::new(&env));
        if env.storage().instance().get::<_, bool>(&DataKey::WindDown).unwrap_or(false) && !plan.is_empty() {
            plan = Vec::new(&env);
            env.storage().instance().set(&DataKey::Plan, &plan);
        }
        let live = rungs(&env);

        if !unwinding && plan.is_empty() {
            // idle ladder: decide whether anything is due
            let nav_now = nav(&env, &c, &sqrt)?;
            if live.is_empty() {
                if nav_now < MIN_DEPLOY_VALUE || env.storage().instance().get::<_, bool>(&DataKey::WindDown).unwrap_or(false) {
                    return Err(Error::NotDue);
                }
                plan = fresh_plan(&env, &c, tick);
                env.storage().instance().set(&DataKey::Center, &plan_center(&plan));
                env.storage().instance().set(&DataKey::LastRebalance, &now);
            } else {
                let last: u64 = env.storage().instance().get(&DataKey::LastRebalance).unwrap_or(0);
                let wind_now: bool = env.storage().instance().get(&DataKey::WindDown).unwrap_or(false);
                if now < last + c.cooldown as u64 && !wind_now {
                    return Err(Error::NotDue);
                }
                let center: i32 = env.storage().instance().get(&DataKey::Center).unwrap_or(0);
                let drifted = ((tick - center).abs() as i64) >= c.recenter_sp as i64 * c.spacing as i64;
                let idle_val = get_i128(&env, &DataKey::IdleU) + other_to_u(&env, &c, get_i128(&env, &DataKey::IdleO), &sqrt)?;
                let idle_heavy = idle_val >= MIN_DEPLOY_VALUE && idle_val * 10_000 >= nav_now * IDLE_REDEPLOY_BPS;
                let wind: bool = env.storage().instance().get(&DataKey::WindDown).unwrap_or(false);
                if wind {
                    accrue_fee(&env, &c, nav_now);
                    unwinding = true;
                } else if drifted {
                    accrue_fee(&env, &c, nav_now);
                    unwinding = true;
                } else if idle_heavy {
                    // top up the existing rungs with the idle funds
                    for r in live.iter() {
                        plan.push_back(PlanRung { lower: r.lower, upper: r.upper, weight_bps: r.weight_bps });
                    }
                } else {
                    return Err(Error::NotDue);
                }
                env.storage().instance().set(&DataKey::LastRebalance, &now);
            }
        }

        if unwinding {
            match pool.try_get_is_killed_deposit() {
                Ok(Ok(_)) => {}
                _ => return Err(Error::PoolUnavailable),
            }
            let mut rs = rungs(&env);
            let (bu, bo) = (bal(&env, &c.underlying), bal(&env, &c.other));
            let me = env.current_contract_address();
            let mut done = 0u32;
            while !rs.is_empty() && done < MAX_WITHDRAWS_PER_TX {
                let r = rs.get(rs.len() - 1).unwrap();
                if r.liquidity == 0 {
                    rs.pop_back();
                    continue;
                }
                let min = vec![&env, 0u128, 0u128];
                match pool.try_withdraw_position(&me, &r.lower, &r.upper, &r.liquidity, &min) {
                    Ok(Ok(_)) => {}
                    _ => return Err(Error::PoolUnavailable),
                }
                rs.pop_back();
                done += 1;
            }
            set_i128(&env, &DataKey::IdleU, get_i128(&env, &DataKey::IdleU) + (bal(&env, &c.underlying) - bu));
            set_i128(&env, &DataKey::IdleO, get_i128(&env, &DataKey::IdleO) + (bal(&env, &c.other) - bo));
            env.storage().instance().set(&DataKey::Rungs, &rs);
            if rs.is_empty() {
                // fully unwound: plan the new ladder around the CURRENT price
                let wind: bool = env.storage().instance().get(&DataKey::WindDown).unwrap_or(false);
                let new_plan = if wind { Vec::new(&env) } else { fresh_plan(&env, &c, tick) };
                if !wind {
                    env.storage().instance().set(&DataKey::Center, &plan_center(&new_plan));
                }
                env.storage().instance().set(&DataKey::Plan, &new_plan);
                env.storage().instance().set(&DataKey::Unwinding, &false);
                env.storage().instance().set(&DataKey::LastRebalance, &now);
            } else {
                env.storage().instance().set(&DataKey::Unwinding, &true);
            }
            RebalancedEvent { by: caller, center_tick: tick, rungs: rs.len(), value_in_ladder: 0, idle_value: 0 }.publish(&env);
            return Ok(true);
        }

        // funding step
        match pool.try_get_is_killed_deposit() {
            Ok(Ok(false)) => {}
            _ => return Err(Error::PoolUnavailable),
        }
        let funded = fund_step(&env, &c, &pool, &mut plan)?;
        env.storage().instance().set(&DataKey::Plan, &plan);
        env.storage().instance().set(&DataKey::Unwinding, &false);
        RebalancedEvent { by: caller, center_tick: tick, rungs: rungs(&env).len(), value_in_ladder: funded, idle_value: 0 }.publish(&env);
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
    /// Orderly exit: while on, the keeper's rebalance steps unwind every rung into idle funds and nothing is redeployed,
    /// so all holders can then withdraw atomically. Deposits are refused. Reversible by the owner.
    pub fn set_wind_down(env: Env, owner: Address, on: bool) -> Result<(), Error> {
        require_owner(&env, &owner)?;
        bump(&env);
        env.storage().instance().set(&DataKey::WindDown, &on);
        if on {
            // never keep funding while winding down
            env.storage().instance().set(&DataKey::Plan, &Vec::<PlanRung>::new(&env));
        }
        SettingEvent { name: Symbol::new(&env, "wind_down") }.publish(&env);
        Ok(())
    }
    pub fn is_wind_down(env: Env) -> bool {
        env.storage().instance().get(&DataKey::WindDown).unwrap_or(false)
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
        if paused(&env) {
            return false;
        }
        if env.storage().instance().get::<_, bool>(&DataKey::Unwinding).unwrap_or(false) {
            return true;
        }
        if env.storage().instance().get::<_, bool>(&DataKey::WindDown).unwrap_or(false) {
            return !rungs(&env).is_empty();
        }
        let plan: Vec<PlanRung> = env.storage().instance().get(&DataKey::Plan).unwrap_or(Vec::new(&env));
        if !plan.is_empty() {
            return true;
        }
        let Ok((s, tick)) = spot(&env, &c) else { return false };
        let old = rungs(&env);
        if old.is_empty() {
            return get_i128(&env, &DataKey::IdleU) + other_to_u(&env, &c, get_i128(&env, &DataKey::IdleO), &s).unwrap_or(0) >= MIN_DEPLOY_VALUE;
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
        idle >= MIN_DEPLOY_VALUE && idle * 10_000 >= n * IDLE_REDEPLOY_BPS
    }
    pub fn get_plan(env: Env) -> (bool, Vec<PlanRung>) {
        (
            env.storage().instance().get(&DataKey::Unwinding).unwrap_or(false),
            env.storage().instance().get(&DataKey::Plan).unwrap_or(Vec::new(&env)),
        )
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
