#![cfg(test)]
//! Integration with the REAL audited controller, receipt-vault and jump-rate-model Wasm
//! (`build/test/`, which accept `TEST_ADMIN_ADDRESS` as their initial admin).
use super::*;
use mock_reflector::{MockReflector, MockReflectorClient};
use mock_token::{MockToken, MockTokenClient};
use peridot_interfaces::{ReflectorOnlyCfg, TEST_ADMIN_ADDRESS};
use soroban_sdk::testutils::Ledger;
use soroban_sdk::{symbol_short, Env, String};

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
const UNIT: i128 = 10_000_000; // 7 decimals

struct World<'a> {
    env: Env,
    admin: Address,
    comp: controller::Client<'a>,
    router: PriceRouterExtClient<'a>,
    feed: MockReflectorClient<'a>,
    token_debt: Address,
    token_coll: Address,
    vault_debt: vault::Client<'a>,
    vault_coll: vault::Client<'a>,
    lender: Address,
    borrower: Address,
}

fn token<'a>(env: &Env, name: &str) -> (Address, MockTokenClient<'a>) {
    let id = env.register(MockToken, ());
    let c = MockTokenClient::new(env, &id);
    c.initialize(
        &String::from_str(env, name),
        &String::from_str(env, name),
        &7u32,
    );
    (id, c)
}

fn world<'a>() -> World<'a> {
    let env = Env::default();
    env.mock_all_auths_allowing_non_root_auth();
    env.cost_estimate().budget().reset_unlimited(); // Wasm-in-host tests exceed the default budget
    env.ledger().set_timestamp(NOW);
    let admin = Address::from_str(&env, TEST_ADMIN_ADDRESS);

    let (token_debt, mint_debt) = token(&env, "DEBT");
    let (token_coll, mint_coll) = token(&env, "COLL");

    // Two receipt-vault markets; the debt market earns/charges via a real jump-rate-model.
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
    comp.set_market_cf(&vc_id, &500_000u128);
    vault_debt.set_peridottroller(&comp_id);
    vault_coll.set_peridottroller(&comp_id);
    vault_coll.set_collateral_factor(&500_000u128);

    // Reflector-like feed at 14 decimals / 300 s, prices set at the current ledger time.
    let feed_id = env.register(MockReflector, (14u32, 300u32));
    let feed = MockReflectorClient::new(&env, &feed_id);
    let key_debt = Asset::Other(symbol_short!("DEBT"));
    let key_coll = Asset::Other(symbol_short!("COLL"));
    feed.set_price(&key_debt, &10i128.pow(14), &NOW); // $1
    feed.set_price(&key_coll, &(2 * 10i128.pow(14)), &NOW); // $2

    // The router, with admin = the address the controller wasm treats as admin (the factory in prod).
    let router_id = env.register(PriceRouterExt, (admin.clone(), 14u32, 300u32));
    let router = PriceRouterExtClient::new(&env, &router_id);
    for (tok, key) in [(&token_debt, &key_debt), (&token_coll, &key_coll)] {
        router.set_asset_config(
            &admin,
            tok,
            &PriceConfig::ReflectorOnly(ReflectorOnlyCfg {
                oracle: feed_id.clone(),
                asset: key.clone(),
            }),
        );
    }
    // First oracle on a fresh controller applies immediately.
    comp.set_oracle(&router_id);
    assert_eq!(comp.get_oracle(), Some(router_id.clone()));

    let lender = Address::generate_addr(&env);
    let borrower = Address::generate_addr(&env);
    mint_debt.mint(&lender, &(1_000 * UNIT));
    mint_coll.mint(&borrower, &(100 * UNIT));
    vault_debt.deposit(&lender, &((1_000 * UNIT) as u128));
    vault_coll.deposit(&borrower, &((100 * UNIT) as u128));
    comp.enter_market(&borrower, &vc_id);
    comp.enter_market(&borrower, &vd_id);

    World {
        env,
        admin,
        comp,
        router,
        feed,
        token_debt,
        token_coll,
        vault_debt,
        vault_coll,
        lender,
        borrower,
    }
}

impl World<'_> {
    fn borrow(&self, amount_units: i128) {
        self.env.cost_estimate().budget().reset_unlimited();
        self.vault_debt
            .borrow(&self.borrower, &((amount_units * UNIT) as u128));
    }
    fn try_borrow(&self, amount_units: i128) -> bool {
        self.env.cost_estimate().budget().reset_unlimited();
        self.vault_debt
            .try_borrow(&self.borrower, &((amount_units * UNIT) as u128))
            .is_ok()
    }
}

trait Gen {
    fn generate_addr(env: &Env) -> Address;
}
impl Gen for Address {
    fn generate_addr(env: &Env) -> Address {
        <Address as soroban_sdk::testutils::Address>::generate(env)
    }
}

#[test]
fn controller_prices_through_the_router() {
    let w = world();
    // 14-decimal prices reach the controller at the router's decimals
    let (price, scale) = w.comp.get_price_usd(&w.token_coll).unwrap();
    assert_eq!(scale, 10u128.pow(14));
    assert_eq!(price, 2 * 10u128.pow(14));
    let (price, _) = w.comp.get_price_usd(&w.token_debt).unwrap();
    assert_eq!(price, 10u128.pow(14));
    assert_eq!(w.router.check(&w.token_coll).status, Symbol::new(&w.env, "ok"));
    let _ = (&w.admin, &w.lender, &w.vault_coll);
}

#[test]
fn borrow_works_with_router_prices() {
    let w = world();
    // 100 COLL * $2 * CF 50% = $100 of borrowing power at 7 decimals
    let (liq, short) = w.comp.account_liquidity(&w.borrower);
    assert_eq!(short, 0);
    assert_eq!(liq, (100 * UNIT) as u128);
    w.borrow(50); // $50 of DEBT at $1
    assert_eq!(w.comp.get_user_total_borrows(&w.borrower), (50 * UNIT) as u128);
}

#[test]
fn borrow_over_limit_is_still_rejected() {
    let w = world();
    assert!(!w.try_borrow(101));
    assert!(w.try_borrow(100));
}

#[test]
fn borrow_blocked_when_reflector_price_is_cleared() {
    let w = world();
    w.borrow(10);
    // The feed drops the price. The controller may reuse its last good cached price for at most
    // k * resolution (600 s) of feed age, so move past that window.
    w.feed.clear_price(&Asset::Other(symbol_short!("COLL")));
    w.env.ledger().set_timestamp(NOW + 601);
    // Keep the DEBT price fresh so the cleared COLL price is the only missing input.
    w.feed
        .set_price(&Asset::Other(symbol_short!("DEBT")), &(10i128.pow(14)), &(NOW + 601));
    assert!(w.router.lastprice(&Asset::Stellar(w.token_coll.clone())).is_none());
    assert_eq!(
        w.router.check(&w.token_coll).status,
        Symbol::new(&w.env, "unavailable")
    );
    assert!(!w.try_borrow(10));
    // Restoring the COLL price re-enables borrowing.
    w.feed
        .set_price(&Asset::Other(symbol_short!("COLL")), &(2 * 10i128.pow(14)), &(NOW + 601));
    assert!(w.try_borrow(10));
}

#[test]
fn borrow_blocked_when_reflector_price_is_stale() {
    let w = world();
    w.borrow(10);
    // No feed update: ledger time moves beyond 2 * resolution of the feed timestamp.
    w.env.ledger().set_timestamp(NOW + 601);
    assert_eq!(w.router.check(&w.token_coll).status, Symbol::new(&w.env, "stale"));
    // The router forwards the feed's old timestamp untouched; the controller rejects it.
    let pd = w.router.lastprice(&Asset::Stellar(w.token_coll.clone())).unwrap();
    assert_eq!(pd.timestamp, NOW);
    assert!(!w.try_borrow(10));
    // A fresh feed update unblocks it, so the rejection above was the staleness rule.
    w.feed
        .set_price(&Asset::Other(symbol_short!("COLL")), &(2 * 10i128.pow(14)), &(NOW + 601));
    w.feed
        .set_price(&Asset::Other(symbol_short!("DEBT")), &(10i128.pow(14)), &(NOW + 601));
    assert!(w.try_borrow(10));
}
