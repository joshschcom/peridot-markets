//! Tests run against `mock-zenex` (Zenex has no testnet; mainnet interface verified separately) with the
//! mock market doing the real escrow transfers inside its own frame, so the adapter's nested authorization
//! is exercised. The receipt-vault integration uses the REAL receipt-vault / controller / jump-rate Wasm.
extern crate std;

use super::*;
use mock_token::{MockToken, MockTokenClient};
use mock_zenex::{Config as ZConfig, MockZenexMarket, MockZenexMarketClient, MockZenexVault, MockZenexVaultClient};
use peridot_interfaces::{YieldVaultClient, TEST_ADMIN_ADDRESS};
use soroban_sdk::{
    testutils::{Address as _, Ledger as _, MockAuth, MockAuthInvoke},
    Env, String as SString,
};

const E7: i128 = 10_000_000;
const EXEC_FEE: i128 = 100_000;

struct T {
    env: Env,
    token: Address,
    zvault: Address,
    zmarket: Address,
    vault: Address,
    owner: Address,
    keeper: Address,
    market: Address,
}

impl T {
    fn tok(&self) -> MockTokenClient<'_> {
        MockTokenClient::new(&self.env, &self.token)
    }
    fn v(&self) -> ZenexVaultClient<'_> {
        ZenexVaultClient::new(&self.env, &self.vault)
    }
    fn zm(&self) -> MockZenexMarketClient<'_> {
        MockZenexMarketClient::new(&self.env, &self.zmarket)
    }
    fn zv(&self) -> MockZenexVaultClient<'_> {
        MockZenexVaultClient::new(&self.env, &self.zvault)
    }
    fn yv(&self) -> YieldVaultClient<'_> {
        YieldVaultClient::new(&self.env, &self.vault)
    }
    fn deposit(&self, amount: i128) {
        self.tok().mint(&self.market, &amount);
        self.v().deposit(&vec![&self.env, amount], &vec![&self.env, amount], &self.market, &true);
    }
    fn warp(&self, secs: u64) {
        let ts = self.env.ledger().timestamp();
        self.env.ledger().set_timestamp(ts + secs);
    }
}

fn cfg_for(env: &Env, zm: &Address, zv: &Address, keeper: &Address) -> ZenexConfig {
    ZenexConfig {
        zenex_market: zm.clone(),
        zenex_vault: zv.clone(),
        keeper: keeper.clone(),
        target_buffer_bps: 3_000,
        min_buffer_bps: 1_000,
        slippage_bps: 100,
        haircut_bps: 200,
        cap: 100_000 * E7,
    }
    .clone_with(env)
}

impl ZenexConfig {
    fn clone_with(self, _env: &Env) -> Self {
        self
    }
}

fn setup() -> T {
    let env = Env::default();
    env.mock_all_auths_allowing_non_root_auth();
    env.cost_estimate().budget().reset_unlimited();
    env.ledger().set_timestamp(1_000_000);
    let token = env.register(MockToken, ());
    MockTokenClient::new(&env, &token).initialize(&SString::from_str(&env, "USDC"), &SString::from_str(&env, "USDC"), &7);
    let zvault = env.register(MockZenexVault, (token.clone(),));
    let zmarket = env.register(
        MockZenexMarket,
        (
            token.clone(),
            zvault.clone(),
            ZConfig {
                deposit_fee: 0,
                exec_fee: EXEC_FEE,
                max_vault_balance: 100_000 * E7,
                min_deposit: 10 * E7,
                redeem_fee: 0,
                redeem_lock: 3_600,
            },
        ),
    );
    // Seed the Zenex vault so the share price is not the empty-vault case.
    let lp = Address::generate(&env);
    MockTokenClient::new(&env, &token).mint(&zvault, &(1_000 * E7));
    MockZenexVaultClient::new(&env, &zvault).mint_for_fill(&lp, &(1_000 * E7 * 1_000_000));
    let owner = Address::generate(&env);
    let keeper = Address::generate(&env);
    let market = Address::generate(&env);
    let vault = env.register(ZenexVault, (owner.clone(), market.clone(), token.clone(), cfg_for(&env, &zmarket, &zvault, &keeper)));
    T { env, token, zvault, zmarket, vault, owner, keeper, market }
}

fn reg_fails(env: &Env, args: (Address, Address, Address, ZenexConfig)) -> bool {
    std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        env.register(ZenexVault, args);
    }))
    .is_err()
}

fn approx(a: i128, b: i128, tol: i128) {
    assert!((a - b).abs() <= tol, "{a} vs {b} tol {tol}");
}

// (1) deposit lands in the buffer; sync creates a deposit order; fill mints shares; value stays consistent
#[test]
fn deposit_buffers_then_sync_orders_and_fill_keeps_value() {
    let t = setup();
    t.deposit(1_000 * E7);
    assert_eq!(t.v().balance(&t.market), 1_000 * E7);
    assert_eq!(t.tok().balance(&t.vault), 1_000 * E7);
    assert_eq!(t.v().get_state().total_value, 1_000 * E7);

    let id = t.v().sync(&t.keeper);
    assert_eq!(id, 1);
    // 30% target buffer kept, 70% minus exec fee escrowed in the Zenex market
    let order = t.zm().get_vault_order(&t.vault, &id);
    assert_eq!(order.amount, 700 * E7 - EXEC_FEE);
    assert_eq!(order.kind, 0);
    assert_eq!(t.tok().balance(&t.vault), 300 * E7);
    // pending principal counted (less haircut), exec fee already a cost
    let v_pending = t.v().get_state().total_value;
    assert!(v_pending < 1_000 * E7 && v_pending > 985 * E7, "{v_pending}");

    t.warp(10);
    t.zm().mock_fill(&t.vault, &id, &false);
    // order gone, shares held; no double counting
    let st = t.v().get_zenex_state();
    assert!(st.zenex_shares > 0);
    let v_filled = t.v().get_state().total_value;
    assert!(v_filled < 1_000 * E7 && v_filled > 985 * E7, "{v_filled}");
    approx(v_filled, v_pending, 2 * E7);
    // a second sync clears the id and finds nothing to do
    t.warp(400);
    assert_eq!(t.v().try_sync(&t.keeper), Err(Ok(Error::NothingToDo)));
    assert_eq!(t.v().get_zenex_state().pending_deposit_id, 0);
}

// (2) withdraw within buffer works; beyond buffer fails with LiquidityShortfall, state unchanged
#[test]
fn withdraw_from_buffer_and_shortfall() {
    let t = setup();
    t.deposit(1_000 * E7);
    t.v().sync(&t.keeper);
    t.warp(10);
    t.zm().mock_fill(&t.vault, &1, &false);

    let out = t.yv().withdraw(&(100 * E7), &vec![&t.env, 0i128], &t.market);
    assert!(out.get(0).unwrap() > 95 * E7);
    assert_eq!(t.tok().balance(&t.market), out.get(0).unwrap());

    let shares_before = t.v().balance(&t.market);
    let r = t.v().try_withdraw(&shares_before, &vec![&t.env, 0i128], &t.market);
    assert_eq!(r, Err(Ok(Error::LiquidityShortfall)));
    assert_eq!(t.v().balance(&t.market), shares_before);
}

// (3) low buffer triggers a redeem order; fill after the lock restores the buffer
#[test]
fn low_buffer_redeems_after_lock() {
    let t = setup();
    t.deposit(1_000 * E7);
    t.v().sync(&t.keeper);
    t.warp(10);
    t.zm().mock_fill(&t.vault, &1, &false);
    // market pulls 250 of the 300 buffer: buffer ~50 < 10% floor of ~740
    t.yv().withdraw(&(250 * E7), &vec![&t.env, 0i128], &t.market);
    t.warp(400);
    let id = t.v().sync(&t.keeper);
    let o = t.zm().get_vault_order(&t.vault, &id);
    assert_eq!(o.kind, 1);
    assert!(t.v().get_state().total_value > 700 * E7); // shares in escrow still counted
    // lock not elapsed
    assert!(t.zm().try_mock_fill(&t.vault, &id, &false).is_err());
    t.warp(3_700);
    let buf_before = t.tok().balance(&t.vault);
    t.zm().mock_fill(&t.vault, &id, &false);
    let buf = t.tok().balance(&t.vault);
    assert!(buf > buf_before + 100 * E7, "{buf} {buf_before}");
    assert_eq!(t.v().try_sync(&t.keeper).is_err(), true); // nothing more to do / cooldown
}

// (4) rejected fill refunds and clears the pending order
#[test]
fn rejected_deposit_refunds_and_clears() {
    let t = setup();
    t.deposit(1_000 * E7);
    let id = t.v().sync(&t.keeper);
    let before = t.tok().balance(&t.vault);
    t.warp(10);
    t.zm().mock_fill(&t.vault, &id, &true);
    assert_eq!(t.tok().balance(&t.vault) - before, 700 * E7 - EXEC_FEE);
    assert_eq!(t.v().get_zenex_state().zenex_shares, 0);
    // value lost only the exec fee
    approx(t.v().get_state().total_value, 1_000 * E7 - EXEC_FEE, 1);
    // cooldown protects against reject loops
    assert_eq!(t.v().try_sync(&t.keeper), Err(Ok(Error::Cooldown)));
    t.warp(400);
    assert_eq!(t.v().sync(&t.keeper), 2); // ids are per user, next is 2
}

#[test]
fn cancel_pending_refunds_everything() {
    let t = setup();
    t.deposit(1_000 * E7);
    let id = t.v().sync(&t.keeper);
    t.v().cancel_pending(&t.owner, &0);
    assert!(t.zm().try_get_vault_order(&t.vault, &id).is_err());
    assert_eq!(t.tok().balance(&t.vault), 1_000 * E7);
    assert_eq!(t.v().try_cancel_pending(&t.owner, &0), Err(Ok(Error::NoOpenOrder)));
}

// enforced nested auth: only the keeper's own auth, the adapter authorizes its escrow transfer itself
#[test]
fn sync_works_with_enforced_auth() {
    let t = setup();
    t.deposit(1_000 * E7);
    t.env.mock_auths(&[MockAuth {
        address: &t.keeper,
        invoke: &MockAuthInvoke {
            contract: &t.vault,
            fn_name: "sync",
            args: (t.keeper.clone(),).into_val(&t.env),
            sub_invokes: &[],
        },
    }]);
    assert_eq!(t.v().sync(&t.keeper), 1);
    assert_eq!(t.tok().balance(&t.zmarket), 700 * E7);
}

#[test]
fn sync_redeem_works_with_enforced_auth() {
    let t = setup();
    t.deposit(1_000 * E7);
    t.v().sync(&t.keeper);
    t.warp(10);
    t.zm().mock_fill(&t.vault, &1, &false);
    t.yv().withdraw(&(250 * E7), &vec![&t.env, 0i128], &t.market);
    t.warp(400);
    t.env.mock_auths(&[MockAuth {
        address: &t.keeper,
        invoke: &MockAuthInvoke {
            contract: &t.vault,
            fn_name: "sync",
            args: (t.keeper.clone(),).into_val(&t.env),
            sub_invokes: &[],
        },
    }]);
    assert_eq!(t.v().sync(&t.keeper), 2);
}

// ---------------------------------------------------------------- bounds, roles, pause

#[test]
fn constructor_bounds_are_enforced() {
    let t = setup();
    let bad = |f: &dyn Fn(&mut ZenexConfig)| {
        let mut c = cfg_for(&t.env, &t.zmarket, &t.zvault, &t.keeper);
        f(&mut c);
        reg_fails(&t.env, (t.owner.clone(), t.market.clone(), t.token.clone(), c))
    };
    assert!(bad(&|c| c.target_buffer_bps = 1_999));
    assert!(bad(&|c| c.min_buffer_bps = 3_000));
    assert!(bad(&|c| c.min_buffer_bps = 100));
    assert!(bad(&|c| c.slippage_bps = 10));
    assert!(bad(&|c| c.slippage_bps = 600));
    assert!(bad(&|c| c.haircut_bps = 10));
    assert!(bad(&|c| c.haircut_bps = 2_500));
    assert!(bad(&|c| c.cap = 5 * E7)); // below Zenex min deposit
    assert!(bad(&|c| c.cap = 1_000_000 * E7)); // above Zenex vault cap
    assert!(bad(&|c| c.zenex_vault = Address::generate(&t.env))); // not this market's vault
    // wrong underlying
    let other = t.env.register(MockToken, ());
    assert!(reg_fails(&t.env, (t.owner.clone(), t.market.clone(), other, cfg_for(&t.env, &t.zmarket, &t.zvault, &t.keeper))));
}

#[test]
fn only_market_deposits_and_cap_applies() {
    let t = setup();
    let stranger = Address::generate(&t.env);
    t.tok().mint(&stranger, &(100 * E7));
    assert_eq!(
        t.v().try_deposit(&vec![&t.env, 100 * E7], &vec![&t.env, 0i128], &stranger, &true),
        Err(Ok(Error::NotMarket))
    );
    t.tok().mint(&t.market, &(100_001 * E7));
    assert_eq!(
        t.v().try_deposit(&vec![&t.env, 100_001 * E7], &vec![&t.env, 0i128], &t.market, &true),
        Err(Ok(Error::CapExceeded))
    );
}

#[test]
fn pause_blocks_deposits_not_withdrawals() {
    let t = setup();
    t.deposit(1_000 * E7);
    t.v().pause(&t.owner, &true);
    t.tok().mint(&t.market, &(10 * E7));
    assert_eq!(
        t.v().try_deposit(&vec![&t.env, 10 * E7], &vec![&t.env, 0i128], &t.market, &true),
        Err(Ok(Error::Paused))
    );
    assert_eq!(t.v().try_sync(&t.keeper), Err(Ok(Error::NothingToDo))); // no new deposit orders
    t.yv().withdraw(&(100 * E7), &vec![&t.env, 0i128], &t.market);
    // platform admin can pause too, strangers cannot
    let admin = Address::from_str(&t.env, "GBZ7C3N43KURCM3DWN4LOOKR5XWHNU6EZEJQT5VGRLHKUUQQYL7UXFMJ");
    t.v().pause(&admin, &false);
    assert_eq!(t.v().try_pause(&Address::generate(&t.env), &true), Err(Ok(Error::NotOwner)));
}

#[test]
fn owner_params_bounded_haircut_raise_only_and_roles() {
    let t = setup();
    t.v().set_params(&t.owner, &4_000, &1_500, &100, &300, &(50_000 * E7));
    assert_eq!(t.v().config().haircut_bps, 300);
    assert_eq!(
        t.v().try_set_params(&t.owner, &4_000, &1_500, &100, &100, &(50_000 * E7)),
        Err(Ok(Error::InvalidConfig))
    );
    assert_eq!(
        t.v().try_set_params(&t.owner, &1_000, &500, &100, &300, &(50_000 * E7)),
        Err(Ok(Error::InvalidConfig))
    );
    let k2 = Address::generate(&t.env);
    t.v().set_keeper(&t.owner, &k2);
    t.deposit(1_000 * E7);
    assert_eq!(t.v().try_sync(&t.keeper), Err(Ok(Error::NotKeeper)));
    assert_eq!(t.v().sync(&k2), 1);
    assert_eq!(t.v().try_set_keeper(&k2, &k2), Err(Ok(Error::NotOwner)));
    // only the platform admin may upgrade
    let hash = BytesN::from_array(&t.env, &[1u8; 32]);
    assert_eq!(t.v().try_upgrade(&t.owner, &hash), Err(Ok(Error::NotAdmin)));
}

#[test]
fn bind_market_once() {
    let t = setup();
    let v2 = t.env.register(
        ZenexVault,
        (t.owner.clone(), t.owner.clone(), t.token.clone(), cfg_for(&t.env, &t.zmarket, &t.zvault, &t.keeper)),
    );
    let c = ZenexVaultClient::new(&t.env, &v2);
    assert!(!c.get_zenex_state().bound);
    c.bind_market(&t.owner, &t.market);
    assert_eq!(c.market(), t.market);
    assert_eq!(c.try_bind_market(&t.owner, &t.owner), Err(Ok(Error::AlreadyBound)));
}

#[test]
fn defindex_shaped_reads_never_panic() {
    let t = setup();
    let a = t.v().get_assets();
    assert_eq!(a.len(), 1);
    assert_eq!(a.get(0).unwrap().address, t.token);
    assert!(!a.get(0).unwrap().strategies.get(0).unwrap().paused);
    assert_eq!(t.v().get_asset_amounts_per_shares(&0).get(0).unwrap(), 0);
    assert_eq!(t.v().kind(), symbol_short!("zenex"));
}

#[test]
fn share_price_follows_zenex_pnl_conservatively() {
    let t = setup();
    t.deposit(1_000 * E7);
    t.v().sync(&t.keeper);
    t.warp(10);
    t.zm().mock_fill(&t.vault, &1, &false);
    let before = t.v().get_state().total_value;
    // Zenex vault loses 10% of its assets (traders win)
    let sink = Address::generate(&t.env);
    t.zv().drain(&sink, &(t.tok().balance(&t.zvault) / 10));
    let after = t.v().get_state().total_value;
    assert!(after < before);
    // value per share quoted to the market follows
    let q = t.v().get_asset_amounts_per_shares(&t.v().balance(&t.market)).get(0).unwrap();
    assert_eq!(q, after);
}

// (5) integration with the REAL receipt-vault via set_boosted_vault
mod rv {
    use soroban_sdk::{contractclient, Address, Env};
    pub const WASM: &[u8] = include_bytes!("../../../build/test/receipt_vault.wasm");
    #[contractclient(name = "Client")]
    #[allow(dead_code)]
    pub trait Vault {
        fn initialize(env: Env, token_address: Address, supply_yearly_rate_scaled: u128, borrow_yearly_rate_scaled: u128, admin: Address);
        fn enable_static_rates(env: Env, admin: Address);
        fn set_peridottroller(env: Env, peridottroller: Address);
        fn set_idle_cash_buffer_bps(env: Env, admin: Address, idle_cash_buffer_bps: u32);
        fn set_boosted_vault(env: Env, admin: Address, boosted_vault: Address);
        fn get_boosted_vault(env: Env) -> Option<Address>;
        fn refresh_boosted_underlying(env: Env);
        fn get_total_underlying(env: Env) -> u128;
        fn get_ptoken_balance(env: Env, user: Address) -> u128;
        fn deposit(env: Env, user: Address, amount: u128);
        fn withdraw(env: Env, user: Address, ptoken_amount: u128);
    }
}
mod ctrl {
    soroban_sdk::contractimport!(file = "../../build/test/simple_peridottroller.wasm");
}

#[test]
fn real_receipt_vault_routes_idle_liquidity_into_the_zenex_buffer() {
    let env = Env::default();
    env.mock_all_auths_allowing_non_root_auth();
    env.cost_estimate().budget().reset_unlimited();
    env.ledger().set_timestamp(1_000_000);
    let admin = Address::from_str(&env, TEST_ADMIN_ADDRESS);
    let token = env.register(MockToken, ());
    MockTokenClient::new(&env, &token).initialize(&SString::from_str(&env, "USDC"), &SString::from_str(&env, "USDC"), &7);
    let zvault = env.register(MockZenexVault, (token.clone(),));
    let zmarket = env.register(
        MockZenexMarket,
        (token.clone(), zvault.clone(), ZConfig { deposit_fee: 0, exec_fee: EXEC_FEE, max_vault_balance: 100_000 * E7, min_deposit: 10 * E7, redeem_fee: 0, redeem_lock: 3_600 }),
    );
    let lp = Address::generate(&env);
    MockTokenClient::new(&env, &token).mint(&zvault, &(1_000 * E7));
    MockZenexVaultClient::new(&env, &zvault).mint_for_fill(&lp, &(1_000 * E7 * 1_000_000));

    let vault = env.register(rv::WASM, ());
    let vc = rv::Client::new(&env, &vault);
    vc.initialize(&token, &0u128, &0u128, &admin);
    vc.enable_static_rates(&admin);
    let oracle = env.register(mock_reflector::MockReflector, (7u32, 1u32));
    let comp = env.register(ctrl::WASM, ());
    let cc = ctrl::Client::new(&env, &comp);
    cc.initialize(&admin);
    cc.set_oracle(&oracle);
    cc.add_market(&vault);
    cc.set_market_cf(&vault, &800_000u128);
    cc.set_price_fallback(&token, &Some((1_000_000u128, 1_000_000u128)));
    vc.set_peridottroller(&comp);

    let owner = Address::generate(&env);
    let keeper = Address::generate(&env);
    // vault created first with the owner as placeholder market, bound once the receipt-vault exists
    let zv = env.register(ZenexVault, (owner.clone(), owner.clone(), token.clone(), cfg_for(&env, &zmarket, &zvault, &keeper)));
    let zc = ZenexVaultClient::new(&env, &zv);
    zc.bind_market(&owner, &vault);
    vc.set_idle_cash_buffer_bps(&admin, &1_000);
    vc.set_boosted_vault(&admin, &zv);
    assert_eq!(vc.get_boosted_vault(), Some(zv.clone()));

    let user = Address::generate(&env);
    MockTokenClient::new(&env, &token).mint(&user, &(10_000 * E7));
    vc.deposit(&user, &((10_000 * E7) as u128));
    // 10% idle in the market, 90% parked in the Zenex vault's local buffer
    assert_eq!(MockTokenClient::new(&env, &token).balance(&vault), 1_000 * E7);
    assert_eq!(MockTokenClient::new(&env, &token).balance(&zv), 9_000 * E7);
    // keeper moves the excess into Zenex
    assert_eq!(zc.sync(&keeper), 1);
    MockZenexMarketClient::new(&env, &zmarket).mock_fill(&zv, &1, &false);
    // a user withdrawal within market idle + Zenex buffer still works
    let pt = vc.get_ptoken_balance(&user);
    vc.withdraw(&user, &(pt / 10));
    assert!(MockTokenClient::new(&env, &token).balance(&user) > 900 * E7);
    // a full exit needs Zenex liquidity: it fails cleanly while funds sit in Zenex
    let rest = vc.get_ptoken_balance(&user);
    assert!(vc.try_withdraw(&user, &rest).is_err());
}
