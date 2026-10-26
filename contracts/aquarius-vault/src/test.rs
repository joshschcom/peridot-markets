extern crate std;

use soroban_sdk::{
    contract, contractimpl, contracttype,
    testutils::{Address as _, Ledger},
    token::{Client as TokenClient, StellarAssetClient},
    vec, Address, Env, Symbol, Vec, U256,
};

use crate::pool::Slot0;
use crate::{AquariusVault, AquariusVaultClient, Error};

// ---------------------------------------------------------------------------------------------
// A small but honest concentrated-liquidity pool model: several positions per owner, real v3
// token amounts from the tick range, one-sided deposits out of range, price-based swaps with a fee.
// Float maths is fine for a test double.
// ---------------------------------------------------------------------------------------------
#[contracttype]
#[derive(Clone)]
enum K {
    T0,
    T1,
    Tick,
    Spacing,
    Pos(Address, i32, i32),
    Killed,
}

fn sp(tick: i32) -> f64 {
    (1.0001f64).powf(tick as f64 / 2.0)
}
fn amounts(l: f64, tick: i32, lo: i32, hi: i32) -> (f64, f64) {
    let (sa, sb, s) = (sp(lo), sp(hi), sp(tick));
    if tick < lo {
        (l * (1.0 / sa - 1.0 / sb), 0.0)
    } else if tick >= hi {
        (0.0, l * (sb - sa))
    } else {
        (l * (1.0 / s - 1.0 / sb), l * (s - sa))
    }
}
fn liq_for(d0: f64, d1: f64, tick: i32, lo: i32, hi: i32) -> f64 {
    let (sa, sb, s) = (sp(lo), sp(hi), sp(tick));
    if tick < lo {
        d0 / (1.0 / sa - 1.0 / sb)
    } else if tick >= hi {
        d1 / (sb - sa)
    } else {
        (d0 / (1.0 / s - 1.0 / sb)).min(d1 / (s - sa))
    }
}

#[contract]
pub struct MockClPool;
#[contractimpl]
impl MockClPool {
    pub fn init(env: Env, t0: Address, t1: Address, tick: i32, spacing: i32) {
        env.storage().instance().set(&K::T0, &t0);
        env.storage().instance().set(&K::T1, &t1);
        env.storage().instance().set(&K::Tick, &tick);
        env.storage().instance().set(&K::Spacing, &spacing);
    }
    pub fn set_tick(env: Env, tick: i32) {
        env.storage().instance().set(&K::Tick, &tick);
    }
    pub fn set_killed(env: Env, k: bool) {
        env.storage().instance().set(&K::Killed, &k);
    }
    pub fn pool_type(env: Env) -> Symbol {
        Symbol::new(&env, "concentrated")
    }
    pub fn get_tokens(env: Env) -> Vec<Address> {
        vec![&env, env.storage().instance().get::<_, Address>(&K::T0).unwrap(), env.storage().instance().get::<_, Address>(&K::T1).unwrap()]
    }
    pub fn get_tick_spacing(env: Env) -> i32 {
        env.storage().instance().get(&K::Spacing).unwrap()
    }
    pub fn get_slot0(env: Env) -> Slot0 {
        let tick: i32 = env.storage().instance().get(&K::Tick).unwrap();
        let q = sp(tick) * 2f64.powi(96);
        Slot0 { sqrt_price_x96: U256::from_u128(&env, q as u128), tick }
    }
    pub fn get_is_killed_deposit(env: Env) -> bool {
        env.storage().instance().get(&K::Killed).unwrap_or(false)
    }
    pub fn estimate_deposit_position(env: Env, lo: i32, hi: i32, desired: Vec<u128>) -> (Vec<u128>, u128) {
        let tick: i32 = env.storage().instance().get(&K::Tick).unwrap();
        // Liquidity on a coarse grid and amounts rounded UP, so feeding the quote back in is idempotent (like the real pool).
        let l = (liq_for(desired.get(0).unwrap() as f64, desired.get(1).unwrap() as f64, tick, lo, hi) / 1e6).floor() * 1e6;
        let (a0, a1) = amounts(l, tick, lo, hi);
        (vec![&env, a0.ceil() as u128, a1.ceil() as u128], l as u128)
    }
    pub fn deposit_position(env: Env, sender: Address, lo: i32, hi: i32, desired: Vec<u128>, min_liq: u128) -> (Vec<u128>, u128) {
        let (amts, l) = Self::estimate_deposit_position(env.clone(), lo, hi, desired);
        assert!(l >= min_liq, "OutMinNotSatisfied");
        let me = env.current_contract_address();
        let (t0, t1) = (Self::get_tokens(env.clone()).get(0).unwrap(), Self::get_tokens(env.clone()).get(1).unwrap());
        if amts.get(0).unwrap() > 0 {
            TokenClient::new(&env, &t0).transfer(&sender, &me, &(amts.get(0).unwrap() as i128));
        }
        if amts.get(1).unwrap() > 0 {
            TokenClient::new(&env, &t1).transfer(&sender, &me, &(amts.get(1).unwrap() as i128));
        }
        let k = K::Pos(sender, lo, hi);
        let cur: u128 = env.storage().persistent().get(&k).unwrap_or(0);
        env.storage().persistent().set(&k, &(cur + l));
        (amts, l)
    }
    pub fn estimate_withdraw_position(env: Env, owner: Address, lo: i32, hi: i32, amount: u128) -> Vec<u128> {
        let held: u128 = env.storage().persistent().get(&K::Pos(owner, lo, hi)).unwrap_or(0);
        assert!(amount <= held, "InsufficientLiquidity");
        let tick: i32 = env.storage().instance().get(&K::Tick).unwrap();
        let (a0, a1) = amounts(amount as f64, tick, lo, hi);
        vec![&env, a0.floor() as u128, a1.floor() as u128]
    }
    pub fn withdraw_position(env: Env, owner: Address, lo: i32, hi: i32, amount: u128, _min: Vec<u128>) -> Vec<u128> {
        owner.require_auth();
        let out = Self::estimate_withdraw_position(env.clone(), owner.clone(), lo, hi, amount);
        let k = K::Pos(owner.clone(), lo, hi);
        let held: u128 = env.storage().persistent().get(&k).unwrap();
        env.storage().persistent().set(&k, &(held - amount));
        let me = env.current_contract_address();
        let toks = Self::get_tokens(env.clone());
        for i in 0..2 {
            let a = out.get(i).unwrap();
            if a > 0 {
                TokenClient::new(&env, &toks.get(i).unwrap()).transfer(&me, &owner, &(a as i128));
            }
        }
        out
    }
    pub fn estimate_swap(env: Env, in_idx: u32, _out_idx: u32, amount: u128) -> u128 {
        let tick: i32 = env.storage().instance().get(&K::Tick).unwrap();
        let p = sp(tick).powi(2);
        let after_fee = amount as f64 * 0.997;
        (if in_idx == 0 { after_fee * p } else { after_fee / p }).floor() as u128
    }
    pub fn swap(env: Env, user: Address, in_idx: u32, out_idx: u32, amount: u128, out_min: u128) -> u128 {
        let out = Self::estimate_swap(env.clone(), in_idx, out_idx, amount);
        assert!(out >= out_min, "OutMinNotSatisfied");
        let toks = Self::get_tokens(env.clone());
        let me = env.current_contract_address();
        TokenClient::new(&env, &toks.get(in_idx).unwrap()).transfer(&user, &me, &(amount as i128));
        TokenClient::new(&env, &toks.get(out_idx).unwrap()).transfer(&me, &user, &(out as i128));
        out
    }
    pub fn get_all_position_fees(env: Env, _owner: Address) -> Vec<u128> {
        vec![&env, 0u128, 0u128]
    }
    pub fn claim_all_position_fees(env: Env, _owner: Address) -> Vec<u128> {
        vec![&env, 0u128, 0u128]
    }
    pub fn claim(_env: Env, _user: Address) -> u128 {
        0
    }
}

// ---------------------------------------------------------------------------------------------
struct Ctx<'a> {
    env: Env,
    vault: AquariusVaultClient<'a>,
    pool: Address,
    t0: Address,
    t1: Address,
    owner: Address,
    keeper: Address,
    alice: Address,
}

const E7: i128 = 10_000_000;

fn pool_env() -> (Env, Address, Address, Address, Address) {
    let env = Env::default();
    env.mock_all_auths();
    env.cost_estimate().budget().reset_unlimited();
    env.ledger().set_timestamp(1_000_000);
    let admin = Address::generate(&env);
    let mut a = env.register_stellar_asset_contract_v2(admin.clone()).address();
    let mut b = env.register_stellar_asset_contract_v2(admin.clone()).address();
    if a > b {
        core::mem::swap(&mut a, &mut b);
    }
    let pool = env.register(MockClPool, ());
    // price ~ 5.75 token1 per token0 (tick 17487), spacing 60, like the testnet USDT/XLM pool
    MockClPoolClient::new(&env, &pool).init(&a, &b, &17_487, &60);
    // the pool holds deep reserves for swaps
    StellarAssetClient::new(&env, &a).mint(&pool, &(10_000_000 * E7));
    StellarAssetClient::new(&env, &b).mint(&pool, &(10_000_000 * E7));
    (env, pool, a, b, admin)
}

#[allow(clippy::too_many_arguments)]
fn make<'a>(env: &Env, pool: &Address, u: &Address, owner: &Address, keeper: &Address, rungs: u32, cap: i128, fee: u32) -> Result<AquariusVaultClient<'a>, ()> {
    let id = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        env.register(AquariusVault, (owner, pool, u, keeper, &rungs, &2u32, &2u32, &1u32, &3u32, &3600u32, &fee, &cap, &100u32))
    }));
    match id {
        Ok(id) => Ok(AquariusVaultClient::new(env, &id)),
        Err(_) => Err(()),
    }
}

fn setup<'a>(underlying_is_t0: bool, rungs: u32) -> Ctx<'a> {
    let (env, pool, t0, t1, _admin) = pool_env();
    let owner = Address::generate(&env);
    let keeper = Address::generate(&env);
    let alice = Address::generate(&env);
    let u = if underlying_is_t0 { t0.clone() } else { t1.clone() };
    let vault = make(&env, &pool, &u, &owner, &keeper, rungs, 1_000_000 * E7, 1000).unwrap();
    StellarAssetClient::new(&env, &u).mint(&alice, &(100_000 * E7));
    Ctx { env, vault, pool, t0, t1, owner, keeper, alice }
}

fn u_tok(c: &Ctx) -> Address {
    c.vault.underlying()
}

#[test]
fn constructor_rejects_bad_config() {
    let (env, pool, t0, _t1, _) = pool_env();
    let o = Address::generate(&env);
    // good
    assert!(make(&env, &pool, &t0, &o, &o, 5, 1000, 1000).is_ok());
    // underlying not in pool
    let stranger = env.register_stellar_asset_contract_v2(Address::generate(&env)).address();
    assert!(make(&env, &pool, &stranger, &o, &o, 5, 1000, 1000).is_err());
    // too many rungs, zero cap, fee above 20%
    assert!(make(&env, &pool, &t0, &o, &o, 8, 1000, 1000).is_err());
    assert!(make(&env, &pool, &t0, &o, &o, 5, 0, 1000).is_err());
    assert!(make(&env, &pool, &t0, &o, &o, 5, 1000, 2001).is_err());
    // not a pool at all
    assert!(make(&env, &o, &t0, &o, &o, 5, 1000, 1000).is_err());
}

#[test]
fn deposit_rebalance_withdraw_round_trip_both_sides() {
    for u_is_t0 in [true, false] {
        let c = setup(u_is_t0, 5);
        let u = u_tok(&c);
        let ut = TokenClient::new(&c.env, &u);
        let start = ut.balance(&c.alice);
        let shares = c.vault.deposit_underlying(&c.alice, &(1000 * E7), &0);
        assert_eq!(shares, 1000 * E7 - crate::DEAD_SHARES);
        assert_eq!(c.vault.total_supply(), 1000 * E7);
        assert!(c.vault.needs_rebalance());
        assert!(c.vault.rebalance(&c.keeper));
        let rungs = c.vault.get_rungs();
        assert!(rungs.len() >= 4, "ladder built: {}", rungs.len());
        // value is conserved within the 1% slippage guard
        let nav = c.vault.total_value();
        assert!(nav * 10_000 >= 1000 * E7 * 9_900, "nav {nav}");
        // rebalance again right away is not due
        assert_eq!(c.vault.try_rebalance(&c.keeper).unwrap_err().unwrap(), Error::NotDue);
        // exit with everything
        let out = c.vault.withdraw(&shares, &vec![&c.env, 0i128], &c.alice);
        let got = out.get(0).unwrap();
        assert!(got * 10_000 >= 1000 * E7 * 9_800, "got {got}");
        assert_eq!(ut.balance(&c.alice), start - 1000 * E7 + got);
        assert_eq!(c.vault.balance(&c.alice), 0);
    }
}

#[test]
fn second_depositor_pays_fair_price_and_partial_withdraw_is_pro_rata() {
    let c = setup(true, 5);
    let bob = Address::generate(&c.env);
    StellarAssetClient::new(&c.env, &u_tok(&c)).mint(&bob, &(5_000 * E7));
    let s1 = c.vault.deposit_underlying(&c.alice, &(1000 * E7), &0);
    c.vault.rebalance(&c.owner);
    let s2 = c.vault.deposit_underlying(&bob, &(500 * E7), &0);
    // bob deposited half of alice's amount into a vault worth ~the same: shares within 2% of half
    let expected = s1 / 2;
    assert!((s2 - expected).abs() * 100 < expected * 2, "s1 {s1} s2 {s2}");
    let before = c.vault.get_asset_amounts_per_shares(&s1).get(0).unwrap();
    let out = c.vault.withdraw(&(s1 / 2), &vec![&c.env, 0i128], &c.alice).get(0).unwrap();
    assert!(out * 100 > before * 48 && out * 100 < before * 52, "out {out} before {before}");
    // the remaining ladder keeps its other half
    let rungs = c.vault.get_rungs();
    assert!(rungs.iter().all(|r| r.liquidity > 0));
}

#[test]
fn drift_and_cooldown_gate_rebalances() {
    let c = setup(true, 5);
    c.vault.deposit_underlying(&c.alice, &(1000 * E7), &0);
    c.vault.rebalance(&c.keeper);
    let pool = MockClPoolClient::new(&c.env, &c.pool);
    // price moves 4 spacings: past the 3-spacing trigger, but the cooldown has not elapsed
    pool.set_tick(&(17_487 + 4 * 60));
    assert_eq!(c.vault.try_rebalance(&c.keeper).unwrap_err().unwrap(), Error::NotDue);
    c.env.ledger().set_timestamp(1_000_000 + 3_601);
    assert!(c.vault.needs_rebalance());
    assert!(c.vault.rebalance(&c.keeper));
    // moved: nothing to do until the next drift
    c.env.ledger().set_timestamp(1_000_000 + 8_000);
    assert!(!c.vault.needs_rebalance());
    // a stranger cannot rebalance
    let eve = Address::generate(&c.env);
    assert_eq!(c.vault.try_rebalance(&eve).unwrap_err().unwrap(), Error::NotKeeper);
}

#[test]
fn pause_blocks_deposit_and_rebalance_but_never_exit() {
    let c = setup(false, 3);
    let shares = c.vault.deposit_underlying(&c.alice, &(1000 * E7), &0);
    c.vault.rebalance(&c.keeper);
    c.vault.set_paused(&c.owner, &true);
    assert_eq!(c.vault.try_deposit_underlying(&c.alice, &(10 * E7), &0).unwrap_err().unwrap(), Error::Paused);
    assert_eq!(c.vault.try_rebalance(&c.keeper).unwrap_err().unwrap(), Error::Paused);
    assert!(c.vault.get_assets().get(0).unwrap().strategies.get(0).unwrap().paused);
    // in-kind exit pays both tokens without a swap
    let (u_out, o_out) = c.vault.redeem_in_kind(&c.alice, &(shares / 2));
    assert!(u_out + o_out > 0);
    let out = c.vault.withdraw(&c.vault.balance(&c.alice), &vec![&c.env, 0i128], &c.alice);
    assert!(out.get(0).unwrap() > 0);
}

#[test]
fn caps_first_deposit_and_dead_shares() {
    let (env, pool, t0, _t1, _) = pool_env();
    let o = Address::generate(&env);
    let v = make(&env, &pool, &t0, &o, &o, 5, 500 * E7, 0).unwrap();
    let a = Address::generate(&env);
    StellarAssetClient::new(&env, &t0).mint(&a, &(10_000 * E7));
    assert_eq!(v.try_deposit_underlying(&a, &1_000, &0).unwrap_err().unwrap(), Error::FirstDepositTooSmall);
    assert_eq!(v.try_deposit_underlying(&a, &(501 * E7), &0).unwrap_err().unwrap(), Error::CapExceeded);
    v.deposit_underlying(&a, &(400 * E7), &0);
    assert_eq!(v.balance(&v.address), crate::DEAD_SHARES);
    assert_eq!(v.try_deposit_underlying(&a, &(101 * E7), &0).unwrap_err().unwrap(), Error::CapExceeded);
    // donation does not move the share price
    StellarAssetClient::new(&env, &t0).mint(&v.address, &(1_000_000 * E7));
    assert_eq!(v.get_asset_amounts_per_shares(&E7).get(0).unwrap(), E7 * 400 * E7 / (400 * E7));
}

#[test]
fn market_binding_restricts_deposits_and_defindex_shape() {
    let c = setup(true, 5);
    let market = Address::generate(&c.env);
    StellarAssetClient::new(&c.env, &u_tok(&c)).mint(&market, &(1000 * E7));
    // shape the market factory checks
    let assets = c.vault.get_assets();
    assert_eq!(assets.len(), 1);
    assert_eq!(assets.get(0).unwrap().address, u_tok(&c));
    assert_eq!(c.vault.get_asset_amounts_per_shares(&0), vec![&c.env, 0i128]);
    c.vault.bind_market(&c.owner, &market);
    assert_eq!(c.vault.try_bind_market(&c.owner, &c.alice).unwrap_err().unwrap(), Error::MarketAlreadyBound);
    assert_eq!(c.vault.try_deposit_underlying(&c.alice, &(10 * E7), &0).unwrap_err().unwrap(), Error::NotMarket);
    let r = c.vault.deposit(&vec![&c.env, 500 * E7], &vec![&c.env, 500 * E7], &market, &true);
    assert_eq!(r, vec![&c.env, 500 * E7]);
    assert_eq!(c.vault.market(), market);
    assert!(c.vault.balance(&market) > 0);
    let out = c.vault.withdraw(&c.vault.balance(&market), &vec![&c.env, 0i128], &market);
    assert!(out.get(0).unwrap() > 0);
}

#[test]
fn owner_cannot_take_pool_tokens_and_fee_only_goes_down() {
    let c = setup(true, 5);
    c.vault.deposit_underlying(&c.alice, &(100 * E7), &0);
    assert_eq!(c.vault.try_sweep_extra(&c.owner, &c.t0, &c.owner).unwrap_err().unwrap(), Error::ProtectedToken);
    assert_eq!(c.vault.try_sweep_extra(&c.owner, &c.t1, &c.owner).unwrap_err().unwrap(), Error::ProtectedToken);
    let eve = Address::generate(&c.env);
    assert_eq!(c.vault.try_sweep_extra(&eve, &c.t0, &eve).unwrap_err().unwrap(), Error::NotOwner);
    assert_eq!(c.vault.try_lower_fee(&c.owner, &1500).unwrap_err().unwrap(), Error::FeeCanOnlyDecrease);
    c.vault.lower_fee(&c.owner, &500);
    assert_eq!(c.vault.get_fee_bps(), 500);
    // an unrelated token can be swept
    let other = c.env.register_stellar_asset_contract_v2(Address::generate(&c.env)).address();
    StellarAssetClient::new(&c.env, &other).mint(&c.vault.address, &77);
    assert_eq!(c.vault.sweep_extra(&c.owner, &other, &c.owner), 77);
}

#[test]
fn killed_deposits_leave_funds_idle_and_withdraw_still_works() {
    let c = setup(true, 5);
    let shares = c.vault.deposit_underlying(&c.alice, &(100 * E7), &0);
    MockClPoolClient::new(&c.env, &c.pool).set_killed(&true);
    assert_eq!(c.vault.try_rebalance(&c.keeper).unwrap_err().unwrap(), Error::PoolUnavailable);
    let out = c.vault.withdraw(&shares, &vec![&c.env, 0i128], &c.alice);
    assert!(out.get(0).unwrap() > 99 * E7);
}
