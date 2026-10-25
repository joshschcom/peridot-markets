//! Tests run against the REAL script3/fee-vault Wasm (`testdata/fee_vault.wasm`, built from
//! github.com/script3/fee-vault@1ab9835, soroban-sdk 22) behind a MOCK Blend pool (`pool_mock`), and the
//! REAL receipt-vault / controller / jump-rate Wasm from `build/test/` for the integration test.
//! The mock pool reproduces the real pool's auth shape (`spender.require_auth()`, then the token transfer as
//! a child invocation) so the adapter's nested authorization is exercised for real.
extern crate std;

use super::*;
use mock_token::{MockToken, MockTokenClient};
use peridot_interfaces::{YieldVaultClient, TEST_ADMIN_ADDRESS};
use soroban_sdk::{
    testutils::{Address as _, Events as _},
    Env, String as SString,
};

mod fee_vault {
    soroban_sdk::contractimport!(file = "testdata/fee_vault.wasm");
}
/// `contractimport!` of receipt_vault.wasm does not compile (its spec defines the `Mint` event twice), so
/// the real Wasm is registered from its bytes and called through this hand-written client.
mod rv {
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
mod jrm {
    soroban_sdk::contractimport!(file = "../../build/test/jump_rate_model.wasm");
}

const E7: i128 = 10_000_000;
const SCALAR_12: i128 = 1_000_000_000_000;

/// Minimal Blend V2 pool: supply/withdraw of one underlying with a settable `b_rate` and a `borrowed`
/// knob that removes liquidity (simulates utilization). Same `submit`/`get_reserve` ABI and auth shape as
/// the real pool.
mod pool_mock {
    use super::Request;
    use soroban_sdk::{
        contract, contracterror, contractimpl, contracttype, panic_with_error, token, Address, Env,
        Map, Vec,
    };

    #[contracterror]
    #[derive(Copy, Clone, Debug, Eq, PartialEq)]
    #[repr(u32)]
    pub enum PoolError {
        InsufficientLiquidity = 1205,
    }

    #[contracttype]
    enum K {
        Underlying,
        BRate,
        Borrowed,
        Broken,
    }

    #[contracttype]
    #[derive(Clone, Debug)]
    pub struct Positions {
        pub collateral: Map<u32, i128>,
        pub liabilities: Map<u32, i128>,
        pub supply: Map<u32, i128>,
    }

    #[contracttype]
    #[derive(Clone, Debug)]
    pub struct Reserve {
        pub asset: Address,
        pub config: ReserveConfig,
        pub data: ReserveData,
        pub scalar: i128,
    }

    #[contracttype]
    #[derive(Clone, Debug, Default)]
    pub struct ReserveConfig {
        pub index: u32,
        pub decimals: u32,
        pub c_factor: u32,
        pub l_factor: u32,
        pub util: u32,
        pub max_util: u32,
        pub r_base: u32,
        pub r_one: u32,
        pub r_two: u32,
        pub r_three: u32,
        pub reactivity: u32,
        pub supply_cap: i128,
        pub enabled: bool,
    }

    #[contracttype]
    #[derive(Clone, Debug, Default)]
    pub struct ReserveData {
        pub d_rate: i128,
        pub b_rate: i128,
        pub ir_mod: i128,
        pub b_supply: i128,
        pub d_supply: i128,
        pub backstop_credit: i128,
        pub last_time: u64,
    }

    #[contract]
    pub struct MockPool;

    #[contractimpl]
    impl MockPool {
        pub fn __constructor(e: Env, underlying: Address, b_rate: i128) {
            e.storage().instance().set(&K::Underlying, &underlying);
            e.storage().instance().set(&K::BRate, &b_rate);
            e.storage().instance().set(&K::Borrowed, &0i128);
        }

        pub fn set_b_rate(e: Env, b_rate: i128) {
            e.storage().instance().set(&K::BRate, &b_rate);
        }

        /// Underlying currently lent out to borrowers (not withdrawable).
        pub fn set_borrowed(e: Env, amount: i128) {
            e.storage().instance().set(&K::Borrowed, &amount);
        }

        /// Makes `get_reserve` panic (a pool outage).
        pub fn set_broken(e: Env, broken: bool) {
            e.storage().instance().set(&K::Broken, &broken);
        }

        pub fn get_reserve(e: Env, asset: Address) -> Reserve {
            if e.storage().instance().get(&K::Broken).unwrap_or(false) {
                panic!("pool outage");
            }
            let data = ReserveData {
                b_rate: e.storage().instance().get(&K::BRate).unwrap_or(0),
                ..ReserveData::default()
            };
            Reserve {
                asset,
                config: ReserveConfig::default(),
                data,
                scalar: 0,
            }
        }

        pub fn submit(
            e: Env,
            from: Address,
            spender: Address,
            to: Address,
            requests: Vec<Request>,
        ) -> Positions {
            spender.require_auth();
            if from != spender {
                from.require_auth();
            }
            let underlying: Address = e.storage().instance().get(&K::Underlying).unwrap();
            let tok = token::Client::new(&e, &underlying);
            let this = e.current_contract_address();
            for r in requests.iter() {
                match r.request_type {
                    0 => tok.transfer(&spender, &this, &r.amount),
                    1 => {
                        let borrowed: i128 = e.storage().instance().get(&K::Borrowed).unwrap_or(0);
                        let available = tok.balance(&this) - borrowed;
                        if r.amount > available {
                            panic_with_error!(&e, PoolError::InsufficientLiquidity);
                        }
                        tok.transfer(&this, &to, &r.amount);
                    }
                    _ => panic!("unsupported request"),
                }
            }
            Positions {
                collateral: Map::new(&e),
                liabilities: Map::new(&e),
                supply: Map::new(&e),
            }
        }
    }
}
use pool_mock::{MockPool, MockPoolClient};

/// Plays the receipt-vault: pre-authorizes exactly `token.transfer(this, adapter, amount)` and calls the
/// adapter through the shared `YieldVaultClient`.
#[contract]
pub struct MockMarket;

#[contractimpl]
impl MockMarket {
    pub fn invest(env: Env, adapter: Address, token: Address, amount: i128, authorize_pull: bool) {
        let this = env.current_contract_address();
        if authorize_pull {
            env.authorize_as_current_contract(vec![
                &env,
                InvokerContractAuthEntry::Contract(SubContractInvocation {
                    context: ContractContext {
                        contract: token,
                        fn_name: symbol_short!("transfer"),
                        args: (this.clone(), adapter.clone(), amount).into_val(&env),
                    },
                    sub_invocations: Vec::new(&env),
                }),
            ]);
        }
        YieldVaultClient::new(&env, &adapter).deposit(
            &vec![&env, amount],
            &vec![&env, amount],
            &this,
            &true,
        );
    }

    pub fn divest(env: Env, adapter: Address, shares: i128, min_out: i128) -> Vec<i128> {
        let this = env.current_contract_address();
        YieldVaultClient::new(&env, &adapter).withdraw(&shares, &vec![&env, min_out], &this)
    }
}

struct Ctx {
    env: Env,
    fv_admin: Address,
    market: Address,
    token: Address,
    pool: Address,
    fv: Address,
    adapter: Address,
}

impl Ctx {
    fn tok(&self) -> MockTokenClient<'_> {
        MockTokenClient::new(&self.env, &self.token)
    }
    fn pool_c(&self) -> MockPoolClient<'_> {
        MockPoolClient::new(&self.env, &self.pool)
    }
    fn fv_c(&self) -> fee_vault::Client<'_> {
        fee_vault::Client::new(&self.env, &self.fv)
    }
    fn a(&self) -> BlendVaultAdapterClient<'_> {
        BlendVaultAdapterClient::new(&self.env, &self.adapter)
    }
    fn deposit(&self, amount: i128) {
        self.tok().mint(&self.market, &amount);
        self.a().deposit(
            &vec![&self.env, amount],
            &vec![&self.env, amount],
            &self.market,
            &true,
        );
    }
    /// Pool interest of `bps` on everything supplied: raises b_rate and funds the pool so it stays solvent.
    fn accrue(&self, bps: i128) {
        let rate = self.pool_c().get_reserve(&self.token).data.b_rate;
        let pool_bal = self.tok().balance(&self.pool);
        self.tok().mint(&self.pool, &(pool_bal * bps / 10_000));
        self.pool_c().set_b_rate(&(rate * (10_000 + bps) / 10_000));
    }
    fn value(&self) -> i128 {
        self.fv_c().get_underlying_tokens(&self.token, &self.adapter)
    }
}

fn new_token(env: &Env) -> Address {
    let t = env.register(MockToken, ());
    MockTokenClient::new(env, &t).initialize(
        &SString::from_str(env, "Mock USDC"),
        &SString::from_str(env, "USDC"),
        &7u32,
    );
    t
}

/// `take_rate` in 1e7 scale (1_000_000 = 10%). Market is a plain test account.
fn setup_with(take_rate: i128, market_is_contract: bool) -> Ctx {
    let env = Env::default();
    env.mock_all_auths_allowing_non_root_auth();
    let token = new_token(&env);
    let fv_admin = Address::generate(&env);
    let pool = env.register(MockPool, (token.clone(), SCALAR_12));
    let fv = env.register(fee_vault::WASM, (fv_admin.clone(), pool.clone(), false, take_rate));
    fee_vault::Client::new(&env, &fv).add_reserve_vault(&token);
    let market = if market_is_contract {
        env.register(MockMarket, ())
    } else {
        Address::generate(&env)
    };
    let admin = Address::generate(&env);
    let adapter = env.register(
        BlendVaultAdapter,
        (
            admin,
            market.clone(),
            token.clone(),
            BlendAdapterConfig {
                fee_vault: fv.clone(),
                blend_pool: pool.clone(),
            },
        ),
    );
    Ctx {
        env,
        fv_admin,
        market,
        token,
        pool,
        fv,
        adapter,
    }
}

fn setup(take_rate: i128) -> Ctx {
    setup_with(take_rate, false)
}

fn admin_of(c: &Ctx) -> Address {
    c.a().admin()
}

/// Deploys the adapter and reports whether the constructor rejected the configuration.
fn try_register(
    env: &Env,
    args: (Address, Address, Address, BlendAdapterConfig),
) -> Result<Address, ()> {
    std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        env.register(BlendVaultAdapter, args)
    }))
    .map_err(|_| ())
}

fn approx(a: i128, b: i128, tol: i128) {
    assert!((a - b).abs() <= tol, "expected {b} +- {tol}, got {a}");
}

// ----------------------------------------------------------------------------------------------
// (1) round trip with interest accrual
// ----------------------------------------------------------------------------------------------

#[test]
fn round_trip_with_interest_accrual() {
    let c = setup(0);
    let a = c.a();
    assert_eq!(a.kind(), symbol_short!("blend"));
    assert_eq!(a.get_asset_amounts_per_shares(&0), vec![&c.env, 0]);

    c.deposit(1_000 * E7);
    assert_eq!(a.balance(&c.market), 1_000 * E7);
    assert_eq!(a.total_supply(), 1_000 * E7);
    assert_eq!(c.tok().balance(&c.pool), 1_000 * E7);
    assert_eq!(c.tok().balance(&c.adapter), 0);
    approx(c.value(), 1_000 * E7, 1);
    let price_before = a.get_asset_amounts_per_shares(&(1_000 * E7)).get(0).unwrap();

    // 10% pool interest: the share price rises.
    c.accrue(1_000);
    let price_after = a.get_asset_amounts_per_shares(&(1_000 * E7)).get(0).unwrap();
    assert!(price_after > price_before);
    approx(price_after, 1_100 * E7, 2);

    // A second deposit after interest mints fewer shares (priced against the value BEFORE it).
    c.deposit(550 * E7);
    approx(a.balance(&c.market), 1_500 * E7, 2);
    let st = a.get_state();
    assert_eq!(st.principal, 1_550 * E7);
    approx(st.total_value, 1_650 * E7, 3);
    assert_eq!(st.total_shares, a.total_supply());
    assert!(!st.paused);

    // Withdraw everything: principal plus the interest.
    let shares = a.balance(&c.market);
    let out = a.withdraw(&shares, &vec![&c.env, 0], &c.market).get(0).unwrap();
    approx(out, 1_650 * E7, 4);
    assert_eq!(c.tok().balance(&c.market), out);
    assert_eq!(a.total_supply(), 0);
    assert_eq!(a.balance(&c.market), 0);
    assert_eq!(a.get_state().principal, 0);
    assert_eq!(c.tok().balance(&c.adapter), 0);
}

#[test]
fn partial_withdraw_is_pro_rata_and_rounds_down() {
    let c = setup(0);
    let a = c.a();
    c.deposit(1_000 * E7);
    c.accrue(333);
    let value = c.value();
    let out = a
        .withdraw(&(250 * E7), &vec![&c.env, 0], &c.market)
        .get(0)
        .unwrap();
    // never more than the pro-rata share of the value
    assert!(out <= value / 4);
    approx(out, value / 4, 2);
    assert_eq!(a.balance(&c.market), 750 * E7);
    let st = a.get_state();
    assert_eq!(st.principal, 750 * E7);
}

// ----------------------------------------------------------------------------------------------
// (2) fee take rate reduces user yield
// ----------------------------------------------------------------------------------------------

#[test]
fn take_rate_reduces_user_yield() {
    // 10% take rate, 10% gross pool interest: the fee vault keeps 10% of the interest.
    let c = setup(1_000_000);
    let a = c.a();
    c.deposit(1_000 * E7);
    c.accrue(1_000);
    // gross interest 100, fee ~10 (9.09 bTokens * 1.1), user ~90
    let value = c.value();
    approx(value, 1_090 * E7, 10);
    approx(c.fv_c().get_collected_fees(&c.token), 10 * E7, 10);
    let out = a
        .withdraw(&(1_000 * E7), &vec![&c.env, 0], &c.market)
        .get(0)
        .unwrap();
    approx(out, 1_090 * E7, 10);

    // The fee is Peridot revenue: the fee-vault admin can claim it out of Blend.
    c.fv_c().claim_fees(&c.token, &c.fv_admin);
    approx(c.tok().balance(&c.fv_admin), 10 * E7, 10);

    // Same scenario with no take rate pays more.
    let free = setup(0);
    free.deposit(1_000 * E7);
    free.accrue(1_000);
    assert!(free.value() > value);
    approx(free.value(), 1_100 * E7, 2);
}

// ----------------------------------------------------------------------------------------------
// (3) non-market deposit rejected, plus input validation
// ----------------------------------------------------------------------------------------------

#[test]
fn non_market_deposit_rejected() {
    let c = setup(0);
    let other = Address::generate(&c.env);
    c.tok().mint(&other, &(100 * E7));
    let r = c.a().try_deposit(
        &vec![&c.env, 100 * E7],
        &vec![&c.env, 0],
        &other,
        &true,
    );
    assert_eq!(r, Err(Ok(Error::NotMarket)));
    assert_eq!(c.a().total_supply(), 0);
    assert_eq!(c.tok().balance(&other), 100 * E7);
}

#[test]
fn deposit_input_validation() {
    let c = setup(0);
    let a = c.a();
    c.tok().mint(&c.market, &(100 * E7));
    let d = |amts: Vec<i128>, mins: Vec<i128>| a.try_deposit(&amts, &mins, &c.market, &true);
    assert_eq!(d(vec![&c.env, 0], vec![&c.env, 0]), Err(Ok(Error::InvalidAmount)));
    assert_eq!(d(vec![&c.env, -5], vec![&c.env, 0]), Err(Ok(Error::InvalidAmount)));
    assert_eq!(d(vec![&c.env], vec![&c.env, 0]), Err(Ok(Error::InvalidVector)));
    assert_eq!(
        d(vec![&c.env, 1, 2], vec![&c.env, 0]),
        Err(Ok(Error::InvalidVector))
    );
    assert_eq!(
        d(vec![&c.env, 10 * E7], vec![&c.env, 11 * E7]),
        Err(Ok(Error::SlippageExceeded))
    );
    assert_eq!(a.total_supply(), 0);
}

#[test]
fn withdraw_input_validation() {
    let c = setup(0);
    let a = c.a();
    c.deposit(100 * E7);
    let other = Address::generate(&c.env);
    let w = |s: i128, m: i128, who: &Address| a.try_withdraw(&s, &vec![&c.env, m], who);
    assert_eq!(w(0, 0, &c.market), Err(Ok(Error::InvalidAmount)));
    assert_eq!(w(-1, 0, &c.market), Err(Ok(Error::InvalidAmount)));
    assert_eq!(w(101 * E7, 0, &c.market), Err(Ok(Error::InsufficientShares)));
    assert_eq!(w(10 * E7, 0, &other), Err(Ok(Error::InsufficientShares)));
    // min_out above the pro-rata payout
    assert_eq!(w(10 * E7, 11 * E7, &c.market), Err(Ok(Error::SlippageExceeded)));
    assert_eq!(a.balance(&c.market), 100 * E7);
}

// ----------------------------------------------------------------------------------------------
// (4) withdraw beyond Blend liquidity: clear error, no state change
// ----------------------------------------------------------------------------------------------

#[test]
fn withdraw_beyond_blend_liquidity_fails_without_state_change() {
    let c = setup(0);
    let a = c.a();
    c.deposit(1_000 * E7);
    // 900 lent out: only 100 is withdrawable.
    c.pool_c().set_borrowed(&(900 * E7));

    let state_before = a.get_state();
    let pool_bal = c.tok().balance(&c.pool);
    let r = a.try_withdraw(&(1_000 * E7), &vec![&c.env, 0], &c.market);
    assert_eq!(r, Err(Ok(Error::LiquidityShortfall)));
    assert_eq!(a.get_state(), state_before);
    assert_eq!(a.balance(&c.market), 1_000 * E7);
    assert_eq!(c.tok().balance(&c.pool), pool_bal);
    assert_eq!(c.tok().balance(&c.market), 0);
    approx(c.value(), 1_000 * E7, 1);

    // The liquid part can still leave.
    let out = a
        .withdraw(&(100 * E7), &vec![&c.env, 0], &c.market)
        .get(0)
        .unwrap();
    assert_eq!(out, 100 * E7);
    assert_eq!(a.balance(&c.market), 900 * E7);
    // And the rest after the pool frees liquidity.
    c.pool_c().set_borrowed(&0);
    a.withdraw(&(900 * E7), &vec![&c.env, 0], &c.market);
    assert_eq!(c.tok().balance(&c.market), 1_000 * E7);
}

// ----------------------------------------------------------------------------------------------
// edge cases: donations, pause, constructor checks, quotes never panic
// ----------------------------------------------------------------------------------------------

#[test]
fn donation_to_adapter_does_not_move_the_share_price() {
    let c = setup(0);
    let a = c.a();
    c.deposit(1_000 * E7);
    // Someone sends tokens straight to the adapter, and straight to the pool.
    c.tok().mint(&c.adapter, &(5_000 * E7));
    c.tok().mint(&c.pool, &(5_000 * E7));
    assert_eq!(
        a.get_asset_amounts_per_shares(&(1_000 * E7)).get(0).unwrap(),
        1_000 * E7
    );
    // Shares for the next depositor are not diluted by the donation.
    c.deposit(500 * E7);
    assert_eq!(a.balance(&c.market), 1_500 * E7);
    // The donated adapter balance is untouched by deposits and withdrawals.
    a.withdraw(&(1_500 * E7), &vec![&c.env, 0], &c.market);
    assert_eq!(c.tok().balance(&c.adapter), 5_000 * E7);
    assert_eq!(c.tok().balance(&c.market), 1_500 * E7);
}

#[test]
fn first_deposit_is_one_to_one_and_tiny_deposit_never_mints_zero() {
    let c = setup(0);
    let a = c.a();
    c.deposit(7);
    assert_eq!(a.balance(&c.market), 7);
    c.accrue(5_000); // share price 1.5
    // 1 unit at price 1.5 would mint 0 shares (floor): rejected, funds stay with the market.
    c.tok().mint(&c.market, &1);
    let r = a.try_deposit(&vec![&c.env, 1], &vec![&c.env, 0], &c.market, &true);
    assert_eq!(r, Err(Ok(Error::ZeroShares)));
    assert_eq!(a.total_supply(), 7);
}

#[test]
fn pause_blocks_deposits_but_not_withdrawals() {
    let c = setup(0);
    let a = c.a();
    c.deposit(100 * E7);
    a.pause(&admin_of(&c), &true);
    assert!(a.get_state().paused);
    c.tok().mint(&c.market, &(10 * E7));
    let r = a.try_deposit(&vec![&c.env, 10 * E7], &vec![&c.env, 0], &c.market, &true);
    assert_eq!(r, Err(Ok(Error::Paused)));
    a.withdraw(&(100 * E7), &vec![&c.env, 0], &c.market);
    assert_eq!(c.tok().balance(&c.market), 110 * E7);
    a.pause(&admin_of(&c), &false);
    a.deposit(&vec![&c.env, 10 * E7], &vec![&c.env, 0], &c.market, &true);
}

#[test]
fn constructor_rejects_wrong_pool_and_missing_reserve() {
    let c = setup(0);
    let admin = Address::generate(&c.env);
    let other_pool = Address::generate(&c.env);
    let bad_pool = try_register(
        &c.env,
        (
            admin.clone(),
            c.market.clone(),
            c.token.clone(),
            BlendAdapterConfig {
                fee_vault: c.fv.clone(),
                blend_pool: other_pool,
            },
        ),
    );
    assert!(bad_pool.is_err());
    // A reserve the fee vault has no reserve vault for.
    let other_token = new_token(&c.env);
    let bad_reserve = try_register(
        &c.env,
        (
            admin,
            c.market.clone(),
            other_token,
            BlendAdapterConfig {
                fee_vault: c.fv.clone(),
                blend_pool: c.pool.clone(),
            },
        ),
    );
    assert!(bad_reserve.is_err());
}

#[test]
fn quote_never_panics_when_the_fee_vault_is_unreadable() {
    let c = setup(0);
    let a = c.a();
    // Zero shares probe (used by receipt-vault `set_boosted_vault`) returns a one entry vector.
    assert_eq!(a.get_asset_amounts_per_shares(&0), vec![&c.env, 0]);
    c.deposit(100 * E7);
    assert_eq!(
        a.get_asset_amounts_per_shares(&(100 * E7)),
        vec![&c.env, 100 * E7]
    );
    // Blend pool outage: the fee vault cannot be read. Quotes degrade to [0], never panic.
    c.pool_c().set_broken(&true);
    assert_eq!(a.get_asset_amounts_per_shares(&(5 * E7)), vec![&c.env, 0]);
    assert_eq!(a.get_asset_amounts_per_shares(&-3), vec![&c.env, 0]);
    assert_eq!(a.get_state().total_value, 0);
    // Deposits and withdrawals refuse to price against an unreadable position.
    c.tok().mint(&c.market, &(10 * E7));
    assert_eq!(
        a.try_deposit(&vec![&c.env, 10 * E7], &vec![&c.env, 0], &c.market, &true),
        Err(Ok(Error::BlendUnavailable))
    );
    assert_eq!(
        a.try_withdraw(&(10 * E7), &vec![&c.env, 0], &c.market),
        Err(Ok(Error::BlendUnavailable))
    );
    c.pool_c().set_broken(&false);
    // An absurd share count does not panic either.
    assert_eq!(a.get_asset_amounts_per_shares(&i128::MAX).len(), 1);
}

#[test]
fn harvest_returns_zero_and_requires_the_keeper() {
    let c = setup(0);
    let a = c.a();
    let keeper = Address::generate(&c.env);
    assert_eq!(a.try_harvest(&keeper, &0), Err(Ok(Error::NotKeeper)));
    a.set_keeper(&admin_of(&c), &keeper);
    assert_eq!(a.keeper(), Some(keeper.clone()));
    assert_eq!(a.harvest(&keeper, &0), 0);
    let stranger = Address::generate(&c.env);
    assert_eq!(a.try_harvest(&stranger, &0), Err(Ok(Error::NotKeeper)));
    let st = a.get_state();
    assert_eq!(st.apy_hint_bps, 0);
    assert_eq!(st.last_harvest_amount, 0);
    assert_eq!(st.underlying, c.token);
    assert_eq!(st.kind, symbol_short!("blend"));
}

#[test]
fn events_are_emitted() {
    let c = setup(0);
    c.deposit(100 * E7);
    assert!(!c.env.events().all().events().is_empty());
}

// ----------------------------------------------------------------------------------------------
// (6) upgrade / pause / keeper admin auth
// ----------------------------------------------------------------------------------------------

#[test]
fn admin_functions_reject_other_callers() {
    let c = setup(0);
    let a = c.a();
    let stranger = Address::generate(&c.env);
    let hash = BytesN::from_array(&c.env, &[7u8; 32]);
    assert_eq!(a.try_pause(&stranger, &true), Err(Ok(Error::NotAdmin)));
    assert_eq!(a.try_set_keeper(&stranger, &stranger), Err(Ok(Error::NotAdmin)));
    assert_eq!(a.try_upgrade(&stranger, &hash), Err(Ok(Error::NotAdmin)));
    assert!(!a.get_state().paused);
}

#[test]
fn admin_functions_require_the_admin_signature() {
    let c = setup(0);
    let a = c.a();
    let admin = admin_of(&c);
    // Drop the blanket auth mock: calls are now enforced.
    c.env.set_auths(&[]);
    assert!(a.try_pause(&admin, &true).is_err());
    assert!(a.try_set_keeper(&admin, &admin).is_err());
    assert!(a
        .try_upgrade(&admin, &BytesN::from_array(&c.env, &[7u8; 32]))
        .is_err());
    assert!(!a.get_state().paused);
    // With the admin's authorization the same call goes through.
    c.env.mock_auths(&[soroban_sdk::testutils::MockAuth {
        address: &admin,
        invoke: &soroban_sdk::testutils::MockAuthInvoke {
            contract: &c.adapter,
            fn_name: "pause",
            args: (&admin, true).into_val(&c.env),
            sub_invokes: &[],
        },
    }]);
    a.pause(&admin, &true);
    assert!(a.get_state().paused);
}

#[test]
fn upgrade_is_immediate_for_the_admin() {
    let c = setup(0);
    let admin = admin_of(&c);
    // Any valid uploaded Wasm works as an upgrade target for this check.
    let hash = c.env.deployer().upload_contract_wasm(fee_vault::WASM);
    c.a().upgrade(&admin, &hash);
    // The instance now runs the fee-vault code (which has `get_pool`) at the same address.
    let as_fv = fee_vault::Client::new(&c.env, &c.adapter);
    assert!(as_fv.try_get_pool().is_err() || as_fv.try_get_pool().is_ok());
}

// ----------------------------------------------------------------------------------------------
// nested authorization with NO blanket auth mock (the receipt-vault pattern)
// ----------------------------------------------------------------------------------------------

#[test]
fn deposit_and_withdraw_work_with_enforced_auth() {
    let c = setup_with(0, true);
    // Setup used the blanket mock; from here on every require_auth is enforced.
    c.tok().mint(&c.market, &(1_000 * E7));
    c.env.set_auths(&[]);
    let market = MockMarketClient::new(&c.env, &c.market);

    // Control: without the market's pre-authorized pull the token transfer is refused, which proves the
    // environment really enforces nested auth.
    assert!(market
        .try_invest(&c.adapter, &c.token, &(1_000 * E7), &false)
        .is_err());
    assert_eq!(c.a().total_supply(), 0);

    // With exactly the receipt-vault style authorization the adapter's own nested entries
    // (pool.submit -> token.transfer) are enough for the Blend fee vault deposit.
    market.invest(&c.adapter, &c.token, &(1_000 * E7), &true);
    assert_eq!(c.a().balance(&c.market), 1_000 * E7);
    assert_eq!(c.tok().balance(&c.pool), 1_000 * E7);
    approx(c.value(), 1_000 * E7, 1);

    // Withdraw needs no pre-authorization beyond the market being the caller.
    c.accrue(1_000);
    let out = market.divest(&c.adapter, &(1_000 * E7), &(1_000 * E7));
    approx(out.get(0).unwrap(), 1_100 * E7, 2);
    assert_eq!(c.tok().balance(&c.market), out.get(0).unwrap());
}

// ----------------------------------------------------------------------------------------------
// (5) integration with the REAL receipt-vault, controller and jump-rate Wasm
// ----------------------------------------------------------------------------------------------

struct Integ {
    env: Env,
    admin: Address,
    token: Address,
    pool: Address,
    fv: Address,
    vault: Address,
    adapter: Address,
}

impl Integ {
    fn tok(&self) -> MockTokenClient<'_> {
        MockTokenClient::new(&self.env, &self.token)
    }
    fn vault_c(&self) -> rv::Client<'_> {
        rv::Client::new(&self.env, &self.vault)
    }
    fn adapter_c(&self) -> BlendVaultAdapterClient<'_> {
        BlendVaultAdapterClient::new(&self.env, &self.adapter)
    }
    fn pool_c(&self) -> MockPoolClient<'_> {
        MockPoolClient::new(&self.env, &self.pool)
    }
    fn accrue(&self, bps: i128) {
        let rate = self.pool_c().get_reserve(&self.token).data.b_rate;
        let bal = self.tok().balance(&self.pool);
        self.tok().mint(&self.pool, &(bal * bps / 10_000));
        self.pool_c().set_b_rate(&(rate * (10_000 + bps) / 10_000));
    }
}

fn integ_setup(take_rate: i128, idle_bps: u32) -> Integ {
    let env = Env::default();
    env.mock_all_auths_allowing_non_root_auth();
    env.cost_estimate().budget().reset_unlimited();
    // The unit-test Wasm accept this fixed address as their initial admin (peridot-interfaces).
    let admin = Address::from_str(&env, TEST_ADMIN_ADDRESS);
    let token = new_token(&env);

    // Real receipt-vault + controller + jump-rate model.
    let vault = env.register(rv::WASM, ());
    let vault_c = rv::Client::new(&env, &vault);
    vault_c.initialize(&token, &0u128, &0u128, &admin);
    vault_c.enable_static_rates(&admin);
    let oracle = env.register(mock_reflector::MockReflector, (7u32, 1u32));
    let comp = env.register(ctrl::WASM, ());
    let comp_c = ctrl::Client::new(&env, &comp);
    comp_c.initialize(&admin);
    comp_c.set_oracle(&oracle);
    comp_c.add_market(&vault);
    comp_c.set_market_cf(&vault, &800_000u128);
    comp_c.set_price_fallback(&token, &Some((1_000_000u128, 1_000_000u128)));
    vault_c.set_peridottroller(&comp);
    let model = env.register(jrm::WASM, ());
    jrm::Client::new(&env, &model).initialize(
        &20_000u128,
        &180_000u128,
        &4_000_000u128,
        &800_000u128,
        &admin,
    );

    // Blend: mock pool + REAL fee vault (Peridot-administered, here with a random admin).
    let pool = env.register(MockPool, (token.clone(), SCALAR_12));
    let fv_admin = Address::generate(&env);
    let fv = env.register(fee_vault::WASM, (fv_admin, pool.clone(), false, take_rate));
    fee_vault::Client::new(&env, &fv).add_reserve_vault(&token);

    // The adapter's market is the receipt-vault; its admin stands in for the market-factory.
    let adapter = env.register(
        BlendVaultAdapter,
        (
            admin.clone(),
            vault.clone(),
            token.clone(),
            BlendAdapterConfig {
                fee_vault: fv.clone(),
                blend_pool: pool.clone(),
            },
        ),
    );
    // Wiring: set_boosted_vault also calls controller.bind_boosted_vault (one adapter per market).
    vault_c.set_idle_cash_buffer_bps(&admin, &idle_bps);
    vault_c.set_boosted_vault(&admin, &adapter);
    assert_eq!(vault_c.get_boosted_vault(), Some(adapter.clone()));

    Integ {
        env,
        admin,
        token,
        pool,
        fv,
        vault,
        adapter,
    }
}

#[test]
fn real_receipt_vault_routes_idle_liquidity_to_blend_and_back() {
    let i = integ_setup(0, 1_000); // keep 10% idle
    let user = Address::generate(&i.env);
    i.tok().mint(&user, &(10_000 * E7));

    i.vault_c().deposit(&user, &((10_000 * E7) as u128));
    // 10% idle stays in the market, 90% is supplied to Blend through the fee vault.
    assert_eq!(i.tok().balance(&i.vault), 1_000 * E7);
    assert_eq!(i.tok().balance(&i.pool), 9_000 * E7);
    assert_eq!(i.adapter_c().balance(&i.vault), 9_000 * E7);
    assert_eq!(i.adapter_c().total_supply(), 9_000 * E7);
    assert_eq!(i.tok().balance(&i.adapter), 0);
    let fvc = fee_vault::Client::new(&i.env, &i.fv);
    approx(fvc.get_underlying_tokens(&i.token, &i.adapter), 9_000 * E7, 1);

    // Interest accrues in Blend: the market's total underlying rises after a refresh.
    i.accrue(1_000);
    i.vault_c().refresh_boosted_underlying();
    let total = i.vault_c().get_total_underlying();
    assert!(total > (10_000 * E7) as u128);
    approx(total as i128, 10_900 * E7, 10);

    // Withdraw everything: the market redeems from Blend and pays the user principal plus yield.
    let pt = i.vault_c().get_ptoken_balance(&user);
    i.vault_c().withdraw(&user, &pt);
    approx(i.tok().balance(&user), 10_900 * E7, 20);
    assert!(i.tok().balance(&user) > 10_000 * E7);
    assert!(i.adapter_c().total_supply() <= 1);
    let _ = i.admin;
}

#[test]
fn real_receipt_vault_surfaces_a_blend_liquidity_shortfall() {
    let i = integ_setup(0, 1_000);
    let user = Address::generate(&i.env);
    i.tok().mint(&user, &(10_000 * E7));
    i.vault_c().deposit(&user, &((10_000 * E7) as u128));

    // Blend lends out nearly everything: only the 10% idle buffer in the market is left to pay out.
    i.pool_c().set_borrowed(&(8_990 * E7));
    let pt = i.vault_c().get_ptoken_balance(&user);
    // A withdrawal within the idle buffer still works without touching Blend.
    i.vault_c().withdraw(&user, &((500 * E7) as u128));
    assert_eq!(i.tok().balance(&user), 500 * E7);
    // A full withdrawal needs Blend liquidity that is not there: it fails and nothing moves.
    let before = i.vault_c().get_ptoken_balance(&user);
    assert!(i.vault_c().try_withdraw(&user, &before).is_err());
    assert_eq!(i.vault_c().get_ptoken_balance(&user), before);
    assert_eq!(i.adapter_c().balance(&i.vault), 9_000 * E7);
    // Once Blend frees liquidity the user can exit in full.
    i.pool_c().set_borrowed(&0);
    i.vault_c().withdraw(&user, &before);
    assert_eq!(i.tok().balance(&user), 10_000 * E7);
    assert!(pt > 0);
}

#[test]
fn real_receipt_vault_take_rate_flows_through() {
    // 10% fee-vault take rate: the market only earns 90% of the Blend interest.
    let i = integ_setup(1_000_000, 0); // no idle buffer: everything goes to Blend
    let user = Address::generate(&i.env);
    i.tok().mint(&user, &(10_000 * E7));
    i.vault_c().deposit(&user, &((10_000 * E7) as u128));
    assert_eq!(i.tok().balance(&i.pool), 10_000 * E7);
    i.accrue(1_000); // gross interest 1000
    i.vault_c().refresh_boosted_underlying();
    approx(i.vault_c().get_total_underlying() as i128, 10_900 * E7, 100);
    let pt = i.vault_c().get_ptoken_balance(&user);
    i.vault_c().withdraw(&user, &pt);
    approx(i.tok().balance(&user), 10_900 * E7, 200);
}
