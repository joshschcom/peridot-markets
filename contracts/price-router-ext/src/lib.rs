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
//! Phase 3 modes are routed through the single `match` in [`price_for`], [`validate`] and
//! [`mode_symbol`]. `AquariusOnly` (a token with no Reflector feed, priced from its Aquarius pool and
//! valued through the quote token's Reflector price) is implemented below; `ReflectorWithAquariusGuard`
//! still resolves to unavailable and `set_asset_config` rejects it with `UnsupportedMode`.

use peridot_interfaces::{
    Asset, AquariusOnlyCfg, PriceCheck, PriceConfig, PriceData, ReflectorOnlyCfg,
};
use soroban_sdk::{
    contract, contractclient, contracterror, contractevent, contractimpl, contracttype,
    panic_with_error, symbol_short, token, Address, BytesN, Env, Map, Symbol, Vec, U256,
};

#[cfg(test)]
mod aquarius_integration_test;
#[cfg(test)]
mod aquarius_test;
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

/// Aquarius pool subset this router reads (`aquarius-lp-vault` uses the same signatures).
#[contractclient(name = "PoolClient")]
pub trait Pool {
    fn get_tokens(env: Env) -> Vec<Address>;
    fn get_reserves(env: Env) -> Vec<u128>;
    fn estimate_swap(env: Env, in_idx: u32, out_idx: u32, in_amount: u128) -> u128;
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
    /// `AquariusOnly`: the pool does not list exactly `{token, quote_token}`, a token does not answer
    /// `decimals()` (<= 18), or `token == quote_token`.
    InvalidPool = 7,
    /// `AquariusOnly`: `quote_token` has no `ReflectorOnly` config in this router yet.
    QuoteTokenNotConfigured = 8,
    /// `AquariusOnly`: the pool does not answer `get_reserves`, or a reserve is zero.
    EmptyPool = 9,
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
    /// token -> [`AqMeta`] for `AquariusOnly` tokens (pool token order and decimals, fixed at config time).
    AqMeta,
    /// token -> [`AqAnchor`]: last accepted price and its ledger time (the step guard). Instance storage
    /// again, so the guard adds no ledger entry to a borrow.
    AqAnchor,
}

/// Facts about an `AquariusOnly` pool that cannot change after deployment, read once in
/// `set_asset_config` so `lastprice` does not repeat `get_tokens` and two `decimals()` calls.
#[contracttype]
#[derive(Clone)]
struct AqMeta {
    /// Index of the priced token in the pool's token vector (the quote token is the other index).
    token_idx: u32,
    token_decimals: u32,
    quote_decimals: u32,
}

#[contracttype]
#[derive(Clone)]
struct AqAnchor {
    price: i128,
    ts: u64,
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

/// `AquariusOnly` probe size: 0.1% of the pool's reserve of the priced token (reserve / 1000).
/// A spot quote of one unit is the cheapest to move; the probe scales with the pool so the price
/// reflects execution at a size an attacker would have to pay depth-proportional capital to skew.
const PROBE_DIVISOR: u128 = 1_000;
/// Minimum depth, in whole USD, of EACH pool side (quote side valued with the quote token's Reflector
/// price, token side with the derived price). Below this the router serves no price.
const MIN_DEPTH_USD: u128 = 500;
/// Step guard: a price further than this (basis points) from the stored anchor ...
const MAX_STEP_BPS: u32 = 2_000;
/// ... within this many seconds of the anchor is refused. An older anchor is replaced.
const MIN_INTERVAL_SECS: u64 = 300;
/// Largest token decimals accepted for `AquariusOnly` (keeps the 256-bit intermediates in range).
const MAX_AQ_DECIMALS: u32 = 18;

const INSTANCE_TTL_THRESHOLD: u32 = 100_000;
const INSTANCE_TTL_EXTEND_TO: u32 = 400_000;

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

fn bits(x: u128) -> u32 {
    128 - x.leading_zeros()
}

/// `(prod nums) / (prod dens)` in 256-bit arithmetic, rounded down. `None` when the factors could
/// overflow 256 bits (checked conservatively through bit lengths), a denominator is zero or the
/// result does not fit a `u128`. Never traps.
fn ratio(env: &Env, nums: &[u128], dens: &[u128]) -> Option<u128> {
    // Bound the sizes BEFORE any host multiplication: a 256-bit overflow would trap the host call.
    let nb: u32 = nums.iter().map(|x| bits(*x)).sum();
    let db: u32 = dens.iter().map(|x| bits(*x)).sum();
    if nb > 255 || db > 255 || dens.iter().any(|x| *x == 0) {
        return None;
    }
    let mut n = U256::from_u32(env, 1);
    let mut d = U256::from_u32(env, 1);
    for x in nums {
        n = n.mul(&U256::from_u128(env, *x));
    }
    for x in dens {
        d = d.mul(&U256::from_u128(env, *x));
    }
    n.div(&d).to_u128()
}

fn read_meta(env: &Env, token: &Address) -> Option<AqMeta> {
    let map: Map<Address, AqMeta> = env.storage().instance().get(&Key::AqMeta)?;
    map.get(token.clone())
}

fn write_meta(env: &Env, token: &Address, meta: Option<AqMeta>) {
    let mut map: Map<Address, AqMeta> = env
        .storage()
        .instance()
        .get(&Key::AqMeta)
        .unwrap_or(Map::new(env));
    match meta {
        Some(m) => map.set(token.clone(), m),
        None => {
            map.remove(token.clone());
        }
    }
    env.storage().instance().set(&Key::AqMeta, &map);
}

fn read_anchor(env: &Env, token: &Address) -> Option<AqAnchor> {
    let map: Map<Address, AqAnchor> = env.storage().instance().get(&Key::AqAnchor)?;
    map.get(token.clone())
}

fn write_anchor(env: &Env, token: &Address, anchor: Option<AqAnchor>) {
    let mut map: Map<Address, AqAnchor> = env
        .storage()
        .instance()
        .get(&Key::AqAnchor)
        .unwrap_or(Map::new(env));
    match anchor {
        Some(a) => map.set(token.clone(), a),
        None => {
            map.remove(token.clone());
        }
    }
    env.storage().instance().set(&Key::AqAnchor, &map);
}

/// USD price of the quote token at the router's decimals, from this router's own `ReflectorOnly`
/// config. The router's `lastprice` timestamp for Aquarius tokens is the ledger time, which makes the
/// controller's staleness rule vacuous, so the staleness of the Reflector input is enforced HERE with
/// the same rule (`timestamp + k * resolution < now`).
fn quote_usd_price(env: &Env, quote_token: &Address) -> Option<i128> {
    let Some(PriceConfig::ReflectorOnly(c)) = read_config(env, quote_token) else {
        return None;
    };
    let pd = reflector_only_price(env, &c)?;
    let now = env.ledger().timestamp();
    let max_age = (resolution_secs(env) as u64).saturating_mul(STALE_K);
    if pd.timestamp > now || pd.timestamp.saturating_add(max_age) < now {
        return None;
    }
    Some(pd.price)
}

struct AqSpot {
    /// USD per whole priced token at the router's decimals.
    price: i128,
    /// USD per whole quote token at the router's decimals.
    quote_usd: i128,
}

/// Probe quote of `token` in the pool, valued in USD. `None` on any failure, empty or shallow pool.
fn aquarius_spot(env: &Env, token: &Address, cfg: &AquariusOnlyCfg) -> Option<AqSpot> {
    let meta = read_meta(env, token)?;
    let pool = PoolClient::new(env, &cfg.pool);
    let reserves = match pool.try_get_reserves() {
        Ok(Ok(v)) => v,
        _ => return None,
    };
    if reserves.len() != 2 || meta.token_idx > 1 {
        return None;
    }
    let t_idx = meta.token_idx;
    let q_idx = 1 - t_idx;
    let reserve_t = reserves.get(t_idx)?;
    let reserve_q = reserves.get(q_idx)?;
    if reserve_t == 0 || reserve_q == 0 {
        return None;
    }
    // Probe: 0.1% of the token reserve, at least one unit, never more than the reserve.
    let probe = (reserve_t / PROBE_DIVISOR).max(1).min(reserve_t);
    let out = match pool.try_estimate_swap(&t_idx, &q_idx, &probe) {
        Ok(Ok(o)) => o,
        _ => return None,
    };
    if out == 0 {
        return None;
    }
    let quote_usd = quote_usd_price(env, &cfg.quote_token)?;
    let quote_usd_u = u128::try_from(quote_usd).ok()?;
    // usd per whole token = out/10^qd * quote_usd / (probe/10^td)
    let price = ratio(
        env,
        &[out, quote_usd_u, 10u128.checked_pow(meta.token_decimals)?],
        &[probe, 10u128.checked_pow(meta.quote_decimals)?],
    )?;
    let price = i128::try_from(price).ok()?;
    if price <= 0 {
        return None;
    }
    // Depth floor on both sides, in USD at the router's decimals.
    let min_depth = MIN_DEPTH_USD.checked_mul(10u128.checked_pow(quote_decimals(env))?)?;
    let depth_q = ratio(
        env,
        &[reserve_q, quote_usd_u],
        &[10u128.checked_pow(meta.quote_decimals)?],
    )?;
    let depth_t = ratio(
        env,
        &[reserve_t, price as u128],
        &[10u128.checked_pow(meta.token_decimals)?],
    )?;
    if depth_q < min_depth || depth_t < min_depth {
        return None;
    }
    Some(AqSpot { price, quote_usd })
}

enum Verdict {
    /// Serve the price; `store` says whether to (re)write the anchor.
    Accept { store: bool },
    /// Serve nothing: moved more than `MAX_STEP_BPS` inside the interval.
    Refuse,
}

/// Step guard against the stored anchor. Returns the verdict and the deviation from the anchor.
fn guard(env: &Env, token: &Address, price: i128, now: u64) -> (Verdict, Option<u32>) {
    let Some(a) = read_anchor(env, token) else {
        return (Verdict::Accept { store: true }, None);
    };
    let dev = a
        .price
        .checked_sub(price)
        .map(|d| d.abs())
        .and_then(|d| d.checked_mul(10_000))
        .map(|n| u32::try_from(n / a.price.max(1)).unwrap_or(u32::MAX))
        .unwrap_or(u32::MAX);
    if now.saturating_sub(a.ts) >= MIN_INTERVAL_SECS {
        return (Verdict::Accept { store: true }, Some(dev));
    }
    if dev > MAX_STEP_BPS {
        (Verdict::Refuse, Some(dev))
    } else {
        (Verdict::Accept { store: false }, Some(dev))
    }
}

/// AquariusOnly: guarded probe price at the ledger time. `commit` stores a new anchor when the
/// guard asks for one (`lastprice`); `check` passes false and never writes.
fn aquarius_only_price(
    env: &Env,
    token: &Address,
    cfg: &AquariusOnlyCfg,
    commit: bool,
) -> Option<PriceData> {
    let spot = aquarius_spot(env, token, cfg)?;
    let now = env.ledger().timestamp();
    match guard(env, token, spot.price, now).0 {
        Verdict::Refuse => None,
        Verdict::Accept { store } => {
            if store && commit {
                write_anchor(
                    env,
                    token,
                    Some(AqAnchor {
                        price: spot.price,
                        ts: now,
                    }),
                );
            }
            Some(PriceData {
                price: spot.price,
                timestamp: now,
            })
        }
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
fn price_for(env: &Env, token: &Address, cfg: &PriceConfig, commit: bool) -> Option<PriceData> {
    match cfg {
        PriceConfig::ReflectorOnly(c) => reflector_only_price(env, c),
        // Phase 3, out of scope for now.
        PriceConfig::ReflectorWithAquariusGuard(_) => None,
        PriceConfig::AquariusOnly(c) => aquarius_only_price(env, token, c, commit),
    }
}

fn mode_symbol(cfg: &PriceConfig) -> Symbol {
    match cfg {
        PriceConfig::ReflectorOnly(_) => symbol_short!("reflector"),
        PriceConfig::ReflectorWithAquariusGuard(_) => symbol_short!("guard"),
        PriceConfig::AquariusOnly(_) => symbol_short!("aquarius"),
    }
}

/// Per-mode guardrails for a config. Returns the `AquariusOnly` metadata to store, if any.
fn validate(env: &Env, token: &Address, cfg: &PriceConfig) -> Result<Option<AqMeta>, RouterError> {
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
            Ok(None)
        }
        PriceConfig::AquariusOnly(c) => {
            if c.quote_token == *token || c.pool == env.current_contract_address() {
                return Err(RouterError::InvalidPool);
            }
            let pool = PoolClient::new(env, &c.pool);
            let tokens = match pool.try_get_tokens() {
                Ok(Ok(v)) => v,
                _ => return Err(RouterError::InvalidPool),
            };
            if tokens.len() != 2 {
                return Err(RouterError::InvalidPool);
            }
            let t0 = tokens.get(0).unwrap();
            let t1 = tokens.get(1).unwrap();
            let token_idx = if t0 == *token && t1 == c.quote_token {
                0
            } else if t1 == *token && t0 == c.quote_token {
                1
            } else {
                return Err(RouterError::InvalidPool);
            };
            if !matches!(
                read_config(env, &c.quote_token),
                Some(PriceConfig::ReflectorOnly(_))
            ) {
                return Err(RouterError::QuoteTokenNotConfigured);
            }
            match pool.try_get_reserves() {
                Ok(Ok(r)) if r.len() == 2 && r.get(0).unwrap_or(0) > 0 && r.get(1).unwrap_or(0) > 0 => {}
                _ => return Err(RouterError::EmptyPool),
            }
            let dec = |t: &Address| match token::TokenClient::new(env, t).try_decimals() {
                Ok(Ok(d)) if d <= MAX_AQ_DECIMALS => Ok(d),
                _ => Err(RouterError::InvalidPool),
            };
            Ok(Some(AqMeta {
                token_idx,
                token_decimals: dec(token)?,
                quote_decimals: dec(&c.quote_token)?,
            }))
        }
        PriceConfig::ReflectorWithAquariusGuard(_) => Err(RouterError::UnsupportedMode),
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
        price_for(&env, &token, &cfg, true)
    }

    pub fn set_asset_config(
        env: Env,
        admin: Address,
        token: Address,
        cfg: PriceConfig,
    ) -> Result<(), RouterError> {
        require_admin(&env, &admin)?;
        let meta = validate(&env, &token, &cfg)?;
        // A (re)configured token starts with no step-guard anchor and no stale pool metadata.
        write_meta(&env, &token, meta);
        write_anchor(&env, &token, None);
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
        if let PriceConfig::AquariusOnly(c) = &cfg {
            // `reflector_price` carries the quote token's USD price, `aquarius_price` the derived
            // price of `token`; `deviation_bps` is the distance from the step-guard anchor (when
            // one exists). Read only: `check` never writes the anchor.
            let Some(spot) = aquarius_spot(&env, &token, c) else {
                return unavailable(mode);
            };
            let now = env.ledger().timestamp();
            let (verdict, dev) = guard(&env, &token, spot.price, now);
            let status = match verdict {
                Verdict::Refuse => symbol_short!("deviation"),
                Verdict::Accept { .. } => symbol_short!("ok"),
            };
            return PriceCheck {
                mode,
                reflector_price: Some(spot.quote_usd),
                aquarius_price: Some(spot.price),
                deviation_bps: dev,
                status,
                timestamp: now,
            };
        }
        let Some(pd) = price_for(&env, &token, &cfg, false) else {
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
