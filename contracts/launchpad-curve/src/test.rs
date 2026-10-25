#![cfg(test)]
extern crate std;

use mock_token::{MockToken, MockTokenClient};
use soroban_sdk::{testutils::Address as _, Address, Env, String};

use crate::params::{validate, CurveParams, ParamError, MAX_AMOUNT};
use crate::{CurveError, LaunchpadCurve, LaunchpadCurveClient, Phase};
use launchpad_token::{LaunchpadToken, LaunchpadTokenClient};

const X7: i128 = 10_000_000;

/// Standard-like preset in XLM terms: 30k virtual XLM, 85k XLM target, 1.073B virtual tokens,
/// 800M curve tokens, 200M LP tokens, 1% fee.
fn std_params() -> CurveParams {
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

struct Ctx {
    env: Env,
    curve: LaunchpadCurveClient<'static>,
    curve_addr: Address,
    token: LaunchpadTokenClient<'static>,
    quote: MockTokenClient<'static>,
    creator: Address,
    treasury: Address,
    factory: Address,
    params: CurveParams,
}

fn setup(params: CurveParams) -> Ctx {
    let env = Env::default();
    env.mock_all_auths();
    env.cost_estimate().budget().reset_unlimited();
    let creator = Address::generate(&env);
    let treasury = Address::generate(&env);
    let factory = Address::generate(&env);
    let curve_addr = Address::generate(&env);

    let quote_id = env.register(MockToken, ());
    let quote = MockTokenClient::new(&env, &quote_id);
    quote.initialize(&String::from_str(&env, "Lumens"), &String::from_str(&env, "XLM"), &7);

    let supply = params.curve_supply + params.lp_supply;
    let token_id = env.register(
        LaunchpadToken,
        (
            &curve_addr,
            String::from_str(&env, "Meridian"),
            String::from_str(&env, "MRD"),
            supply,
            String::from_str(&env, ""),
        ),
    );
    env.register_at(
        &curve_addr,
        LaunchpadCurve,
        (&token_id, &quote_id, &creator, &factory, &treasury, params.clone()),
    );
    Ctx {
        curve: LaunchpadCurveClient::new(&env, &curve_addr),
        token: LaunchpadTokenClient::new(&env, &token_id),
        quote,
        curve_addr,
        creator,
        treasury,
        factory,
        params,
        env,
    }
}

impl Ctx {
    fn funded_user(&self, amount: i128) -> Address {
        let u = Address::generate(&self.env);
        self.quote.mint(&u, &amount);
        u
    }
}

// ---- independent closed form (u128 big math, written separately from math.rs) ----

fn cdiv(a: u128, b: u128) -> u128 {
    (a + b - 1) / b
}

struct Model {
    k: u128,
    vq: u128,
    vt: u128,
    fee_bps: u128,
}

impl Model {
    fn new(p: &CurveParams) -> Self {
        Model {
            k: p.virtual_quote as u128 * p.virtual_token as u128,
            vq: p.virtual_quote as u128,
            vt: p.virtual_token as u128,
            fee_bps: p.trade_fee_bps as u128,
        }
    }
    /// (fee, net, tokens_out) for a buy of `q` from state (real, sold).
    fn buy(&self, real: u128, sold: u128, q: u128) -> (u128, u128, u128) {
        let fee = cdiv(q * self.fee_bps, 10_000);
        let net = q - fee;
        let x = self.vq + real;
        let y = self.vt - sold;
        let out = y - cdiv(self.k, x + net);
        (fee, net, out)
    }
    /// (gross, fee, out) for a sell of `t` from state (real, sold).
    fn sell(&self, real: u128, sold: u128, t: u128) -> (u128, u128, u128) {
        let x = self.vq + real;
        let y = self.vt - sold;
        let gross = x - cdiv(self.k, y + t);
        let fee = cdiv(gross * self.fee_bps, 10_000);
        (gross, fee, gross - fee)
    }
}

// ---- closed form ----

#[test]
fn buy_matches_closed_form_from_fresh_curve() {
    let c = setup(std_params());
    let m = Model::new(&c.params);
    let u = c.funded_user(1_000_000 * X7);
    let q = 1_000 * X7;
    let (fee, net, out) = m.buy(0, 0, q as u128);
    // The first buy also equals the textbook floor(y * net / (x + net)).
    let textbook = m.vt * net / (m.vq + net);
    assert_eq!(out, textbook);

    let got = c.curve.buy(&u, &q, &1);
    assert_eq!(got as u128, out);
    assert_eq!(c.token.balance(&u) as u128, out);
    assert_eq!(c.quote.balance(&u), 1_000_000 * X7 - q);
    let st = c.curve.get_state();
    assert_eq!(st.real_quote as u128, net);
    assert_eq!(st.sold as u128, out);
    assert_eq!(st.fees_treasury_pending as u128, fee);
    // spot price after the trade matches x/y
    let x = m.vq + net;
    let y = m.vt - out;
    assert_eq!(st.price as u128, x * 10_000_000 / y);
    // quote_buy previews the same numbers
    let c2 = setup(std_params());
    let pq = c2.curve.quote_buy(&q);
    assert_eq!((pq.fee as u128, pq.tokens_out as u128, pq.clamped), (fee, out, false));
}

#[test]
fn sell_matches_closed_form() {
    let c = setup(std_params());
    let m = Model::new(&c.params);
    let u = c.funded_user(1_000_000 * X7);
    c.curve.buy(&u, &(5_000 * X7), &1);
    let st = c.curve.get_state();
    let (real, sold) = (st.real_quote as u128, st.sold as u128);
    let t = (sold / 3) as i128;
    let (gross, fee, out) = m.sell(real, sold, t as u128);
    let before = c.quote.balance(&u);
    let pq = c.curve.quote_sell(&t);
    assert_eq!((pq.gross_quote as u128, pq.fee as u128, pq.quote_out as u128), (gross, fee, out));
    let got = c.curve.sell(&u, &t, &1);
    assert_eq!(got as u128, out);
    assert_eq!(c.quote.balance(&u) - before, out as i128);
    let st2 = c.curve.get_state();
    assert_eq!(st2.real_quote as u128, real - gross);
    assert_eq!(st2.sold as u128, sold - t as u128);
}

#[test]
fn curve_never_pays_more_than_the_exact_formula() {
    // The exact (rational) curve has sold(R) = vt * R / (vq + R) once R quote has been added. Whatever
    // sequence of buys and sells led to the current real_quote, the curve must not have sold more than that.
    let c = setup(std_params());
    let u = c.funded_user(10_000_000 * X7);
    let m = Model::new(&c.params);
    let check = |c: &Ctx| {
        let st = c.curve.get_state();
        assert!(
            st.sold as u128 * (m.vq + st.real_quote as u128) <= m.vt * st.real_quote as u128,
            "sold more than the exact closed form"
        );
    };
    for q in [1_000_001i128, 7, 123_456_789, 98_765_432_101, 5 * X7, 33_333 * X7] {
        let _ = c.curve.try_buy(&u, &q, &1); // dust buys revert
        check(&c);
    }
    for frac in [3i128, 7, 2, 11] {
        let t = c.token.balance(&u) / frac;
        let _ = c.curve.try_sell(&u, &t, &1);
        check(&c);
        let _ = c.curve.try_buy(&u, &(777 * X7), &1);
        check(&c);
    }
}

#[test]
fn fee_accounting_to_the_stroop() {
    let mut p = std_params();
    p.creator_fee_share_bps = 2_500; // creator gets 25% of every fee
    let c = setup(p);
    let u = c.funded_user(1_000_000 * X7);
    let mut fees = 0i128;
    let q1 = 1_234_567_891i128;
    c.curve.buy(&u, &q1, &1);
    fees += (q1 * 100 + 9_999) / 10_000;
    let t = c.token.balance(&u) / 2;
    let st = c.curve.get_state();
    let q = c.curve.quote_sell(&t);
    c.curve.sell(&u, &t, &1);
    fees += q.fee;
    let st2 = c.curve.get_state();
    assert_eq!(st.real_quote - st2.real_quote, q.gross_quote);
    assert_eq!(st2.fees_treasury_pending + st2.fees_creator_pending, fees);
    // creator share is floor per trade, remainder to the treasury
    assert!(st2.fees_creator_pending > 0);
    // held quote = real_quote + unclaimed fees
    assert_eq!(c.quote.balance(&c.curve_addr), st2.real_quote + fees);
    // claim pays exactly the counters, to the right accounts, leaving real_quote
    let (tr, cr) = c.curve.claim_fees();
    assert_eq!((tr, cr), (st2.fees_treasury_pending, st2.fees_creator_pending));
    assert_eq!(c.quote.balance(&c.treasury), tr);
    assert_eq!(c.quote.balance(&c.creator), cr);
    assert_eq!(c.quote.balance(&c.curve_addr), st2.real_quote);
    let st3 = c.curve.get_state();
    assert_eq!((st3.fees_treasury_pending, st3.fees_creator_pending), (0, 0));
    // a second claim is a no-op
    assert_eq!(c.curve.claim_fees(), (0, 0));
    assert_eq!(c.quote.balance(&c.curve_addr), st2.real_quote);
}

#[test]
fn zero_fee_curve_has_no_fees() {
    let mut p = std_params();
    p.trade_fee_bps = 0;
    let c = setup(p);
    let u = c.funded_user(100_000 * X7);
    c.curve.buy(&u, &(1_000 * X7), &1);
    let st = c.curve.get_state();
    assert_eq!(st.real_quote, 1_000 * X7);
    assert_eq!(st.fees_treasury_pending, 0);
}

// ---- slippage ----

#[test]
fn slippage_bounds_revert() {
    let c = setup(std_params());
    let u = c.funded_user(100_000 * X7);
    let q = 100 * X7;
    let quote = c.curve.quote_buy(&q);
    assert_eq!(
        c.curve.try_buy(&u, &q, &(quote.tokens_out + 1)).unwrap_err().unwrap(),
        CurveError::SlippageExceeded
    );
    assert_eq!(c.curve.try_buy(&u, &q, &0).unwrap_err().unwrap(), CurveError::InvalidSlippageBound);
    assert_eq!(c.curve.try_buy(&u, &q, &-5).unwrap_err().unwrap(), CurveError::InvalidSlippageBound);
    assert_eq!(c.curve.try_buy(&u, &0, &1).unwrap_err().unwrap(), CurveError::InvalidAmount);
    // exact bound passes
    assert_eq!(c.curve.buy(&u, &q, &quote.tokens_out), quote.tokens_out);

    let t = c.token.balance(&u);
    let sq = c.curve.quote_sell(&t);
    assert_eq!(
        c.curve.try_sell(&u, &t, &(sq.quote_out + 1)).unwrap_err().unwrap(),
        CurveError::SlippageExceeded
    );
    assert_eq!(c.curve.try_sell(&u, &t, &0).unwrap_err().unwrap(), CurveError::InvalidSlippageBound);
    assert_eq!(c.curve.try_sell(&u, &0, &1).unwrap_err().unwrap(), CurveError::InvalidAmount);
    // nothing moved on the failed calls
    assert_eq!(c.token.balance(&u), t);
    assert_eq!(c.curve.sell(&u, &t, &sq.quote_out), sq.quote_out);
}

#[test]
fn dust_trades_revert() {
    let c = setup(std_params());
    let u = c.funded_user(100 * X7);
    // 1 stroop: fee rounds up to 1, net 0
    assert_eq!(c.curve.try_buy(&u, &1, &1).unwrap_err().unwrap(), CurveError::DustTrade);
    c.curve.buy(&u, &(10 * X7), &1);
    // selling a single base unit yields no quote
    assert_eq!(c.curve.try_sell(&u, &1, &1).unwrap_err().unwrap(), CurveError::DustTrade);
    // selling more than was ever sold is rejected
    assert_eq!(
        c.curve.try_sell(&u, &(c.curve.get_state().sold + 1), &1).unwrap_err().unwrap(),
        CurveError::ExceedsSold
    );
}

// ---- round trips and path independence ----

#[test]
fn round_trip_never_profits() {
    for fee_bps in [0u32, 1, 100, 500] {
        let mut p = std_params();
        p.trade_fee_bps = fee_bps;
        let c = setup(p);
        let u = c.funded_user(1_000_000 * X7);
        for q in [10 * X7, 1_000 * X7, 12_345 * X7 + 77, 3_000_000_000i128 + 1] {
            let start = c.quote.balance(&u);
            let t = c.curve.buy(&u, &q, &1);
            let back = c.curve.sell(&u, &t, &1);
            let end = c.quote.balance(&u);
            assert!(end <= start, "round trip profited at fee {fee_bps}");
            if fee_bps > 0 {
                assert!(end < start, "round trip must lose the fees at fee {fee_bps}");
                assert!(back < q);
            }
        }
    }
}

#[test]
fn many_small_buys_equal_one_big_buy_on_k() {
    let mut p = std_params();
    p.trade_fee_bps = 0; // isolate the curve: with no fee the end state depends only on total quote
    let big = setup(p.clone());
    let small = setup(p.clone());
    let a = big.funded_user(1_000_000 * X7);
    let b = small.funded_user(1_000_000 * X7);
    let total = 10_000 * X7;
    big.curve.buy(&a, &total, &1);
    for _ in 0..100 {
        small.curve.buy(&b, &(total / 100), &1);
    }
    let (sb, ss) = (big.curve.get_state(), small.curve.get_state());
    assert_eq!(sb.real_quote, ss.real_quote);
    // On the grid y = ceil(k / x), so the end state is identical no matter how the quote was split.
    assert_eq!(sb.sold, ss.sold);

    // With the 1% fee the end state still sits on the grid of its own real_quote.
    let c = setup(std_params());
    let m = Model::new(&c.params);
    let u = c.funded_user(1_000_000 * X7);
    for _ in 0..50 {
        c.curve.buy(&u, &(200 * X7), &1);
    }
    let st = c.curve.get_state();
    let x = m.vq + st.real_quote as u128;
    assert_eq!(m.vt - st.sold as u128, cdiv(m.k, x));
    assert!(x * (m.vt - st.sold as u128) >= m.k);
}

// ---- creator cap ----

#[test]
fn creator_cap_is_cumulative_and_not_reset_by_sells() {
    let c = setup(std_params());
    c.quote.mint(&c.creator, &(1_000_000 * X7));
    let cap = c.curve.get_state().creator_cap;
    assert_eq!(cap, 8_000_000_000_000_000 * 5 / 100);
    // ~0.37 percent of the curve per 100 XLM at the start; buy in chunks until the cap bites
    let mut bought = 0i128;
    let mut n = 0;
    loop {
        match c.curve.try_buy(&c.creator, &(400 * X7), &1) {
            Ok(Ok(t)) => {
                bought += t;
                n += 1;
                assert!(bought <= cap);
            }
            Ok(Err(_)) | Err(Ok(CurveError::CreatorCapExceeded)) => break,
            other => panic!("unexpected {other:?}"),
        }
    }
    assert!(n >= 2, "several buys must fit under the cap");
    assert_eq!(c.curve.get_state().creator_bought, bought);
    // over the cap now
    assert_eq!(
        c.curve.try_buy(&c.creator, &(400 * X7), &1).unwrap_err().unwrap(),
        CurveError::CreatorCapExceeded
    );
    // selling does not free the allowance
    let half = c.token.balance(&c.creator) / 2;
    c.curve.sell(&c.creator, &half, &1);
    assert_eq!(c.curve.get_state().creator_bought, bought);
    assert_eq!(
        c.curve.try_buy(&c.creator, &(400 * X7), &1).unwrap_err().unwrap(),
        CurveError::CreatorCapExceeded
    );
    // other wallets are not capped
    let u = c.funded_user(100_000 * X7);
    c.curve.buy(&u, &(40_000 * X7), &1);
    assert!(c.token.balance(&u) > cap);
}

// ---- no mint, supply and balances ----

#[test]
fn supply_is_constant_and_balances_add_up() {
    let c = setup(std_params());
    let supply = c.params.curve_supply + c.params.lp_supply;
    assert_eq!(c.token.balance(&c.curve_addr), supply);
    let u1 = c.funded_user(100_000 * X7);
    let u2 = c.funded_user(100_000 * X7);
    c.curve.buy(&u1, &(5_000 * X7), &1);
    c.curve.buy(&u2, &(9_000 * X7), &1);
    c.curve.sell(&u1, &(c.token.balance(&u1) / 2), &1);
    assert_eq!(c.token.total_supply(), supply);
    let held = c.token.balance(&c.curve_addr) + c.token.balance(&u1) + c.token.balance(&u2);
    assert_eq!(held, supply);
    let st = c.curve.get_state();
    assert_eq!(st.sold, c.token.balance(&u1) + c.token.balance(&u2));
    assert_eq!(c.token.balance(&c.curve_addr), supply - st.sold);
}

// ---- target, clamp, graduation state machine ----

fn buy_to_target(c: &Ctx) -> (Address, i128, i128) {
    let u = c.funded_user(10_000_000 * X7);
    let before = c.quote.balance(&u);
    // 2x the needed quote: the buy is clamped
    let want = 2 * (c.params.graduation_target + 1_000 * X7);
    let out = c.curve.buy(&u, &want, &1);
    (u.clone(), before - c.quote.balance(&u), out)
}

#[test]
fn buy_crossing_target_is_clamped_to_a_partial_fill() {
    let c = setup(std_params());
    let (u, spent, out) = buy_to_target(&c);
    let st = c.curve.get_state();
    // lands exactly on the target
    assert_eq!(st.real_quote, c.params.graduation_target);
    assert_eq!(st.phase, Phase::Graduatable);
    assert_eq!(st.progress_bps, 10_000);
    // charged only what was needed (net 85_000 XLM + the ceil fee), never the full request
    let net = c.params.graduation_target as u128;
    let gross = cdiv(net * 10_000, 9_900);
    assert_eq!(spent as u128, gross);
    assert!(spent < 2 * (c.params.graduation_target + 1_000 * X7));
    assert_eq!(out, c.token.balance(&u));
    // does not sell more than curve_supply
    assert!(st.sold <= c.params.curve_supply);
    assert_eq!(st.tokens_remaining, c.params.curve_supply - st.sold);
    // held = real_quote + fees
    assert_eq!(c.quote.balance(&c.curve_addr), st.real_quote + st.fees_treasury_pending);
    // closed form on the final state
    let m = Model::new(&c.params);
    assert_eq!(m.vt - st.sold as u128, cdiv(m.k, m.vq + c.params.graduation_target as u128));
}

#[test]
fn trading_stops_at_target_but_sells_still_work() {
    let c = setup(std_params());
    let (u, _, _) = buy_to_target(&c);
    let other = c.funded_user(1_000 * X7);
    assert_eq!(c.curve.try_buy(&other, &(10 * X7), &1).unwrap_err().unwrap(), CurveError::TradingClosed);
    assert_eq!(c.curve.try_quote_buy(&(10 * X7)).unwrap_err().unwrap(), CurveError::TradingClosed);

    // a sell is allowed and drops the curve back under the target
    let t = c.token.balance(&u) / 10;
    c.curve.sell(&u, &t, &1);
    let st = c.curve.get_state();
    assert!(st.real_quote < c.params.graduation_target);
    assert_eq!(st.phase, Phase::Trading);
    // buying refills exactly up to the target again
    c.curve.buy(&other, &(1_000 * X7), &1);
    let st = c.curve.get_state();
    assert!(st.real_quote <= c.params.graduation_target);
    assert!(st.sold <= c.params.curve_supply);
}

#[test]
fn graduate_stub_enforces_state_machine() {
    let c = setup(std_params());
    assert_eq!(c.curve.try_graduate().unwrap_err().unwrap(), CurveError::NotGraduatable);
    buy_to_target(&c);
    assert_eq!(c.curve.try_graduate().unwrap_err().unwrap(), CurveError::NotImplemented);
    // nothing moved
    assert_eq!(c.curve.get_state().real_quote, c.params.graduation_target);
}

#[test]
fn state_events_and_progress() {
    let c = setup(std_params());
    let st = c.curve.get_state();
    assert_eq!(st.phase, Phase::Trading);
    assert_eq!(st.progress_bps, 0);
    assert_eq!(st.price, (30_000 * X7 as i128) * 10_000_000 / 10_730_000_000_000_000);
    let u = c.funded_user(100_000 * X7);
    c.curve.buy(&u, &(10_000 * X7), &1);
    let st = c.curve.get_state();
    assert_eq!(st.progress_bps as i128, st.real_quote * 10_000 / c.params.graduation_target);
    assert!(st.price > 0 && st.fully_diluted_value > 0);
    let cfg = c.curve.get_config();
    assert_eq!(cfg.factory, c.factory);
    assert_eq!(cfg.creator, c.creator);
}

// ---- constructor validation ----

#[test]
fn param_validation() {
    let ok = std_params();
    assert_eq!(validate(&ok), Ok(()));
    let bad = |f: &dyn Fn(&mut CurveParams)| {
        let mut p = std_params();
        f(&mut p);
        validate(&p)
    };
    assert_eq!(bad(&|p| p.virtual_quote = 0), Err(ParamError::NonPositive));
    assert_eq!(bad(&|p| p.virtual_token = -1), Err(ParamError::NonPositive));
    assert_eq!(bad(&|p| p.lp_supply = 0), Err(ParamError::NonPositive));
    assert_eq!(bad(&|p| p.graduation_target = 0), Err(ParamError::NonPositive));
    assert_eq!(bad(&|p| p.curve_supply = 0), Err(ParamError::NonPositive));
    assert_eq!(bad(&|p| p.virtual_quote = MAX_AMOUNT + 1), Err(ParamError::TooLarge));
    assert_eq!(bad(&|p| p.curve_supply = p.virtual_token), Err(ParamError::CurveSupplyNotBelowVirtual));
    assert_eq!(bad(&|p| p.trade_fee_bps = 501), Err(ParamError::FeeTooHigh));
    assert_eq!(bad(&|p| p.creator_fee_share_bps = 5_001), Err(ParamError::CreatorShareTooHigh));
    assert_eq!(bad(&|p| p.creator_cap_bps = 2_001), Err(ParamError::CreatorCapTooHigh));
    // a target so large that the curve would have to sell more than curve_supply
    assert_eq!(bad(&|p| p.graduation_target = 10_000_000 * X7), Err(ParamError::TargetSellsTooMuch));
    // boundary values are accepted
    assert_eq!(bad(&|p| { p.trade_fee_bps = 500; p.creator_fee_share_bps = 5_000; p.creator_cap_bps = 2_000 }), Ok(()));
    assert_eq!(bad(&|p| { p.trade_fee_bps = 0; p.creator_cap_bps = 0 }), Ok(()));
}

#[test]
#[should_panic(expected = "Error(Contract, #4)")]
fn constructor_rejects_high_fee() {
    let mut p = std_params();
    p.trade_fee_bps = 600;
    setup(p);
}

#[test]
#[should_panic(expected = "Error(Contract, #9)")]
fn constructor_requires_a_funded_curve() {
    let env = Env::default();
    env.mock_all_auths();
    let a = Address::generate(&env);
    let p = std_params();
    let quote_id = env.register(MockToken, ());
    let token_id = env.register(
        LaunchpadToken,
        (
            &a, // supply goes elsewhere, not to the curve
            String::from_str(&env, "T"),
            String::from_str(&env, "T"),
            p.curve_supply + p.lp_supply,
            String::from_str(&env, ""),
        ),
    );
    env.register(LaunchpadCurve, (&token_id, &quote_id, &a, &a, &a, p));
}

// ---- upgrade auth ----

#[test]
fn upgrade_is_factory_only() {
    let c = setup(std_params());
    let hash = soroban_sdk::BytesN::from_array(&c.env, &[7u8; 32]);
    let intruder = Address::generate(&c.env);
    assert_eq!(c.curve.try_upgrade(&intruder, &hash).unwrap_err().unwrap(), CurveError::NotFactory);
    // the factory address passes the check; with no matching Wasm uploaded the host then rejects the hash
    assert!(c.curve.try_upgrade(&c.factory, &hash).is_err());
}

// ---- extreme parameters ----

#[test]
fn extreme_parameters_do_not_overflow() {
    // Largest allowed reserves
    let p = CurveParams {
        virtual_quote: MAX_AMOUNT,
        virtual_token: MAX_AMOUNT,
        curve_supply: 9_000_000_000_000_000_000,
        lp_supply: 1_000_000_000_000_000_000,
        graduation_target: MAX_AMOUNT,
        trade_fee_bps: 500,
        creator_fee_share_bps: 5_000,
        creator_cap_bps: 2_000,
    };
    assert_eq!(validate(&p), Ok(()));
    let c = setup(p.clone());
    let u = c.funded_user(i128::MAX / 4);
    // absurd quote_in: clamped at the target, no overflow
    let out = c.curve.buy(&u, &(i128::MAX / 8), &1);
    let st = c.curve.get_state();
    assert_eq!(st.phase, Phase::Graduatable);
    assert_eq!(st.real_quote, MAX_AMOUNT);
    assert!(st.sold <= p.curve_supply && out > 0);
    c.curve.sell(&u, &out, &1);
    assert_eq!(c.curve.get_state().sold, 0);
    // views with absurd input do not panic with overflow
    let _ = c.curve.try_quote_buy(&i128::MAX);
    let _ = c.curve.try_quote_sell(&i128::MAX);

    // Tiny curve
    let tiny = CurveParams {
        virtual_quote: 1_000,
        virtual_token: 1_000_000,
        curve_supply: 700_000,
        lp_supply: 100_000,
        graduation_target: 2_000,
        trade_fee_bps: 0,
        creator_fee_share_bps: 0,
        creator_cap_bps: 0,
    };
    assert_eq!(validate(&tiny), Ok(()));
    let c = setup(tiny);
    let u = c.funded_user(1_000_000);
    c.curve.buy(&u, &500, &1);
    c.curve.buy(&u, &1_000_000, &1);
    assert_eq!(c.curve.get_state().real_quote, 2_000);
}

// ---- property-style test with a deterministic pseudo-random sequence ----

struct Lcg(u64);
impl Lcg {
    fn next(&mut self) -> u64 {
        self.0 = self.0.wrapping_mul(6364136223846793005).wrapping_add(1442695040888963407);
        self.0 >> 33
    }
}

fn run_property_sequence(seed: u64, params: CurveParams, steps: u32) -> u32 {
    let c = setup(params.clone());
    let m = Model::new(&params);
    let supply = params.curve_supply + params.lp_supply;
    let mut rng = Lcg(seed);
    let mut users = std::vec::Vec::new();
    for _ in 0..5 {
        users.push(c.funded_user(40_000_000 * X7));
    }
    users.push(c.creator.clone());
    c.quote.mint(&c.creator, &(40_000_000 * X7));
    let mut claimed_treasury = 0i128;
    let mut buys = 0u32;
    let mut sells = 0u32;
    let mut closed = 0u32;
    let mut graduatable_steps = 0u32;

    for step in 0..steps {
        let who = &users[(rng.next() % users.len() as u64) as usize];
        let do_buy = rng.next() % 5 < 3;
        if do_buy {
            // amounts between 1e3 and ~9e12 stroops (up to 900k XLM)
            let exp = 3 + (rng.next() % 10) as u32;
            let q = ((rng.next() % 9 + 1) as i128) * 10i128.pow(exp);
            match c.curve.try_buy(who, &q, &1) {
                Ok(Ok(_)) => buys += 1,
                _ => closed += 1,
            }
        } else {
            let bal = c.token.balance(who);
            if bal > 0 {
                let frac = rng.next() % 101;
                let t = (bal * frac as i128 / 100).max(1);
                match c.curve.try_sell(who, &t, &1) {
                    Ok(Ok(_)) => sells += 1,
                    _ => closed += 1,
                }
            }
        }
        if step % 37 == 0 {
            let (a, _) = c.curve.claim_fees();
            claimed_treasury += a;
            assert_eq!(c.quote.balance(&c.treasury), claimed_treasury);
        }

        // ---- invariants after every step ----
        let s = c.curve.get_state();
        let x = (params.virtual_quote + s.real_quote) as u128;
        let y = (params.virtual_token - s.sold) as u128;
        assert!(x * y >= m.k, "k decreased at step {step}");
        // k grows only by rounding: strictly less than one grid step (x or y)
        assert!(x * y - m.k < x.max(y), "k drifted beyond rounding at step {step}");
        assert!(s.sold >= 0 && s.sold <= params.curve_supply, "sold bounds");
        assert!(s.real_quote >= 0 && s.real_quote <= params.graduation_target, "real quote bounds");
        let mut user_tokens = 0;
        for u in users.iter() {
            user_tokens += c.token.balance(u);
        }
        assert_eq!(c.token.balance(&c.curve_addr) + user_tokens, supply, "token balances add up to supply");
        assert_eq!(c.token.total_supply(), supply);
        assert_eq!(user_tokens, s.sold, "tokens outside the curve equal sold");
        assert_eq!(
            c.quote.balance(&c.curve_addr),
            s.real_quote + s.fees_treasury_pending + s.fees_creator_pending,
            "quote held = real_quote + unclaimed fees"
        );
        let expected_phase = if s.real_quote >= params.graduation_target { Phase::Graduatable } else { Phase::Trading };
        assert_eq!(s.phase, expected_phase);
        if s.phase == Phase::Graduatable {
            graduatable_steps += 1;
        }
        assert!(s.creator_bought <= (params.curve_supply * params.creator_cap_bps as i128) / 10_000);
    }
    assert!(buys > 20 && sells > 10, "sequence must exercise both sides ({buys} buys, {sells} sells, {closed} reverts)");
    graduatable_steps
}

#[test]
fn property_random_sequence_standard_params() {
    run_property_sequence(0xC0FFEE, std_params(), 400);
}

#[test]
fn property_random_sequence_reaches_target_on_a_small_curve() {
    // small target so the random walk crosses it repeatedly (clamps, closes, re-opens)
    let p = CurveParams {
        virtual_quote: 220 * X7,
        virtual_token: 10_730_000_000_000_000,
        curve_supply: 8_000_000_000_000_000,
        lp_supply: 2_000_000_000_000_000,
        graduation_target: 600 * X7,
        trade_fee_bps: 250,
        creator_fee_share_bps: 3_000,
        creator_cap_bps: 2_000,
    };
    assert_eq!(validate(&p), Ok(()));
    let g = run_property_sequence(42, p, 400);
    assert!(g > 0, "the walk must reach the graduation target at least once");
}
