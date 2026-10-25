//! Factory tests run against the REAL core Wasm in `build/test/` (built with the fixed test admin,
//! see `scripts/build_core.sh`). The router is `mock-price-router` (Wasm built into build/test).
#![cfg(test)]
extern crate std;

use peridot_interfaces::{
    Asset, BlendRoute, DefindexRoute, KeeperMode, MarketConfig, PriceConfig, RateModel,
    ReflectorOnlyCfg, WasmHashes, YieldRoute, TEST_ADMIN_ADDRESS,
};
use soroban_sdk::{
    symbol_short,
    testutils::{Address as _, Ledger as _},
    Address, Env, Symbol,
};

use crate::{FactoryError, MarketFactory, MarketFactoryClient};

mod ctrl {
    soroban_sdk::contractimport!(file = "../../build/test/simple_peridottroller.wasm");
}
// receipt_vault.wasm cannot go through contractimport! (it declares two events named `Mint`),
// so the test uses a small hand-written client for the calls it needs.
mod vault {
    use soroban_sdk::{contractclient, Address, Env};
    #[contractclient(name = "Client")]
    #[allow(dead_code)]
    pub trait Vault {
        fn deposit(env: Env, user: Address, amount: u128);
        fn withdraw(env: Env, user: Address, ptoken_amount: u128);
        fn borrow(env: Env, user: Address, amount: u128);
        fn update_interest(env: Env);
        fn get_user_borrow_balance(env: Env, user: Address) -> u128;
        fn get_idle_cash_buffer_bps(env: Env) -> u32;
        fn get_underlying_token(env: Env) -> Address;
        fn get_boosted_vault(env: Env) -> Option<Address>;
    }
}

const CONTROLLER: &[u8] = include_bytes!("../../../build/test/simple_peridottroller.wasm");
const VAULT: &[u8] = include_bytes!("../../../build/test/receipt_vault.wasm");
const JRM: &[u8] = include_bytes!("../../../build/test/jump_rate_model.wasm");
const DISTRIBUTOR: &[u8] = include_bytes!("../../../build/test/reward_distributor.wasm");
const REAL_ROUTER: &[u8] = include_bytes!("../../../build/test/price_router_ext.wasm");
const ROUTER: &[u8] = include_bytes!("../../../build/test/mock_price_router.wasm");

// Mainnet per-transaction limits (CPU instructions, memory bytes).
const NET_CPU: u64 = 400_000_000;
const NET_MEM: u64 = 41_943_040;
const ONE: i128 = 10_000_000; // 7 decimals
const PRICE_1_USD: i128 = 100_000_000_000_000; // 14 decimals

struct F<'a> {
    env: Env,
    mf: MarketFactoryClient<'a>,
    admin: Address,
    owner: Address,
    reflector: Address,
    usdc: Address,
    xlm: Address,
}

fn token(env: &Env, name: &str) -> Address {
    let id = env.register(mock_token::MockToken, ());
    let c = mock_token::MockTokenClient::new(env, &id);
    c.initialize(
        &soroban_sdk::String::from_str(env, name),
        &soroban_sdk::String::from_str(env, name),
        &7u32,
    );
    id
}

fn setup<'a>() -> F<'a> {
    setup_with(ROUTER)
}

fn setup_with<'a>(router: &[u8]) -> F<'a> {
    let env = Env::default();
    env.mock_all_auths();
    env.ledger().set_timestamp(1_000_000);
    // CPU/memory budgets accumulate across calls in a test; per-transaction fit is checked in
    // `transactions_fit_network_limits`. The ledger-entry footprint limit stays enforced.
    env.cost_estimate().budget().reset_unlimited();
    let admin = Address::generate(&env);
    let treasury = Address::generate(&env);
    let mf_addr = Address::from_str(&env, TEST_ADMIN_ADDRESS);
    env.register_at(&mf_addr, MarketFactory, (admin.clone(), treasury));
    let mf = MarketFactoryClient::new(&env, &mf_addr);

    let reflector = env.register(mock_reflector::MockReflector, (14u32, 300u32));
    let wasm = WasmHashes {
        controller: env.deployer().upload_contract_wasm(CONTROLLER),
        receipt_vault: env.deployer().upload_contract_wasm(VAULT),
        jump_rate: env.deployer().upload_contract_wasm(JRM),
        price_router: env.deployer().upload_contract_wasm(router),
        reward_distributor: env.deployer().upload_contract_wasm(DISTRIBUTOR),
        blend_adapter: None,
        aquarius_vault: None,
        aquarius_reserve: None,
        zenex_adapter: None,
        xoxno_adapter: None,
    };
    mf.set_wasm(&admin, &wasm);
    mf.set_oracle_allowed(&admin, &reflector, &true);
    let owner = Address::generate(&env);
    let usdc = token(&env, "USDC");
    let xlm = token(&env, "XLM");
    F { env, mf, admin, owner, reflector, usdc, xlm }
}

fn price_cfg(f: &F, sym: &str) -> PriceConfig {
    PriceConfig::ReflectorOnly(ReflectorOnlyCfg {
        oracle: f.reflector.clone(),
        asset: Asset::Other(Symbol::new(&f.env, sym)),
    })
}

fn stable_rates() -> RateModel {
    RateModel { base: 0, multiplier: 80_000, jump: 2_000_000, kink: 900_000 }
}

fn cfg(f: &F, token: &Address, sym: &str) -> MarketConfig {
    MarketConfig {
        token: token.clone(),
        collateral_factor: 700_000,
        supply_cap: 1_000_000 * ONE as u128,
        borrow_cap: 500_000 * ONE as u128,
        reserve_factor: 100_000,
        rates: stable_rates(),
        idle_buffer_bps: 2_000,
        yield_route: YieldRoute::None,
        price: price_cfg(f, sym),
        margin_enabled: false,
        supply_reward_per_sec: 0,
        borrow_reward_per_sec: 0,
    }
}

fn set_price(f: &F, group: u32, token: &Address, price: i128) {
    let g = f.mf.get_group(&group);
    mock_price_router::MockPriceRouterClient::new(&f.env, &g.price_router).set_price(token, &price);
}

fn add_active(f: &F, group: u32, c: &MarketConfig) -> Address {
    let m = f.mf.add_market(&f.owner, &group, c);
    f.mf.activate_market(&f.owner, &group, &m);
    m
}

fn group_with_market<'a>(f: &F<'a>) -> (u32, Address) {
    let id = f.mf.create_group(&f.owner, &symbol_short!("Meridian"));
    let m = add_active(f, id, &cfg(f, &f.usdc, "USDC"));
    set_price(f, id, &f.usdc, PRICE_1_USD);
    (id, m)
}

// ---------------------------------------------------------------------------

#[test]
fn create_group_wires_oracle_and_indexes_owner() {
    let f = setup();
    let id = f.mf.create_group(&f.owner, &symbol_short!("Meridian"));
    assert_eq!(id, 1);
    let g = f.mf.get_group(&id);
    assert_eq!(g.owner, f.owner);
    let c = ctrl::Client::new(&f.env, &g.controller);
    assert_eq!(c.get_oracle(), Some(g.price_router.clone()));
    assert_eq!(c.get_admin(), f.mf.address);
    assert_eq!(f.mf.groups_of(&f.owner).len(), 1);
    assert_eq!(f.mf.group_count(), 1);
    assert_eq!(f.mf.list_groups(&0, &10).len(), 1);
    let id2 = f.mf.create_group(&f.owner, &symbol_short!("Second"));
    assert_eq!(id2, 2);
    assert_ne!(f.mf.get_group(&2).controller, g.controller);
}

#[test]
fn add_market_wires_everything_and_supply_borrow_work() {
    let f = setup();
    let (id, m) = group_with_market(&f);
    let g = f.mf.get_group(&id);
    assert_eq!(g.markets.len(), 1);
    let c = ctrl::Client::new(&f.env, &g.controller);
    assert_eq!(c.get_market_cf(&m), 700_000);
    let v = vault::Client::new(&f.env, &m);
    assert_eq!(v.get_underlying_token(), f.usdc);
    assert_eq!(v.get_idle_cash_buffer_bps(), 2_000);
    assert_eq!(f.mf.market_token(&id, &m), f.usdc);

    // second market, added after launch
    let m2 = add_active(&f, id, &cfg(&f, &f.xlm, "XLM"));
    set_price(&f, id, &f.xlm, PRICE_1_USD / 10);
    assert_eq!(f.mf.get_group(&id).markets.len(), 2);

    let usdc = mock_token::MockTokenClient::new(&f.env, &f.usdc);
    let xlm = mock_token::MockTokenClient::new(&f.env, &f.xlm);
    let alice = Address::generate(&f.env);
    let bob = Address::generate(&f.env);
    usdc.mint(&alice, &(1_000 * ONE));
    xlm.mint(&bob, &(10_000 * ONE));
    v.deposit(&alice, &((1_000 * ONE) as u128));
    // bob supplies XLM as collateral and borrows USDC
    vault::Client::new(&f.env, &m2).deposit(&bob, &((10_000 * ONE) as u128));
    c.enter_market(&bob, &m2);
    c.enter_market(&bob, &m);
    v.borrow(&bob, &((100 * ONE) as u128));
    assert_eq!(usdc.balance(&bob), 100 * ONE);
}

#[test]
fn zero_percent_borrow_market_accrues_no_interest() {
    let f = setup();
    let id = f.mf.create_group(&f.owner, &symbol_short!("Zero"));
    let mut cfg_usdc = cfg(&f, &f.usdc, "USDC");
    cfg_usdc.rates = RateModel { base: 0, multiplier: 0, jump: 0, kink: 0 };
    let m = add_active(&f, id, &cfg_usdc);
    let m2 = add_active(&f, id, &cfg(&f, &f.xlm, "XLM"));
    set_price(&f, id, &f.usdc, PRICE_1_USD);
    set_price(&f, id, &f.xlm, PRICE_1_USD);
    let g = f.mf.get_group(&id);
    let c = ctrl::Client::new(&f.env, &g.controller);
    let usdc = mock_token::MockTokenClient::new(&f.env, &f.usdc);
    let xlm = mock_token::MockTokenClient::new(&f.env, &f.xlm);
    let alice = Address::generate(&f.env);
    let bob = Address::generate(&f.env);
    usdc.mint(&alice, &(1_000 * ONE));
    xlm.mint(&bob, &(1_000 * ONE));
    let v = vault::Client::new(&f.env, &m);
    v.deposit(&alice, &((1_000 * ONE) as u128));
    vault::Client::new(&f.env, &m2).deposit(&bob, &((1_000 * ONE) as u128));
    c.enter_market(&bob, &m2);
    c.enter_market(&bob, &m);
    v.borrow(&bob, &((100 * ONE) as u128));
    let before = v.get_user_borrow_balance(&bob);
    f.env.ledger().set_timestamp(1_000_000 + 365 * 24 * 3600);
    v.update_interest();
    assert_eq!(v.get_user_borrow_balance(&bob), before);
}

#[test]
fn guardrails_reject() {
    let f = setup();
    let id = f.mf.create_group(&f.owner, &symbol_short!("G"));
    let ok = cfg(&f, &f.usdc, "USDC");

    let mut c = ok.clone();
    c.collateral_factor = 900_000;
    assert_eq!(f.mf.try_add_market(&f.owner, &id, &c).err().unwrap().unwrap(), FactoryError::CollateralFactorTooHigh);
    let mut c = ok.clone();
    c.collateral_factor = 0;
    assert_eq!(f.mf.try_add_market(&f.owner, &id, &c).err().unwrap().unwrap(), FactoryError::CollateralFactorTooLow);
    let mut c = ok.clone();
    c.supply_cap = 0;
    assert_eq!(f.mf.try_add_market(&f.owner, &id, &c).err().unwrap().unwrap(), FactoryError::CapRequired);
    let mut c = ok.clone();
    c.borrow_cap = 0;
    assert_eq!(f.mf.try_add_market(&f.owner, &id, &c).err().unwrap().unwrap(), FactoryError::CapRequired);
    let mut c = ok.clone();
    c.idle_buffer_bps = 500;
    assert_eq!(f.mf.try_add_market(&f.owner, &id, &c).err().unwrap().unwrap(), FactoryError::IdleBufferOutOfRange);
    let mut c = ok.clone();
    c.reserve_factor = 600_000;
    assert_eq!(f.mf.try_add_market(&f.owner, &id, &c).err().unwrap().unwrap(), FactoryError::ReserveFactorTooHigh);
    let mut c = ok.clone();
    c.rates.kink = 2_000_000;
    assert_eq!(f.mf.try_add_market(&f.owner, &id, &c).err().unwrap().unwrap(), FactoryError::RatesOutOfRange);
    let mut c = ok.clone();
    c.supply_reward_per_sec = 2_000_000_000_000;
    assert_eq!(f.mf.try_add_market(&f.owner, &id, &c).err().unwrap().unwrap(), FactoryError::RewardSpeedTooHigh);
    let mut c = ok.clone();
    c.supply_reward_per_sec = 1;
    assert_eq!(f.mf.try_add_market(&f.owner, &id, &c).err().unwrap().unwrap(), FactoryError::RewardsNotSet);
    let mut c = ok.clone();
    c.price = PriceConfig::ReflectorOnly(ReflectorOnlyCfg {
        oracle: Address::generate(&f.env),
        asset: Asset::Other(symbol_short!("USDC")),
    });
    assert_eq!(f.mf.try_add_market(&f.owner, &id, &c).err().unwrap().unwrap(), FactoryError::OracleNotAllowed);
    let mut c = ok.clone();
    c.price = PriceConfig::AquariusOnly(peridot_interfaces::AquariusOnlyCfg {
        pool: Address::generate(&f.env),
        quote_token: f.xlm.clone(),
    });
    assert_eq!(f.mf.try_add_market(&f.owner, &id, &c).err().unwrap().unwrap(), FactoryError::PriceModeNotAllowed);
    let mut c = ok.clone();
    c.yield_route = YieldRoute::Blend(BlendRoute { fee_vault: Address::generate(&f.env) });
    assert_eq!(f.mf.try_add_market(&f.owner, &id, &c).err().unwrap().unwrap(), FactoryError::Unsupported);
    let mut c = ok.clone();
    c.token = Address::generate(&f.env); // not a token contract
    assert!(f.mf.try_add_market(&f.owner, &id, &c).is_err());

    // duplicate token
    let first = f.mf.add_market(&f.owner, &id, &ok);
    assert_eq!(f.mf.try_activate_market(&f.owner, &id, &Address::generate(&f.env)).err().unwrap().unwrap(), FactoryError::MarketNotFound);
    f.mf.activate_market(&f.owner, &id, &first);
    assert_eq!(f.mf.try_activate_market(&f.owner, &id, &first).err().unwrap().unwrap(), FactoryError::MarketAlreadyActive);
    assert_eq!(f.mf.try_add_market(&f.owner, &id, &ok).err().unwrap().unwrap(), FactoryError::MarketAlreadyExists);
}

#[test]
fn non_owner_and_admin_checks() {
    let f = setup();
    let (id, m) = group_with_market(&f);
    let mallory = Address::generate(&f.env);
    assert_eq!(f.mf.try_add_market(&mallory, &id, &cfg(&f, &f.xlm, "XLM")).err().unwrap().unwrap(), FactoryError::NotOwner);
    assert_eq!(f.mf.try_update_rates(&mallory, &id, &m, &stable_rates()).err().unwrap().unwrap(), FactoryError::NotOwner);
    assert_eq!(f.mf.try_pause_market(&mallory, &id, &m, &true, &false).err().unwrap().unwrap(), FactoryError::NotOwner);
    assert_eq!(f.mf.try_set_wasm(&mallory, &f.mf.get_wasm()).err().unwrap().unwrap(), FactoryError::NotAdmin);
    assert_eq!(f.mf.try_set_oracle_allowed(&mallory, &mallory, &true).err().unwrap().unwrap(), FactoryError::NotAdmin);
    assert_eq!(
        f.mf.try_upgrade(&mallory, &f.mf.get_wasm().controller).err().unwrap().unwrap(),
        FactoryError::NotAdmin
    );
    // margin hooks only for the registered margin factory
    let mc = Address::generate(&f.env);
    assert_eq!(f.mf.try_wire_margin(&mallory, &id, &mc, &1_080_000, &0).err().unwrap().unwrap(), FactoryError::MarginFactoryNotSet);
    f.mf.set_margin_factory(&f.admin, &Address::generate(&f.env));
    assert_eq!(f.mf.try_wire_margin(&mallory, &id, &mc, &1_080_000, &0).err().unwrap().unwrap(), FactoryError::NotMarginFactory);
}

#[test]
fn wasm_must_be_set_before_creating_groups() {
    let env = Env::default();
    env.mock_all_auths();
    let mf_addr = Address::from_str(&env, TEST_ADMIN_ADDRESS);
    env.register_at(&mf_addr, MarketFactory, (Address::generate(&env), Address::generate(&env)));
    let mf = MarketFactoryClient::new(&env, &mf_addr);
    assert_eq!(
        mf.try_create_group(&Address::generate(&env), &symbol_short!("X")).err().unwrap().unwrap(),
        FactoryError::WasmNotSet
    );
}

#[test]
fn allowlist_mode_gates_creators() {
    let f = setup();
    f.mf.set_allowlist_mode(&f.admin, &true);
    assert_eq!(f.mf.try_create_group(&f.owner, &symbol_short!("X")).err().unwrap().unwrap(), FactoryError::CreatorNotAllowed);
    f.mf.set_creator_allowed(&f.admin, &f.owner, &true);
    f.mf.create_group(&f.owner, &symbol_short!("X"));
}

#[test]
fn update_risk_stages_cf_and_applies_after_delay() {
    let f = setup();
    let (id, m) = group_with_market(&f);
    let g = f.mf.get_group(&id);
    let c = ctrl::Client::new(&f.env, &g.controller);
    // caps and reserve factor are immediate; CF is staged
    f.mf.update_risk(&f.owner, &id, &m, &600_000, &(2_000_000 * ONE as u128), &(100_000 * ONE as u128), &200_000);
    let rec = f.mf.get_market_record(&id, &m);
    assert_eq!(rec.cfg.supply_cap, 2_000_000 * ONE as u128);
    assert_eq!(rec.cfg.reserve_factor, 200_000);
    assert_eq!(rec.cfg.collateral_factor, 700_000);
    assert_eq!(c.get_market_cf(&m), 700_000);
    assert_eq!(rec.pending_cf.len(), 1);
    // too early
    assert_eq!(f.mf.try_apply_pending(&f.owner, &id, &Some(m.clone())).err().unwrap().unwrap(), FactoryError::NotYetApplicable);
    // a CF over the cap is still rejected
    assert_eq!(
        f.mf.try_update_risk(&f.owner, &id, &m, &900_000, &1u128, &1u128, &0).err().unwrap().unwrap(),
        FactoryError::CollateralFactorTooHigh
    );
    f.env.ledger().set_timestamp(1_000_000 + 61);
    assert_eq!(f.mf.apply_pending(&f.owner, &id, &Some(m.clone())), 1);
    assert_eq!(c.get_market_cf(&m), 600_000);
    assert_eq!(f.mf.get_market_config(&id, &m).collateral_factor, 600_000);
    assert_eq!(f.mf.get_market_record(&id, &m).pending_cf.len(), 0);
    assert_eq!(f.mf.try_apply_pending(&f.owner, &id, &Some(m.clone())).err().unwrap().unwrap(), FactoryError::NothingPending);
}

#[test]
fn update_rates_idle_buffer_and_pause() {
    let f = setup();
    let (id, m) = group_with_market(&f);
    f.mf.update_rates(&f.owner, &id, &m, &RateModel { base: 0, multiplier: 0, jump: 0, kink: 0 });
    assert_eq!(f.mf.get_market_config(&id, &m).rates.multiplier, 0);
    assert_eq!(
        f.mf.try_update_rates(&f.owner, &id, &m, &RateModel { base: 20_000_000, multiplier: 0, jump: 0, kink: 0 }).err().unwrap().unwrap(),
        FactoryError::RatesOutOfRange
    );
    f.mf.update_idle_buffer(&f.owner, &id, &m, &5_000);
    assert_eq!(vault::Client::new(&f.env, &m).get_idle_cash_buffer_bps(), 5_000);
    assert_eq!(f.mf.try_update_idle_buffer(&f.owner, &id, &m, &100).err().unwrap().unwrap(), FactoryError::IdleBufferOutOfRange);

    let g = f.mf.get_group(&id);
    let c = ctrl::Client::new(&f.env, &g.controller);
    f.mf.pause_market(&f.owner, &id, &m, &true, &true);
    assert!(c.is_deposit_paused(&m));
    assert!(c.is_borrow_paused(&m));
    f.mf.pause_market(&f.owner, &id, &m, &false, &false);
    assert!(!c.is_deposit_paused(&m));
}

#[test]
fn update_price_is_staged() {
    let f = setup();
    let (id, m) = group_with_market(&f);
    let new_cfg = price_cfg(&f, "USDT");
    f.mf.update_price(&f.owner, &id, &m, &new_cfg);
    assert_eq!(f.mf.try_apply_pending(&f.owner, &id, &Some(m.clone())).err().unwrap().unwrap(), FactoryError::NotYetApplicable);
    f.env.ledger().set_timestamp(1_000_000 + 61);
    assert_eq!(f.mf.apply_pending(&f.owner, &id, &None), 1);
    assert_eq!(f.mf.get_market_config(&id, &m).price, new_cfg);
    let g = f.mf.get_group(&id);
    let r = mock_price_router::MockPriceRouterClient::new(&f.env, &g.price_router);
    assert_eq!(r.get_asset_config(&f.usdc), Some(new_cfg));
    // an unlisted oracle cannot be staged
    let bad = PriceConfig::ReflectorOnly(ReflectorOnlyCfg { oracle: Address::generate(&f.env), asset: Asset::Other(symbol_short!("X")) });
    assert_eq!(f.mf.try_update_price(&f.owner, &id, &m, &bad).err().unwrap().unwrap(), FactoryError::OracleNotAllowed);
}

#[test]
fn transfer_ownership_moves_index() {
    let f = setup();
    let (id, _m) = group_with_market(&f);
    let new_owner = Address::generate(&f.env);
    f.mf.transfer_ownership(&f.owner, &id, &new_owner);
    assert_eq!(f.mf.get_group(&id).owner, new_owner);
    assert_eq!(f.mf.groups_of(&f.owner).len(), 0);
    assert_eq!(f.mf.groups_of(&new_owner).len(), 1);
    assert_eq!(f.mf.try_pause_market(&f.owner, &id, &Address::generate(&f.env), &true, &true).err().unwrap().unwrap(), FactoryError::NotOwner);
}

#[test]
fn keeper_mode_is_recorded() {
    let f = setup();
    let (id, _m) = group_with_market(&f);
    f.mf.set_keeper_mode(&f.owner, &id, &KeeperMode::PeridotHosted);
    assert_eq!(f.mf.get_group(&id).keeper_mode, KeeperMode::PeridotHosted);
}

#[test]
fn defindex_style_vault_attaches_and_receives_idle_cash() {
    let f = setup();
    let id = f.mf.create_group(&f.owner, &symbol_short!("Y"));
    // mock vault stands in for a DeFindex vault; its market field is set to the receipt-vault later
    // by pointing it at a placeholder, then checking deposits flow through the boosted hook.
    let placeholder = Address::generate(&f.env);
    let yv = f.env.register(mock_yield_vault::MockYieldVault, (f.admin.clone(), placeholder, f.usdc.clone()));
    let mut c = cfg(&f, &f.usdc, "USDC");
    c.yield_route = YieldRoute::Defindex(DefindexRoute { vault: yv.clone() });
    let m = add_active(&f, id, &c);
    // unreviewed vaults are refused until Peridot allowlists them
    assert_eq!(f.mf.try_attach_yield(&f.owner, &id, &m).err().unwrap().unwrap(), FactoryError::YieldVaultNotAllowed);
    f.mf.set_yield_vault_allowed(&f.admin, &yv, &true);
    set_price(&f, id, &f.usdc, PRICE_1_USD);
    // wrong underlying is rejected at attach time
    let mut bad = cfg(&f, &f.xlm, "XLM");
    bad.yield_route = YieldRoute::Defindex(DefindexRoute { vault: yv.clone() });
    f.mf.set_yield_vault_allowed(&f.admin, &yv, &true);
    let bad_m = add_active(&f, id, &bad);
    assert_eq!(f.mf.try_attach_yield(&f.owner, &id, &bad_m).err().unwrap().unwrap(), FactoryError::InvalidYieldVault);

    assert_eq!(f.mf.attach_yield(&f.owner, &id, &m), None);
    assert_eq!(vault::Client::new(&f.env, &m).get_boosted_vault(), Some(yv.clone()));
    assert_eq!(f.mf.try_attach_yield(&f.owner, &id, &m).err().unwrap().unwrap(), FactoryError::YieldAlreadyAttached);
    assert_eq!(f.mf.get_market_record(&id, &m).boosted_vault, Some(yv));
}

fn report(f: &F, name: &str) {
    let mut budget = f.env.cost_estimate().budget();
    let cpu = budget.cpu_instruction_cost();
    let mem = budget.memory_bytes_cost();
    std::println!("{name}: cpu {cpu} mem {mem}");
    assert!(cpu < NET_CPU && mem < NET_MEM, "{name} over the per-transaction limit");
    budget.reset_unlimited();
}

#[test]
fn transactions_fit_network_limits() {
    let f = setup();
    let id = f.mf.create_group(&f.owner, &symbol_short!("Cost"));
    report(&f, "create_group");
    let m = f.mf.add_market(&f.owner, &id, &cfg(&f, &f.usdc, "USDC"));
    report(&f, "add_market");
    f.mf.activate_market(&f.owner, &id, &m);
    report(&f, "activate_market");
    std::println!("{:?}", f.env.cost_estimate().resources());
    let mut yc = cfg(&f, &f.xlm, "XLM");
    yc.supply_reward_per_sec = 0;
    let m2 = f.mf.add_market(&f.owner, &id, &yc);
    report(&f, "add_market #2");
    f.mf.activate_market(&f.owner, &id, &m2);
    report(&f, "activate_market #2");
    f.mf.update_risk(&f.owner, &id, &m, &600_000, &1_000_000u128, &1_000_000u128, &0);
    report(&f, "update_risk");
}

#[test]
fn rewards_distributor_pays_claims_through_the_real_controller() {
    let f = setup();
    let id = f.mf.create_group(&f.owner, &symbol_short!("Rew"));
    let reward = token(&f.env, "RWD");
    // speeds cannot be set at market creation: the distributor does not exist yet
    let mut c = cfg(&f, &f.usdc, "USDC");
    c.supply_reward_per_sec = 10;
    assert_eq!(f.mf.try_add_market(&f.owner, &id, &c).err().unwrap().unwrap(), FactoryError::RewardsNotSet);
    c.supply_reward_per_sec = 0;
    let m = add_active(&f, id, &c);
    set_price(&f, id, &f.usdc, PRICE_1_USD);
    assert_eq!(
        f.mf.try_set_rewards(&f.owner, &id, &Address::generate(&f.env)).err().unwrap().unwrap(),
        FactoryError::InvalidToken
    );
    let dist = f.mf.set_rewards(&f.owner, &id, &reward);
    assert_eq!(f.mf.get_group(&id).reward_distributor, Some(dist.clone()));
    assert_eq!(f.mf.try_set_rewards(&f.owner, &id, &reward).err().unwrap().unwrap(), FactoryError::RewardsAlreadySet);
    // audited-core limitation: no new markets once rewards are on
    assert_eq!(
        f.mf.try_add_market(&f.owner, &id, &cfg(&f, &f.xlm, "XLM")).err().unwrap().unwrap(),
        FactoryError::MarketsLockedByRewards
    );

    f.mf.set_reward_speeds(&f.owner, &id, &m, &10, &0);
    // fund the distributor (anyone can)
    let reward_c = mock_token::MockTokenClient::new(&f.env, &reward);
    reward_c.mint(&f.owner, &(1_000 * ONE));
    let dist_c = peridot_interfaces::RewardDistributorClient::new(&f.env, &dist);
    dist_c.fund(&f.owner, &(1_000 * ONE));
    assert_eq!(dist_c.balance_available(), 1_000 * ONE);

    let usdc = mock_token::MockTokenClient::new(&f.env, &f.usdc);
    let alice = Address::generate(&f.env);
    usdc.mint(&alice, &(100 * ONE));
    let g = f.mf.get_group(&id);
    let ctrl = ctrl::Client::new(&f.env, &g.controller);
    ctrl.enter_market(&alice, &m);
    vault::Client::new(&f.env, &m).deposit(&alice, &((100 * ONE) as u128));
    f.env.ledger().set_timestamp(1_000_000 + 100);
    ctrl.claim(&alice);
    assert_eq!(reward_c.balance(&alice), 1_000, "10 per second for 100 seconds");

    // speeds change through the factory
    f.mf.set_reward_speeds(&f.owner, &id, &m, &20, &0);
    f.env.ledger().set_timestamp(1_000_000 + 200);
    ctrl.claim(&alice);
    assert_eq!(reward_c.balance(&alice), 3_000);

    // too-fast speeds are rejected
    assert_eq!(
        f.mf.try_set_reward_speeds(&f.owner, &id, &m, &2_000_000_000_000, &0).err().unwrap().unwrap(),
        FactoryError::RewardSpeedTooHigh
    );
    let mallory = Address::generate(&f.env);
    assert_eq!(f.mf.try_withdraw_unallocated(&mallory, &id, &mallory, &1).err().unwrap().unwrap(), FactoryError::NotOwner);
    f.mf.withdraw_unallocated(&f.owner, &id, &f.owner, &500);
    assert_eq!(reward_c.balance(&f.owner), 500);
}

#[test]
fn real_price_router_reads_reflector_through_the_controller() {
    let f = setup_with(REAL_ROUTER);
    let refl = mock_reflector::MockReflectorClient::new(&f.env, &f.reflector);
    let usdc_key = Asset::Other(symbol_short!("USDC"));
    let xlm_key = Asset::Other(symbol_short!("XLM"));
    // a market whose asset is not on the feed is rejected when the price source is registered
    let id = f.mf.create_group(&f.owner, &symbol_short!("Real"));
    let m = f.mf.add_market(&f.owner, &id, &cfg(&f, &f.usdc, "USDC"));
    assert!(f.mf.try_activate_market(&f.owner, &id, &m).is_err());
    refl.set_price(&usdc_key, &PRICE_1_USD, &1_000_000u64);
    refl.set_price(&xlm_key, &(PRICE_1_USD / 10), &1_000_000u64);
    f.mf.activate_market(&f.owner, &id, &m);
    let m2 = add_active(&f, id, &cfg(&f, &f.xlm, "XLM"));
    let g = f.mf.get_group(&id);
    let router = peridot_interfaces::PriceRouterClient::new(&f.env, &g.price_router);
    assert_eq!(router.lastprice(&Asset::Stellar(f.usdc.clone())).unwrap().price, PRICE_1_USD);
    assert_eq!(router.check(&f.xlm).status, symbol_short!("ok"));

    let usdc = mock_token::MockTokenClient::new(&f.env, &f.usdc);
    let xlm = mock_token::MockTokenClient::new(&f.env, &f.xlm);
    let (alice, bob) = (Address::generate(&f.env), Address::generate(&f.env));
    usdc.mint(&alice, &(1_000 * ONE));
    xlm.mint(&bob, &(10_000 * ONE));
    let c = ctrl::Client::new(&f.env, &g.controller);
    vault::Client::new(&f.env, &m).deposit(&alice, &((1_000 * ONE) as u128));
    vault::Client::new(&f.env, &m2).deposit(&bob, &((10_000 * ONE) as u128));
    c.enter_market(&bob, &m2);
    c.enter_market(&bob, &m);
    vault::Client::new(&f.env, &m).borrow(&bob, &((100 * ONE) as u128));
    // the feed goes stale: no more borrowing, the circuit breaker is the missing price
    f.env.ledger().set_timestamp(1_000_000 + 10_000);
    assert!(vault::Client::new(&f.env, &m).try_borrow(&bob, &((10 * ONE) as u128)).is_err());
    refl.set_price(&usdc_key, &PRICE_1_USD, &(1_000_000u64 + 10_000));
    refl.set_price(&xlm_key, &(PRICE_1_USD / 10), &(1_000_000u64 + 10_000));
    vault::Client::new(&f.env, &m).borrow(&bob, &((10 * ONE) as u128));
}
