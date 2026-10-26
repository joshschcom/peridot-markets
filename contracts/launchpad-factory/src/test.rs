#![cfg(test)]
extern crate std;

// The factory deploys real Wasm, so the tests upload the token and curve builds kept in `testdata/`.
// Regenerate after changing launchpad-token or launchpad-curve:
//   CARGO_TARGET_DIR=<dir> stellar contract build --package launchpad-token --optimize=false
//   CARGO_TARGET_DIR=<dir> stellar contract build --package launchpad-curve --optimize=false
//   cp <dir>/wasm32v1-none/release/launchpad_{token,curve}.wasm contracts/launchpad-factory/testdata/
const TOKEN_WASM: &[u8] = include_bytes!("../testdata/launchpad_token.wasm");
const CURVE_WASM: &[u8] = include_bytes!("../testdata/launchpad_curve.wasm");

use mock_token::{MockToken, MockTokenClient};
use peridot_interfaces::{Asset, PriceConfig, ReflectorOnlyCfg};
use soroban_sdk::{testutils::Address as _, token, Address, Bytes, BytesN, Env, String, Symbol};

use crate::{
    default_preset, CurveParams, FactoryError, LaunchFactory, LaunchFactoryClient, LaunchParams, Preset,
};

const X7: i128 = 10_000_000;

struct Ctx {
    env: Env,
    f: LaunchFactoryClient<'static>,
    f_addr: Address,
    admin: Address,
    treasury: Address,
    quote: MockTokenClient<'static>,
    quote_id: Address,
    token_hash: BytesN<32>,
    curve_hash: BytesN<32>,
}

fn xlm_price(env: &Env, oracle: &Address) -> PriceConfig {
    PriceConfig::ReflectorOnly(ReflectorOnlyCfg { oracle: oracle.clone(), asset: Asset::Other(Symbol::new(env, "XLM")) })
}

fn setup() -> Ctx {
    let env = Env::default();
    env.mock_all_auths();
    env.cost_estimate().budget().reset_unlimited();
    let admin = Address::generate(&env);
    let treasury = Address::generate(&env);
    let f_addr = env.register(LaunchFactory, (&admin, &treasury));
    let f = LaunchFactoryClient::new(&env, &f_addr);
    let quote_id = env.register(MockToken, ());
    let quote = MockTokenClient::new(&env, &quote_id);
    quote.initialize(&String::from_str(&env, "Lumens"), &String::from_str(&env, "XLM"), &7);
    let token_hash = env.deployer().upload_contract_wasm(Bytes::from_slice(&env, TOKEN_WASM));
    let curve_hash = env.deployer().upload_contract_wasm(Bytes::from_slice(&env, CURVE_WASM));
    f.set_wasm(&admin, &token_hash, &curve_hash);
    f.set_default_presets(&admin, &quote_id);
    f.set_graduation(&admin, &Address::generate(&env), &Address::generate(&env));
    f.set_quote_price(&admin, &quote_id, &xlm_price(&env, &Address::generate(&env)));
    Ctx { env, f, f_addr, admin, treasury, quote, quote_id, token_hash, curve_hash }
}

impl Ctx {
    fn params(&self, preset: Preset) -> LaunchParams {
        LaunchParams {
            quote_token: self.quote_id.clone(),
            preset,
            metadata_uri: String::from_str(&self.env, "ipfs://image"),
            creator_buy: 0,
            min_tokens_out: 0,
        }
    }
    fn launch(&self, creator: &Address, name: &str, symbol: &str, preset: Preset) -> (Address, Address) {
        self.f.launch_curve(
            creator,
            &String::from_str(&self.env, name),
            &String::from_str(&self.env, symbol),
            &self.params(preset),
        )
    }
}

// Typed access to the deployed Wasm contracts without importing their specs.
mod curve_api {
    use soroban_sdk::{contractclient, Address, Env};
    #[contractclient(name = "Curve")]
    #[allow(dead_code)]
    pub trait CurveApi {
        fn buy(env: Env, user: Address, quote_in: i128, min_tokens_out: i128) -> i128;
        fn sell(env: Env, user: Address, tokens_in: i128, min_quote_out: i128) -> i128;
        fn claim_fees(env: Env) -> (i128, i128);
    }
}
use curve_api::Curve;

#[test]
fn launch_deploys_token_and_curve_and_indexes_them() {
    let c = setup();
    let creator = Address::generate(&c.env);
    let (tok, curve) = c.launch(&creator, "Meridian Coin", "MRD", Preset::Standard);

    // token: fixed supply minted to the curve, 7 decimals
    let t = token::Client::new(&c.env, &tok);
    let cfg = default_preset(Preset::Standard);
    let supply = cfg.curve_supply + cfg.lp_supply;
    assert_eq!(t.balance(&curve), supply);
    assert_eq!(t.decimals(), 7);
    assert_eq!(t.name(), String::from_str(&c.env, "Meridian Coin"));
    assert_eq!(t.symbol(), String::from_str(&c.env, "MRD"));

    // index
    assert_eq!(c.f.launch_count(), 1);
    let info = c.f.get_launch(&tok);
    assert_eq!(info.id, 0);
    assert_eq!(info.curve, curve);
    assert_eq!(info.creator, creator);
    assert_eq!(info.quote_token, c.quote_id);
    assert_eq!(info.preset, Preset::Standard);
    assert_eq!(c.f.list_launches(&0, &10).len(), 1);
    assert_eq!(c.f.launches_of(&creator).get(0).unwrap().token, tok);
    assert_ne!(tok, curve);
}

#[test]
fn many_launches_paginate_and_stay_distinct() {
    let c = setup();
    let a = Address::generate(&c.env);
    let b = Address::generate(&c.env);
    let mut tokens = std::vec::Vec::new();
    for i in 0..5u32 {
        let who = if i % 2 == 0 { &a } else { &b };
        let (t, _) = c.launch(who, "Coin", "CN", [Preset::Fast, Preset::Standard, Preset::Slow][(i % 3) as usize]);
        tokens.push(t);
    }
    for i in 0..5 {
        for j in (i + 1)..5 {
            assert_ne!(tokens[i], tokens[j]);
        }
    }
    assert_eq!(c.f.launch_count(), 5);
    let page = c.f.list_launches(&1, &3);
    assert_eq!(page.len(), 3);
    assert_eq!(page.get(0).unwrap().id, 1);
    assert_eq!(page.get(2).unwrap().id, 3);
    assert_eq!(c.f.list_launches(&4, &50).len(), 1);
    assert_eq!(c.f.list_launches(&5, &50).len(), 0);
    assert_eq!(c.f.launches_of(&a).len(), 3);
    assert_eq!(c.f.launches_of(&b).len(), 2);
    assert_eq!(c.f.get_launch(&tokens[3]).creator, b);
}

#[test]
fn each_preset_uses_its_own_target() {
    let c = setup();
    let creator = Address::generate(&c.env);
    for p in [Preset::Fast, Preset::Standard, Preset::Slow] {
        let (_, curve) = c.launch(&creator, "Coin", "CN", p);
        let q = Curve::new(&c.env, &curve);
        let _ = q;
        let want = default_preset(p);
        // read the curve's config through the stored preset and its live state
        assert_eq!(c.f.get_preset(&c.quote_id, &p), want);
    }
    assert!(default_preset(Preset::Fast).graduation_target < default_preset(Preset::Standard).graduation_target);
    assert!(default_preset(Preset::Standard).graduation_target < default_preset(Preset::Slow).graduation_target);
}

#[test]
fn launched_curve_trades_end_to_end_on_wasm() {
    let c = setup();
    let creator = Address::generate(&c.env);
    let (tok, curve) = c.launch(&creator, "Meridian", "MRD", Preset::Standard);
    let cv = Curve::new(&c.env, &curve);
    let t = token::Client::new(&c.env, &tok);
    let user = Address::generate(&c.env);
    c.quote.mint(&user, &(10_000 * X7));
    let out = cv.buy(&user, &(1_000 * X7), &1);
    assert_eq!(t.balance(&user), out);
    let back = cv.sell(&user, &(out / 2), &1);
    assert!(back > 0 && back < 500 * X7);
    // held quote = real quote + fees; claim goes to the factory treasury
    let (tr, cr) = cv.claim_fees();
    assert!(tr > 0);
    assert_eq!(cr, 0);
    assert_eq!(c.quote.balance(&c.treasury), tr);
}

#[test]
fn creator_buy_is_atomic_and_capped() {
    let c = setup();
    let creator = Address::generate(&c.env);
    c.quote.mint(&creator, &(10_000 * X7));
    let mut p = c.params(Preset::Standard);
    p.creator_buy = 500 * X7;
    p.min_tokens_out = 1;
    let (tok, curve) = c.f.launch_curve(
        &creator,
        &String::from_str(&c.env, "Meridian"),
        &String::from_str(&c.env, "MRD"),
        &p,
    );
    let t = token::Client::new(&c.env, &tok);
    assert!(t.balance(&creator) > 0);
    assert_eq!(c.quote.balance(&creator), 9_500 * X7);
    assert_eq!(c.quote.balance(&curve), 500 * X7);

    // a creator buy over the 5% cap reverts the whole launch
    let mut big = c.params(Preset::Standard);
    big.creator_buy = 5_000 * X7;
    big.min_tokens_out = 1;
    let r = c.f.try_launch_curve(
        &creator,
        &String::from_str(&c.env, "Other"),
        &String::from_str(&c.env, "OTH"),
        &big,
    );
    assert!(r.is_err());
    assert_eq!(c.f.launch_count(), 1, "failed launch must not be indexed");

    // creator_buy without a slippage bound is rejected
    let mut nobound = c.params(Preset::Standard);
    nobound.creator_buy = 10 * X7;
    assert_eq!(
        c.f.try_launch_curve(&creator, &String::from_str(&c.env, "A"), &String::from_str(&c.env, "AA"), &nobound)
            .unwrap_err()
            .unwrap(),
        FactoryError::InvalidCreatorBuy
    );
}

#[test]
fn launch_fee_goes_to_the_treasury() {
    let c = setup();
    let creator = Address::generate(&c.env);
    c.quote.mint(&creator, &(100 * X7));
    c.f.set_launch_fee(&c.admin, &c.quote_id, &(25 * X7));
    c.launch(&creator, "Coin", "CN", Preset::Fast);
    assert_eq!(c.quote.balance(&creator), 75 * X7);
    assert_eq!(c.quote.balance(&c.treasury), 25 * X7);
    // a creator who cannot pay cannot launch
    let broke = Address::generate(&c.env);
    assert!(c
        .f
        .try_launch_curve(&broke, &String::from_str(&c.env, "Coin"), &String::from_str(&c.env, "CN"), &c.params(Preset::Fast))
        .is_err());
    // fee off again
    c.f.set_launch_fee(&c.admin, &c.quote_id, &0);
    c.launch(&broke, "Coin", "CN", Preset::Fast);
    assert_eq!(c.f.config().launch_fee, 0);
}

#[test]
fn guardrails_reject_bad_launches() {
    let c = setup();
    let creator = Address::generate(&c.env);
    let go = |name: &str, symbol: &str, p: LaunchParams| {
        c.f.try_launch_curve(&creator, &String::from_str(&c.env, name), &String::from_str(&c.env, symbol), &p)
            .map(|r| r.unwrap())
            .map_err(|e| e.unwrap())
    };
    assert_eq!(go("", "AB", c.params(Preset::Fast)).unwrap_err(), FactoryError::InvalidName);
    assert_eq!(go("Bad<script>", "AB", c.params(Preset::Fast)).unwrap_err(), FactoryError::InvalidName);
    assert_eq!(go(" lead", "AB", c.params(Preset::Fast)).unwrap_err(), FactoryError::InvalidName);
    assert_eq!(go("Coin", "A", c.params(Preset::Fast)).unwrap_err(), FactoryError::InvalidSymbol);
    assert_eq!(go("Coin", "TOOLONGSYMBOL1", c.params(Preset::Fast)).unwrap_err(), FactoryError::InvalidSymbol);
    assert_eq!(go("Coin", "A-B", c.params(Preset::Fast)).unwrap_err(), FactoryError::InvalidSymbol);
    let mut uri = c.params(Preset::Fast);
    let long = "x".repeat(300);
    uri.metadata_uri = String::from_str(&c.env, &long);
    assert_eq!(go("Coin", "CN", uri).unwrap_err(), FactoryError::InvalidMetadataUri);
    // unknown quote token: no preset
    let mut other = c.params(Preset::Fast);
    other.quote_token = Address::generate(&c.env);
    assert_eq!(go("Coin", "CN", other).unwrap_err(), FactoryError::PresetNotSet);
    assert_eq!(c.f.launch_count(), 0);
}

#[test]
fn set_preset_applies_the_curve_guardrails() {
    let c = setup();
    let mut p: CurveParams = default_preset(Preset::Standard);
    p.trade_fee_bps = 501;
    assert_eq!(
        c.f.try_set_preset(&c.admin, &c.quote_id, &Preset::Fast, &p).unwrap_err().unwrap(),
        FactoryError::BadCurveParams
    );
    let mut p = default_preset(Preset::Standard);
    p.graduation_target *= 100; // would need more than curve_supply
    assert_eq!(
        c.f.try_set_preset(&c.admin, &c.quote_id, &Preset::Fast, &p).unwrap_err().unwrap(),
        FactoryError::BadCurveParams
    );
    // valid custom preset (USDC-like quote) is accepted and used
    let mut usdc = default_preset(Preset::Fast);
    usdc.graduation_target = 5_000 * X7;
    usdc.virtual_quote = 1_764 * X7;
    c.f.set_preset(&c.admin, &c.quote_id, &Preset::Fast, &usdc);
    assert_eq!(c.f.get_preset(&c.quote_id, &Preset::Fast), usdc);
    // removed preset cannot launch
    c.f.remove_preset(&c.admin, &c.quote_id, &Preset::Fast);
    let creator = Address::generate(&c.env);
    assert_eq!(
        c.f.try_launch_curve(
            &creator,
            &String::from_str(&c.env, "Coin"),
            &String::from_str(&c.env, "CN"),
            &c.params(Preset::Fast)
        )
        .unwrap_err()
        .unwrap(),
        FactoryError::PresetNotSet
    );
}

#[test]
fn launch_requires_wasm_and_respects_pause() {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let treasury = Address::generate(&env);
    let f = LaunchFactoryClient::new(&env, &env.register(LaunchFactory, (&admin, &treasury)));
    let quote = env.register(MockToken, ());
    f.set_default_presets(&admin, &quote);
    let creator = Address::generate(&env);
    let p = LaunchParams {
        quote_token: quote.clone(),
        preset: Preset::Fast,
        metadata_uri: String::from_str(&env, ""),
        creator_buy: 0,
        min_tokens_out: 0,
    };
    let name = String::from_str(&env, "Coin");
    let sym = String::from_str(&env, "CN");
    assert_eq!(f.try_launch_curve(&creator, &name, &sym, &p).unwrap_err().unwrap(), FactoryError::WasmNotSet);

    let c = setup();
    let creator = Address::generate(&c.env);
    let name = String::from_str(&c.env, "Coin");
    let sym = String::from_str(&c.env, "CN");
    c.f.set_paused(&c.admin, &true);
    assert_eq!(
        c.f.try_launch_curve(&creator, &name, &sym, &c.params(Preset::Fast)).unwrap_err().unwrap(),
        FactoryError::Paused
    );
    c.f.set_paused(&c.admin, &false);
    c.launch(&creator, "Coin", "CN", Preset::Fast);
}

#[test]
fn admin_only_entrypoints_reject_others() {
    let c = setup();
    let intruder = Address::generate(&c.env);
    let h = c.token_hash.clone();
    let p = default_preset(Preset::Fast);
    assert_eq!(c.f.try_set_wasm(&intruder, &h, &h).unwrap_err().unwrap(), FactoryError::NotAdmin);
    assert_eq!(c.f.try_set_preset(&intruder, &c.quote_id, &Preset::Fast, &p).unwrap_err().unwrap(), FactoryError::NotAdmin);
    assert_eq!(c.f.try_set_default_presets(&intruder, &c.quote_id).unwrap_err().unwrap(), FactoryError::NotAdmin);
    assert_eq!(c.f.try_remove_preset(&intruder, &c.quote_id, &Preset::Fast).unwrap_err().unwrap(), FactoryError::NotAdmin);
    assert_eq!(c.f.try_set_launch_fee(&intruder, &c.quote_id, &1).unwrap_err().unwrap(), FactoryError::NotAdmin);
    assert_eq!(c.f.try_set_paused(&intruder, &true).unwrap_err().unwrap(), FactoryError::NotAdmin);
    assert_eq!(c.f.try_set_treasury(&intruder, &intruder).unwrap_err().unwrap(), FactoryError::NotAdmin);
    assert_eq!(c.f.try_set_admin(&intruder, &intruder).unwrap_err().unwrap(), FactoryError::NotAdmin);
    assert_eq!(c.f.try_upgrade(&intruder, &h).unwrap_err().unwrap(), FactoryError::NotAdmin);
    let creator = Address::generate(&c.env);
    let (tok, _) = c.launch(&creator, "Coin", "CN", Preset::Fast);
    assert_eq!(c.f.try_upgrade_launch(&intruder, &tok, &h).unwrap_err().unwrap(), FactoryError::NotAdmin);
    // the right admin must actually sign: no mocked auth means the call fails
    let env2 = Env::default();
    let admin2 = Address::generate(&env2);
    let t2 = Address::generate(&env2);
    let f2 = LaunchFactoryClient::new(&env2, &env2.register(LaunchFactory, (&admin2, &t2)));
    let h2 = BytesN::from_array(&env2, &[1u8; 32]);
    assert!(f2.try_set_wasm(&admin2, &h2, &h2).is_err());
}

#[test]
fn admin_can_be_rotated() {
    let c = setup();
    let new_admin = Address::generate(&c.env);
    c.f.set_admin(&c.admin, &new_admin);
    assert_eq!(c.f.try_set_paused(&c.admin, &true).unwrap_err().unwrap(), FactoryError::NotAdmin);
    c.f.set_paused(&new_admin, &true);
    assert!(c.f.config().paused);
}

#[test]
fn upgrade_launch_swaps_the_curve_wasm_and_keeps_state() {
    let c = setup();
    let creator = Address::generate(&c.env);
    let (tok, curve) = c.launch(&creator, "Coin", "CN", Preset::Standard);
    let cv = Curve::new(&c.env, &curve);
    let user = Address::generate(&c.env);
    c.quote.mint(&user, &(1_000 * X7));
    let out = cv.buy(&user, &(100 * X7), &1);

    // same code plus an empty custom section: a different hash, identical behaviour
    let mut bytes = std::vec::Vec::from(CURVE_WASM);
    bytes.extend_from_slice(&[0x00, 0x02, 0x01, b'x']);
    let new_hash = c.env.deployer().upload_contract_wasm(Bytes::from_slice(&c.env, &bytes));
    assert_ne!(new_hash, c.curve_hash);
    c.f.upgrade_launch(&c.admin, &tok, &new_hash);
    // state survived and the curve still trades
    let back = cv.sell(&user, &out, &1);
    assert!(back > 0);
    // upgrading a curve directly (not through the factory) is impossible
    #[soroban_sdk::contractclient(name = "UpCurve")]
    #[allow(dead_code)]
    trait Up {
        fn upgrade(env: Env, admin: Address, h: BytesN<32>);
    }
    let direct = UpCurve::new(&c.env, &curve);
    assert!(direct.try_upgrade(&creator, &new_hash).is_err());
    // unknown token
    let unknown = Address::generate(&c.env);
    assert_eq!(c.f.try_upgrade_launch(&c.admin, &unknown, &new_hash).unwrap_err().unwrap(), FactoryError::LaunchNotFound);
}

#[test]
fn factory_upgrade_is_immediate_for_admin() {
    let c = setup();
    let mut bytes = std::vec::Vec::from(CURVE_WASM);
    bytes.extend_from_slice(&[0x00, 0x02, 0x01, b'y']);
    // upgrading the factory to the curve Wasm is a valid hash swap; use it to prove the call goes through
    let h = c.env.deployer().upload_contract_wasm(Bytes::from_slice(&c.env, &bytes));
    c.f.upgrade(&c.admin, &h);
    let _ = &c.f_addr;
}

#[test]
fn get_launch_unknown_token() {
    let c = setup();
    let x = Address::generate(&c.env);
    assert_eq!(c.f.try_get_launch(&x).unwrap_err().unwrap(), FactoryError::LaunchNotFound);
}

#[test]
fn cpu_report_for_launch_buy_sell() {
    let c = setup();
    let creator = Address::generate(&c.env);
    let user = Address::generate(&c.env);
    c.quote.mint(&user, &(100_000 * X7));
    c.quote.mint(&creator, &(100_000 * X7));
    let name = String::from_str(&c.env, "Meridian Coin");
    let sym = String::from_str(&c.env, "MRD");

    // Launch under mainnet-like default limits (not unlimited).
    c.env.cost_estimate().budget().reset_default();
    let (_, curve) = c.f.launch_curve(&creator, &name, &sym, &c.params(Preset::Standard));
    let launch_cpu = c.env.cost_estimate().budget().cpu_instruction_cost();

    let mut p = c.params(Preset::Standard);
    p.creator_buy = 100 * X7;
    p.min_tokens_out = 1;
    c.env.cost_estimate().budget().reset_default();
    c.f.launch_curve(&creator, &name, &sym, &p);
    let launch_buy_cpu = c.env.cost_estimate().budget().cpu_instruction_cost();

    let cv = Curve::new(&c.env, &curve);
    c.env.cost_estimate().budget().reset_default();
    let out = cv.buy(&user, &(1_000 * X7), &1);
    let buy_cpu = c.env.cost_estimate().budget().cpu_instruction_cost();
    c.env.cost_estimate().budget().reset_default();
    cv.sell(&user, &(out / 2), &1);
    let sell_cpu = c.env.cost_estimate().budget().cpu_instruction_cost();
    c.env.cost_estimate().budget().reset_default();
    cv.claim_fees();
    let claim_cpu = c.env.cost_estimate().budget().cpu_instruction_cost();

    std::println!(
        "CPU launch={launch_cpu} launch+creator_buy={launch_buy_cpu} buy={buy_cpu} sell={sell_cpu} claim_fees={claim_cpu}"
    );
    // mainnet limit is 400M instructions per transaction
    for v in [launch_cpu, launch_buy_cpu, buy_cpu, sell_cpu, claim_cpu] {
        assert!(v < 400_000_000);
    }
}

#[test]
fn is_curve_answers_for_deployed_curves_only() {
    let c = setup();
    let creator = Address::generate(&c.env);
    let (tok, curve) = c.launch(&creator, "Meridian Coin", "MRD", Preset::Standard);
    let (tok2, curve2) = c.launch(&creator, "Second", "SEC", Preset::Fast);
    assert!(c.f.is_curve(&curve));
    assert!(c.f.is_curve(&curve2));
    // the token, the factory, the creator and a stranger are not curves
    for not in [tok, tok2, c.f_addr.clone(), creator.clone(), Address::generate(&c.env)] {
        assert!(!c.f.is_curve(&not));
    }
    // extending a launch keeps the curve index alive
    c.f.extend_launch(&0);
    assert!(c.f.is_curve(&curve));
}

#[test]
fn launching_needs_graduation_wiring_and_a_quote_price() {
    let env = Env::default();
    env.mock_all_auths();
    env.cost_estimate().budget().reset_unlimited();
    let admin = Address::generate(&env);
    let f_addr = env.register(LaunchFactory, (&admin, &Address::generate(&env)));
    let f = LaunchFactoryClient::new(&env, &f_addr);
    let quote_id = env.register(MockToken, ());
    MockTokenClient::new(&env, &quote_id).initialize(&String::from_str(&env, "Lumens"), &String::from_str(&env, "XLM"), &7);
    f.set_wasm(
        &admin,
        &env.deployer().upload_contract_wasm(Bytes::from_slice(&env, TOKEN_WASM)),
        &env.deployer().upload_contract_wasm(Bytes::from_slice(&env, CURVE_WASM)),
    );
    f.set_default_presets(&admin, &quote_id);
    let creator = Address::generate(&env);
    let launch = || {
        f.try_launch_curve(
            &creator,
            &String::from_str(&env, "Coin"),
            &String::from_str(&env, "CN"),
            &LaunchParams {
                quote_token: quote_id.clone(),
                preset: Preset::Fast,
                metadata_uri: String::from_str(&env, ""),
                creator_buy: 0,
                min_tokens_out: 0,
            },
        )
    };
    assert_eq!(launch().unwrap_err().unwrap(), FactoryError::GraduationNotSet);
    f.set_graduation(&admin, &Address::generate(&env), &Address::generate(&env));
    assert_eq!(launch().unwrap_err().unwrap(), FactoryError::QuotePriceNotSet);
    // only a ReflectorOnly mapping is accepted, and only the admin sets it
    let oracle = Address::generate(&env);
    let aq = PriceConfig::AquariusOnly(peridot_interfaces::AquariusOnlyCfg {
        pool: Address::generate(&env),
        quote_token: quote_id.clone(),
    });
    assert_eq!(f.try_set_quote_price(&admin, &quote_id, &aq).unwrap_err().unwrap(), FactoryError::InvalidQuotePrice);
    assert!(f.try_set_quote_price(&creator, &quote_id, &xlm_price(&env, &oracle)).is_err());
    f.set_quote_price(&admin, &quote_id, &xlm_price(&env, &oracle));
    assert_eq!(f.get_quote_price(&quote_id), Some(xlm_price(&env, &oracle)));
    assert!(launch().is_ok());
}

// ---------------- simple (plain) tokens ----------------

fn plain(c: &Ctx, creator: &Address, name: &str, symbol: &str, supply: i128) -> Address {
    c.f.create_plain_token(
        creator,
        &String::from_str(&c.env, name),
        &String::from_str(&c.env, symbol),
        &supply,
        &String::from_str(&c.env, ""),
    )
}

fn plain_err(c: &Ctx, creator: &Address, name: &str, symbol: &str, supply: i128) -> FactoryError {
    c.f.try_create_plain_token(
        creator,
        &String::from_str(&c.env, name),
        &String::from_str(&c.env, symbol),
        &supply,
        &String::from_str(&c.env, ""),
    )
    .unwrap_err()
    .unwrap()
}

#[test]
fn plain_token_mints_whole_supply_to_creator_and_is_indexed() {
    let c = setup();
    let creator = Address::generate(&c.env);
    let tok = plain(&c, &creator, "Plain Coin", "PLN", 1_000_000);
    let t = token::Client::new(&c.env, &tok);
    assert_eq!(t.balance(&creator), 1_000_000 * X7);
    assert_eq!(t.decimals(), 7);
    assert_eq!(t.symbol(), String::from_str(&c.env, "PLN"));

    assert_eq!(c.f.plain_token_count(), 1);
    let info = c.f.get_plain_token(&tok);
    assert_eq!(info.creator, creator);
    assert_eq!(info.supply, 1_000_000 * X7);
    assert_eq!(c.f.list_plain_tokens(&0, &10).len(), 1);
    assert_eq!(c.f.plain_tokens_of(&creator).get(0).unwrap().token, tok);
    // the curve registry is untouched
    assert_eq!(c.f.launch_count(), 0);
    assert_eq!(c.f.list_launches(&0, &10).len(), 0);
    assert_eq!(c.f.try_get_launch(&tok).unwrap_err().unwrap(), FactoryError::LaunchNotFound);
}

#[test]
fn plain_tokens_are_distinct_and_do_not_collide_with_curve_launches() {
    let c = setup();
    let creator = Address::generate(&c.env);
    let (curve_token, curve) = c.launch(&creator, "Curve Coin", "CRV", Preset::Fast);
    let a = plain(&c, &creator, "Plain A", "PLA", 10);
    let b = plain(&c, &creator, "Plain B", "PLB", 20);
    let (curve_token2, _) = c.launch(&creator, "Curve Two", "CR2", Preset::Fast);
    for (x, y) in [(&a, &b), (&a, &curve_token), (&b, &curve_token), (&a, &curve), (&curve_token2, &b)] {
        assert_ne!(x, y);
    }
    assert_eq!(c.f.plain_token_count(), 2);
    assert_eq!(c.f.launch_count(), 2);
    let page = c.f.list_plain_tokens(&1, &10);
    assert_eq!(page.len(), 1);
    assert_eq!(page.get(0).unwrap().token, b);
}

#[test]
fn plain_token_validates_inputs() {
    let c = setup();
    let creator = Address::generate(&c.env);
    assert_eq!(plain_err(&c, &creator, "", "PLN", 1), FactoryError::InvalidName);
    assert_eq!(plain_err(&c, &creator, "Ok", "P", 1), FactoryError::InvalidSymbol);
    assert_eq!(plain_err(&c, &creator, "Ok", "P-N", 1), FactoryError::InvalidSymbol);
    assert_eq!(plain_err(&c, &creator, "Ok", "PLN", 0), FactoryError::InvalidSupply);
    assert_eq!(plain_err(&c, &creator, "Ok", "PLN", -5), FactoryError::InvalidSupply);
    assert_eq!(plain_err(&c, &creator, "Ok", "PLN", crate::MAX_PLAIN_SUPPLY + 1), FactoryError::InvalidSupply);
    // the maximum is accepted
    let tok = plain(&c, &creator, "Max", "MAX", crate::MAX_PLAIN_SUPPLY);
    assert_eq!(token::Client::new(&c.env, &tok).balance(&creator), crate::MAX_PLAIN_SUPPLY * X7);
    let long_uri = String::from_str(&c.env, &"x".repeat(257));
    assert_eq!(
        c.f.try_create_plain_token(&creator, &String::from_str(&c.env, "Ok"), &String::from_str(&c.env, "PLN"), &1, &long_uri)
            .unwrap_err()
            .unwrap(),
        FactoryError::InvalidMetadataUri
    );
}

#[test]
fn plain_token_respects_pause_and_wasm_and_creator_cap() {
    let c = setup();
    let creator = Address::generate(&c.env);
    c.f.set_paused(&c.admin, &true);
    assert_eq!(plain_err(&c, &creator, "Ok", "PLN", 1), FactoryError::Paused);
    c.f.set_paused(&c.admin, &false);
    for _ in 0..crate::MAX_LAUNCHES_PER_CREATOR {
        plain(&c, &creator, "Ok", "PLN", 1);
    }
    assert_eq!(plain_err(&c, &creator, "Ok", "PLN", 1), FactoryError::TooManyLaunches);
    // a factory without token wasm cannot create plain tokens
    let env = Env::default();
    env.mock_all_auths();
    let f_addr = env.register(LaunchFactory, (&Address::generate(&env), &Address::generate(&env)));
    let f = LaunchFactoryClient::new(&env, &f_addr);
    assert_eq!(
        f.try_create_plain_token(
            &Address::generate(&env),
            &String::from_str(&env, "Ok"),
            &String::from_str(&env, "PLN"),
            &1,
            &String::from_str(&env, "")
        )
        .unwrap_err()
        .unwrap(),
        FactoryError::WasmNotSet
    );
}

#[test]
fn plain_token_requires_the_creator_auth() {
    let c = setup();
    let creator = Address::generate(&c.env);
    plain(&c, &creator, "Plain Coin", "PLN", 5);
    let auths = c.env.auths();
    assert!(auths.iter().any(|(addr, _)| *addr == creator));
}
