#![cfg(test)]
//! A launchpad-style token market priced through `AquariusOnly`, with the REAL audited controller,
//! receipt-vault and jump-rate-model Wasm (`build/test/`). Layout of the world:
//!
//! * `DEBT` is the quote asset ("USDC"): Reflector-priced at $1, lent by `lender`, borrowed by `borrower`.
//! * `COLL` is the freshly graduated token: no Reflector feed, priced from its COLL/DEBT Aquarius pool
//!   (100,000 COLL against 200,000 DEBT, about $2 each).
//!
//! The controller keeps a per-token price cache that is valid for `k * resolution` = 600 s of its
//! timestamp, and the router stamps `AquariusOnly` prices with the ledger time, so a cached price is
//! reused for 600 s after any refresh. The tests below therefore move the clock by more than 600 s
//! where they want the controller to ask the router again.
//!
//! Footprint: a borrow in a two-market group that has to refresh BOTH prices inside the borrow
//! transaction already reads about 98 ledger entries with Reflector prices (the network limit is
//! 100). An Aquarius-priced market adds the pool's instance, code and state entries (3 on the real
//! mainnet XLM/USDC concentrated pool, 4 with the mock) and does not fit. The supported flow is
//! therefore to warm the controller's price cache first with the public `cache_price(token)` in
//! its own transaction (keeper or UI), after which the borrow hits the cache. `try_borrow` below
//! does exactly that; `borrow_footprint_...` measures both paths.
extern crate std;
use super::*;
use mock_aquarius_pool::{MockAquariusPool, MockAquariusPoolClient};
use mock_reflector::{MockReflector, MockReflectorClient};
use mock_token::{MockToken, MockTokenClient};
use peridot_interfaces::TEST_ADMIN_ADDRESS;
use soroban_sdk::testutils::{Address as _, Ledger};
use soroban_sdk::{symbol_short, vec, Env, String};

mod controller {
    soroban_sdk::contractimport!(file = "../../build/test/simple_peridottroller.wasm");
}
/// `contractimport!` of receipt_vault.wasm does not compile (its spec lists the `Mint` event
/// twice), so the Wasm is registered from its bytes and called through this minimal client.
mod vault {
    use soroban_sdk::{contractclient, Address, Env};
    pub const WASM: &[u8] = include_bytes!("../../../build/test/receipt_vault.wasm");

    #[contractclient(name = "Client")]
    #[allow(dead_code)]
    pub trait Vault {
        fn initialize(env: Env, token: Address, supply_rate: u128, borrow_rate: u128, admin: Address);
        fn enable_static_rates(env: Env, admin: Address);
        fn set_peridottroller(env: Env, peridottroller: Address);
        fn set_collateral_factor(env: Env, factor: u128);
        fn set_interest_model(env: Env, model: Address);
        fn deposit(env: Env, user: Address, amount: u128);
        fn borrow(env: Env, user: Address, amount: u128);
    }
}
mod jrm {
    soroban_sdk::contractimport!(file = "../../build/test/jump_rate_model.wasm");
}

const NOW: u64 = 1_000_000;
const UNIT: i128 = 10_000_000;
const ONE_USD: i128 = 100_000_000_000_000;

struct World<'a> {
    env: Env,
    comp: controller::Client<'a>,
    router: PriceRouterExtClient<'a>,
    feed: MockReflectorClient<'a>,
    pool: MockAquariusPoolClient<'a>,
    token_debt: Address,
    token_coll: Address,
    coll_mint: MockTokenClient<'a>,
    vault_debt: vault::Client<'a>,
    provider: Address,
    borrower: Address,
}

fn token<'a>(env: &Env, name: &str) -> (Address, MockTokenClient<'a>) {
    let id = env.register(MockToken, ());
    let c = MockTokenClient::new(env, &id);
    c.initialize(&String::from_str(env, name), &String::from_str(env, name), &7u32);
    (id, c)
}

/// `aquarius`: price COLL from the pool. false: price COLL from a Reflector feed (baseline for the footprint).
fn world<'a>(aquarius: bool) -> World<'a> {
    let env = Env::default();
    env.mock_all_auths_allowing_non_root_auth();
    env.cost_estimate().budget().reset_unlimited();
    env.ledger().set_timestamp(NOW);
    let admin = Address::from_str(&env, TEST_ADMIN_ADDRESS);

    let (token_debt, mint_debt) = token(&env, "DEBT");
    let (token_coll, mint_coll) = token(&env, "COLL");

    let vd_id = env.register(vault::WASM, ());
    let vc_id = env.register(vault::WASM, ());
    let vault_debt = vault::Client::new(&env, &vd_id);
    let vault_coll = vault::Client::new(&env, &vc_id);
    vault_debt.initialize(&token_debt, &0u128, &0u128, &admin);
    vault_debt.enable_static_rates(&admin);
    vault_coll.initialize(&token_coll, &0u128, &0u128, &admin);
    vault_coll.enable_static_rates(&admin);
    let model_id = env.register(jrm::WASM, ());
    jrm::Client::new(&env, &model_id).initialize(
        &20_000u128,
        &180_000u128,
        &4_000_000u128,
        &800_000u128,
        &admin,
    );
    vault_debt.set_interest_model(&model_id);

    let comp_id = env.register(controller::WASM, ());
    let comp = controller::Client::new(&env, &comp_id);
    comp.initialize(&admin);
    comp.add_market(&vd_id);
    comp.add_market(&vc_id);
    // The launchpad preset caps the collateral factor of AquariusOnly markets at 50% in the factory.
    comp.set_market_cf(&vc_id, &500_000u128);
    vault_debt.set_peridottroller(&comp_id);
    vault_coll.set_peridottroller(&comp_id);
    vault_coll.set_collateral_factor(&500_000u128);

    let feed_id = env.register(MockReflector, (14u32, 300u32));
    let feed = MockReflectorClient::new(&env, &feed_id);
    let key_debt = Asset::Other(symbol_short!("DEBT"));
    feed.set_price(&key_debt, &ONE_USD, &NOW);

    let router_id = env.register(PriceRouterExt, (admin.clone(), 14u32, 300u32));
    let router = PriceRouterExtClient::new(&env, &router_id);
    router.set_asset_config(
        &admin,
        &token_debt,
        &PriceConfig::ReflectorOnly(ReflectorOnlyCfg {
            oracle: feed_id.clone(),
            asset: key_debt,
        }),
    );

    // The Aquarius pool, funded by a liquidity provider.
    let pool_id = env.register(MockAquariusPool, ());
    let pool = MockAquariusPoolClient::new(&env, &pool_id);
    pool.initialize(&token_coll, &token_debt, &60, &30);
    let provider = Address::generate(&env);
    mint_coll.mint(&provider, &(1_000_000 * UNIT));
    mint_debt.mint(&provider, &(1_000_000 * UNIT));
    pool.deposit_position(
        &provider,
        &-600,
        &600,
        &vec![&env, (100_000 * UNIT) as u128, (200_000 * UNIT) as u128],
        &0,
    );

    if aquarius {
        router.set_asset_config(
            &admin,
            &token_coll,
            &PriceConfig::AquariusOnly(AquariusOnlyCfg {
                pool: pool_id,
                quote_token: token_debt.clone(),
            }),
        );
    } else {
        let key_coll = Asset::Other(symbol_short!("COLL"));
        feed.set_price(&key_coll, &(2 * ONE_USD), &NOW);
        router.set_asset_config(
            &admin,
            &token_coll,
            &PriceConfig::ReflectorOnly(ReflectorOnlyCfg {
                oracle: feed_id,
                asset: key_coll,
            }),
        );
    }
    comp.set_oracle(&router_id);

    let lender = Address::generate(&env);
    let borrower = Address::generate(&env);
    mint_debt.mint(&lender, &(1_000 * UNIT));
    mint_coll.mint(&borrower, &(100 * UNIT));
    vault_debt.deposit(&lender, &((1_000 * UNIT) as u128));
    vault_coll.deposit(&borrower, &((100 * UNIT) as u128));
    comp.enter_market(&borrower, &vc_id);
    comp.enter_market(&borrower, &vd_id);

    World {
        env,
        comp,
        router,
        feed,
        pool,
        token_debt,
        token_coll,
        coll_mint: mint_coll,
        vault_debt,
        provider,
        borrower,
    }
}

impl World<'_> {
    /// Pre-warms the controller's price cache in its own invocations, like a keeper or the app does.
    fn warm(&self) {
        self.comp.cache_price(&self.token_coll);
        self.comp.cache_price(&self.token_debt);
    }
    fn try_borrow(&self, units: i128) -> bool {
        self.warm();
        self.env.cost_estimate().budget().reset_unlimited();
        self.vault_debt
            .try_borrow(&self.borrower, &((units * UNIT) as u128))
            .is_ok()
    }
    fn coll(&self) -> Asset {
        Asset::Stellar(self.token_coll.clone())
    }
    /// Moves the clock and refreshes the Reflector price of the quote asset, so the quote input stays fresh.
    fn at(&self, ts: u64) {
        self.env.ledger().set_timestamp(ts);
        self.feed
            .set_price(&Asset::Other(symbol_short!("DEBT")), &ONE_USD, &ts);
        self.feed
            .set_price(&Asset::Other(symbol_short!("COLL")), &(2 * ONE_USD), &ts);
    }
    fn drain_pool(&self) {
        let liq = self.pool.get_user_position_snapshot(&self.provider).raw_liquidity;
        self.pool.withdraw_position(
            &self.provider,
            &-600,
            &600,
            &liq,
            &vec![&self.env, 0u128, 0u128],
        );
    }
    fn refill_pool(&self) {
        self.pool.deposit_position(
            &self.provider,
            &-600,
            &600,
            &vec![&self.env, (100_000 * UNIT) as u128, (200_000 * UNIT) as u128],
            &0,
        );
    }
    /// Sells COLL into the pool (lowers the COLL price).
    fn sell_coll(&self, amount: i128) {
        let trader = Address::generate(&self.env);
        self.coll_mint.mint(&trader, &amount);
        self.pool.swap(&trader, &0, &1, &(amount as u128), &0);
    }
}

#[test]
fn launchpad_token_market_supports_supply_and_a_small_borrow() {
    let w = world(true);
    // The controller sees the pool-derived price at the router's 14 decimals: just under $2.
    let (price, scale) = w.comp.get_price_usd(&w.token_coll).unwrap();
    assert_eq!(scale, 10u128.pow(14));
    assert!(price < 2 * ONE_USD as u128 && price > 1_990 * ONE_USD as u128 / 1000, "price {price}");
    let c = w.router.check(&w.token_coll);
    assert_eq!(c.mode, symbol_short!("aquarius"));
    assert_eq!(c.status, Symbol::new(&w.env, "ok"));
    // 100 COLL * ~$2 * CF 50% = a bit under $100 of borrowing power (7 decimals).
    let (liq, short) = w.comp.account_liquidity(&w.borrower);
    assert_eq!(short, 0);
    assert!(liq > (99 * UNIT) as u128 && liq < (100 * UNIT) as u128, "liq {liq}");
    assert!(w.try_borrow(40));
    assert_eq!(w.comp.get_user_total_borrows(&w.borrower), (40 * UNIT) as u128);
    // Over the limit stays rejected: 40 + 70 > 99.
    assert!(!w.try_borrow(70));
}

#[test]
fn borrow_is_blocked_when_the_pool_is_drained_and_recovers_when_it_is_refilled() {
    let w = world(true);
    assert!(w.try_borrow(10));
    w.drain_pool();
    // Inside the controller's 600 s cache window the last good price is reused (controller behaviour).
    w.at(NOW + 100);
    assert!(w.router.lastprice(&w.coll()).is_none());
    assert_eq!(
        w.router.check(&w.token_coll).status,
        Symbol::new(&w.env, "unavailable")
    );
    assert!(w.try_borrow(10));
    // Past the cache window the controller asks the router again, gets no price and blocks the borrow.
    w.at(NOW + 700);
    assert!(w.router.lastprice(&w.coll()).is_none());
    assert!(!w.try_borrow(10));
    // Liquidity returns, so does the market.
    w.refill_pool();
    assert!(w.router.lastprice(&w.coll()).is_some());
    assert!(w.try_borrow(10));
}

#[test]
fn borrow_is_blocked_when_the_price_jumps_beyond_the_guard() {
    let w = world(true);
    assert!(w.try_borrow(10)); // anchor stored at NOW, controller caches the price until NOW + 600
    // A keeper (or anyone) pokes the router while the controller's cache is still valid: the anchor
    // is older than the interval, so it moves to the current price at NOW + 500.
    w.at(NOW + 500);
    assert!(w.router.lastprice(&w.coll()).is_some());
    // Now a 25% sell dumps the pool price by about 36%.
    w.sell_coll(25_000 * UNIT);
    // The controller's cache expires at NOW + 600; at NOW + 601 it asks the router, which sees a
    // jump of far more than 20% within 300 s of the anchor and refuses.
    w.at(NOW + 601);
    assert!(w.router.lastprice(&w.coll()).is_none());
    assert_eq!(
        w.router.check(&w.token_coll).status,
        Symbol::new(&w.env, "deviation")
    );
    assert!(!w.try_borrow(10));
    // Once the anchor is older than the interval the new level is accepted and borrowing resumes
    // (against the lower collateral value).
    w.at(NOW + 800);
    assert!(w.router.lastprice(&w.coll()).is_some());
    assert!(w.try_borrow(10));
    let (price, _) = w.comp.get_price_usd(&w.token_coll).unwrap();
    assert!(price < 13 * ONE_USD as u128 / 10, "price {price}");
}

#[test]
fn a_move_inside_the_step_does_not_block_borrowing() {
    let w = world(true);
    assert!(w.try_borrow(10));
    w.at(NOW + 500);
    assert!(w.router.lastprice(&w.coll()).is_some());
    // A 5% sell moves the price by about 9%, inside the 20% step.
    w.sell_coll(5_000 * UNIT);
    w.at(NOW + 601);
    assert!(w.router.lastprice(&w.coll()).is_some());
    assert!(w.try_borrow(10));
}

#[test]
fn borrow_footprint_with_an_aquarius_priced_collateral_market() {
    // Same world, same borrows; the baseline prices COLL from Reflector. Cold = the borrow transaction
    // itself refreshes both prices (cache older than 600 s). Warm = the cache was pre-warmed.
    let mut rows = std::vec::Vec::new();
    for aquarius in [false, true] {
        let w = world(aquarius);
        w.env.cost_estimate().disable_resource_limits();
        let mut ts = NOW;
        for borrow_no in 1..=2 {
            // cold
            ts += 700;
            w.at(ts);
            assert!(w.vault_debt.try_borrow(&w.borrower, &(UNIT as u128)).is_ok());
            let cold = w.env.cost_estimate().resources();
            // warm
            ts += 700;
            w.at(ts);
            w.warm();
            assert!(w.vault_debt.try_borrow(&w.borrower, &(UNIT as u128)).is_ok());
            let warm = w.env.cost_estimate().resources();
            rows.push((
                aquarius,
                borrow_no,
                cold.memory_read_entries + cold.disk_read_entries + cold.write_entries,
                warm.memory_read_entries + warm.disk_read_entries + warm.write_entries,
                cold.instructions,
            ));
        }
    }
    // (aquarius, borrow #, footprint entries cold, footprint entries warm, cold instructions)
    std::println!("borrow footprint rows: {rows:?}");
    for (aquarius, _, cold, warm, _) in &rows {
        assert!(*warm < 100, "warm borrow must fit: {rows:?}");
        if !*aquarius {
            assert!(*cold <= 100, "{rows:?}");
        }
    }
}
