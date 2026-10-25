//! Graduation helpers (stage 2): the Aquarius pool step and the market presets.
//!
//! Auth pattern (verified against recorded mainnet simulations of router v220, see docs/SPECS.md):
//! - `router.init_standard_pool(user = curve, ..)` requires `user` (the invoker, implicit) and the router
//!   itself transfers the creation fee: `AQUA.transfer(curve, payment_address, fee)` is a child of the router
//!   call, so it needs one `authorize_as_current_contract` entry.
//! - `router.deposit(user = curve, ..)` forwards to `pool.deposit(user, desired_amounts, min_shares)`, which
//!   calls `user.require_auth()` again and pulls both tokens: the entry is `pool.deposit(..)` with the two
//!   `transfer(curve, pool, amount)` calls nested under it.
//! - `authorize_as_current_contract` only covers the NEXT contract call, so every read happens before it.
use peridot_interfaces::{AquariusOnlyCfg, MarketConfig, PriceConfig, RateModel, YieldRoute};
use soroban_sdk::{
    auth::{ContractContext, InvokerContractAuthEntry, SubContractInvocation},
    contractclient, symbol_short, token, vec, Address, BytesN, Env, IntoVal, Symbol, Val, Vec,
};

use crate::{
    errors::CurveError,
    events,
    types::{Config, GradStep, Graduation},
};

/// Standard pool fee tier: 30 bps (Aquarius accepts 10, 30 and 100).
pub const POOL_FEE_BPS: u32 = 30;

// ---- market preset (docs/SPECS.md, "Graduation (stage 2)") ----
/// Collateral factor of the graduated token (factory cap for `AquariusOnly` is 50%).
pub const TOKEN_CF: u128 = 250_000;
/// Collateral factor of the quote asset market (`ReflectorOnly`, factory cap 75%).
pub const QUOTE_CF: u128 = 600_000;
pub const RESERVE_FACTOR: u128 = 100_000;
pub const IDLE_BUFFER_BPS: u32 = 5_000;
/// Token supply cap is this share (bps) of the tokens seeded into the pool.
pub const TOKEN_SUPPLY_CAP_BPS: i128 = 1_000;
/// Borrow cap is this share (bps) of the supply cap, for both markets.
pub const BORROW_CAP_BPS: i128 = 1_000;

#[contractclient(name = "RouterClient")]
#[allow(dead_code)]
pub trait AquariusRouter {
    fn init_standard_pool(env: Env, user: Address, tokens: Vec<Address>, fee_fraction: u32) -> (BytesN<32>, Address);
    fn deposit(
        env: Env,
        user: Address,
        tokens: Vec<Address>,
        pool_index: BytesN<32>,
        desired_amounts: Vec<u128>,
        min_shares: u128,
    ) -> (Vec<u128>, u128);
    fn share_id(env: Env, tokens: Vec<Address>, pool_index: BytesN<32>) -> Address;
    fn get_init_pool_payment_token(env: Env) -> Address;
    fn get_init_pool_payment_address(env: Env) -> Address;
    fn get_standard_pool_payment_amount(env: Env) -> u128;
}

/// The calls the curve makes on the market factory (it is the group owner until `claim_group`).
#[contractclient(name = "MarketFactoryClient")]
#[allow(dead_code)]
pub trait MarketFactoryApi {
    fn create_group(env: Env, owner: Address, name: Symbol) -> u32;
    fn add_market(env: Env, owner: Address, group_id: u32, cfg: MarketConfig) -> Address;
    fn activate_market(env: Env, owner: Address, group_id: u32, market: Address);
    fn transfer_ownership(env: Env, owner: Address, group_id: u32, new_owner: Address);
}

fn i(v: u128) -> Result<i128, CurveError> {
    i128::try_from(v).map_err(|_| CurveError::Overflow)
}

fn transfer_entry(env: &Env, token: &Address, from: &Address, to: &Address, amount: i128) -> InvokerContractAuthEntry {
    let args: Vec<Val> = (from.clone(), to.clone(), amount).into_val(env);
    InvokerContractAuthEntry::Contract(SubContractInvocation {
        context: ContractContext { contract: token.clone(), fn_name: Symbol::new(env, "transfer"), args },
        sub_invocations: Vec::new(env),
    })
}

/// `(fee token, fee amount)` read live from the router.
pub fn creation_fee(env: &Env, cfg: &Config) -> Result<(Address, i128), CurveError> {
    let r = RouterClient::new(env, &cfg.graduation.router);
    Ok((r.get_init_pool_payment_token(), i(r.get_standard_pool_payment_amount())?))
}

/// Everything the pool step does. `real_quote` is the quote to seed (all raised quote, fees excluded).
/// The caller (lib.rs) has already checked the phase and authorized `payer`.
pub fn pool_step(env: &Env, cfg: &Config, payer: &Address, real_quote: i128) -> Result<Graduation, CurveError> {
    let this = env.current_contract_address();
    let router = RouterClient::new(env, &cfg.graduation.router);
    let token_amt = cfg.params.lp_supply;
    let quote_amt = real_quote;

    // Aquarius requires the token vector sorted ascending by contract address (host byte order).
    let (tokens, desired): (Vec<Address>, Vec<u128>) = if cfg.token < cfg.quote_token {
        (
            vec![env, cfg.token.clone(), cfg.quote_token.clone()],
            vec![env, token_amt as u128, quote_amt as u128],
        )
    } else {
        (
            vec![env, cfg.quote_token.clone(), cfg.token.clone()],
            vec![env, quote_amt as u128, token_amt as u128],
        )
    };

    // ---- 1. creation fee: pulled from the payer, forwarded by the router, any unspent part refunded ----
    let fee_token = router.get_init_pool_payment_token();
    let fee_to = router.get_init_pool_payment_address();
    let fee = i(router.get_standard_pool_payment_amount())?;
    let fee_client = token::Client::new(env, &fee_token);
    let fee_before = fee_client.balance(&this);
    if fee > 0 {
        fee_client.transfer(payer, &this, &fee);
        env.authorize_as_current_contract(vec![env, transfer_entry(env, &fee_token, &this, &fee_to, fee)]);
    }
    let (pool_index, pool) = router.init_standard_pool(&this, &tokens, &POOL_FEE_BPS);
    // A pool that already existed charges nothing: give the payer back whatever the router did not take.
    let unspent = fee_client.balance(&this) - fee_before;
    if unspent > 0 {
        fee_client.transfer(&this, payer, &unspent);
    }
    let fee_paid = fee - unspent;

    // ---- 2. seed the pool with ALL raised quote and the whole lp_supply ----
    let min_shares: u128 = 1; // the real guard is the exact-amount check below
    let t0 = tokens.get(0).unwrap();
    let t1 = tokens.get(1).unwrap();
    let a0 = i(desired.get(0).unwrap())?;
    let a1 = i(desired.get(1).unwrap())?;
    let dep_args: Vec<Val> = (this.clone(), desired.clone(), min_shares).into_val(env);
    env.authorize_as_current_contract(vec![
        env,
        InvokerContractAuthEntry::Contract(SubContractInvocation {
            context: ContractContext { contract: pool.clone(), fn_name: Symbol::new(env, "deposit"), args: dep_args },
            sub_invocations: vec![
                env,
                transfer_entry(env, &t0, &this, &pool, a0),
                transfer_entry(env, &t1, &this, &pool, a1),
            ],
        }),
    ]);
    let (used, shares) = router.deposit(&this, &tokens, &pool_index, &desired, &min_shares);
    // A fresh pool takes exactly what is offered. Anything else means the pool already held liquidity at
    // another ratio (front-run creation): refuse, nothing is committed.
    if used != desired || shares == 0 {
        return Err(CurveError::PoolNotFresh);
    }

    // ---- 3. lock: burn every LP share the curve received ----
    let share_token = router.share_id(&tokens, &pool_index);
    let share_client = token::Client::new(env, &share_token);
    let lp_balance = share_client.balance(&this);
    if lp_balance <= 0 {
        return Err(CurveError::NothingBurned);
    }
    share_client.burn(&this, &lp_balance);
    if share_client.balance(&this) != 0 {
        return Err(CurveError::NothingBurned);
    }

    // ---- 4. burn what the curve did not sell ----
    let token_client = token::Client::new(env, &cfg.token);
    let unsold = token_client.balance(&this);
    if unsold > 0 {
        token_client.burn(&this, &unsold);
    }

    events::PoolCreated {
        pool: pool.clone(),
        pool_index: pool_index.clone(),
        share_token: share_token.clone(),
        payer: payer.clone(),
        quote_amount: quote_amt,
        token_amount: token_amt,
        lp_shares_burned: lp_balance,
        unsold_burned: unsold,
        fee_token,
        fee_paid,
    }
    .publish(env);

    Ok(Graduation {
        step: GradStep::PoolCreated,
        pool,
        pool_index,
        share_token,
        quote_in_pool: quote_amt,
        token_in_pool: token_amt,
        lp_shares_burned: lp_balance,
        unsold_burned: unsold,
        group_id: 0,
        quote_market: None,
        token_market: None,
        claimed: false,
    })
}

/// The group name is the token symbol (ASCII alphanumeric by launch-factory validation).
pub fn group_name(env: &Env, token_addr: &Address) -> Symbol {
    let s = token::Client::new(env, token_addr).symbol();
    let n = s.len() as usize;
    let mut buf = [0u8; 32];
    if n == 0 || n > 32 {
        return symbol_short!("LAUNCH");
    }
    s.copy_into_slice(&mut buf[..n]);
    if !buf[..n].iter().all(|c| c.is_ascii_alphanumeric()) {
        return symbol_short!("LAUNCH");
    }
    match core::str::from_utf8(&buf[..n]) {
        Ok(t) => Symbol::new(env, t),
        Err(_) => symbol_short!("LAUNCH"),
    }
}

fn pct_cap(amount: i128, bps: i128) -> u128 {
    // never zero: the factory refuses a zero cap
    (amount * bps / 10_000).max(1) as u128
}

fn stable_rates() -> RateModel {
    RateModel { base: 0, multiplier: 80_000, jump: 2_000_000, kink: 900_000 }
}

fn volatile_rates() -> RateModel {
    RateModel { base: 10_000, multiplier: 180_000, jump: 4_000_000, kink: 800_000 }
}

/// Quote asset market: priced by the approved `ReflectorOnly` mapping, stable-style rates. The supply cap is
/// the quote depth of the pool, the borrow cap 10% of it.
pub fn quote_market_config(cfg: &Config, g: &Graduation) -> MarketConfig {
    let supply_cap = pct_cap(g.quote_in_pool, 10_000);
    MarketConfig {
        token: cfg.quote_token.clone(),
        collateral_factor: QUOTE_CF,
        supply_cap,
        borrow_cap: pct_cap(supply_cap as i128, BORROW_CAP_BPS),
        reserve_factor: RESERVE_FACTOR,
        rates: stable_rates(),
        idle_buffer_bps: IDLE_BUFFER_BPS,
        yield_route: YieldRoute::None,
        price: cfg.graduation.quote_price.clone(),
        margin_enabled: false,
        supply_reward_per_sec: 0,
        borrow_reward_per_sec: 0,
    }
}

/// Graduated token market: priced from the pool, 25% collateral factor, supply cap = 10% of the tokens in
/// the pool (equal in value to 10% of the pool's quote side), borrow cap = 10% of the supply cap.
pub fn token_market_config(cfg: &Config, g: &Graduation) -> MarketConfig {
    let supply_cap = pct_cap(g.token_in_pool, TOKEN_SUPPLY_CAP_BPS);
    MarketConfig {
        token: cfg.token.clone(),
        collateral_factor: TOKEN_CF,
        supply_cap,
        borrow_cap: pct_cap(supply_cap as i128, BORROW_CAP_BPS),
        reserve_factor: RESERVE_FACTOR,
        rates: volatile_rates(),
        idle_buffer_bps: IDLE_BUFFER_BPS,
        yield_route: YieldRoute::None,
        price: PriceConfig::AquariusOnly(AquariusOnlyCfg { pool: g.pool.clone(), quote_token: cfg.quote_token.clone() }),
        margin_enabled: false,
        supply_reward_per_sec: 0,
        borrow_reward_per_sec: 0,
    }
}
