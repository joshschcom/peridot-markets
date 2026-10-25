//! End to end on Wasm: launch through the REAL factory (token and curve deployed from their Wasm), trade to
//! the target, graduate with the REAL market factory and the real core Wasm (`build/test`), against the
//! Aquarius router double from the curve crate. Proves `is_curve` end to end and meters each step with the
//! curve running as Wasm.
#![cfg(test)]
extern crate std;

use market_factory::{MarketFactory, MarketFactoryClient};
use mock_token::{MockToken, MockTokenClient};
use peridot_interfaces::{
    Asset, AquariusOnlyCfg, PriceConfig, ReflectorOnlyCfg, WasmHashes, TEST_ADMIN_ADDRESS,
};
use soroban_sdk::{testutils::{Address as _, Ledger as _}, token, Address, Bytes, Env, String, Symbol};

use crate::test_aquarius::{TestPool, TestRouter, TestRouterClient};
use crate::{default_preset, LaunchFactory, LaunchFactoryClient, LaunchParams, Preset};

const TOKEN_WASM: &[u8] = include_bytes!("../testdata/launchpad_token.wasm");
const CURVE_WASM: &[u8] = include_bytes!("../testdata/launchpad_curve.wasm");
const CONTROLLER: &[u8] = include_bytes!("../../../build/test/simple_peridottroller.wasm");
const VAULT: &[u8] = include_bytes!("../../../build/test/receipt_vault.wasm");
const JRM: &[u8] = include_bytes!("../../../build/test/jump_rate_model.wasm");
const DISTRIBUTOR: &[u8] = include_bytes!("../../../build/test/reward_distributor.wasm");
const ROUTER: &[u8] = include_bytes!("../../../build/test/mock_price_router.wasm");

const X7: i128 = 10_000_000;
const NET_CPU: i64 = 400_000_000;
const NET_MEM: i64 = 41_943_040;
const NET_READ_ENTRIES: u32 = 100;
const NET_WRITE_ENTRIES: u32 = 50;

mod curve_api {
    use soroban_sdk::{contractclient, Address, Env};
    #[contractclient(name = "Curve")]
    #[allow(dead_code)]
    pub trait CurveApi {
        fn buy(env: Env, user: Address, quote_in: i128, min_tokens_out: i128) -> i128;
        fn graduate(env: Env, payer: Address) -> u32;
        fn claim_group(env: Env, creator: Address) -> u32;
        fn claim_fees(env: Env) -> (i128, i128);
    }
}
use curve_api::Curve;

mod supply_api {
    use soroban_sdk::{contractclient, Env};
    #[contractclient(name = "Supply")]
    #[allow(dead_code)]
    pub trait SupplyApi {
        fn total_supply(env: Env) -> i128;
    }
}
use supply_api::Supply;

fn mock_token(env: &Env, name: &str) -> (Address, MockTokenClient<'static>) {
    let id = env.register(MockToken, ());
    let c = MockTokenClient::new(env, &id);
    c.initialize(&String::from_str(env, name), &String::from_str(env, name), &7u32);
    (id, c)
}

#[test]
fn factory_launched_wasm_curve_graduates_into_pool_and_group() {
    let env = Env::default();
    env.mock_all_auths();
    env.ledger().set_timestamp(1_000_000);
    env.cost_estimate().budget().reset_unlimited();
    let admin = Address::generate(&env);
    let treasury = Address::generate(&env);
    let creator = Address::generate(&env);
    let payer = Address::generate(&env);

    // market factory (native) with the real core Wasm
    let mf_addr = Address::from_str(&env, TEST_ADMIN_ADDRESS);
    env.register_at(&mf_addr, MarketFactory, (admin.clone(), Address::generate(&env)));
    let mf = MarketFactoryClient::new(&env, &mf_addr);
    mf.set_wasm(
        &admin,
        &WasmHashes {
            controller: env.deployer().upload_contract_wasm(CONTROLLER),
            receipt_vault: env.deployer().upload_contract_wasm(VAULT),
            jump_rate: env.deployer().upload_contract_wasm(JRM),
            price_router: env.deployer().upload_contract_wasm(ROUTER),
            reward_distributor: env.deployer().upload_contract_wasm(DISTRIBUTOR),
            blend_adapter: None,
            aquarius_vault: None,
            aquarius_reserve: None,
            zenex_adapter: None,
            xoxno_adapter: None,
        },
    );

    // Aquarius double
    let (aqua_id, aqua) = mock_token(&env, "AQUA");
    let router_id = env.register(TestRouter, (&aqua_id, Address::generate(&env), X7 as u128));
    let router = TestRouterClient::new(&env, &router_id);
    for _ in 0..2 {
        let pool = env.register(TestPool, ());
        let (share, _) = mock_token(&env, "LP");
        router.queue_pool(&pool, &share);
    }

    // launch factory registered as THE launchpad of the market factory
    let (quote_id, quote) = mock_token(&env, "XLM");
    let f_addr = env.register(LaunchFactory, (&admin, &treasury));
    let f = LaunchFactoryClient::new(&env, &f_addr);
    mf.set_launchpad(&admin, &f_addr);
    let oracle = Address::generate(&env);
    let asset = Asset::Other(Symbol::new(&env, "XLM"));
    mf.set_oracle_allowed(&admin, &oracle, &true);
    mf.set_price_feed_allowed(&admin, &quote_id, &oracle, &asset, &true);
    f.set_wasm(
        &admin,
        &env.deployer().upload_contract_wasm(Bytes::from_slice(&env, TOKEN_WASM)),
        &env.deployer().upload_contract_wasm(Bytes::from_slice(&env, CURVE_WASM)),
    );
    f.set_default_presets(&admin, &quote_id);
    f.set_graduation(&admin, &router_id, &mf_addr);
    f.set_quote_price(
        &admin,
        &quote_id,
        &PriceConfig::ReflectorOnly(ReflectorOnlyCfg { oracle: oracle.clone(), asset: asset.clone() }),
    );

    // launch, trade to the target
    let (tok, curve_addr) = f.launch_curve(
        &creator,
        &String::from_str(&env, "Meridian Coin"),
        &String::from_str(&env, "MRD"),
        &LaunchParams {
            quote_token: quote_id.clone(),
            preset: Preset::Fast,
            metadata_uri: String::from_str(&env, ""),
            creator_buy: 0,
            min_tokens_out: 0,
        },
    );
    let curve = Curve::new(&env, &curve_addr);
    let cfg = default_preset(Preset::Fast);
    let buyer = Address::generate(&env);
    quote.mint(&buyer, &(100_000 * X7));
    let sold = curve.buy(&buyer, &(50_000 * X7), &1);
    aqua.mint(&payer, &(5 * X7));

    // graduate: six steps, curve metered as Wasm
    let t = token::Client::new(&env, &tok);
    let supply = Supply::new(&env, &tok);
    let supply_before = supply.total_supply();
    let names = ["pool", "create_group", "quote add_market", "quote activate", "token add_market", "token activate"];
    for (i, name) in names.iter().enumerate() {
        env.cost_estimate().budget().reset_unlimited();
        let step = curve.graduate(&payer);
        assert_eq!(step, i as u32 + 1);
        let r = env.cost_estimate().resources();
        let reads = r.disk_read_entries + r.memory_read_entries;
        std::println!(
            "WASM {name:<18} cpu {:>11} mem {:>10} reads {:>3} writes {:>3}",
            r.instructions, r.mem_bytes, reads, r.write_entries
        );
        assert!(r.instructions < NET_CPU && r.mem_bytes < NET_MEM, "{name} over cpu/mem");
        assert!(reads <= NET_READ_ENTRIES && r.write_entries <= NET_WRITE_ENTRIES, "{name} over entries");
    }

    // pool holds all quote and lp_supply, unsold burned, curve empty
    let unsold = cfg.curve_supply - sold;
    assert_eq!(supply.total_supply(), supply_before - unsold);
    assert_eq!(t.balance(&curve_addr), 0);

    // the factory-registered curve created the group; the creator claims it
    assert_eq!(mf.group_count(), 1);
    let gid = 1u32;
    assert_eq!(mf.get_group(&gid).owner, curve_addr);
    let tm = mf.get_group(&gid).markets.get(1).unwrap();
    let tc = mf.get_market_config(&gid, &tm);
    assert_eq!(tc.collateral_factor, 250_000);
    assert!(matches!(tc.price, PriceConfig::AquariusOnly(AquariusOnlyCfg { .. })));
    assert_eq!(curve.claim_group(&creator), gid);
    assert_eq!(mf.get_group(&gid).owner, creator);
    assert_eq!(mf.groups_of(&creator).get(0).unwrap(), gid);
    curve.claim_fees();
}

#[test]
fn a_curve_the_factory_did_not_deploy_cannot_get_a_pool_priced_market() {
    // the market factory asks THIS factory; an arbitrary address is refused at add_market
    let env = Env::default();
    env.mock_all_auths();
    env.cost_estimate().budget().reset_unlimited();
    let admin = Address::generate(&env);
    let mf_addr = Address::from_str(&env, TEST_ADMIN_ADDRESS);
    env.register_at(&mf_addr, MarketFactory, (admin.clone(), Address::generate(&env)));
    let mf = MarketFactoryClient::new(&env, &mf_addr);
    mf.set_wasm(
        &admin,
        &WasmHashes {
            controller: env.deployer().upload_contract_wasm(CONTROLLER),
            receipt_vault: env.deployer().upload_contract_wasm(VAULT),
            jump_rate: env.deployer().upload_contract_wasm(JRM),
            price_router: env.deployer().upload_contract_wasm(ROUTER),
            reward_distributor: env.deployer().upload_contract_wasm(DISTRIBUTOR),
            blend_adapter: None,
            aquarius_vault: None,
            aquarius_reserve: None,
            zenex_adapter: None,
            xoxno_adapter: None,
        },
    );
    let f_addr = env.register(LaunchFactory, (&admin, &Address::generate(&env)));
    mf.set_launchpad(&admin, &f_addr);
    let (tok, _) = mock_token(&env, "TOK");
    let (q, _) = mock_token(&env, "XLM");
    let stranger = Address::generate(&env);
    let gid = mf.create_group(&stranger, &Symbol::new(&env, "Own"));
    let cfg = peridot_interfaces::MarketConfig {
        token: tok,
        collateral_factor: 250_000,
        supply_cap: 1_000,
        borrow_cap: 100,
        reserve_factor: 100_000,
        rates: peridot_interfaces::RateModel { base: 0, multiplier: 0, jump: 0, kink: 0 },
        idle_buffer_bps: 5_000,
        yield_route: peridot_interfaces::YieldRoute::None,
        price: PriceConfig::AquariusOnly(AquariusOnlyCfg { pool: Address::generate(&env), quote_token: q }),
        margin_enabled: false,
        supply_reward_per_sec: 0,
        borrow_reward_per_sec: 0,
    };
    assert!(mf.try_add_market(&stranger, &gid, &cfg).is_err());
}
