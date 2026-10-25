#![cfg(test)]
//! `AquariusOnly` unit tests against `core/mocks/mock-aquarius-pool` (plain x*y=k with a fee) and
//! `contracts/mocks/mock-reflector`.
use super::*;
use mock_aquarius_pool::{MockAquariusPool, MockAquariusPoolClient};
use mock_reflector::{MockReflector, MockReflectorClient};
use mock_token::{MockToken, MockTokenClient};
use soroban_sdk::testutils::{Address as _, Ledger};
use soroban_sdk::{contract, contractimpl, symbol_short, vec, Env, String};

const NOW: u64 = 1_000_000;
const UNIT: i128 = 10_000_000; // 7 decimals
const ONE_USD_14: i128 = 100_000_000_000_000;
const LOWER: i32 = -600;
const UPPER: i32 = 600;

/// A pool double whose answers and failures are fully scripted.
#[contract]
pub struct StubPool;

#[contractimpl]
impl StubPool {
    pub fn __constructor(env: Env, tokens: Vec<Address>, r0: u128, r1: u128) {
        env.storage().instance().set(&symbol_short!("tokens"), &tokens);
        env.storage().instance().set(&symbol_short!("r"), &vec![&env, r0, r1]);
        env.storage().instance().set(&symbol_short!("mode"), &0u32);
    }
    /// 0 ok, 1 get_reserves traps, 2 estimate_swap traps, 3 estimate_swap returns 0,
    /// 4 get_reserves returns three entries.
    pub fn set_mode(env: Env, mode: u32) {
        env.storage().instance().set(&symbol_short!("mode"), &mode);
    }
    pub fn get_tokens(env: Env) -> Vec<Address> {
        env.storage().instance().get(&symbol_short!("tokens")).unwrap()
    }
    pub fn get_reserves(env: Env) -> Vec<u128> {
        let mode: u32 = env.storage().instance().get(&symbol_short!("mode")).unwrap();
        if mode == 1 {
            panic!("pool down");
        }
        let mut r: Vec<u128> = env.storage().instance().get(&symbol_short!("r")).unwrap();
        if mode == 4 {
            r.push_back(1);
        }
        r
    }
    pub fn estimate_swap(env: Env, _in_idx: u32, _out_idx: u32, in_amount: u128) -> u128 {
        let mode: u32 = env.storage().instance().get(&symbol_short!("mode")).unwrap();
        match mode {
            2 => panic!("swap down"),
            3 => 0,
            _ => in_amount * 2,
        }
    }
}

struct Aq<'a> {
    env: Env,
    admin: Address,
    router: PriceRouterExtClient<'a>,
    feed: MockReflectorClient<'a>,
    token: Address,
    quote: Address,
    token_c: MockTokenClient<'a>,
    quote_c: MockTokenClient<'a>,
    pool_id: Address,
    pool: MockAquariusPoolClient<'a>,
    provider: Address,
}

struct Params {
    /// Pool order: true = (token, quote), false = (quote, token).
    token_first: bool,
    token_dec: u32,
    quote_dec: u32,
    router_dec: u32,
    fee_bps: u32,
    /// Raw reserves.
    token_reserve: i128,
    quote_reserve: i128,
}

impl Params {
    /// 100,000 TOK against 200,000 USDC (both 7 decimals): about $2 per TOK, no fee, 14 decimals.
    fn base() -> Self {
        Params {
            token_first: true,
            token_dec: 7,
            quote_dec: 7,
            router_dec: 14,
            fee_bps: 0,
            token_reserve: 100_000 * UNIT,
            quote_reserve: 200_000 * UNIT,
        }
    }
}

fn mk_token<'a>(env: &Env, name: &str, dec: u32) -> (Address, MockTokenClient<'a>) {
    let id = env.register(MockToken, ());
    let c = MockTokenClient::new(env, &id);
    c.initialize(&String::from_str(env, name), &String::from_str(env, name), &dec);
    (id, c)
}

fn usdc() -> Asset {
    Asset::Other(symbol_short!("USDC"))
}

fn build<'a>(p: Params) -> Aq<'a> {
    let env = Env::default();
    env.mock_all_auths_allowing_non_root_auth();
    env.ledger().set_timestamp(NOW);
    let admin = Address::generate(&env);
    let router_id = env.register(PriceRouterExt, (admin.clone(), p.router_dec, 300u32));
    let router = PriceRouterExtClient::new(&env, &router_id);

    let feed_id = env.register(MockReflector, (14u32, 300u32));
    let feed = MockReflectorClient::new(&env, &feed_id);
    feed.set_price(&usdc(), &ONE_USD_14, &NOW);

    let (token, token_c) = mk_token(&env, "TOK", p.token_dec);
    let (quote, quote_c) = mk_token(&env, "USDC", p.quote_dec);
    // The quote token is priced by Reflector in this router, as the launchpad preset requires.
    router.set_asset_config(
        &admin,
        &quote,
        &PriceConfig::ReflectorOnly(ReflectorOnlyCfg {
            oracle: feed_id,
            asset: usdc(),
        }),
    );

    let pool_id = env.register(MockAquariusPool, ());
    let pool = MockAquariusPoolClient::new(&env, &pool_id);
    let provider = Address::generate(&env);
    token_c.mint(&provider, &(p.token_reserve * 10));
    quote_c.mint(&provider, &(p.quote_reserve * 10));
    if p.token_first {
        pool.initialize(&token, &quote, &60, &p.fee_bps);
        pool.deposit_position(
            &provider,
            &LOWER,
            &UPPER,
            &vec![&env, p.token_reserve as u128, p.quote_reserve as u128],
            &0,
        );
    } else {
        pool.initialize(&quote, &token, &60, &p.fee_bps);
        pool.deposit_position(
            &provider,
            &LOWER,
            &UPPER,
            &vec![&env, p.quote_reserve as u128, p.token_reserve as u128],
            &0,
        );
    }
    Aq {
        env,
        admin,
        router,
        feed,
        token,
        quote,
        token_c,
        quote_c,
        pool_id,
        pool,
        provider,
    }
}

impl<'a> Aq<'a> {
    fn cfg(&self) -> PriceConfig {
        PriceConfig::AquariusOnly(AquariusOnlyCfg {
            pool: self.pool_id.clone(),
            quote_token: self.quote.clone(),
        })
    }
    fn configure(&self) {
        self.router.set_asset_config(&self.admin, &self.token, &self.cfg());
    }
    fn asset(&self) -> Asset {
        Asset::Stellar(self.token.clone())
    }
    fn price(&self) -> Option<i128> {
        self.router.lastprice(&self.asset()).map(|pd| pd.price)
    }
    /// Moves the ledger clock and keeps the quote token's Reflector price fresh.
    fn advance_to(&self, ts: u64) {
        self.env.ledger().set_timestamp(ts);
        self.feed.set_price(&usdc(), &ONE_USD_14, &ts);
    }
    /// Sells `amount` raw units of the priced token into the pool, lowering its price.
    fn sell_token(&self, amount: i128) {
        let trader = Address::generate(&self.env);
        self.token_c.mint(&trader, &amount);
        let t_idx = self.pool.get_tokens().first_index_of(&self.token).unwrap();
        self.pool.swap(&trader, &t_idx, &(1 - t_idx), &(amount as u128), &0);
    }
    fn drain_pool(&self) {
        let liq = self.pool.get_user_position_snapshot(&self.provider).raw_liquidity;
        self.pool
            .withdraw_position(&self.provider, &LOWER, &UPPER, &liq, &vec![&self.env, 0u128, 0u128]);
    }
    fn status(&self) -> Symbol {
        self.router.check(&self.token).status
    }
    fn sym(&self, s: &str) -> Symbol {
        Symbol::new(&self.env, s)
    }
}

/// Reference model of the probe for 7/7 decimals: floor arithmetic like the contract.
fn model_price(rt: u128, rq: u128, fee_bps: u128, quote_usd_14: u128) -> i128 {
    let probe = (rt / 1000).max(1).min(rt);
    let in_after = probe * (10_000 - fee_bps) / 10_000;
    let out = rq * in_after / (rt + in_after);
    (out * quote_usd_14 / probe) as i128
}

// ---- pricing ----

#[test]
fn prices_a_funded_pool_in_both_token_orders() {
    for token_first in [true, false] {
        let a = build(Params {
            token_first,
            ..Params::base()
        });
        a.configure();
        let pd = a.router.lastprice(&a.asset()).unwrap();
        let expected = model_price(
            (100_000 * UNIT) as u128,
            (200_000 * UNIT) as u128,
            0,
            ONE_USD_14 as u128,
        );
        assert_eq!(pd.price, expected, "token_first={token_first}");
        // 0.1% probe on x*y=k: just under 2 USD (the 0.1% price impact of the probe itself).
        assert!(pd.price < 2 * ONE_USD_14 && pd.price > 199 * ONE_USD_14 / 100);
        // Timestamp is the ledger time: there is no oracle timestamp.
        assert_eq!(pd.timestamp, NOW);
    }
}

#[test]
fn fee_lowers_the_quote_and_a_pricier_quote_token_scales_it() {
    let a = build(Params {
        fee_bps: 30,
        ..Params::base()
    });
    a.configure();
    let with_fee = a.price().unwrap();
    assert_eq!(
        with_fee,
        model_price(
            (100_000 * UNIT) as u128,
            (200_000 * UNIT) as u128,
            30,
            ONE_USD_14 as u128
        )
    );
    // The quote token is worth $1.50 now: the token's price scales by the same factor.
    // (A 50% jump of the input inside the interval is itself refused by the step guard, so wait it out.)
    a.env.ledger().set_timestamp(NOW + 300);
    a.feed.set_price(&usdc(), &(ONE_USD_14 * 3 / 2), &(NOW + 300));
    assert_eq!(a.price().unwrap(), with_fee * 3 / 2);
}

#[test]
fn probe_is_a_thousandth_of_the_token_reserve() {
    // 1 unit (the minimum probe) of a 0-decimal token worth $1,000 each: reserve 600 < 1000, so the
    // probe floors to 1 instead of 0. A 0.1% probe of the reserve would be 0.
    let a = build(Params {
        token_dec: 0,
        token_reserve: 600,
        quote_reserve: 600_000 * UNIT,
        ..Params::base()
    });
    a.configure();
    let out = 600_000 * UNIT as u128 / 601; // x*y=k, fee 0, probe 1
    let expected = (out * 10u128.pow(14)) / 10u128.pow(7); // usd = out/1e7 per 1 token, at 14 decimals
    assert_eq!(a.price().unwrap(), expected as i128);

    // With a deep pool the probe is 0.1% of the reserve: the price carries that slippage, which a
    // 1-unit probe would not (price would be 2.0 exactly, to 1e-7).
    let b = build(Params::base());
    b.configure();
    let p = b.price().unwrap();
    assert!(p < 2 * ONE_USD_14 - ONE_USD_14 / 1000); // below 1.999
    assert!(p > 1_997 * ONE_USD_14 / 1000);
}

#[test]
fn scales_to_the_router_decimals() {
    for router_dec in [8u32, 14, 18] {
        let a = build(Params {
            router_dec,
            ..Params::base()
        });
        a.configure();
        let at14 = model_price(
            (100_000 * UNIT) as u128,
            (200_000 * UNIT) as u128,
            0,
            ONE_USD_14 as u128,
        );
        // The Reflector quote is rescaled 14 -> router decimals first, then multiplied.
        let quote_scaled = rescale(ONE_USD_14, 14, router_dec).unwrap() as u128;
        let expected = model_price(
            (100_000 * UNIT) as u128,
            (200_000 * UNIT) as u128,
            0,
            quote_scaled,
        );
        assert_eq!(a.price().unwrap(), expected, "router_dec={router_dec}");
        if router_dec == 14 {
            assert_eq!(expected, at14);
        }
    }
}

#[test]
fn handles_different_token_decimals() {
    // 18-decimal token against a 7-decimal quote: 1,000 TOK against 2,000 USDC, about $2 each.
    let a = build(Params {
        token_dec: 18,
        token_reserve: 1_000 * 10i128.pow(18),
        quote_reserve: 2_000 * UNIT,
        ..Params::base()
    });
    a.configure();
    let p = a.price().unwrap();
    assert!(p < 2 * ONE_USD_14 && p > 1_997 * ONE_USD_14 / 1000, "price {p}");
    // And the reverse: 7-decimal token against an 18-decimal quote.
    let b = build(Params {
        quote_dec: 18,
        token_reserve: 1_000 * UNIT,
        quote_reserve: 2_000 * 10i128.pow(18),
        ..Params::base()
    });
    b.configure();
    let p = b.price().unwrap();
    assert!(p < 2 * ONE_USD_14 && p > 1_997 * ONE_USD_14 / 1000, "price {p}");
}

#[test]
fn only_stellar_assets_are_priced() {
    let a = build(Params::base());
    a.configure();
    assert!(a.router.lastprice(&Asset::Other(symbol_short!("TOK"))).is_none());
    assert!(a.router.lastprice(&Asset::Stellar(Address::generate(&a.env))).is_none());
}

// ---- unavailable ----

#[test]
fn empty_or_drained_pool_has_no_price() {
    let a = build(Params::base());
    a.configure();
    assert!(a.price().is_some());
    a.drain_pool();
    assert_eq!(a.pool.get_reserves(), vec![&a.env, 0u128, 0u128]);
    assert!(a.price().is_none());
    let c = a.router.check(&a.token);
    assert_eq!(c.status, a.sym("unavailable"));
    assert_eq!(c.mode, symbol_short!("aquarius"));
    assert!(c.aquarius_price.is_none());
}

#[test]
fn shallow_pool_has_no_price() {
    // 100 TOK against 200 USDC: $200 per side, below the $500 floor.
    let a = build(Params {
        token_reserve: 100 * UNIT,
        quote_reserve: 200 * UNIT,
        ..Params::base()
    });
    a.configure();
    assert!(a.price().is_none());
    assert_eq!(a.status(), a.sym("unavailable"));
}

#[test]
fn one_sided_shallow_pool_has_no_price() {
    // Token side is deep ($200k) but the quote side holds only $100.
    let a = build(Params {
        token_reserve: 100_000 * UNIT,
        quote_reserve: 100 * UNIT,
        ..Params::base()
    });
    a.configure();
    assert!(a.price().is_none());
}

#[test]
fn quote_price_missing_or_stale_means_no_price() {
    let a = build(Params::base());
    a.configure();
    assert!(a.price().is_some());
    a.feed.clear_price(&usdc());
    assert!(a.price().is_none());
    assert_eq!(a.status(), a.sym("unavailable"));
    // A quote price older than 2 * resolution is not usable even though the router reports ledger time.
    a.feed.set_price(&usdc(), &ONE_USD_14, &NOW);
    assert!(a.price().is_some());
    a.env.ledger().set_timestamp(NOW + 601);
    assert!(a.price().is_none());
    a.feed.set_price(&usdc(), &ONE_USD_14, &(NOW + 601));
    assert!(a.price().is_some());
    // A non-positive quote price is not usable either.
    a.feed.set_price(&usdc(), &0, &(NOW + 601));
    assert!(a.price().is_none());
}

#[test]
fn failing_pool_returns_none_and_never_panics() {
    let env = Env::default();
    env.mock_all_auths_allowing_non_root_auth();
    env.ledger().set_timestamp(NOW);
    let admin = Address::generate(&env);
    let router_id = env.register(PriceRouterExt, (admin.clone(), 14u32, 300u32));
    let router = PriceRouterExtClient::new(&env, &router_id);
    let feed_id = env.register(MockReflector, (14u32, 300u32));
    let feed = MockReflectorClient::new(&env, &feed_id);
    feed.set_price(&usdc(), &ONE_USD_14, &NOW);
    let (token, _) = mk_token(&env, "TOK", 7);
    let (quote, _) = mk_token(&env, "USDC", 7);
    router.set_asset_config(
        &admin,
        &quote,
        &PriceConfig::ReflectorOnly(ReflectorOnlyCfg {
            oracle: feed_id,
            asset: usdc(),
        }),
    );
    let tokens = vec![&env, token.clone(), quote.clone()];
    let stub_id = env.register(
        StubPool,
        (tokens, (100_000 * UNIT) as u128, (200_000 * UNIT) as u128),
    );
    let stub = StubPoolClient::new(&env, &stub_id);
    router.set_asset_config(
        &admin,
        &token,
        &PriceConfig::AquariusOnly(AquariusOnlyCfg {
            pool: stub_id,
            quote_token: quote,
        }),
    );
    let asset = Asset::Stellar(token.clone());
    // The stub quotes 2x the probe: a clean $2 price.
    assert_eq!(router.lastprice(&asset).unwrap().price, 2 * ONE_USD_14);
    for mode in [1u32, 2, 3, 4] {
        stub.set_mode(&mode);
        assert!(router.lastprice(&asset).is_none(), "mode {mode}");
        let c = router.check(&token);
        assert_eq!(c.status, Symbol::new(&env, "unavailable"), "mode {mode}");
        assert_eq!(c.mode, symbol_short!("aquarius"));
    }
    stub.set_mode(&0);
    assert_eq!(router.lastprice(&asset).unwrap().price, 2 * ONE_USD_14);
}

// ---- step guard ----

#[test]
fn step_guard_refuses_a_jump_inside_the_interval_and_accepts_after_it() {
    let a = build(Params::base());
    a.configure();
    let p0 = a.price().unwrap(); // stores the anchor at NOW
    // A one-shot 25% sell into the pool moves the price far beyond 20%.
    a.sell_token(25_000 * UNIT);
    a.advance_to(NOW + 10);
    assert!(a.price().is_none());
    let c = a.router.check(&a.token);
    assert_eq!(c.status, a.sym("deviation"));
    assert!(c.deviation_bps.unwrap() > MAX_STEP_BPS);
    // The spot price is still reported by `check` (aquarius_price) for operators.
    assert!(c.aquarius_price.unwrap() < p0 * 8 / 10);
    assert_eq!(c.reflector_price, Some(ONE_USD_14));
    assert_eq!(c.mode, symbol_short!("aquarius"));
    // One second before the interval ends: still refused. At the interval: accepted and stored.
    a.advance_to(NOW + 299);
    assert!(a.price().is_none());
    a.advance_to(NOW + 300);
    let p1 = a.price().unwrap();
    assert!(p1 < p0 * 8 / 10);
    // The anchor was replaced, so the new level is now the reference.
    assert_eq!(a.status(), a.sym("ok"));
    assert_eq!(a.router.check(&a.token).deviation_bps, Some(0));
}

#[test]
fn step_guard_bounds_cumulative_drift_inside_the_interval() {
    let a = build(Params::base());
    a.configure();
    let p0 = a.price().unwrap();
    // First 10% sell: price drops about 17%, within the step, accepted but the anchor stays.
    a.sell_token(10_000 * UNIT);
    a.advance_to(NOW + 60);
    let p1 = a.price().unwrap();
    assert!(p1 < p0 && p1 > p0 * 8 / 10);
    // Second 10% sell: about 31% below the ORIGINAL anchor, refused although the step from p1 is small.
    a.sell_token(11_000 * UNIT);
    a.advance_to(NOW + 120);
    assert!(a.price().is_none());
    assert_eq!(a.status(), a.sym("deviation"));
    // Prices moving back toward the anchor are fine again: buy the token back.
    let trader = Address::generate(&a.env);
    a.quote_c.mint(&trader, &(100_000 * UNIT));
    let t_idx = a.pool.get_tokens().first_index_of(&a.token).unwrap();
    a.pool
        .swap(&trader, &(1 - t_idx), &t_idx, &((40_000 * UNIT) as u128), &0);
    assert!(a.price().is_some());
}

#[test]
fn check_does_not_write_the_anchor_but_lastprice_does() {
    let a = build(Params::base());
    a.configure();
    // `check` alone never sets an anchor: no deviation is reported and a later jump is accepted
    // as the first observation.
    assert_eq!(a.router.check(&a.token).deviation_bps, None);
    a.sell_token(25_000 * UNIT);
    a.advance_to(NOW + 5);
    assert!(a.price().is_some());
    assert_eq!(a.router.check(&a.token).deviation_bps, Some(0));
}

#[test]
fn reconfiguring_resets_the_anchor() {
    let a = build(Params::base());
    a.configure();
    a.price().unwrap();
    a.sell_token(25_000 * UNIT);
    a.advance_to(NOW + 10);
    assert!(a.price().is_none());
    a.configure();
    assert!(a.price().is_some());
}

// ---- configuration ----

#[test]
fn config_roundtrip_and_event() {
    let a = build(Params::base());
    a.configure();
    assert_eq!(a.router.get_asset_config(&a.token), Some(a.cfg()));
    assert_eq!(a.router.check(&a.token).mode, symbol_short!("aquarius"));
}

fn err(r: Result<Result<(), soroban_sdk::ConversionError>, Result<RouterError, soroban_sdk::InvokeError>>) -> RouterError {
    r.unwrap_err().unwrap()
}

#[test]
fn validation_errors() {
    let a = build(Params::base());
    let set = |token: &Address, pool: &Address, quote: &Address| {
        err(a.router.try_set_asset_config(
            &a.admin,
            token,
            &PriceConfig::AquariusOnly(AquariusOnlyCfg {
                pool: pool.clone(),
                quote_token: quote.clone(),
            }),
        ))
    };
    // Not a pool.
    assert_eq!(set(&a.token, &Address::generate(&a.env), &a.quote), RouterError::InvalidPool);
    // token == quote_token.
    assert_eq!(set(&a.quote, &a.pool_id, &a.quote), RouterError::InvalidPool);
    // The pool does not hold the token / quote.
    let other = Address::generate(&a.env);
    assert_eq!(set(&other, &a.pool_id, &a.quote), RouterError::InvalidPool);
    assert_eq!(set(&a.token, &a.pool_id, &other), RouterError::InvalidPool);
    // The router itself is not a pool.
    assert_eq!(set(&a.token, &a.router.address, &a.quote), RouterError::InvalidPool);

    // Quote token without a ReflectorOnly config.
    let (t3, _) = mk_token(&a.env, "T3", 7);
    let (q3, _) = mk_token(&a.env, "Q3", 7);
    let p3 = a.env.register(MockAquariusPool, ());
    MockAquariusPoolClient::new(&a.env, &p3).initialize(&t3, &q3, &60, &0);
    // Empty pool is reported after the quote check, so test them in order.
    assert_eq!(set(&t3, &p3, &q3), RouterError::QuoteTokenNotConfigured);
    a.router.set_asset_config(
        &a.admin,
        &q3,
        &PriceConfig::ReflectorOnly(ReflectorOnlyCfg {
            oracle: a.feed.address.clone(),
            asset: usdc(),
        }),
    );
    assert_eq!(set(&t3, &p3, &q3), RouterError::EmptyPool);

    // Pools that do not hold exactly two tokens, or are scripted to misbehave.
    let three = vec![&a.env, a.token.clone(), a.quote.clone(), other.clone()];
    let p_three = a.env.register(StubPool, (three, 1u128, 1u128));
    assert_eq!(set(&a.token, &p_three, &a.quote), RouterError::InvalidPool);
    let two = vec![&a.env, a.token.clone(), a.quote.clone()];
    let p_zero = a.env.register(StubPool, (two.clone(), 0u128, 5u128));
    assert_eq!(set(&a.token, &p_zero, &a.quote), RouterError::EmptyPool);
    let p_bad = a.env.register(StubPool, (two, 5u128, 5u128));
    StubPoolClient::new(&a.env, &p_bad).set_mode(&1);
    assert_eq!(set(&a.token, &p_bad, &a.quote), RouterError::EmptyPool);

    // Nothing got stored by the failed attempts.
    assert!(a.router.get_asset_config(&a.token).is_none());
    // The quote token cannot itself be an AquariusOnly token or a still-unconfigured pair member.
    a.configure();
    assert!(a.router.get_asset_config(&a.token).is_some());
}

#[test]
fn token_decimals_above_18_are_rejected() {
    let a = build(Params {
        token_dec: 19,
        token_reserve: 1_000 * 10i128.pow(19),
        ..Params::base()
    });
    assert_eq!(
        err(a.router.try_set_asset_config(&a.admin, &a.token, &a.cfg())),
        RouterError::InvalidPool
    );
}

#[test]
fn only_the_admin_can_configure() {
    let a = build(Params::base());
    let stranger = Address::generate(&a.env);
    assert_eq!(
        err(a.router.try_set_asset_config(&stranger, &a.token, &a.cfg())),
        RouterError::NotAdmin
    );
}

#[test]
fn switching_modes_clears_the_pool_metadata() {
    let a = build(Params::base());
    a.configure();
    assert!(a.price().is_some());
    // Reconfigured as ReflectorOnly: the Aquarius path is gone.
    a.feed.set_price(&Asset::Other(symbol_short!("TOK")), &(3 * ONE_USD_14), &NOW);
    a.router.set_asset_config(
        &a.admin,
        &a.token,
        &PriceConfig::ReflectorOnly(ReflectorOnlyCfg {
            oracle: a.feed.address.clone(),
            asset: Asset::Other(symbol_short!("TOK")),
        }),
    );
    assert_eq!(a.price().unwrap(), 3 * ONE_USD_14);
    assert_eq!(a.router.check(&a.token).mode, symbol_short!("reflector"));
    // Quote token lookups still work for the other direction.
    assert!(a.router.get_asset_config(&a.quote).is_some());
}

#[test]
fn reserves_are_checked_at_config_time_only_for_non_zero() {
    let a = build(Params::base());
    a.drain_pool();
    assert_eq!(
        err(a.router.try_set_asset_config(&a.admin, &a.token, &a.cfg())),
        RouterError::EmptyPool
    );
    let _ = (&a.token_c, &a.quote_c);
}

#[test]
fn guard_mode_is_still_unsupported() {
    let a = build(Params::base());
    let g = PriceConfig::ReflectorWithAquariusGuard(peridot_interfaces::ReflectorGuardCfg {
        oracle: a.feed.address.clone(),
        asset: usdc(),
        pool: a.pool_id.clone(),
        quote_token: a.quote.clone(),
        max_dev_bps: 300,
    });
    assert_eq!(
        err(a.router.try_set_asset_config(&a.admin, &a.token, &g)),
        RouterError::UnsupportedMode
    );
}
