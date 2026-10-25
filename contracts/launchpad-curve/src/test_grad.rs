//! Graduation (stage 2) tests: native curve, the REAL market factory and the REAL core Wasm (`build/test`),
//! an Aquarius router/pool double that mirrors the deployed authorization shape (`test_aquarius.rs`).
#![cfg(test)]
extern crate std;

use market_factory::{MarketFactory, MarketFactoryClient};
use mock_token::{MockToken, MockTokenClient};
use peridot_interfaces::{
    Asset, AquariusOnlyCfg, PriceConfig, ReflectorOnlyCfg, WasmHashes, YieldRoute, TEST_ADMIN_ADDRESS,
};
use soroban_sdk::{
    contract, contractimpl,
    testutils::{Address as _, Ledger as _, MockAuth, MockAuthInvoke},
    Address, Env, IntoVal, String, Symbol, Vec,
};

use crate::params::CurveParams;
use crate::test_aquarius::{TestPool, TestRouter, TestRouterClient};
use crate::{
    CurveError, GradStep, GraduationConfig, GraduationVenue, LaunchpadCurve, LaunchpadCurveClient, Phase,
};
use launchpad_token::{LaunchpadToken, LaunchpadTokenClient};

const X7: i128 = 10_000_000;
/// Testnet creation fee: 1 AQUA.
const AQUA_FEE: i128 = X7;

const CONTROLLER: &[u8] = include_bytes!("../../../build/test/simple_peridottroller.wasm");
const VAULT: &[u8] = include_bytes!("../../../build/test/receipt_vault.wasm");
const JRM: &[u8] = include_bytes!("../../../build/test/jump_rate_model.wasm");
const DISTRIBUTOR: &[u8] = include_bytes!("../../../build/test/reward_distributor.wasm");
const ROUTER: &[u8] = include_bytes!("../../../build/test/mock_price_router.wasm");

// Per-transaction limits used by the network (CPU instructions, memory bytes, ledger entries).
const NET_CPU: i64 = 400_000_000;
const NET_MEM: i64 = 41_943_040;
const NET_READ_ENTRIES: u32 = 100;
const NET_WRITE_ENTRIES: u32 = 50;

#[contract]
pub struct TestLaunchpad;

#[contractimpl]
impl TestLaunchpad {
    pub fn set_curve(env: Env, curve: Address) {
        env.storage().instance().set(&curve, &true);
    }
    pub fn is_curve(env: Env, curve: Address) -> bool {
        env.storage().instance().get(&curve).unwrap_or(false)
    }
}

fn params() -> CurveParams {
    CurveParams {
        virtual_quote: 30_000 * X7,
        virtual_token: 10_730_000_000_000_000,
        curve_supply: 8_000_000_000_000_000,
        lp_supply: 2_000_000_000_000_000,
        graduation_target: 85_000 * X7,
        trade_fee_bps: 100,
        creator_fee_share_bps: 0,
        creator_cap_bps: 500,
    }
}

fn mock_token(env: &Env, name: &str) -> (Address, MockTokenClient<'static>) {
    let id = env.register(MockToken, ());
    let c = MockTokenClient::new(env, &id);
    c.initialize(&String::from_str(env, name), &String::from_str(env, name), &7u32);
    (id, c)
}

struct G {
    env: Env,
    curve: LaunchpadCurveClient<'static>,
    curve_addr: Address,
    token: LaunchpadTokenClient<'static>,
    quote: MockTokenClient<'static>,
    aqua: MockTokenClient<'static>,
    aqua_addr: Address,
    router: TestRouterClient<'static>,
    mf: MarketFactoryClient<'static>,
    launchpad: Address,
    admin: Address,
    creator: Address,
    payer: Address,
    params: CurveParams,
    quote_asset: Asset,
    oracle: Address,
}

/// `token_first`: whether the launched token sorts BEFORE the quote token (Aquarius byte order).
fn setup(token_first: bool) -> G {
    let env = Env::default();
    env.mock_all_auths();
    env.ledger().set_timestamp(1_000_000);
    env.cost_estimate().budget().reset_unlimited();
    let p = params();
    let creator = Address::generate(&env);
    let treasury = Address::generate(&env);
    let factory = Address::generate(&env);
    let admin = Address::generate(&env);
    let payer = Address::generate(&env);

    // ---- real market factory at the address the core Wasm bakes in as admin ----
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

    // ---- tokens: the launched token mints to the pre-generated curve address. Test-env contract ids grow
    // with registration order, so the registration order decides the Aquarius (byte) order. ----
    let curve_addr = Address::generate(&env);
    let supply = p.curve_supply + p.lp_supply;
    let register_token = |env: &Env| {
        env.register(
            LaunchpadToken,
            (&curve_addr, String::from_str(env, "Meridian"), String::from_str(env, "MRD"), supply, String::from_str(env, "")),
        )
    };
    let (token_id, quote_id, quote);
    if token_first {
        token_id = register_token(&env);
        (quote_id, quote) = mock_token(&env, "XLM");
    } else {
        (quote_id, quote) = mock_token(&env, "XLM");
        token_id = register_token(&env);
    }
    assert_eq!(token_id < quote_id, token_first, "token order");
    let (aqua_addr, aqua) = mock_token(&env, "AQUA");

    // ---- Aquarius double ----
    let router_id = env.register(TestRouter, (&aqua_addr, Address::generate(&env), AQUA_FEE as u128));
    let router = TestRouterClient::new(&env, &router_id);
    for _ in 0..3 {
        let pool = env.register(TestPool, ());
        let (share, _) = mock_token(&env, "LP");
        router.queue_pool(&pool, &share);
    }

    // ---- launchpad registry + the quote price mapping the market factory approves ----
    let launchpad = env.register(TestLaunchpad, ());
    TestLaunchpadClient::new(&env, &launchpad).set_curve(&curve_addr);
    mf.set_launchpad(&admin, &launchpad);
    let oracle = Address::generate(&env);
    let quote_asset = Asset::Other(Symbol::new(&env, "XLM"));
    mf.set_oracle_allowed(&admin, &oracle, &true);
    mf.set_price_feed_allowed(&admin, &quote_id, &oracle, &quote_asset, &true);

    env.register_at(
        &curve_addr,
        LaunchpadCurve,
        (
            &token_id,
            &quote_id,
            &creator,
            &factory,
            &treasury,
            p.clone(),
            GraduationConfig {
                venue: GraduationVenue::Aquarius,
                router: router_id.clone(),
                market_factory: mf_addr.clone(),
                quote_price: PriceConfig::ReflectorOnly(ReflectorOnlyCfg {
                    oracle: oracle.clone(),
                    asset: quote_asset.clone(),
                }),
            },
        ),
    );
    aqua.mint(&payer, &(10 * X7));
    G {
        curve: LaunchpadCurveClient::new(&env, &curve_addr),
        token: LaunchpadTokenClient::new(&env, &token_id),
        quote,
        aqua,
        aqua_addr,
        router,
        mf,
        launchpad,
        admin,
        creator,
        payer,
        params: p,
        quote_asset,
        oracle,
        curve_addr,
        env,
    }
}

impl G {
    fn buy_to_target(&self) -> (Address, i128) {
        let u = Address::generate(&self.env);
        self.quote.mint(&u, &(1_000_000 * X7));
        let out = self.curve.buy(&u, &(2 * self.params.graduation_target), &1);
        assert_eq!(self.curve.get_state().phase, Phase::Graduatable);
        (u, out)
    }

    fn sorted_tokens(&self) -> Vec<Address> {
        let cfg = self.curve.get_config();
        let mut v = Vec::new(&self.env);
        if cfg.token < cfg.quote_token {
            v.push_back(cfg.token);
            v.push_back(cfg.quote_token);
        } else {
            v.push_back(cfg.quote_token);
            v.push_back(cfg.token);
        }
        v
    }

    /// One graduation step with CPU and ledger entry metering. Returns `(step, cpu, read entries, write entries)`.
    fn step(&self, label: &str) -> GradStep {
        self.env.cost_estimate().budget().reset_unlimited();
        let step = self.curve.graduate(&self.payer);
        let r = self.env.cost_estimate().resources();
        let reads = r.disk_read_entries + r.memory_read_entries;
        std::println!(
            "{label:<24} cpu {:>11} mem {:>10} reads {:>3} writes {:>3} ({:?})",
            r.instructions,
            r.mem_bytes,
            reads,
            r.write_entries,
            step
        );
        step
    }

    fn graduate_fully(&self) -> std::vec::Vec<GradStep> {
        let mut steps = std::vec::Vec::new();
        loop {
            let s = self.step("graduate");
            steps.push(s);
            if s == GradStep::Graduated {
                return steps;
            }
        }
    }
}

const ALL_STEPS: [GradStep; 6] = [
    GradStep::PoolCreated,
    GradStep::GroupCreated,
    GradStep::QuoteMarketAdded,
    GradStep::QuoteMarketActivated,
    GradStep::TokenMarketAdded,
    GradStep::Graduated,
];

fn check_full_path(g: &G) {
    let (_buyer, sold) = g.buy_to_target();
    let before = g.curve.get_state();
    assert_eq!(before.sold, sold);
    let supply = g.params.curve_supply + g.params.lp_supply;
    assert_eq!(g.token.total_supply(), supply);

    let steps = g.graduate_fully();
    assert_eq!(steps, ALL_STEPS.to_vec());

    let cfg = g.curve.get_config();
    let grad = g.curve.get_graduation().unwrap();
    assert_eq!(grad.step, GradStep::Graduated);
    assert_eq!(g.curve.get_state().phase, Phase::Graduated);

    // ---- the pool: exists in the router for the SORTED pair, holds all quote and the whole lp_supply ----
    let pools = g.router.get_pools(&g.sorted_tokens());
    assert_eq!(pools.len(), 1);
    assert_eq!(pools.get(grad.pool_index.clone()).unwrap(), grad.pool);
    assert_eq!(g.token.balance(&grad.pool), g.params.lp_supply);
    assert_eq!(g.quote.balance(&grad.pool), before.real_quote);
    assert_eq!(grad.quote_in_pool, before.real_quote);
    assert_eq!(grad.token_in_pool, g.params.lp_supply);

    // ---- LP locked: every share burned, none left anywhere ----
    let share = MockTokenClient::new(&g.env, &grad.share_token);
    assert_eq!(share.balance(&g.curve_addr), 0);
    assert_eq!(share.total_supply(), 0);
    assert!(grad.lp_shares_burned > 0);

    // ---- unsold burned: the fixed supply shrank by exactly the unsold tokens ----
    let unsold = g.params.curve_supply - sold;
    assert_eq!(grad.unsold_burned, unsold);
    assert_eq!(g.token.balance(&g.curve_addr), 0);
    assert_eq!(g.token.total_supply(), supply - unsold);
    assert_eq!(g.token.total_supply(), g.params.lp_supply + sold);

    // ---- quote: only the unclaimed fees stay in the curve, and they stay claimable ----
    assert_eq!(g.quote.balance(&g.curve_addr), before.fees_treasury_pending + before.fees_creator_pending);
    g.curve.claim_fees();
    assert_eq!(g.quote.balance(&g.curve_addr), 0);

    // ---- the group: owned by the curve, two active markets ----
    let group = g.mf.get_group(&grad.group_id);
    assert_eq!(group.owner, g.curve_addr);
    assert_eq!(group.name, Symbol::new(&g.env, "MRD"));
    assert_eq!(group.markets.len(), 2);
    let qm = grad.quote_market.clone().unwrap();
    let tm = grad.token_market.clone().unwrap();
    assert_eq!(group.markets.get(0).unwrap(), qm);
    assert_eq!(group.markets.get(1).unwrap(), tm);
    assert_eq!(g.mf.market_token(&grad.group_id, &qm), cfg.quote_token);
    assert_eq!(g.mf.market_token(&grad.group_id, &tm), cfg.token);

    let qc = g.mf.get_market_config(&grad.group_id, &qm);
    assert_eq!(qc.price, PriceConfig::ReflectorOnly(ReflectorOnlyCfg { oracle: g.oracle.clone(), asset: g.quote_asset.clone() }));
    assert_eq!(qc.rates.multiplier, 80_000); // stable-style
    assert!(!qc.margin_enabled);
    assert_eq!(qc.yield_route, YieldRoute::None);

    let tc = g.mf.get_market_config(&grad.group_id, &tm);
    assert_eq!(tc.price, PriceConfig::AquariusOnly(AquariusOnlyCfg { pool: grad.pool.clone(), quote_token: cfg.quote_token.clone() }));
    assert_eq!(tc.collateral_factor, 250_000);
    assert_eq!(tc.supply_cap, (g.params.lp_supply / 10) as u128);
    assert_eq!(tc.borrow_cap, tc.supply_cap / 10);
    assert!(tc.supply_cap > 0 && tc.borrow_cap > 0);
    assert_eq!(tc.idle_buffer_bps, 5_000);
    assert_eq!(tc.reserve_factor, 100_000);
    assert!(!tc.margin_enabled); // margin is OFF; the owner may opt in through the margin factory
    assert_eq!(tc.yield_route, YieldRoute::None);

    // ---- the creator takes the group ----
    assert_eq!(g.curve.claim_group(&g.creator), grad.group_id);
    assert_eq!(g.mf.get_group(&grad.group_id).owner, g.creator);
    assert!(g.curve.get_graduation().unwrap().claimed);
}

#[test]
fn full_path_token_sorts_first() {
    check_full_path(&setup(true));
}

#[test]
fn full_path_quote_sorts_first() {
    check_full_path(&setup(false));
}

#[test]
fn the_router_double_rejects_unsorted_tokens() {
    for token_first in [true, false] {
        let g = setup(token_first);
        let sorted = g.sorted_tokens();
        let unsorted = Vec::from_array(&g.env, [sorted.get(1).unwrap(), sorted.get(0).unwrap()]);
        let user = Address::generate(&g.env);
        let err = g.router.try_init_standard_pool(&user, &unsorted, &30).unwrap_err().unwrap();
        assert_eq!(err, soroban_sdk::Error::from_contract_error(2002));
        // 30 bps only: the double also refuses fee tiers Aquarius refuses
        assert!(g.router.try_init_standard_pool(&user, &sorted, &50).is_err());
    }
}

#[test]
fn graduate_before_target_and_after_graduated_revert() {
    let g = setup(true);
    assert_eq!(g.curve.try_graduate(&g.payer).unwrap_err().unwrap(), CurveError::NotGraduatable);
    // below the target but trading
    let u = Address::generate(&g.env);
    g.quote.mint(&u, &(1_000 * X7));
    g.curve.buy(&u, &(1_000 * X7), &1);
    assert_eq!(g.curve.try_graduate(&g.payer).unwrap_err().unwrap(), CurveError::NotGraduatable);
    assert!(g.curve.get_graduation().is_none());

    g.buy_to_target();
    g.graduate_fully();
    assert_eq!(g.curve.try_graduate(&g.payer).unwrap_err().unwrap(), CurveError::AlreadyGraduated);
    // nothing moved: still exactly one group
    assert_eq!(g.mf.group_count(), 1);
}

#[test]
fn trading_ends_with_the_first_graduation_step() {
    let g = setup(true);
    let (buyer, sold) = g.buy_to_target();
    // before the first step a holder can still sell
    let t = sold / 10;
    g.curve.sell(&buyer, &t, &1);
    assert_eq!(g.curve.get_state().phase, Phase::Graduatable);
    assert_eq!(g.step("pool"), GradStep::PoolCreated);
    assert_eq!(g.curve.get_state().phase, Phase::Graduating);
    // after it: no sells, no buys, no quotes, in every remaining state
    for _ in 0..5 {
        assert_eq!(g.curve.try_sell(&buyer, &1_000, &1).unwrap_err().unwrap(), CurveError::TradingClosed);
        assert_eq!(g.curve.try_quote_sell(&1_000).unwrap_err().unwrap(), CurveError::TradingClosed);
        assert_eq!(g.curve.try_buy(&buyer, &(10 * X7), &1).unwrap_err().unwrap(), CurveError::TradingClosed);
        if g.step("next") == GradStep::Graduated {
            break;
        }
    }
    assert_eq!(g.curve.get_state().phase, Phase::Graduated);
    assert_eq!(g.curve.try_sell(&buyer, &1_000, &1).unwrap_err().unwrap(), CurveError::TradingClosed);
    // the pool was seeded with the post-sell raise, whatever the sell did to real_quote
    let grad = g.curve.get_graduation().unwrap();
    assert_eq!(grad.quote_in_pool, g.curve.get_state().real_quote);
}

#[test]
fn only_the_creator_claims_the_group_and_only_once() {
    let g = setup(true);
    g.buy_to_target();
    let stranger = Address::generate(&g.env);
    // not before graduation completes
    assert_eq!(g.curve.try_claim_group(&g.creator).unwrap_err().unwrap(), CurveError::NotGraduated);
    g.step("pool");
    g.step("group");
    assert_eq!(g.curve.try_claim_group(&g.creator).unwrap_err().unwrap(), CurveError::NotGraduated);
    while g.step("rest") != GradStep::Graduated {}
    assert_eq!(g.curve.try_claim_group(&stranger).unwrap_err().unwrap(), CurveError::NotCreator);
    // the group is still the curve's
    let gid = g.curve.get_graduation().unwrap().group_id;
    assert_eq!(g.mf.get_group(&gid).owner, g.curve_addr);
    g.curve.claim_group(&g.creator);
    assert_eq!(g.curve.try_claim_group(&g.creator).unwrap_err().unwrap(), CurveError::GroupAlreadyClaimed);
    assert_eq!(g.mf.get_group(&gid).owner, g.creator);
}

#[test]
fn a_payer_without_enough_aqua_fails_cleanly() {
    let g = setup(true);
    g.buy_to_target();
    let poor = Address::generate(&g.env);
    g.aqua.mint(&poor, &(AQUA_FEE - 1));
    let supply_before = g.token.total_supply();
    let quote_held = g.quote.balance(&g.curve_addr);
    assert!(g.curve.try_graduate(&poor).is_err());
    // nothing half-done
    assert!(g.curve.get_graduation().is_none());
    assert_eq!(g.curve.get_state().phase, Phase::Graduatable);
    assert_eq!(g.router.get_pools(&g.sorted_tokens()).len(), 0);
    assert_eq!(g.token.total_supply(), supply_before);
    assert_eq!(g.token.balance(&g.curve_addr), g.params.curve_supply + g.params.lp_supply - g.curve.get_state().sold);
    assert_eq!(g.quote.balance(&g.curve_addr), quote_held);
    assert_eq!(g.aqua.balance(&poor), AQUA_FEE - 1);
    assert_eq!(g.aqua.balance(&g.curve_addr), 0);
    // and a funded payer can still graduate it
    assert_eq!(g.curve.graduate(&g.payer), GradStep::PoolCreated);
    // the whole fee reached Aquarius (not the curve, not the payer)
    assert_eq!(g.aqua.balance(&g.payer), 10 * X7 - AQUA_FEE);
    assert_eq!(g.aqua.balance(&g.curve_addr), 0);
}

#[test]
fn graduation_cost_is_read_live_from_the_router() {
    let g = setup(true);
    assert_eq!(g.curve.graduation_cost(), (g.aqua_addr.clone(), AQUA_FEE));
    g.router.set_pay_amount(&3_000_000_000_000u128); // mainnet: 300,000 AQUA
    assert_eq!(g.curve.graduation_cost(), (g.aqua_addr.clone(), 3_000_000_000_000));
    // a payer that cannot cover the new price reverts; one that can pays exactly that
    g.buy_to_target();
    assert!(g.curve.try_graduate(&g.payer).is_err());
    let rich = Address::generate(&g.env);
    g.aqua.mint(&rich, &3_500_000_000_000);
    g.curve.graduate(&rich);
    assert_eq!(g.aqua.balance(&rich), 500_000_000_000);
}

#[test]
fn an_existing_empty_pool_charges_nothing_and_the_fee_is_refunded() {
    let g = setup(false);
    g.buy_to_target();
    // someone creates the pair first (and pays for it)
    let early = Address::generate(&g.env);
    g.aqua.mint(&early, &AQUA_FEE);
    g.router.init_standard_pool(&early, &g.sorted_tokens(), &30);
    assert_eq!(g.aqua.balance(&early), 0);
    g.curve.graduate(&g.payer);
    // the router charged nothing for the existing pool: the payer gets everything back
    assert_eq!(g.aqua.balance(&g.payer), 10 * X7);
    assert_eq!(g.aqua.balance(&g.curve_addr), 0);
    assert_eq!(g.curve.get_graduation().unwrap().step, GradStep::PoolCreated);
}

#[test]
fn a_front_run_pool_at_another_ratio_blocks_the_step_without_side_effects() {
    let g = setup(true);
    // the attacker buys a little of the token while the curve is open ...
    let attacker = Address::generate(&g.env);
    g.quote.mint(&attacker, &(100 * X7));
    let bought = g.curve.buy(&attacker, &(100 * X7), &1);
    g.buy_to_target();
    // ... creates the pair first and seeds it at a ratio nowhere near the curve's
    g.aqua.mint(&attacker, &AQUA_FEE);
    let tokens = g.sorted_tokens();
    let (idx, _pool) = g.router.init_standard_pool(&attacker, &tokens, &30);
    let cfg = g.curve.get_config();
    let (tok_amt, quote_amt) = (bought / 2, 1_000u128);
    let desired = if cfg.token < cfg.quote_token {
        Vec::from_array(&g.env, [tok_amt as u128, quote_amt])
    } else {
        Vec::from_array(&g.env, [quote_amt, tok_amt as u128])
    };
    g.quote.mint(&attacker, &(quote_amt as i128));
    g.router.deposit(&attacker, &tokens, &idx, &desired, &1);

    let payer_aqua = g.aqua.balance(&g.payer);
    let supply = g.token.total_supply();
    assert_eq!(g.curve.try_graduate(&g.payer).unwrap_err().unwrap(), CurveError::PoolNotFresh);
    // atomic: nothing burned, nothing paid, nothing recorded, trading phase untouched
    assert!(g.curve.get_graduation().is_none());
    assert_eq!(g.curve.get_state().phase, Phase::Graduatable);
    assert_eq!(g.aqua.balance(&g.payer), payer_aqua);
    assert_eq!(g.token.total_supply(), supply);
    assert_eq!(g.token.balance(&g.curve_addr), g.params.curve_supply + g.params.lp_supply - g.curve.get_state().sold);
}

#[test]
fn the_pool_step_needs_only_the_payer_signature() {
    // Only the payer's top-level authorization is mocked: the curve's own authorizations (the router fee
    // transfer and the pool deposit tree) must come from `authorize_as_current_contract`, exactly as on chain.
    for token_first in [true, false] {
        let g = setup(token_first);
        g.buy_to_target();
        g.env.mock_auths(&[MockAuth {
            address: &g.payer,
            invoke: &MockAuthInvoke {
                contract: &g.curve_addr,
                fn_name: "graduate",
                args: (g.payer.clone(),).into_val(&g.env),
                sub_invokes: &[MockAuthInvoke {
                    contract: &g.aqua_addr,
                    fn_name: "transfer",
                    args: (g.payer.clone(), g.curve_addr.clone(), AQUA_FEE).into_val(&g.env),
                    sub_invokes: &[],
                }],
            },
        }]);
        assert_eq!(g.curve.graduate(&g.payer), GradStep::PoolCreated);
        let grad = g.curve.get_graduation().unwrap();
        assert_eq!(g.token.balance(&grad.pool), g.params.lp_supply);
        assert_eq!(g.aqua.balance(&g.payer), 10 * X7 - AQUA_FEE);
    }
}

#[test]
fn without_the_payer_signature_the_pool_step_fails() {
    let g = setup(true);
    g.buy_to_target();
    g.env.mock_auths(&[]);
    assert!(g.curve.try_graduate(&g.payer).is_err());
    assert!(g.curve.get_graduation().is_none());
}

#[test]
fn the_market_steps_wait_for_the_launchpad_registry_and_resume() {
    let g = setup(true);
    g.buy_to_target();
    // the market factory only lets registered curves create AquariusOnly markets: unregister this curve
    let other_registry = g.env.register(TestLaunchpad, ());
    g.mf.set_launchpad(&g.admin, &other_registry);
    for expected in [GradStep::PoolCreated, GradStep::GroupCreated, GradStep::QuoteMarketAdded, GradStep::QuoteMarketActivated] {
        assert_eq!(g.curve.graduate(&g.payer), expected);
    }
    // the token market step reverts cleanly ...
    assert!(g.curve.try_graduate(&g.payer).is_err());
    assert_eq!(g.curve.get_graduation().unwrap().step, GradStep::QuoteMarketActivated);
    assert!(g.curve.get_graduation().unwrap().token_market.is_none());
    // ... and resumes once the registry knows the curve
    TestLaunchpadClient::new(&g.env, &other_registry).set_curve(&g.curve_addr);
    assert_eq!(g.curve.graduate(&g.payer), GradStep::TokenMarketAdded);
    assert_eq!(g.curve.graduate(&g.payer), GradStep::Graduated);
    let _ = g.launchpad;
}

#[test]
fn the_curve_never_exceeds_the_per_transaction_limits() {
    for token_first in [true, false] {
        let g = setup(token_first);
        g.buy_to_target();
        std::println!("-- token sorts {} the quote --", if token_first { "before" } else { "after" });
        for label in ["1 pool", "2 create_group", "3 quote add_market", "4 quote activate", "5 token add_market", "6 token activate"] {
            g.env.cost_estimate().budget().reset_unlimited();
            g.curve.graduate(&g.payer);
            let r = g.env.cost_estimate().resources();
            let reads = r.disk_read_entries + r.memory_read_entries;
            std::println!(
                "{label:<22} cpu {:>11} mem {:>10} reads {:>3} writes {:>3} events {:>5}B",
                r.instructions, r.mem_bytes, reads, r.write_entries, r.contract_events_size_bytes
            );
            assert!(r.instructions < NET_CPU && r.mem_bytes < NET_MEM, "{label} over cpu/mem");
            assert!(reads <= NET_READ_ENTRIES && r.write_entries <= NET_WRITE_ENTRIES, "{label} over entries");
        }
    }
}

#[test]
fn every_step_emits_its_event_and_the_last_one_the_graduated_triple() {
    use soroban_sdk::testutils::Events as _;
    let g = setup(true);
    g.buy_to_target();
    let wanted = ["pool_created", "group_created", "market_added", "market_activated", "market_added", "graduated"];
    for name in wanted {
        g.curve.graduate(&g.payer);
        let dump = std::format!("{:?}", g.env.events().all());
        assert!(dump.contains(name), "step event {name} missing");
    }
    assert_eq!(g.curve.get_graduation().unwrap().group_id, 1);
}
