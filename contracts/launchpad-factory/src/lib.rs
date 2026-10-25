//! Launchpad factory (docs/handoff/12-LAUNCHPAD.md): deploys one fixed-supply token and one bonding curve per
//! launch, applies guardrails, indexes launches.
//!
//! Chicken and egg (the token must mint to the curve, the curve must know the token): both addresses are
//! deterministic. The salts derive from a launch counter, so `deployer().with_current_contract(salt)
//! .deployed_address()` returns the curve address BEFORE it exists. The factory then deploys the TOKEN first
//! (its constructor mints the whole supply to that pre-computed curve address) and the CURVE second (its
//! constructor takes the real token address and checks `token.balance(curve) >= curve_supply + lp_supply`).
//! If anything were off the curve constructor reverts and the whole launch reverts atomically.
//!
//! The factory is the `factory` (upgrade admin) of every curve it deploys; tokens are immutable.
#![no_std]

mod errors;
mod events;
#[path = "../../launchpad-curve/src/params.rs"]
#[allow(dead_code)]
mod params;
mod types;

#[cfg(test)]
mod test;
#[cfg(test)]
mod test_e2e;
#[cfg(test)]
#[path = "../../launchpad-curve/src/test_aquarius.rs"]
mod test_aquarius;

use peridot_interfaces::PriceConfig;
use soroban_sdk::{
    contract, contractclient, contractimpl, contracttype, token, Address, Bytes, BytesN, Env, String, Vec,
};

pub use errors::FactoryError;
pub use params::CurveParams;
pub use types::{
    FactoryConfig, GraduationConfig, GraduationTargets, GraduationVenue, LaunchInfo, LaunchParams, Preset,
};

const TTL_THRESHOLD: u32 = 100_000; // below testnet's 120_960 default so creation never bumps
const TTL_EXTEND_TO: u32 = 400_000;

const KIND_TOKEN: u32 = 1;
const KIND_CURVE: u32 = 2;

pub const MAX_LIST_LIMIT: u32 = 50;
pub const MAX_LAUNCHES_PER_CREATOR: u32 = 100;
pub const MAX_NAME_LEN: u32 = 32;
pub const MAX_SYMBOL_LEN: u32 = 12;
pub const MAX_URI_LEN: u32 = 256;

// ---- default presets, denominated in a 7-decimal quote with XLM-like value (admin may override) ----
const X7: i128 = 10_000_000;
/// 1.073B virtual tokens, 800M on the curve, 200M for the pool: the pump.fun shape.
pub const PRESET_VIRTUAL_TOKEN: i128 = 1_073_000_000 * X7;
pub const PRESET_CURVE_SUPPLY: i128 = 800_000_000 * X7;
pub const PRESET_LP_SUPPLY: i128 = 200_000_000 * X7;
pub const PRESET_FAST_TARGET: i128 = 25_000 * X7;
pub const PRESET_STANDARD_TARGET: i128 = 85_000 * X7;
pub const PRESET_SLOW_TARGET: i128 = 250_000 * X7;

/// The default numbers for a preset: virtual quote = target * 30 / 85, so about 793M of the 800M curve tokens
/// are sold at the target whatever the target is.
pub fn default_preset(preset: Preset) -> CurveParams {
    let target = match preset {
        Preset::Fast => PRESET_FAST_TARGET,
        Preset::Standard => PRESET_STANDARD_TARGET,
        Preset::Slow => PRESET_SLOW_TARGET,
    };
    CurveParams {
        virtual_quote: target * 30 / 85,
        virtual_token: PRESET_VIRTUAL_TOKEN,
        curve_supply: PRESET_CURVE_SUPPLY,
        lp_supply: PRESET_LP_SUPPLY,
        graduation_target: target,
        trade_fee_bps: params::DEFAULT_TRADE_FEE_BPS,
        creator_fee_share_bps: 0,
        creator_cap_bps: params::DEFAULT_CREATOR_CAP_BPS,
    }
}

#[contractclient(name = "CurveClient")]
#[allow(dead_code)]
pub trait CurveInterface {
    fn buy(env: Env, user: Address, quote_in: i128, min_tokens_out: i128) -> i128;
    fn upgrade(env: Env, admin: Address, new_wasm_hash: BytesN<32>);
}

#[contracttype]
enum DataKey {
    Admin,
    Treasury,
    TokenWasm,
    CurveWasm,
    Paused,
    FeeToken,
    LaunchFee,
    Graduation,
    Count,
    Preset(Address, Preset),
    Launch(u32),
    TokenIndex(Address),
    CreatorLaunches(Address),
    /// Quote token -> price config of its market in graduated groups.
    QuotePrice(Address),
    /// Curve address -> true, for every curve this factory deployed (`is_curve`).
    CurveIndex(Address),
}

fn inst_bump(env: &Env) {
    env.storage().instance().extend_ttl(TTL_THRESHOLD, TTL_EXTEND_TO);
}

fn pbump(env: &Env, key: &DataKey) {
    env.storage().persistent().extend_ttl(key, TTL_THRESHOLD, TTL_EXTEND_TO);
}

fn admin(env: &Env) -> Address {
    env.storage().instance().get(&DataKey::Admin).expect("not initialized")
}

fn require_admin(env: &Env, caller: &Address) -> Result<(), FactoryError> {
    if admin(env) != *caller {
        return Err(FactoryError::NotAdmin);
    }
    caller.require_auth();
    Ok(())
}

fn count(env: &Env) -> u32 {
    env.storage().instance().get(&DataKey::Count).unwrap_or(0)
}

fn deploy_salt(env: &Env, id: u32, kind: u32) -> BytesN<32> {
    let mut b = Bytes::new(env);
    b.extend_from_array(&id.to_be_bytes());
    b.extend_from_array(&kind.to_be_bytes());
    env.crypto().sha256(&b).to_bytes()
}

fn is_name_char(c: u8) -> bool {
    c.is_ascii_alphanumeric() || c == b' ' || c == b'-' || c == b'_' || c == b'.'
}

/// Printable ASCII words only: keeps look-alike and control characters out of names and symbols.
fn check_text(s: &String, min: u32, max: u32, symbol: bool) -> bool {
    let len = s.len();
    if len < min || len > max {
        return false;
    }
    let mut buf = [0u8; 32];
    let n = len as usize;
    s.copy_into_slice(&mut buf[..n]);
    let bytes = &buf[..n];
    if symbol {
        bytes.iter().all(|c| c.is_ascii_alphanumeric())
    } else {
        bytes.iter().all(|c| is_name_char(*c)) && bytes[0] != b' ' && bytes[n - 1] != b' '
    }
}

fn get_launch_by_id(env: &Env, id: u32) -> Result<LaunchInfo, FactoryError> {
    env.storage().persistent().get(&DataKey::Launch(id)).ok_or(FactoryError::LaunchNotFound)
}

#[contract]
pub struct LaunchFactory;

#[contractimpl]
impl LaunchFactory {
    pub fn __constructor(env: Env, admin: Address, treasury: Address) {
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::Treasury, &treasury);
        env.storage().instance().set(&DataKey::Paused, &false);
        env.storage().instance().set(&DataKey::Count, &0u32);
    }

    // ---------------- admin ----------------

    /// Registers the token and curve Wasm used by new launches. Existing launches are unaffected.
    pub fn set_wasm(
        env: Env,
        admin: Address,
        token_hash: BytesN<32>,
        curve_hash: BytesN<32>,
    ) -> Result<(), FactoryError> {
        require_admin(&env, &admin)?;
        env.storage().instance().set(&DataKey::TokenWasm, &token_hash);
        env.storage().instance().set(&DataKey::CurveWasm, &curve_hash);
        events::WasmSet { token_hash, curve_hash }.publish(&env);
        Ok(())
    }

    /// Sets the numbers behind one preset for one quote token. Validated with the curve's own guardrails.
    pub fn set_preset(
        env: Env,
        admin: Address,
        quote_token: Address,
        preset: Preset,
        cfg: CurveParams,
    ) -> Result<(), FactoryError> {
        require_admin(&env, &admin)?;
        Self::store_preset(&env, &quote_token, preset, &cfg)
    }

    /// Installs the three built-in presets (Fast, Standard, Slow) for a quote token whose unit is worth
    /// roughly one XLM and has 7 decimals.
    pub fn set_default_presets(env: Env, admin: Address, quote_token: Address) -> Result<(), FactoryError> {
        require_admin(&env, &admin)?;
        for p in [Preset::Fast, Preset::Standard, Preset::Slow] {
            Self::store_preset(&env, &quote_token, p, &default_preset(p))?;
        }
        Ok(())
    }

    /// Removes a preset; launches with that (quote, preset) pair then revert with `PresetNotSet`.
    pub fn remove_preset(env: Env, admin: Address, quote_token: Address, preset: Preset) -> Result<(), FactoryError> {
        require_admin(&env, &admin)?;
        env.storage().persistent().remove(&DataKey::Preset(quote_token.clone(), preset));
        events::PresetSet { quote_token, preset, enabled: false }.publish(&env);
        Ok(())
    }

    /// Registers the Aquarius router and the Peridot market factory every NEW curve graduates through.
    /// Existing curves keep the wiring they were deployed with.
    pub fn set_graduation(
        env: Env,
        admin: Address,
        router: Address,
        market_factory: Address,
    ) -> Result<(), FactoryError> {
        require_admin(&env, &admin)?;
        env.storage().instance().set(&DataKey::Graduation, &GraduationTargets {
            router: router.clone(),
            market_factory: market_factory.clone(),
        });
        events::GraduationSet { router, market_factory }.publish(&env);
        Ok(())
    }

    /// Price config of the QUOTE asset market that graduated groups create (a `ReflectorOnly` mapping that
    /// the market factory has approved with `set_price_feed_allowed`). Frozen into each curve at launch.
    pub fn set_quote_price(
        env: Env,
        admin: Address,
        quote_token: Address,
        price: PriceConfig,
    ) -> Result<(), FactoryError> {
        require_admin(&env, &admin)?;
        if !matches!(price, PriceConfig::ReflectorOnly(_)) {
            return Err(FactoryError::InvalidQuotePrice);
        }
        let key = DataKey::QuotePrice(quote_token.clone());
        env.storage().persistent().set(&key, &price);
        pbump(&env, &key);
        events::QuotePriceSet { quote_token, price }.publish(&env);
        Ok(())
    }

    /// Optional launch fee, paid by the creator to the treasury inside `launch_curve`. `amount == 0` disables.
    pub fn set_launch_fee(env: Env, admin: Address, fee_token: Address, amount: i128) -> Result<(), FactoryError> {
        require_admin(&env, &admin)?;
        if amount < 0 {
            return Err(FactoryError::InvalidFee);
        }
        env.storage().instance().set(&DataKey::FeeToken, &fee_token);
        env.storage().instance().set(&DataKey::LaunchFee, &amount);
        events::LaunchFeeSet { fee_token, amount }.publish(&env);
        Ok(())
    }

    pub fn set_paused(env: Env, admin: Address, paused: bool) -> Result<(), FactoryError> {
        require_admin(&env, &admin)?;
        env.storage().instance().set(&DataKey::Paused, &paused);
        events::PausedSet { paused }.publish(&env);
        Ok(())
    }

    /// Treasury for new launches (existing curves keep the treasury they were deployed with).
    pub fn set_treasury(env: Env, admin: Address, treasury: Address) -> Result<(), FactoryError> {
        require_admin(&env, &admin)?;
        env.storage().instance().set(&DataKey::Treasury, &treasury);
        events::TreasurySet { treasury }.publish(&env);
        Ok(())
    }

    pub fn set_admin(env: Env, admin: Address, new_admin: Address) -> Result<(), FactoryError> {
        require_admin(&env, &admin)?;
        env.storage().instance().set(&DataKey::Admin, &new_admin);
        events::AdminSet { admin: new_admin }.publish(&env);
        Ok(())
    }

    /// Immediate upgrade of the factory itself (house rule).
    pub fn upgrade(env: Env, admin: Address, new_wasm_hash: BytesN<32>) -> Result<(), FactoryError> {
        require_admin(&env, &admin)?;
        env.deployer().update_current_contract_wasm(new_wasm_hash.clone());
        events::Upgraded { wasm_hash: new_wasm_hash }.publish(&env);
        Ok(())
    }

    /// Immediate upgrade of the curve of one launch, identified by its token (hotfix path; the curve accepts
    /// `upgrade` only from this factory). Tokens are immutable and cannot be upgraded.
    pub fn upgrade_launch(
        env: Env,
        admin: Address,
        token: Address,
        new_wasm_hash: BytesN<32>,
    ) -> Result<(), FactoryError> {
        require_admin(&env, &admin)?;
        let id: u32 = env
            .storage()
            .persistent()
            .get(&DataKey::TokenIndex(token))
            .ok_or(FactoryError::LaunchNotFound)?;
        let info = get_launch_by_id(&env, id)?;
        CurveClient::new(&env, &info.curve).upgrade(&env.current_contract_address(), &new_wasm_hash);
        events::LaunchUpgraded { curve: info.curve, wasm_hash: new_wasm_hash }.publish(&env);
        Ok(())
    }

    // ---------------- launching ----------------

    /// Deploys a token and its curve. `creator` authorizes (and pays the launch fee and the optional first
    /// buy). Returns `(token, curve)`.
    pub fn launch_curve(
        env: Env,
        creator: Address,
        name: String,
        symbol: String,
        params: LaunchParams,
    ) -> Result<(Address, Address), FactoryError> {
        creator.require_auth();
        if env.storage().instance().get(&DataKey::Paused).unwrap_or(false) {
            return Err(FactoryError::Paused);
        }
        if !check_text(&name, 1, MAX_NAME_LEN, false) {
            return Err(FactoryError::InvalidName);
        }
        if !check_text(&symbol, 2, MAX_SYMBOL_LEN, true) {
            return Err(FactoryError::InvalidSymbol);
        }
        if params.metadata_uri.len() > MAX_URI_LEN {
            return Err(FactoryError::InvalidMetadataUri);
        }
        if params.creator_buy < 0 || (params.creator_buy > 0 && params.min_tokens_out <= 0) {
            return Err(FactoryError::InvalidCreatorBuy);
        }
        let token_hash: BytesN<32> =
            env.storage().instance().get(&DataKey::TokenWasm).ok_or(FactoryError::WasmNotSet)?;
        let curve_hash: BytesN<32> =
            env.storage().instance().get(&DataKey::CurveWasm).ok_or(FactoryError::WasmNotSet)?;
        let cfg: CurveParams = env
            .storage()
            .persistent()
            .get(&DataKey::Preset(params.quote_token.clone(), params.preset))
            .ok_or(FactoryError::PresetNotSet)?;
        let targets: GraduationTargets =
            env.storage().instance().get(&DataKey::Graduation).ok_or(FactoryError::GraduationNotSet)?;
        let quote_price: PriceConfig = env
            .storage()
            .persistent()
            .get(&DataKey::QuotePrice(params.quote_token.clone()))
            .ok_or(FactoryError::QuotePriceNotSet)?;
        // A preset is validated when stored, but re-check so a bad migration can never deploy.
        params::validate(&cfg).map_err(|_| FactoryError::BadCurveParams)?;

        let creator_key = DataKey::CreatorLaunches(creator.clone());
        let mut mine: Vec<u32> = env.storage().persistent().get(&creator_key).unwrap_or(Vec::new(&env));
        if mine.len() >= MAX_LAUNCHES_PER_CREATOR {
            return Err(FactoryError::TooManyLaunches);
        }

        let id = count(&env);
        let this = env.current_contract_address();
        let treasury: Address = env.storage().instance().get(&DataKey::Treasury).expect("treasury");
        let supply = cfg.curve_supply.checked_add(cfg.lp_supply).ok_or(FactoryError::Overflow)?;

        // 1. predict the curve address, 2. deploy the token minting to it, 3. deploy the curve.
        let curve_salt = deploy_salt(&env, id, KIND_CURVE);
        let curve_addr = env.deployer().with_current_contract(curve_salt.clone()).deployed_address();
        let token_addr = env.deployer().with_current_contract(deploy_salt(&env, id, KIND_TOKEN)).deploy_v2(
            token_hash,
            (curve_addr.clone(), name.clone(), symbol.clone(), supply, params.metadata_uri.clone()),
        );
        let deployed_curve = env.deployer().with_current_contract(curve_salt).deploy_v2(
            curve_hash,
            (
                token_addr.clone(),
                params.quote_token.clone(),
                creator.clone(),
                this,
                treasury.clone(),
                cfg,
                GraduationConfig {
                    venue: GraduationVenue::Aquarius,
                    router: targets.router,
                    market_factory: targets.market_factory,
                    quote_price,
                },
            ),
        );
        debug_assert!(deployed_curve == curve_addr);
        if deployed_curve != curve_addr {
            // Cannot happen with deterministic salts; fail closed rather than index a wrong address.
            return Err(FactoryError::Overflow);
        }

        // Optional launch fee: creator -> treasury.
        let fee: i128 = env.storage().instance().get(&DataKey::LaunchFee).unwrap_or(0);
        if fee > 0 {
            let fee_token: Address = env.storage().instance().get(&DataKey::FeeToken).expect("fee token");
            token::Client::new(&env, &fee_token).transfer(&creator, &treasury, &fee);
        }

        // Index before the optional buy so every state change of this call is recorded together.
        let info = LaunchInfo {
            id,
            token: token_addr.clone(),
            curve: curve_addr.clone(),
            creator: creator.clone(),
            quote_token: params.quote_token.clone(),
            preset: params.preset,
            name,
            symbol,
            created_at: env.ledger().timestamp(),
        };
        let launch_key = DataKey::Launch(id);
        env.storage().persistent().set(&launch_key, &info);
        pbump(&env, &launch_key);
        let curve_key = DataKey::CurveIndex(curve_addr.clone());
        env.storage().persistent().set(&curve_key, &true);
        pbump(&env, &curve_key);
        let idx_key = DataKey::TokenIndex(token_addr.clone());
        env.storage().persistent().set(&idx_key, &id);
        pbump(&env, &idx_key);
        mine.push_back(id);
        env.storage().persistent().set(&creator_key, &mine);
        pbump(&env, &creator_key);
        env.storage().instance().set(&DataKey::Count, &(id + 1));
        inst_bump(&env);

        if params.creator_buy > 0 {
            CurveClient::new(&env, &curve_addr).buy(&creator, &params.creator_buy, &params.min_tokens_out);
        }

        events::Launched {
            id,
            creator,
            token: token_addr.clone(),
            curve: curve_addr.clone(),
            quote_token: params.quote_token,
            preset: params.preset,
        }
        .publish(&env);
        Ok((token_addr, curve_addr))
    }

    /// Permissionless: extends the TTL of one launch record and its indexes.
    pub fn extend_launch(env: Env, id: u32) -> Result<(), FactoryError> {
        let info = get_launch_by_id(&env, id)?;
        pbump(&env, &DataKey::Launch(id));
        pbump(&env, &DataKey::TokenIndex(info.token));
        pbump(&env, &DataKey::CurveIndex(info.curve.clone()));
        pbump(&env, &DataKey::CreatorLaunches(info.creator));
        inst_bump(&env);
        Ok(())
    }

    // ---------------- views ----------------

    pub fn launch_count(env: Env) -> u32 {
        count(&env)
    }

    /// Launches with ids in `[start, start + limit)`, oldest first. `limit` is capped at 50.
    pub fn list_launches(env: Env, start: u32, limit: u32) -> Vec<LaunchInfo> {
        let n = count(&env);
        let end = start.saturating_add(limit.min(MAX_LIST_LIMIT)).min(n);
        let mut out = Vec::new(&env);
        let mut i = start;
        while i < end {
            if let Some(info) = env.storage().persistent().get::<_, LaunchInfo>(&DataKey::Launch(i)) {
                out.push_back(info);
            }
            i += 1;
        }
        out
    }

    pub fn launches_of(env: Env, creator: Address) -> Vec<LaunchInfo> {
        let ids: Vec<u32> = env.storage().persistent().get(&DataKey::CreatorLaunches(creator)).unwrap_or(Vec::new(&env));
        let mut out = Vec::new(&env);
        for id in ids.iter() {
            if let Some(info) = env.storage().persistent().get::<_, LaunchInfo>(&DataKey::Launch(id)) {
                out.push_back(info);
            }
        }
        out
    }

    /// Looks a launch up by its token address.
    pub fn get_launch(env: Env, token: Address) -> Result<LaunchInfo, FactoryError> {
        let id: u32 = env
            .storage()
            .persistent()
            .get(&DataKey::TokenIndex(token))
            .ok_or(FactoryError::LaunchNotFound)?;
        get_launch_by_id(&env, id)
    }

    /// True for every curve this factory deployed. The market factory asks this before it lets a curve own
    /// groups with pool-priced (`AquariusOnly`) markets.
    pub fn is_curve(env: Env, curve: Address) -> bool {
        env.storage().persistent().get(&DataKey::CurveIndex(curve)).unwrap_or(false)
    }

    pub fn graduation_targets(env: Env) -> Option<GraduationTargets> {
        env.storage().instance().get(&DataKey::Graduation)
    }

    pub fn get_quote_price(env: Env, quote_token: Address) -> Option<PriceConfig> {
        env.storage().persistent().get(&DataKey::QuotePrice(quote_token))
    }

    pub fn get_preset(env: Env, quote_token: Address, preset: Preset) -> Result<CurveParams, FactoryError> {
        env.storage().persistent().get(&DataKey::Preset(quote_token, preset)).ok_or(FactoryError::PresetNotSet)
    }

    pub fn config(env: Env) -> FactoryConfig {
        FactoryConfig {
            admin: admin(&env),
            treasury: env.storage().instance().get(&DataKey::Treasury).expect("treasury"),
            paused: env.storage().instance().get(&DataKey::Paused).unwrap_or(false),
            wasm_set: env.storage().instance().has(&DataKey::TokenWasm)
                && env.storage().instance().has(&DataKey::CurveWasm),
            fee_token: env.storage().instance().get(&DataKey::FeeToken),
            launch_fee: env.storage().instance().get(&DataKey::LaunchFee).unwrap_or(0),
            launch_count: count(&env),
        }
    }
}

impl LaunchFactory {
    fn store_preset(env: &Env, quote_token: &Address, preset: Preset, cfg: &CurveParams) -> Result<(), FactoryError> {
        params::validate(cfg).map_err(|_| FactoryError::BadCurveParams)?;
        let key = DataKey::Preset(quote_token.clone(), preset);
        env.storage().persistent().set(&key, cfg);
        pbump(env, &key);
        events::PresetSet { quote_token: quote_token.clone(), preset, enabled: true }.publish(env);
        Ok(())
    }
}
