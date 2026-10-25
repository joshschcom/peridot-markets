#![cfg(test)]
use super::*;
use mock_reflector::{MockReflector, MockReflectorClient};
use peridot_interfaces::{AquariusOnlyCfg, PriceRouterClient, ReflectorGuardCfg};
use soroban_sdk::testutils::{Address as _, Events as _, Ledger};
use soroban_sdk::{contract, contractimpl, symbol_short, vec, Env};

/// A feed that answers `decimals`/`assets` (so the config is accepted) but has no `lastprice`.
#[contract]
pub struct NoLastPriceFeed;
#[contractimpl]
impl NoLastPriceFeed {
    pub fn decimals(_env: Env) -> u32 {
        14
    }
    pub fn assets(env: Env) -> Vec<Asset> {
        vec![&env, Asset::Other(symbol_short!("XLM"))]
    }
}

/// A feed whose `lastprice` traps.
#[contract]
pub struct PanicFeed;
#[contractimpl]
impl PanicFeed {
    pub fn decimals(_env: Env) -> u32 {
        14
    }
    pub fn assets(env: Env) -> Vec<Asset> {
        vec![&env, Asset::Other(symbol_short!("XLM"))]
    }
    pub fn lastprice(_env: Env, _asset: Asset) -> Option<PriceData> {
        panic!("feed down")
    }
}

const NOW: u64 = 1_000_000;

struct Fx<'a> {
    env: Env,
    admin: Address,
    token: Address,
    router: PriceRouterExtClient<'a>,
    router_id: Address,
}

fn fx<'a>() -> Fx<'a> {
    let env = Env::default();
    env.mock_all_auths();
    env.ledger().set_timestamp(NOW);
    let admin = Address::generate(&env);
    let router_id = env.register(PriceRouterExt, (admin.clone(), 14u32, 300u32));
    let router = PriceRouterExtClient::new(&env, &router_id);
    let token = Address::generate(&env);
    Fx {
        env,
        admin,
        token,
        router,
        router_id,
    }
}

fn feed<'a>(env: &Env, dec: u32) -> (Address, MockReflectorClient<'a>) {
    let id = env.register(MockReflector, (dec, 300u32));
    (id.clone(), MockReflectorClient::new(env, &id))
}

fn cfg(oracle: &Address, asset: &Asset) -> PriceConfig {
    PriceConfig::ReflectorOnly(ReflectorOnlyCfg {
        oracle: oracle.clone(),
        asset: asset.clone(),
    })
}

fn xlm() -> Asset {
    Asset::Other(symbol_short!("XLM"))
}

#[test]
fn constructor_values_are_returned() {
    let f = fx();
    assert_eq!(f.router.decimals(), 14);
    assert_eq!(f.router.resolution(), 300);
}

#[test]
#[should_panic]
fn constructor_rejects_bad_decimals() {
    let env = Env::default();
    let admin = Address::generate(&env);
    env.register(PriceRouterExt, (admin, 39u32, 300u32));
}

#[test]
#[should_panic]
fn constructor_rejects_zero_resolution() {
    let env = Env::default();
    let admin = Address::generate(&env);
    env.register(PriceRouterExt, (admin, 14u32, 0u32));
}

fn scaling_case(feed_dec: u32, raw: i128, expected: i128) {
    let f = fx();
    let (oracle, mock) = feed(&f.env, feed_dec);
    mock.set_price(&xlm(), &raw, &NOW);
    f.router
        .set_asset_config(&f.admin, &f.token, &cfg(&oracle, &xlm()));
    let pd = f.router.lastprice(&Asset::Stellar(f.token.clone())).unwrap();
    assert_eq!(pd.price, expected);
    assert_eq!(pd.timestamp, NOW);
}

#[test]
fn scales_14_to_14() {
    scaling_case(14, 12_345_678_901_234, 12_345_678_901_234);
}

#[test]
fn scales_8_to_14() {
    // $0.12 at 8 decimals -> 14 decimals
    scaling_case(8, 12_000_000, 12_000_000_000_000);
}

#[test]
fn scales_18_to_14() {
    // $0.12 at 18 decimals -> 14 decimals
    scaling_case(18, 120_000_000_000_000_000, 12_000_000_000_000);
}

#[test]
fn rescale_edge_cases() {
    assert_eq!(rescale(0, 14, 14), None);
    assert_eq!(rescale(-5, 14, 14), None);
    assert_eq!(rescale(i128::MAX, 0, 14), None); // overflow
    assert_eq!(rescale(5, 18, 14), None); // rounds to zero
    assert_eq!(rescale(10_000, 18, 14), Some(1));
    assert_eq!(rescale(1, 0, 39), None); // exponent out of range
    assert_eq!(rescale(1, 0, 38), Some(10i128.pow(38)));
}

#[test]
fn non_positive_feed_price_is_none() {
    let f = fx();
    let (oracle, mock) = feed(&f.env, 14);
    mock.set_price(&xlm(), &0, &NOW);
    f.router
        .set_asset_config(&f.admin, &f.token, &cfg(&oracle, &xlm()));
    let a = Asset::Stellar(f.token.clone());
    assert!(f.router.lastprice(&a).is_none());
    mock.set_price(&xlm(), &-1, &NOW);
    assert!(f.router.lastprice(&a).is_none());
}

#[test]
fn stale_timestamp_passes_through_and_check_reports_stale() {
    let f = fx();
    let (oracle, mock) = feed(&f.env, 14);
    let old = NOW - 10_000;
    mock.set_price(&xlm(), &1_000_000_000_000, &old);
    f.router
        .set_asset_config(&f.admin, &f.token, &cfg(&oracle, &xlm()));
    let pd = f.router.lastprice(&Asset::Stellar(f.token.clone())).unwrap();
    assert_eq!(pd.timestamp, old);
    let c = f.router.check(&f.token);
    assert_eq!(c.status, Symbol::new(&f.env, "stale"));
    assert_eq!(c.reflector_price, Some(1_000_000_000_000));
    assert_eq!(c.timestamp, old);
}

#[test]
fn missing_config_is_none() {
    let f = fx();
    assert!(f.router.lastprice(&Asset::Stellar(f.token.clone())).is_none());
    assert!(f.router.get_asset_config(&f.token).is_none());
    // Other(symbol) is never served
    assert!(f.router.lastprice(&xlm()).is_none());
    let c = f.router.check(&f.token);
    assert_eq!(c.status, Symbol::new(&f.env, "unavailable"));
    assert_eq!(c.mode, symbol_short!("none"));
    assert!(c.reflector_price.is_none());
}

#[test]
fn oracle_returning_none_is_none() {
    let f = fx();
    let (oracle, mock) = feed(&f.env, 14);
    mock.set_price(&xlm(), &1_000_000_000_000, &NOW);
    f.router
        .set_asset_config(&f.admin, &f.token, &cfg(&oracle, &xlm()));
    let a = Asset::Stellar(f.token.clone());
    assert!(f.router.lastprice(&a).is_some());
    mock.clear_price(&xlm());
    assert!(f.router.lastprice(&a).is_none());
    let c = f.router.check(&f.token);
    assert_eq!(c.status, Symbol::new(&f.env, "unavailable"));
    assert_eq!(c.mode, symbol_short!("reflector"));
}

#[test]
fn broken_oracles_return_none_and_never_panic() {
    let f = fx();
    for oracle in [
        f.env.register(NoLastPriceFeed, ()),
        f.env.register(PanicFeed, ()),
    ] {
        let token = Address::generate(&f.env);
        f.router
            .set_asset_config(&f.admin, &token, &cfg(&oracle, &xlm()));
        assert!(f.router.lastprice(&Asset::Stellar(token.clone())).is_none());
        let c = f.router.check(&token);
        assert_eq!(c.status, Symbol::new(&f.env, "unavailable"));
    }
}

#[test]
fn check_ok_boundary_and_future_timestamp() {
    let f = fx();
    let (oracle, mock) = feed(&f.env, 14);
    f.router
        .set_asset_config(&f.admin, &f.token, &{
            mock.set_price(&xlm(), &5, &NOW);
            cfg(&oracle, &xlm())
        });
    let ok = Symbol::new(&f.env, "ok");
    assert_eq!(f.router.check(&f.token).status, ok);
    // exactly 2 * resolution old is still ok (same rule as the controller)
    mock.set_price(&xlm(), &5, &(NOW - 600));
    assert_eq!(f.router.check(&f.token).status, ok);
    mock.set_price(&xlm(), &5, &(NOW - 601));
    assert_eq!(f.router.check(&f.token).status, Symbol::new(&f.env, "stale"));
    // future timestamps are rejected by the controller, so they are unavailable
    mock.set_price(&xlm(), &5, &(NOW + 1));
    assert_eq!(
        f.router.check(&f.token).status,
        Symbol::new(&f.env, "unavailable")
    );
}

#[test]
fn stellar_keyed_feed_asset_works() {
    let f = fx();
    let (oracle, mock) = feed(&f.env, 14);
    let key = Asset::Stellar(f.token.clone());
    mock.set_price(&key, &777, &NOW);
    f.router
        .set_asset_config(&f.admin, &f.token, &cfg(&oracle, &key));
    assert_eq!(f.router.lastprice(&key).unwrap().price, 777);
}

#[test]
fn config_roundtrip_and_event() {
    let f = fx();
    let (oracle, mock) = feed(&f.env, 14);
    mock.set_price(&xlm(), &5, &NOW);
    let c = cfg(&oracle, &xlm());
    f.router.set_asset_config(&f.admin, &f.token, &c);
    assert_eq!(f.env.events().all().events().len(), 1);
    assert_eq!(f.router.get_asset_config(&f.token), Some(c));
}

#[test]
fn non_admin_cannot_set_config() {
    let f = fx();
    let (oracle, mock) = feed(&f.env, 14);
    mock.set_price(&xlm(), &5, &NOW);
    let intruder = Address::generate(&f.env);
    let r = f
        .router
        .try_set_asset_config(&intruder, &f.token, &cfg(&oracle, &xlm()));
    assert_eq!(r.unwrap_err().unwrap(), RouterError::NotAdmin);
    assert!(f.router.get_asset_config(&f.token).is_none());
}

#[test]
fn admin_must_authorize() {
    let env = Env::default();
    let admin = Address::generate(&env);
    let id = env.register(PriceRouterExt, (admin.clone(), 14u32, 300u32));
    let router = PriceRouterExtClient::new(&env, &id);
    let (oracle, mock) = feed(&env, 14);
    mock.set_price(&xlm(), &5, &NOW);
    // no mocked auths: the stored admin did not sign
    assert!(router
        .try_set_asset_config(&admin, &Address::generate(&env), &cfg(&oracle, &xlm()))
        .is_err());
}

#[test]
fn phase3_modes_are_rejected() {
    let f = fx();
    let (oracle, mock) = feed(&f.env, 14);
    mock.set_price(&xlm(), &5, &NOW);
    let guard = PriceConfig::ReflectorWithAquariusGuard(ReflectorGuardCfg {
        oracle: oracle.clone(),
        asset: xlm(),
        pool: Address::generate(&f.env),
        quote_token: Address::generate(&f.env),
        max_dev_bps: 300,
    });
    // The guard mode stays out of scope; AquariusOnly is live (see aquarius_test.rs) and an address
    // that is not an Aquarius pool is refused with InvalidPool.
    let r = f.router.try_set_asset_config(&f.admin, &f.token, &guard);
    assert_eq!(r.unwrap_err().unwrap(), RouterError::UnsupportedMode);
    let aq = PriceConfig::AquariusOnly(AquariusOnlyCfg {
        pool: Address::generate(&f.env),
        quote_token: Address::generate(&f.env),
    });
    let r = f.router.try_set_asset_config(&f.admin, &f.token, &aq);
    assert_eq!(r.unwrap_err().unwrap(), RouterError::InvalidPool);
    assert!(f.router.get_asset_config(&f.token).is_none());
}

#[test]
fn validation_rejects_bad_oracles() {
    let f = fx();
    // not a contract that answers decimals()
    let junk = Address::generate(&f.env);
    let r = f
        .router
        .try_set_asset_config(&f.admin, &f.token, &cfg(&junk, &xlm()));
    assert!(r.is_err());
    // an unrelated contract (the router has no assets())
    let r = f
        .router
        .try_set_asset_config(&f.admin, &f.token, &cfg(&f.router_id, &xlm()));
    assert_eq!(r.unwrap_err().unwrap(), RouterError::SelfOracle);
    // asset not on feed
    let (oracle, mock) = feed(&f.env, 14);
    mock.set_price(&xlm(), &5, &NOW);
    let r = f.router.try_set_asset_config(
        &f.admin,
        &f.token,
        &cfg(&oracle, &Asset::Other(symbol_short!("DOGE"))),
    );
    assert_eq!(r.unwrap_err().unwrap(), RouterError::AssetNotOnFeed);
    // feed decimals out of range
    let (bad, bad_mock) = feed(&f.env, 39);
    bad_mock.set_price(&xlm(), &5, &NOW);
    let r = f
        .router
        .try_set_asset_config(&f.admin, &f.token, &cfg(&bad, &xlm()));
    assert_eq!(r.unwrap_err().unwrap(), RouterError::InvalidOracle);
}

#[test]
fn reconfigure_replaces_config() {
    let f = fx();
    let (o1, m1) = feed(&f.env, 14);
    let (o2, m2) = feed(&f.env, 8);
    m1.set_price(&xlm(), &100_000_000_000_000, &NOW);
    m2.set_price(&xlm(), &200_000_000, &NOW);
    let a = Asset::Stellar(f.token.clone());
    f.router.set_asset_config(&f.admin, &f.token, &cfg(&o1, &xlm()));
    assert_eq!(f.router.lastprice(&a).unwrap().price, 100_000_000_000_000);
    f.router.set_asset_config(&f.admin, &f.token, &cfg(&o2, &xlm()));
    assert_eq!(f.router.lastprice(&a).unwrap().price, 200_000_000_000_000);
}

#[test]
fn upgrade_is_admin_only() {
    let f = fx();
    let hash = f
        .env
        .deployer()
        .upload_contract_wasm(include_bytes!("../../../build/test/jump_rate_model.wasm").as_slice());
    let intruder = Address::generate(&f.env);
    let r = f.router.try_upgrade(&intruder, &hash);
    assert_eq!(r.unwrap_err().unwrap(), RouterError::NotAdmin);
    // admin upgrade succeeds immediately (the contract is now a different Wasm)
    f.router.upgrade(&f.admin, &hash);
}

/// The factory and other crates call this contract through the shared trait client.
#[test]
fn works_through_the_shared_trait_client() {
    let f = fx();
    let (oracle, mock) = feed(&f.env, 8);
    mock.set_price(&xlm(), &12_000_000, &NOW);
    let shared = PriceRouterClient::new(&f.env, &f.router_id);
    shared.set_asset_config(&f.admin, &f.token, &cfg(&oracle, &xlm()));
    assert_eq!(shared.decimals(), 14);
    assert_eq!(shared.resolution(), 300);
    assert_eq!(
        shared.lastprice(&Asset::Stellar(f.token.clone())).unwrap().price,
        12_000_000_000_000
    );
    assert!(shared.get_asset_config(&f.token).is_some());
    assert_eq!(shared.check(&f.token).status, Symbol::new(&f.env, "ok"));
}
