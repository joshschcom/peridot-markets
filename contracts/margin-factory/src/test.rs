#![cfg(test)]
//! Tests run against the real audited Wasm in `build/test/` (built by `scripts/build_core.sh` with
//! INIT_ADMIN = TEST_ADMIN_ADDRESS and MARGIN_INIT_ADMIN = TEST_MARGIN_FACTORY_ADDRESS).
//! The market-factory is replaced by `MockMarketFactory`, registered at TEST_ADMIN_ADDRESS so it is
//! the real admin of the group controller and the receipt-vaults, as the production MF will be.

extern crate std;

use crate::{MarginError, MarginFactory, MarginFactoryClient};
use mock_aquarius_pool::{MockAquariusPool, MockAquariusPoolClient};
use mock_reflector::{MockReflector, MockReflectorClient};
use mock_token::{MockToken, MockTokenClient};
use peridot_interfaces::{
    AquariusOnlyCfg, Asset, Group, GroupMarginConfig, KeeperMode, MarginVariant, MarginWasmHashes,
    MarketConfig, PriceConfig, RateModel, ReflectorOnlyCfg, YieldRoute, TEST_ADMIN_ADDRESS,
    TEST_MARGIN_FACTORY_ADDRESS,
};
use soroban_sdk::testutils::{Address as _, Ledger};
use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short, Address, BytesN, Env, String, Vec,
};

mod ctl {
    soroban_sdk::contractimport!(file = "../../build/test/simple_peridottroller.wasm");
}
/// The receipt-vault spec defines the `Mint` event twice, which `contractimport!` rejects, so the
/// vault is registered from raw bytes and called through this hand-written client.
mod vault {
    use soroban_sdk::{contractclient, Address, Env};

    pub const WASM: &[u8] = include_bytes!("../../../build/test/receipt_vault.wasm");

    #[contractclient(name = "Client")]
    #[allow(dead_code)]
    pub trait Vault {
        fn initialize(
            env: Env,
            token_address: Address,
            supply_yearly_rate_scaled: u128,
            borrow_yearly_rate_scaled: u128,
            admin: Address,
        );
        fn enable_static_rates(env: Env, admin: Address);
        fn set_peridottroller(env: Env, peridottroller: Address);
        fn deposit(env: Env, user: Address, amount: u128);
        fn set_margin_controller(env: Env, admin: Address, margin_controller: Option<Address>);
        fn get_margin_controller(env: Env) -> Option<Address>;
        fn get_margin_borrow_balance(env: Env, position_id: u64) -> u128;
    }
}
mod mcw {
    soroban_sdk::contractimport!(file = "../../build/test/margin_controller.wasm");
}
mod saw {
    soroban_sdk::contractimport!(file = "../../build/test/swap_adapter.wasm");
}

// ---------------------------------------------------------------------------------------------
// Test-only market-factory: serves the Group / MarketConfig fixtures and performs the real admin
// calls on the group controller and receipt-vaults, gated to the registered margin-factory.
// ---------------------------------------------------------------------------------------------

#[contracttype]
#[derive(Clone)]
enum MKey {
    Xf,
    Group(u32),
    Config(u32, Address),
}

#[contract]
pub struct MockMarketFactory;

#[contractimpl]
impl MockMarketFactory {
    pub fn __constructor(env: Env, xf: Address) {
        env.storage().instance().set(&MKey::Xf, &xf);
    }

    pub fn put_group(env: Env, group: Group) {
        env.storage().persistent().set(&MKey::Group(group.id), &group);
    }

    pub fn put_market(env: Env, group_id: u32, market: Address, cfg: MarketConfig) {
        env.storage()
            .persistent()
            .set(&MKey::Config(group_id, market), &cfg);
    }

    pub fn get_group(env: Env, group_id: u32) -> Group {
        env.storage().persistent().get(&MKey::Group(group_id)).unwrap()
    }

    pub fn get_market_config(env: Env, group_id: u32, market: Address) -> MarketConfig {
        env.storage()
            .persistent()
            .get(&MKey::Config(group_id, market))
            .unwrap()
    }

    pub fn market_token(env: Env, group_id: u32, market: Address) -> Address {
        Self::get_market_config(env, group_id, market).token
    }

    pub fn wire_margin(
        env: Env,
        caller: Address,
        group_id: u32,
        margin_controller: Address,
        liquidation_incentive: u128,
        liquidation_fee: u128,
    ) {
        Self::only_xf(&env, &caller);
        let mut group = Self::get_group(env.clone(), group_id);
        let c = ctl::Client::new(&env, &group.controller);
        c.set_margin_liquidation_ctrl(&margin_controller, &true);
        c.set_liquidation_incentive(&liquidation_incentive);
        c.set_liquidation_fee(&liquidation_fee);
        group.margin_controller = Some(margin_controller);
        env.storage().persistent().set(&MKey::Group(group_id), &group);
    }

    pub fn link_margin_market(
        env: Env,
        caller: Address,
        group_id: u32,
        market: Address,
        margin_controller: Option<Address>,
    ) {
        Self::only_xf(&env, &caller);
        let group = Self::get_group(env.clone(), group_id);
        assert!(group.markets.contains(&market));
        vault::Client::new(&env, &market)
            .set_margin_controller(&env.current_contract_address(), &margin_controller);
    }

    pub fn update_margin_params(
        env: Env,
        caller: Address,
        group_id: u32,
        liquidation_incentive: u128,
        liquidation_fee: u128,
    ) {
        Self::only_xf(&env, &caller);
        let group = Self::get_group(env.clone(), group_id);
        let c = ctl::Client::new(&env, &group.controller);
        c.set_liquidation_incentive(&liquidation_incentive);
        c.set_liquidation_fee(&liquidation_fee);
    }
}

impl MockMarketFactory {
    fn only_xf(env: &Env, caller: &Address) {
        let xf: Address = env.storage().instance().get(&MKey::Xf).unwrap();
        assert!(*caller == xf, "caller is not the margin factory");
        caller.require_auth();
    }
}

// ---------------------------------------------------------------------------------------------
// World
// ---------------------------------------------------------------------------------------------

const GROUP: u32 = 1;
const UNIT: u128 = 10_000_000; // 1 token, 7 decimals

struct World {
    env: Env,
    xf: Address,
    mf: Address,
    xf_admin: Address,
    owner: Address,
    usdt: Address,
    xlm: Address,
    uvault: Address,
    xvault: Address,
    ctl: Address,
    reflector: Address,
    pool: Address,
    pool_id: BytesN<32>,
}

fn cfg(lev: u128) -> GroupMarginConfig {
    GroupMarginConfig {
        variant: MarginVariant::Audited,
        max_leverage: lev,
        max_slippage: 50_000,
        liquidation_incentive: 1_080_000,
        liquidation_fee: 0,
    }
}

fn market_cfg(token: &Address, reflector: &Address, cf: u128) -> MarketConfig {
    MarketConfig {
        token: token.clone(),
        collateral_factor: cf,
        supply_cap: 1_000_000_000 * UNIT,
        borrow_cap: 1_000_000_000 * UNIT,
        reserve_factor: 100_000,
        rates: RateModel { base: 0, multiplier: 0, jump: 0, kink: 0 },
        idle_buffer_bps: 2_000,
        yield_route: YieldRoute::None,
        price: PriceConfig::ReflectorOnly(ReflectorOnlyCfg {
            oracle: reflector.clone(),
            asset: Asset::Stellar(token.clone()),
        }),
        margin_enabled: false,
        supply_reward_per_sec: 0,
        borrow_reward_per_sec: 0,
    }
}

fn set_price(w: &World, token: &Address, price: i128) {
    let ts = w.env.ledger().timestamp();
    MockReflectorClient::new(&w.env, &w.reflector).set_price(
        &Asset::Stellar(token.clone()),
        &price,
        &ts,
    );
    // The group controller serves cached prices while fresh; refresh it like a keeper would.
    ctl::Client::new(&w.env, &w.ctl).cache_price(token);
}

/// A real two-market group (USDT, XLM at 1.0, 7 decimals) owned by `owner`, with XF registered at
/// TEST_MARGIN_FACTORY_ADDRESS, MockMarketFactory at TEST_ADMIN_ADDRESS, wasm hashes and router set.
fn world(cf: u128) -> World {
    let env = Env::default();
    env.mock_all_auths_allowing_non_root_auth();
    env.cost_estimate().disable_resource_limits();
    env.cost_estimate().budget().reset_unlimited();
    env.ledger().set_timestamp(1_000);

    let xf = Address::from_str(&env, TEST_MARGIN_FACTORY_ADDRESS);
    let mf = Address::from_str(&env, TEST_ADMIN_ADDRESS);
    let xf_admin = Address::generate(&env);
    let owner = Address::generate(&env);

    env.register_at(&mf, MockMarketFactory, (xf.clone(),));
    env.register_at(&xf, MarginFactory, (xf_admin.clone(), mf.clone()));

    let mk_token = |name: &str| {
        let id = env.register(MockToken, ());
        MockTokenClient::new(&env, &id).initialize(
            &String::from_str(&env, name),
            &String::from_str(&env, name),
            &7u32,
        );
        id
    };
    let usdt = mk_token("USDT");
    let xlm = mk_token("XLM");

    let mk_vault = |token: &Address| {
        let id = env.register(vault::WASM, ());
        let v = vault::Client::new(&env, &id);
        v.initialize(token, &0u128, &0u128, &mf);
        v.enable_static_rates(&mf);
        id
    };
    let uvault = mk_vault(&usdt);
    let xvault = mk_vault(&xlm);

    let reflector = env.register(MockReflector, (6u32, 300u32));
    let ctl_id = env.register(ctl::WASM, ());
    let c = ctl::Client::new(&env, &ctl_id);
    c.initialize(&mf);
    c.set_oracle(&reflector);
    for v in [&uvault, &xvault] {
        c.add_market(v);
        c.set_market_cf(v, &cf);
    }
    vault::Client::new(&env, &uvault).set_peridottroller(&ctl_id);
    vault::Client::new(&env, &xvault).set_peridottroller(&ctl_id);

    let pool = env.register(MockAquariusPool, ());
    MockAquariusPoolClient::new(&env, &pool).initialize(&usdt, &xlm, &10, &0u32);

    let mut markets = Vec::new(&env);
    markets.push_back(uvault.clone());
    markets.push_back(xvault.clone());
    let mfc = MockMarketFactoryClient::new(&env, &mf);
    mfc.put_group(&Group {
        id: GROUP,
        owner: owner.clone(),
        name: symbol_short!("Meridian"),
        controller: ctl_id.clone(),
        price_router: Address::generate(&env),
        reward_distributor: None,
        margin_controller: None,
        markets,
        created_at: 1_000,
        keeper_mode: KeeperMode::None,
        keeper_paid_until: 0,
    });
    mfc.put_market(&GROUP, &uvault, &market_cfg(&usdt, &reflector, cf));
    mfc.put_market(&GROUP, &xvault, &market_cfg(&xlm, &reflector, cf));

    let w = World {
        env: env.clone(),
        xf: xf.clone(),
        mf,
        xf_admin: xf_admin.clone(),
        owner,
        usdt: usdt.clone(),
        xlm: xlm.clone(),
        uvault,
        xvault,
        ctl: ctl_id,
        reflector,
        pool,
        pool_id: BytesN::from_array(&env, &[9u8; 32]),
    };
    set_price(&w, &usdt, 1_000_000);
    set_price(&w, &xlm, 1_000_000);

    // Peridot admin configures the factory.
    let x = MarginFactoryClient::new(&env, &xf);
    x.set_wasm(
        &xf_admin,
        &MarginWasmHashes {
            audited: env.deployer().upload_contract_wasm(mcw::WASM),
            custom: None,
            swap_adapter: env.deployer().upload_contract_wasm(saw::WASM),
        },
    );
    x.set_router(&xf_admin, &Address::generate(&env));
    w
}

impl World {
    fn x(&self) -> MarginFactoryClient<'_> {
        MarginFactoryClient::new(&self.env, &self.xf)
    }

    fn mcc(&self, mc: &Address) -> mcw::Client<'_> {
        mcw::Client::new(&self.env, mc)
    }

    /// Owner enables margin, allowlists + binds the pool, and enables both markets.
    fn enable_all(&self, lev: u128) -> Address {
        let mc = self.x().enable_margin(&self.owner, &GROUP, &cfg(lev));
        self.fund_pool();
        self.x().set_pool_allowed(&self.owner, &GROUP, &self.pool, &true);
        self.x()
            .set_pool_binding(&self.owner, &GROUP, &self.pool_id, &self.pool, &true);
        self.x().set_market_margin(&self.owner, &GROUP, &self.uvault, &true);
        self.x().set_market_margin(&self.owner, &GROUP, &self.xvault, &true);
        mc
    }

    fn fund_pool(&self) {
        let lp = Address::generate(&self.env);
        let amt = 1_000_000 * UNIT;
        MockTokenClient::new(&self.env, &self.usdt).mint(&lp, &(amt as i128));
        MockTokenClient::new(&self.env, &self.xlm).mint(&lp, &(amt as i128));
        MockAquariusPoolClient::new(&self.env, &self.pool).donate(&lp, &amt, &amt);
        // Lenders fund both receipt-vaults so positions can borrow.
        let lender = Address::generate(&self.env);
        for (t, v) in [(&self.usdt, &self.uvault), (&self.xlm, &self.xvault)] {
            MockTokenClient::new(&self.env, t).mint(&lender, &((100_000 * UNIT) as i128));
            vault::Client::new(&self.env, v).deposit(&lender, &(100_000 * UNIT));
        }
    }

    /// Deposit `tokens` USDT as margin for a fresh user and return the user.
    fn user_with_margin(&self, tokens: u128) -> Address {
        let user = Address::generate(&self.env);
        let amount = tokens * UNIT;
        MockTokenClient::new(&self.env, &self.usdt).mint(&user, &(amount as i128));
        vault::Client::new(&self.env, &self.uvault).deposit(&user, &amount);
        user
    }

    /// Minimum output for closing a long: just under the pool quote (the controller needs it to be
    /// at least the pool-derived floor and at least the debt).
    fn close_floor(&self, collateral: u128) -> u128 {
        MockAquariusPoolClient::new(&self.env, &self.pool).estimate_swap(&1u32, &0u32, &collateral)
            * 98
            / 100
    }

    fn pool_tokens(&self) -> Vec<Address> {
        let mut v = Vec::new(&self.env);
        v.push_back(self.usdt.clone());
        v.push_back(self.xlm.clone());
        v
    }

    /// Long XLM with USDT margin; returns the position id (after activation).
    fn open_long(&self, mc: &Address, user: &Address, margin_tokens: u128, lev: u128) -> u64 {
        let margin = margin_tokens * UNIT;
        let c = self.mcc(mc);
        c.transfer_spot_to_margin(user, &self.usdt, &margin);
        let min_out = margin * lev * 95 / 100;
        let id = c.begin_open_position_v3(
            user,
            &self.usdt,
            &self.xlm,
            &margin,
            &lev,
            &mcw::PositionSide::Long,
            &self.pool_tokens(),
            &self.pool_id,
            &self.pool,
            &min_out,
        );
        c.swap_open_position_v3(user, &id);
        c.activate_open_position_v3(user, &id);
        id
    }
}

fn err<T: core::fmt::Debug, E: core::fmt::Debug>(
    r: Result<Result<T, E>, Result<MarginError, soroban_sdk::InvokeError>>,
) -> MarginError {
    match r {
        Err(Ok(e)) => e,
        other => panic!("expected a contract error, got {:?}", other),
    }
}

// ---------------------------------------------------------------------------------------------
// (1) enable margin on a fresh group
// ---------------------------------------------------------------------------------------------

#[test]
fn enable_margin_wires_controller_adapter_and_group() {
    let w = world(750_000);
    assert!(w.x().get_margin(&GROUP).is_none());
    let mc = w.x().enable_margin(&w.owner, &GROUP, &cfg(3));

    let info = w.x().get_margin(&GROUP).unwrap();
    assert_eq!(info.controller, mc);
    assert_eq!(info.variant, MarginVariant::Audited);
    assert_eq!(info.cfg, cfg(3));
    assert_eq!(info.enabled_markets.len(), 0);

    // XF is admin of both group-local contracts, MF recorded the controller and authorized it.
    assert_eq!(w.mcc(&mc).get_admin(), w.xf);
    assert_eq!(saw::Client::new(&w.env, &info.swap_adapter).get_admin(), w.xf);
    assert!(saw::Client::new(&w.env, &info.swap_adapter).is_pool_allowed(&mc));
    let ctl_c = ctl::Client::new(&w.env, &w.ctl);
    assert!(ctl_c.is_margin_liquidation_ctrl(&mc));
    let group = MockMarketFactoryClient::new(&w.env, &w.mf).get_group(&GROUP);
    assert_eq!(group.margin_controller, Some(mc.clone()));

    // Enabling twice is rejected.
    assert_eq!(
        err(w.x().try_enable_margin(&w.owner, &GROUP, &cfg(3))),
        MarginError::AlreadyEnabled
    );
}

#[test]
fn enable_margin_requires_wasm_and_router() {
    let w = world(750_000);
    // A second factory instance that has no Wasm hashes or router configured yet.
    let xf2 = Address::generate(&w.env);
    w.env
        .register_at(&xf2, MarginFactory, (w.xf_admin.clone(), w.mf.clone()));
    let x2 = MarginFactoryClient::new(&w.env, &xf2);
    assert_eq!(
        err(x2.try_enable_margin(&w.owner, &GROUP, &cfg(3))),
        MarginError::WasmNotSet
    );
    x2.set_wasm(
        &w.xf_admin,
        &w.x().get_wasm().unwrap(),
    );
    assert_eq!(
        err(x2.try_enable_margin(&w.owner, &GROUP, &cfg(3))),
        MarginError::RouterNotSet
    );
}

#[test]
fn market_enable_links_vault_and_caps_pair_leverage() {
    let w = world(750_000);
    let mc = w.enable_all(3);
    // The vault points at the margin controller (via MF) and both markets are enabled.
    assert_eq!(
        vault::Client::new(&w.env, &w.uvault).get_margin_controller(),
        Some(mc.clone())
    );
    let info = w.x().get_margin(&GROUP).unwrap();
    assert_eq!(info.enabled_markets.len(), 2);
    // Pair configs carry the group leverage, not the controller default of 10.
    let pair = w
        .mcc(&mc)
        .get_perps_pair_config(&w.usdt, &w.xlm, &mcw::PositionSide::Long)
        .unwrap();
    assert_eq!(pair.max_leverage, 3);
    assert_eq!(pair.maintenance_margin_scaled, 50_000);
    assert_eq!(pair.liquidation_incentive_scaled, 80_000);
    let pair = w
        .mcc(&mc)
        .get_perps_pair_config(&w.xlm, &w.usdt, &mcw::PositionSide::Short)
        .unwrap();
    assert_eq!(pair.max_leverage, 3);
}

// ---------------------------------------------------------------------------------------------
// (2) open a 2x long and close it end to end through the audited V3 flow
// ---------------------------------------------------------------------------------------------

#[test]
fn open_2x_long_and_close_end_to_end() {
    let w = world(750_000);
    let mc = w.enable_all(3);
    let user = w.user_with_margin(1_000);
    let margin = 1_000 * UNIT;
    let id = w.open_long(&mc, &user, 1_000, 2);

    let c = w.mcc(&mc);
    let perps = c.get_perps_position(&id).unwrap();
    assert_eq!(perps.margin_amount, margin);
    assert_eq!(perps.notional_value, 2 * margin);
    assert!(c.get_health_factor(&id) > 1_000_000);
    assert_eq!(
        vault::Client::new(&w.env, &w.uvault).get_margin_borrow_balance(&id),
        margin
    );

    // Close: prepare, swap back, finish.
    c.prepare_close_position_v3(&user, &id);
    let pending = c.get_pending_perps_close(&id).unwrap();
    c.swap_close_position_v3(&user, &id, &w.close_floor(pending.collateral_underlying));
    c.finish_close_position_v3(&id);
    assert!(c.get_position(&id).is_none());
    assert_eq!(
        vault::Client::new(&w.env, &w.uvault).get_margin_borrow_balance(&id),
        0
    );
    // The user keeps their margin minus swap costs in free margin.
    assert!(c.get_margin_balance_underlying(&user, &w.usdt) > margin * 98 / 100);
}

#[test]
fn leverage_above_group_max_is_rejected_by_the_controller() {
    let w = world(750_000);
    let mc = w.enable_all(3);
    let user = w.user_with_margin(1_000);
    let margin = 1_000 * UNIT;
    let c = w.mcc(&mc);
    c.transfer_spot_to_margin(&user, &w.usdt, &margin);
    // 4x > group max 3x. Without XF writing pair configs the controller default would allow 10x.
    let res = c.try_begin_open_position_v3(
        &user,
        &w.usdt,
        &w.xlm,
        &margin,
        &4u128,
        &mcw::PositionSide::Long,
        &w.pool_tokens(),
        &w.pool_id,
        &w.pool,
        &(margin * 3),
    );
    assert!(res.is_err());
}

// ---------------------------------------------------------------------------------------------
// (3) guardrails
// ---------------------------------------------------------------------------------------------

#[test]
fn guardrails_reject_bad_config() {
    let w = world(750_000);
    let mut bad = cfg(6);
    assert_eq!(
        err(w.x().try_enable_margin(&w.owner, &GROUP, &bad)),
        MarginError::InvalidLeverage
    );
    bad = cfg(0);
    assert_eq!(
        err(w.x().try_enable_margin(&w.owner, &GROUP, &bad)),
        MarginError::InvalidLeverage
    );
    bad = cfg(3);
    bad.liquidation_incentive = 1_200_000;
    assert_eq!(
        err(w.x().try_enable_margin(&w.owner, &GROUP, &bad)),
        MarginError::InvalidIncentive
    );
    bad.liquidation_incentive = 1_010_000;
    assert_eq!(
        err(w.x().try_enable_margin(&w.owner, &GROUP, &bad)),
        MarginError::InvalidIncentive
    );
    bad = cfg(3);
    bad.max_slippage = 200_000;
    assert_eq!(
        err(w.x().try_enable_margin(&w.owner, &GROUP, &bad)),
        MarginError::InvalidSlippage
    );
    bad = cfg(3);
    bad.liquidation_fee = 600_000;
    assert_eq!(
        err(w.x().try_enable_margin(&w.owner, &GROUP, &bad)),
        MarginError::InvalidFee
    );
    bad = cfg(3);
    bad.variant = MarginVariant::Custom;
    assert_eq!(
        err(w.x().try_enable_margin(&w.owner, &GROUP, &bad)),
        MarginError::VariantUnavailable
    );
    // Boundary values are accepted: 5x, 1.10, 10% slippage.
    let ok = GroupMarginConfig {
        variant: MarginVariant::Audited,
        max_leverage: 5,
        max_slippage: 100_000,
        liquidation_incentive: 1_100_000,
        liquidation_fee: 500_000,
    };
    w.x().enable_margin(&w.owner, &GROUP, &ok);
    // Also invalid on update.
    let mut bad = ok.clone();
    bad.max_leverage = 6;
    assert_eq!(
        err(w.x().try_update_margin(&w.owner, &GROUP, &bad)),
        MarginError::InvalidLeverage
    );
}

#[test]
fn market_without_allowlisted_pool_cannot_be_enabled() {
    let w = world(750_000);
    w.x().enable_margin(&w.owner, &GROUP, &cfg(3));
    assert_eq!(
        err(w.x().try_set_market_margin(&w.owner, &GROUP, &w.uvault, &true)),
        MarginError::NoAllowlistedPool
    );
    // A pool that does not trade the group's tokens is refused outright.
    let other_a = w.env.register(MockToken, ());
    let other_b = w.env.register(MockToken, ());
    let stray = w.env.register(MockAquariusPool, ());
    MockAquariusPoolClient::new(&w.env, &stray).initialize(&other_a, &other_b, &10, &0u32);
    assert_eq!(
        err(w.x().try_set_pool_allowed(&w.owner, &GROUP, &stray, &true)),
        MarginError::PoolNotInGroup
    );
    // A non-pool address is refused too.
    let junk = Address::generate(&w.env);
    assert_eq!(
        err(w.x().try_set_pool_allowed(&w.owner, &GROUP, &junk, &true)),
        MarginError::PoolNotInGroup
    );
    // Removing the only pool makes the market ineligible again.
    w.x().set_pool_allowed(&w.owner, &GROUP, &w.pool, &true);
    w.x().set_market_margin(&w.owner, &GROUP, &w.uvault, &true);
    // owners cannot revoke an exit route; the Peridot admin can
    assert_eq!(
        err(w.x().try_set_pool_allowed(&w.owner, &GROUP, &w.pool, &false)),
        MarginError::PoolRevocationAdminOnly
    );
    w.x().admin_revoke_pool(&w.xf_admin, &GROUP, &w.pool, &None);
    assert_eq!(
        err(w.x().try_set_market_margin(&w.owner, &GROUP, &w.xvault, &true)),
        MarginError::NoAllowlistedPool
    );
}

#[test]
fn pool_priced_market_can_be_margin_enabled_but_capped_at_2x() {
    let w = world(750_000);
    let mc = w.enable_all(5);
    // Flip the XLM market to AquariusOnly pricing in the fixture and re-apply pairs.
    let mut c = market_cfg(&w.xlm, &w.reflector, 750_000);
    c.price = PriceConfig::AquariusOnly(AquariusOnlyCfg {
        pool: w.pool.clone(),
        quote_token: w.usdt.clone(),
    });
    MockMarketFactoryClient::new(&w.env, &w.mf).put_market(&GROUP, &w.xvault, &c);
    w.x().sync_pairs(&GROUP);
    for (a, b) in [(&w.usdt, &w.xlm), (&w.xlm, &w.usdt)] {
        assert_eq!(
            w.mcc(&mc).get_perps_pair_config(a, b, &mcw::PositionSide::Long).unwrap().max_leverage,
            2
        );
    }
    assert_eq!(w.x().effective_max_leverage(&GROUP, &w.xvault), 2);
    // the Reflector-priced side alone is still limited only by group max and CF (4x at 75% CF)
    assert_eq!(w.x().effective_max_leverage(&GROUP, &w.uvault), 4);
}

#[test]
fn market_must_belong_to_group_and_be_known_to_disable() {
    let w = world(750_000);
    w.x().enable_margin(&w.owner, &GROUP, &cfg(3));
    w.x().set_pool_allowed(&w.owner, &GROUP, &w.pool, &true);
    let foreign = Address::generate(&w.env);
    assert_eq!(
        err(w.x().try_set_market_margin(&w.owner, &GROUP, &foreign, &true)),
        MarginError::MarketNotInGroup
    );
    // Disabling a never-enabled market is an error, not a silent success.
    assert_eq!(
        err(w.x().try_set_market_margin(&w.owner, &GROUP, &w.uvault, &false)),
        MarginError::UnknownMarket
    );
}

// ---------------------------------------------------------------------------------------------
// (4) non-owner rejected
// ---------------------------------------------------------------------------------------------

#[test]
fn non_owner_is_rejected_everywhere() {
    let w = world(750_000);
    let mallory = Address::generate(&w.env);
    assert_eq!(
        err(w.x().try_enable_margin(&mallory, &GROUP, &cfg(3))),
        MarginError::NotOwner
    );
    w.enable_all(3);
    assert_eq!(
        err(w.x().try_update_margin(&mallory, &GROUP, &cfg(2))),
        MarginError::NotOwner
    );
    assert_eq!(
        err(w.x().try_set_market_margin(&mallory, &GROUP, &w.uvault, &false)),
        MarginError::NotOwner
    );
    assert_eq!(
        err(w.x().try_set_pool_allowed(&mallory, &GROUP, &w.pool, &false)),
        MarginError::NotOwner
    );
    assert_eq!(
        err(w.x().try_set_pool_binding(&mallory, &GROUP, &w.pool_id, &w.pool, &false)),
        MarginError::NotOwner
    );
    assert_eq!(
        err(w.x().try_apply_margin(&mallory, &GROUP)),
        MarginError::NotOwner
    );
}

#[test]
fn owner_calls_require_the_owner_signature() {
    // Without mocked auths the owner's require_auth must fire.
    let w = world(750_000);
    w.env.set_auths(&[]);
    assert!(w.x().try_enable_margin(&w.owner, &GROUP, &cfg(3)).is_err());
}

// ---------------------------------------------------------------------------------------------
// (5) liquidation through the controller's liquidate path
// ---------------------------------------------------------------------------------------------

#[test]
fn underwater_position_is_liquidated() {
    let w = world(800_000);
    let mc = w.enable_all(5);
    let user = w.user_with_margin(1_000);
    let id = w.open_long(&mc, &user, 1_000, 5);
    let c = w.mcc(&mc);
    assert!(c.get_health_factor(&id) > 1_000_000);
    let liquidator = Address::generate(&w.env);
    assert!(c.try_liquidate_position_v3(&liquidator, &id).is_err());

    // XLM drops 17%: a 5x long loses its 5% maintenance buffer.
    set_price(&w, &w.xlm, 830_000);
    assert!(c.get_health_factor(&id) <= 1_000_000);
    c.liquidate_position_v3(&liquidator, &id);
    assert!(c.get_position(&id).is_none());
    assert_eq!(
        vault::Client::new(&w.env, &w.uvault).get_margin_borrow_balance(&id),
        0
    );
    assert!(MockTokenClient::new(&w.env, &w.usdt).balance(&liquidator) > 0);
}

// ---------------------------------------------------------------------------------------------
// (6) update_margin and the 60s staging of the liquidation incentive
// ---------------------------------------------------------------------------------------------

#[test]
fn incentive_stages_for_60s_and_apply_margin_applies_it() {
    let w = world(750_000);
    let mc = w.enable_all(3);
    // enable_margin with the controller default (1.08) is live at once.
    let s = w.x().get_margin_status(&GROUP).unwrap();
    assert!(s.incentive_applied);
    assert_eq!(s.applied_liquidation_incentive, 1_080_000);
    assert_eq!(s.incentive_apply_after, 0);

    let mut next = cfg(3);
    next.liquidation_incentive = 1_100_000;
    next.liquidation_fee = 50_000;
    let t0 = w.env.ledger().timestamp();
    w.x().update_margin(&w.owner, &GROUP, &next);

    // Target is stored, the group controller still runs the old incentive; the fee is immediate.
    let s = w.x().get_margin_status(&GROUP).unwrap();
    assert_eq!(s.cfg.liquidation_incentive, 1_100_000);
    assert!(!s.incentive_applied);
    assert_eq!(s.applied_liquidation_incentive, 1_080_000);
    assert_eq!(s.applied_liquidation_fee, 50_000);
    assert_eq!(s.incentive_apply_after, t0 + 60);
    assert_eq!(s.pair_liquidation_incentive, 100_000);
    // The margin controller's own pair incentive follows the new value at once.
    assert_eq!(
        w.mcc(&mc)
            .get_perps_pair_config(&w.usdt, &w.xlm, &mcw::PositionSide::Long)
            .unwrap()
            .liquidation_incentive_scaled,
        100_000
    );

    // Too early: the group controller rejects the repeat, nothing changes.
    w.env.ledger().set_timestamp(t0 + 59);
    assert!(w.x().try_apply_margin(&w.owner, &GROUP).is_err());
    // A fee-only change while the incentive is pending gets a clear error.
    let mut fee_only = next.clone();
    fee_only.liquidation_fee = 60_000;
    assert_eq!(
        err(w.x().try_update_margin(&w.owner, &GROUP, &fee_only)),
        MarginError::IncentivePending
    );
    // A leverage-only change is fine and does not touch the pending incentive.
    let mut lev_only = next.clone();
    lev_only.max_leverage = 2;
    w.x().update_margin(&w.owner, &GROUP, &lev_only);
    assert_eq!(
        w.mcc(&mc)
            .get_perps_pair_config(&w.xlm, &w.usdt, &mcw::PositionSide::Short)
            .unwrap()
            .max_leverage,
        2
    );

    w.env.ledger().set_timestamp(t0 + 60);
    w.x().apply_margin(&w.owner, &GROUP);
    let s = w.x().get_margin_status(&GROUP).unwrap();
    assert!(s.incentive_applied);
    assert_eq!(s.applied_liquidation_incentive, 1_100_000);
    assert_eq!(s.incentive_apply_after, 0);
}

#[test]
fn update_margin_changes_leverage_slippage_and_blocks_variant_switch() {
    let w = world(800_000);
    let mc = w.enable_all(3);
    let mut next = cfg(5);
    next.max_slippage = 80_000;
    w.x().update_margin(&w.owner, &GROUP, &next);
    assert_eq!(w.x().get_margin(&GROUP).unwrap().cfg, next);
    for (a, b) in [(&w.usdt, &w.xlm), (&w.xlm, &w.usdt)] {
        for side in [mcw::PositionSide::Long, mcw::PositionSide::Short] {
            assert_eq!(
                w.mcc(&mc).get_perps_pair_config(a, b, &side).unwrap().max_leverage,
                5
            );
        }
    }
    let mut custom = next.clone();
    custom.variant = MarginVariant::Custom;
    assert_eq!(
        err(w.x().try_update_margin(&w.owner, &GROUP, &custom)),
        MarginError::VariantChange
    );
    // A 5x position now opens.
    let user = w.user_with_margin(100);
    let id = w.open_long(&mc, &user, 100, 5);
    assert!(w.mcc(&mc).get_position(&id).is_some());
}

#[test]
fn disabling_a_market_blocks_new_opens_but_keeps_positions_closable() {
    let w = world(750_000);
    let mc = w.enable_all(3);
    let user = w.user_with_margin(2_000);
    let id = w.open_long(&mc, &user, 1_000, 2);

    w.x().set_market_margin(&w.owner, &GROUP, &w.xvault, &false);
    assert_eq!(w.x().get_margin(&GROUP).unwrap().enabled_markets.len(), 1);
    assert_eq!(w.x().effective_max_leverage(&GROUP, &w.xvault), 0);

    // New opens in the pair are blocked (1x means zero borrow).
    let c = w.mcc(&mc);
    let margin = 1_000 * UNIT;
    c.transfer_spot_to_margin(&user, &w.usdt, &margin);
    assert!(c
        .try_begin_open_position_v3(
            &user,
            &w.usdt,
            &w.xlm,
            &margin,
            &2u128,
            &mcw::PositionSide::Long,
            &w.pool_tokens(),
            &w.pool_id,
            &w.pool,
            &(margin * 19 / 10),
        )
        .is_err());

    // The existing position still closes.
    c.prepare_close_position_v3(&user, &id);
    let pending = c.get_pending_perps_close(&id).unwrap();
    c.swap_close_position_v3(&user, &id, &w.close_floor(pending.collateral_underlying));
    c.finish_close_position_v3(&id);
    assert!(c.get_position(&id).is_none());

    // Re-enabling restores the pair leverage.
    w.x().set_market_margin(&w.owner, &GROUP, &w.xvault, &true);
    assert_eq!(
        c.get_perps_pair_config(&w.usdt, &w.xlm, &mcw::PositionSide::Long)
            .unwrap()
            .max_leverage,
        3
    );
}

#[test]
fn effective_max_leverage_is_min_of_group_max_and_cf_bound() {
    // CF 75% -> 1/(1-0.75) = 4; CF 90% -> 10; CF 50% -> 2.
    for (cf, group_max, expect) in [
        (750_000u128, 5u128, 4u128),
        (750_000, 3, 3),
        (900_000, 5, 5),
        (500_000, 5, 2),
    ] {
        let w = world(cf);
        w.enable_all(group_max);
        assert_eq!(w.x().effective_max_leverage(&GROUP, &w.uvault), expect);
    }
}

#[test]
fn pool_registry_hardening_blocks_untrusted_pools() {
    let w = world(750_000);
    w.x().enable_margin(&w.owner, &GROUP, &cfg(3));
    w.x().set_pool_registry_enforced(&w.xf_admin, &true);
    assert_eq!(
        err(w.x().try_set_pool_allowed(&w.owner, &GROUP, &w.pool, &true)),
        MarginError::PoolNotTrusted
    );
    w.x().set_pool_trusted(&w.xf_admin, &w.pool, &true);
    w.x().set_pool_allowed(&w.owner, &GROUP, &w.pool, &true);
    // Binding needs an allowlisted pool.
    let other = Address::generate(&w.env);
    assert_eq!(
        err(w.x().try_set_pool_binding(&w.owner, &GROUP, &w.pool_id, &other, &true)),
        MarginError::PoolNotAllowed
    );
}

// ---------------------------------------------------------------------------------------------
// (7) upgrade auth
// ---------------------------------------------------------------------------------------------

#[test]
fn upgrade_and_admin_calls_check_the_admin() {
    let w = world(750_000);
    let mallory = Address::generate(&w.env);
    let hash = BytesN::from_array(&w.env, &[1u8; 32]);
    assert_eq!(err(w.x().try_upgrade(&mallory, &hash)), MarginError::NotAdmin);
    assert_eq!(
        err(w.x().try_set_router(&mallory, &Address::generate(&w.env))),
        MarginError::NotAdmin
    );
    assert_eq!(
        err(w.x().try_set_pool_registry_enforced(&mallory, &true)),
        MarginError::NotAdmin
    );
    w.enable_all(3);
    assert_eq!(
        err(w.x().try_propose_group_margin_upgrade(&mallory, &GROUP, &hash)),
        MarginError::NotAdmin
    );
    assert_eq!(
        err(w.x().try_upgrade_group_margin(&mallory, &GROUP, &hash)),
        MarginError::NotAdmin
    );
    // The owner of the group is not the Peridot admin.
    assert_eq!(err(w.x().try_upgrade(&w.owner, &hash)), MarginError::NotAdmin);
}

#[test]
fn admin_upgrade_requires_its_signature() {
    let w = world(750_000);
    let hash = BytesN::from_array(&w.env, &[1u8; 32]);
    w.env.set_auths(&[]);
    assert!(w.x().try_upgrade(&w.xf_admin, &hash).is_err());
}

#[test]
fn audited_controller_upgrade_uses_the_two_step_timelock() {
    let w = world(750_000);
    let mc = w.enable_all(3);
    // A real Wasm to upgrade to (the same audited build is enough to exercise the path).
    let new_hash = w.env.deployer().upload_contract_wasm(mcw::WASM);
    w.x().propose_group_margin_upgrade(&w.xf_admin, &GROUP, &new_hash);
    // Before the 60s delay the controller refuses.
    assert!(w.x().try_upgrade_group_margin(&w.xf_admin, &GROUP, &new_hash).is_err());
    w.env.ledger().set_timestamp(w.env.ledger().timestamp() + 61);
    // A different hash than the proposed one is refused.
    let other = BytesN::from_array(&w.env, &[2u8; 32]);
    assert!(w.x().try_upgrade_group_margin(&w.xf_admin, &GROUP, &other).is_err());
    w.x().upgrade_group_margin(&w.xf_admin, &GROUP, &new_hash);
    // Still healthy afterwards.
    assert_eq!(w.mcc(&mc).get_admin(), w.xf);
}

#[test]
fn swap_adapter_upgrade_uses_the_two_step_timelock() {
    let w = world(750_000);
    w.enable_all(3);
    let new_hash = w.env.deployer().upload_contract_wasm(saw::WASM);
    w.x().propose_group_sa_upgrade(&w.xf_admin, &GROUP, &new_hash);
    assert!(w.x().try_upgrade_group_sa(&w.xf_admin, &GROUP, &new_hash).is_err());
    w.env.ledger().set_timestamp(w.env.ledger().timestamp() + 61);
    w.x().upgrade_group_sa(&w.xf_admin, &GROUP, &new_hash);
}

// ---------------------------------------------------------------------------------------------
// Resource footprint of the multi-contract setup calls (mainnet per-tx limits are roughly
// 400M instructions, 100 ledger entries, 50 written entries) and event emission.
// ---------------------------------------------------------------------------------------------

fn assert_resources_under(env: &Env, label: &str) {
    let r = env.cost_estimate().resources();
    let entries = r.disk_read_entries.saturating_add(r.memory_read_entries);
    std::println!(
        "{label}: instructions {} read entries {} write entries {}",
        r.instructions, entries, r.write_entries
    );
    assert!(r.instructions <= 400_000_000, "{label}: instructions {}", r.instructions);
    assert!(entries <= 100, "{label}: read entries {entries}");
    assert!(r.write_entries <= 50, "{label}: write entries {}", r.write_entries);
}

#[test]
fn setup_calls_fit_in_one_transaction() {
    let w = world(750_000);
    w.fund_pool();
    w.x().enable_margin(&w.owner, &GROUP, &cfg(5));
    assert_resources_under(&w.env, "enable_margin");
    w.x().set_pool_allowed(&w.owner, &GROUP, &w.pool, &true);
    assert_resources_under(&w.env, "set_pool_allowed");
    w.x().set_pool_binding(&w.owner, &GROUP, &w.pool_id, &w.pool, &true);
    assert_resources_under(&w.env, "set_pool_binding");
    w.x().set_market_margin(&w.owner, &GROUP, &w.uvault, &true);
    assert_resources_under(&w.env, "set_market_margin first");
    w.x().set_market_margin(&w.owner, &GROUP, &w.xvault, &true);
    assert_resources_under(&w.env, "set_market_margin second");
    let mut next = cfg(4);
    next.max_slippage = 70_000;
    w.x().update_margin(&w.owner, &GROUP, &next);
    assert_resources_under(&w.env, "update_margin");
}

#[test]
fn state_changes_emit_events() {
    use soroban_sdk::testutils::Events as _;
    let w = world(750_000);
    w.x().enable_margin(&w.owner, &GROUP, &cfg(3));
    let n = w.env.events().all().events().len();
    assert!(n > 0);
    w.x().set_pool_allowed(&w.owner, &GROUP, &w.pool, &true);
    assert!(w.env.events().all().events().len() > 0);
}

#[test]
fn pairs_enforce_group_slippage_and_the_collateral_factor_leverage_cap() {
    let w = world(750_000); // 1 / (1 - 0.75) = 4x
    let mc = w.enable_all(5);
    let slip = w.x().get_margin(&GROUP).unwrap().cfg.max_slippage;
    for (a, b) in [(&w.usdt, &w.xlm), (&w.xlm, &w.usdt)] {
        for side in [mcw::PositionSide::Long, mcw::PositionSide::Short] {
            assert_eq!(w.mcc(&mc).get_perps_pair_config(a, b, &side).unwrap().max_leverage, 4);
            let exec = w.mcc(&mc).get_perps_pair_execution_config(a, b, &side);
            assert_eq!(exec.open_slippage_scaled, slip);
            assert_eq!(exec.close_slippage_scaled, slip);
        }
    }
    assert_eq!(w.x().effective_max_leverage(&GROUP, &w.xvault), 4);
    // anyone can re-sync the caps after a collateral factor change
    w.x().sync_pairs(&GROUP);
}

#[test]
fn revoked_pool_stays_denied_and_slippage_updates_reach_existing_pairs() {
    let w = world(800_000);
    let mc = w.enable_all(3);
    // admin revocation sticks: the owner cannot re-allow the pool
    w.x().admin_revoke_pool(&w.xf_admin, &GROUP, &w.pool, &Some(w.pool_id.clone()));
    assert_eq!(
        err(w.x().try_set_pool_allowed(&w.owner, &GROUP, &w.pool, &true)),
        MarginError::PoolDenied
    );
    // trusting it again lifts the denial
    w.x().set_pool_trusted(&w.xf_admin, &w.pool, &true);
    w.x().set_pool_allowed(&w.owner, &GROUP, &w.pool, &true);

    // lowering only the slippage limit re-applies the per-pair execution limits
    let mut next = w.x().get_margin(&GROUP).unwrap().cfg;
    next.max_slippage = 10_000;
    w.x().update_margin(&w.owner, &GROUP, &next);
    let exec = w
        .mcc(&mc)
        .get_perps_pair_execution_config(&w.usdt, &w.xlm, &mcw::PositionSide::Long);
    assert_eq!(exec.open_slippage_scaled, 10_000);
    assert_eq!(exec.close_slippage_scaled, 10_000);
}
