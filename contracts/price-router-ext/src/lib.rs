#![no_std]
//! Per-group price router (phase 1: `PriceConfig::ReflectorOnly`).
//!
//! The market factory deploys one router per group with `deploy_v2`, initializes it through the
//! constructor (admin = the factory) and sets it as the group controller's oracle. The controller
//! only speaks the Reflector subset (`decimals`, `resolution`, `lastprice`), always passing
//! `Asset::Stellar(token)` because the factory never sets oracle asset symbols. This router maps
//! the token to a per-token [`PriceConfig`], reads the configured Reflector feed, rescales the
//! price to the router's `decimals()` and returns the feed's own timestamp, so the controller's
//! staleness rule (`timestamp + k * resolution < now`) keeps working unchanged.
//!
//! Failure behaviour: every external call goes through `try_` clients and every failure collapses
//! to `None` ("price unavailable"). The controller then has no price (the factory sets no fallback
//! prices), which blocks borrows and liquidations for that market. That is the circuit breaker.
//!
//! Phase 3 modes (`ReflectorWithAquariusGuard`, `AquariusOnly`) are routed through the single
//! `match` in [`price_for`] and [`mode_symbol`]; today they resolve to unavailable and
//! `set_asset_config` rejects them with `UnsupportedMode`.

use peridot_interfaces::{Asset, PriceCheck, PriceConfig, PriceData, ReflectorOnlyCfg};
use soroban_sdk::{
    contract, contractclient, contracterror, contractevent, contractimpl, contracttype,
    panic_with_error, symbol_short, Address, BytesN, Env, Map, Symbol, Vec,
};

#[cfg(test)]
mod integration_test;
#[cfg(test)]
mod test;

/// Reflector subset this router reads from a feed (SEP-40).
#[contractclient(name = "FeedClient")]
pub trait Feed {
    fn decimals(env: Env) -> u32;
    fn assets(env: Env) -> Vec<Asset>;
    fn lastprice(env: Env, asset: Asset) -> Option<PriceData>;
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum RouterError {
    NotAdmin = 1,
    /// Phase 3 mode (`ReflectorWithAquariusGuard`, `AquariusOnly`) is not enabled in this build.
    UnsupportedMode = 2,
    /// The oracle did not answer `decimals()` / `assets()` with a sane value.
    InvalidOracle = 3,
    /// The oracle is this router itself.
    SelfOracle = 4,
    /// The asset key is not listed in the feed's `assets()`.
    AssetNotOnFeed = 5,
    /// Constructor arguments out of range.
    InvalidParams = 6,
}

#[contracttype]
#[derive(Clone)]
enum Key {
    Admin,
    QuoteDecimals,
    Resolution,
    /// token -> config. Kept in instance storage: the instance entry is loaded on every call anyway, so
    /// per-token persistent entries would add one ledger entry per priced token to every borrow
    /// (Soroban caps a transaction at 100 entries).
    Configs,
}

#[contractevent(topics = ["asset_cfg"])]
pub struct AssetConfigSet {
    #[topic]
    pub token: Address,
    pub mode: Symbol,
    pub config: PriceConfig,
}

#[contractevent(topics = ["upgraded"])]
pub struct Upgraded {
    pub wasm_hash: BytesN<32>,
}

/// Staleness multiplier: same default (k = 2) the controller applies.
const STALE_K: u64 = 2;
/// Largest `decimals` for which `10^n` fits in an `i128`.
const MAX_DECIMALS: u32 = 38;

const INSTANCE_TTL_THRESHOLD: u32 = 518_400; // about 30 days
const INSTANCE_TTL_EXTEND_TO: u32 = 1_036_800; // about 60 days

#[contract]
pub struct PriceRouterExt;

fn bump_instance(env: &Env) {
    env.storage()
        .instance()
        .extend_ttl(INSTANCE_TTL_THRESHOLD, INSTANCE_TTL_EXTEND_TO);
}

fn read_config(env: &Env, token: &Address) -> Option<PriceConfig> {
    let map: Map<Address, PriceConfig> = env.storage().instance().get(&Key::Configs)?;
    map.get(token.clone())
}

fn quote_decimals(env: &Env) -> u32 {
    env.storage().instance().get(&Key::QuoteDecimals).unwrap_or(0)
}

fn resolution_secs(env: &Env) -> u32 {
    env.storage().instance().get(&Key::Resolution).unwrap_or(0)
}

fn require_admin(env: &Env, admin: &Address) -> Result<(), RouterError> {
    let stored: Option<Address> = env.storage().instance().get(&Key::Admin);
    match stored {
        Some(a) if a == *admin => {
            admin.require_auth();
            Ok(())
        }
        _ => Err(RouterError::NotAdmin),
    }
}

fn pow10(exp: u32) -> Option<i128> {
    if exp > MAX_DECIMALS {
        return None;
    }
    let mut v: i128 = 1;
    let mut i = 0;
    while i < exp {
        v = v.checked_mul(10)?;
        i += 1;
    }
    Some(v)
}

/// Rescales `price` from `from` decimals to `to` decimals. `None` on non-positive input,
/// overflow, or a result that rounds down to zero.
pub fn rescale(price: i128, from: u32, to: u32) -> Option<i128> {
    if price <= 0 {
        return None;
    }
    let out = if to >= from {
        price.checked_mul(pow10(to - from)?)?
    } else {
        price / pow10(from - to)?
    };
    if out > 0 {
        Some(out)
    } else {
        None
    }
}

/// ReflectorOnly: the feed's price rescaled to the router's decimals, with the feed's timestamp.
fn reflector_only_price(env: &Env, cfg: &ReflectorOnlyCfg) -> Option<PriceData> {
    let feed = FeedClient::new(env, &cfg.oracle);
    let feed_decimals = match feed.try_decimals() {
        Ok(Ok(d)) => d,
        _ => return None,
    };
    let pd = match feed.try_lastprice(&cfg.asset) {
        Ok(Ok(Some(pd))) => pd,
        _ => return None,
    };
    let price = rescale(pd.price, feed_decimals, quote_decimals(env))?;
    Some(PriceData {
        price,
        timestamp: pd.timestamp,
    })
}

/// The single place where `PriceConfig` variants are interpreted for pricing.
fn price_for(env: &Env, cfg: &PriceConfig) -> Option<PriceData> {
    match cfg {
        PriceConfig::ReflectorOnly(c) => reflector_only_price(env, c),
        // Phase 3.
        PriceConfig::ReflectorWithAquariusGuard(_) => None,
        PriceConfig::AquariusOnly(_) => None,
    }
}

fn mode_symbol(cfg: &PriceConfig) -> Symbol {
    match cfg {
        PriceConfig::ReflectorOnly(_) => symbol_short!("reflector"),
        PriceConfig::ReflectorWithAquariusGuard(_) => symbol_short!("guard"),
        PriceConfig::AquariusOnly(_) => symbol_short!("aquarius"),
    }
}

/// Phase 1 guardrails for a config. The single place to add per-mode validation later.
fn validate(env: &Env, cfg: &PriceConfig) -> Result<(), RouterError> {
    match cfg {
        PriceConfig::ReflectorOnly(c) => {
            if c.oracle == env.current_contract_address() {
                return Err(RouterError::SelfOracle);
            }
            let feed = FeedClient::new(env, &c.oracle);
            match feed.try_decimals() {
                Ok(Ok(d)) if d <= MAX_DECIMALS => {}
                _ => return Err(RouterError::InvalidOracle),
            }
            match feed.try_assets() {
                Ok(Ok(list)) => {
                    if !list.contains(&c.asset) {
                        return Err(RouterError::AssetNotOnFeed);
                    }
                }
                _ => return Err(RouterError::InvalidOracle),
            }
            Ok(())
        }
        PriceConfig::ReflectorWithAquariusGuard(_) | PriceConfig::AquariusOnly(_) => {
            Err(RouterError::UnsupportedMode)
        }
    }
}

#[contractimpl]
impl PriceRouterExt {
    /// `admin` is the market-factory. `quote_decimals` is what the controller reads as the price
    /// scale (14 typical, like Reflector). `resolution` is in seconds (300 typical) and feeds the
    /// controller's staleness window.
    pub fn __constructor(env: Env, admin: Address, quote_decimals: u32, resolution: u32) {
        if quote_decimals > MAX_DECIMALS || resolution == 0 {
            panic_with_error!(&env, RouterError::InvalidParams);
        }
        env.storage().instance().set(&Key::Admin, &admin);
        env.storage()
            .instance()
            .set(&Key::QuoteDecimals, &quote_decimals);
        env.storage().instance().set(&Key::Resolution, &resolution);
        bump_instance(&env);
    }

    pub fn admin(env: Env) -> Address {
        env.storage().instance().get(&Key::Admin).unwrap()
    }

    // The functions below are exactly the `PriceRouter` trait in peridot-interfaces. The two
    // privileged ones return `Result` instead of `()`: an Ok is encoded as void, so
    // `PriceRouterClient` callers are unaffected, and failures carry a typed error code.
    pub fn decimals(env: Env) -> u32 {
        quote_decimals(&env)
    }

    pub fn resolution(env: Env) -> u32 {
        resolution_secs(&env)
    }

    pub fn lastprice(env: Env, asset: Asset) -> Option<PriceData> {
        bump_instance(&env);
        let token = match asset {
            Asset::Stellar(token) => token,
            // The factory never sets oracle asset symbols, so the controller never sends these.
            Asset::Other(_) => return None,
        };
        let cfg = read_config(&env, &token)?;
        price_for(&env, &cfg)
    }

    pub fn set_asset_config(
        env: Env,
        admin: Address,
        token: Address,
        cfg: PriceConfig,
    ) -> Result<(), RouterError> {
        require_admin(&env, &admin)?;
        validate(&env, &cfg)?;
        let mut map: Map<Address, PriceConfig> =
            env.storage().instance().get(&Key::Configs).unwrap_or(Map::new(&env));
        map.set(token.clone(), cfg.clone());
        env.storage().instance().set(&Key::Configs, &map);
        bump_instance(&env);
        AssetConfigSet {
            token,
            mode: mode_symbol(&cfg),
            config: cfg,
        }
        .publish(&env);
        Ok(())
    }

    pub fn get_asset_config(env: Env, token: Address) -> Option<PriceConfig> {
        read_config(&env, &token)
    }

    pub fn check(env: Env, token: Address) -> PriceCheck {
        let unavailable = |mode: Symbol| PriceCheck {
            mode,
            reflector_price: None,
            aquarius_price: None,
            deviation_bps: None,
            status: Symbol::new(&env, "unavailable"),
            timestamp: 0,
        };
        let Some(cfg) = read_config(&env, &token) else {
            return unavailable(symbol_short!("none"));
        };
        let mode = mode_symbol(&cfg);
        let Some(pd) = price_for(&env, &cfg) else {
            return unavailable(mode);
        };
        let now = env.ledger().timestamp();
        let max_age = (resolution_secs(&env) as u64).saturating_mul(STALE_K);
        let status = if pd.timestamp > now {
            Symbol::new(&env, "unavailable")
        } else if pd.timestamp.saturating_add(max_age) < now {
            symbol_short!("stale")
        } else {
            symbol_short!("ok")
        };
        PriceCheck {
            mode,
            reflector_price: Some(pd.price),
            aquarius_price: None,
            deviation_bps: None,
            status,
            timestamp: pd.timestamp,
        }
    }

    pub fn upgrade(env: Env, admin: Address, new_wasm_hash: BytesN<32>) -> Result<(), RouterError> {
        require_admin(&env, &admin)?;
        env.deployer()
            .update_current_contract_wasm(new_wasm_hash.clone());
        Upgraded {
            wasm_hash: new_wasm_hash,
        }
        .publish(&env);
        Ok(())
    }
}
