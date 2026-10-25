//! margin-factory (XF): leveraged margin per isolated group, using the audited `margin-controller`.
//!
//! XF is the admin of each group's `margin-controller` and `swap-adapter` (their Wasm bake in XF as
//! the permitted initial admin). Everything that must touch the group controller or a receipt-vault
//! (admin = market-factory) goes through the market-factory (MF) calls in `clients.rs`.
//!
//! The audited controller is the V3 staged flow (`begin_open_position_v3`, `swap_open_position_v3`,
//! `activate_open_position_v3`, close and liquidation stages). Leverage and liquidation incentive of
//! V3 are enforced per (margin asset, base asset, side) pair, defaulting to 10x when a pair has no
//! config, so XF writes a pair config for every ordered pair of margin markets.
#![no_std]

#[allow(dead_code)]
mod clients;
mod guardrails;
#[cfg(test)]
mod test;

use clients::*;
use guardrails::*;
use peridot_interfaces::{
    Group, GroupMarginConfig, MarginInfo, MarginVariant, MarginWasmHashes, PriceConfig,
};
use soroban_sdk::{
    contract, contracterror, contractevent, contractimpl, contracttype, token, Address, BytesN,
    Env, Vec,
};

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum MarginError {
    NotAdmin = 1,
    NotOwner = 2,
    WasmNotSet = 3,
    RouterNotSet = 4,
    AlreadyEnabled = 5,
    NotEnabled = 6,
    InvalidLeverage = 7,
    InvalidIncentive = 8,
    InvalidSlippage = 9,
    InvalidFee = 10,
    VariantUnavailable = 11,
    VariantChange = 12,
    MarketNotInGroup = 13,
    NoAllowlistedPool = 14,
    PriceModeNotAllowed = 15,
    UnsupportedDecimals = 16,
    TooManyMarkets = 17,
    TooManyPools = 18,
    PoolNotInGroup = 19,
    PoolNotTrusted = 20,
    PoolNotAllowed = 21,
    IncentivePending = 22,
    UnknownMarket = 23,
}

#[contracttype]
#[derive(Clone)]
enum Key {
    Admin,
    MarketFactory,
    Wasm,
    Router,
    RegistryEnforced,
    TrustedPool(Address),
    Margin(u32),
    Pools(u32),
}

/// Internal record. `markets`, `tokens`, `active` are parallel vectors; a market that was
/// disabled keeps its slot (the controller's pair registry is bounded, see `MAX_MARGIN_MARKETS`).
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
struct MarginRecord {
    controller: Address,
    swap_adapter: Address,
    variant: MarginVariant,
    cfg: GroupMarginConfig,
    markets: Vec<Address>,
    tokens: Vec<Address>,
    active: Vec<bool>,
    /// Ledger time when the current group-controller incentive change was staged; 0 if applied.
    incentive_staged_at: u64,
}

/// Richer view than `MarginInfo`: what is configured versus what is live.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct MarginStatus {
    pub controller: Address,
    pub swap_adapter: Address,
    pub variant: MarginVariant,
    /// Target configuration the owner asked for.
    pub cfg: GroupMarginConfig,
    pub enabled_markets: Vec<Address>,
    /// Liquidation incentive live on the group controller right now.
    pub applied_liquidation_incentive: u128,
    pub applied_liquidation_fee: u128,
    /// False while `cfg.liquidation_incentive` is staged on the group controller.
    pub incentive_applied: bool,
    /// Earliest ledger time a repeat call (`apply_margin`) applies the staged incentive; 0 if applied.
    pub incentive_apply_after: u64,
    /// Liquidation incentive paid by the margin controller per pair (live immediately).
    pub pair_liquidation_incentive: u128,
    pub maintenance_margin: u128,
    /// Pools allowlisted on the group's swap adapter through this factory.
    pub pools: Vec<Address>,
}

#[contractevent(topics = ["margin_enabled"])]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct MarginEnabled {
    #[topic]
    pub group_id: u32,
    pub owner: Address,
    pub controller: Address,
    pub swap_adapter: Address,
    pub max_leverage: u128,
    pub max_slippage: u128,
    pub liquidation_incentive: u128,
    pub liquidation_fee: u128,
    pub incentive_applied: bool,
}

#[contractevent(topics = ["margin_updated"])]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct MarginUpdated {
    #[topic]
    pub group_id: u32,
    pub max_leverage: u128,
    pub max_slippage: u128,
    pub liquidation_incentive: u128,
    pub liquidation_fee: u128,
    pub incentive_applied: bool,
}

#[contractevent(topics = ["market_margin_set"])]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct MarketMarginSet {
    #[topic]
    pub group_id: u32,
    #[topic]
    pub market: Address,
    pub token: Address,
    pub enabled: bool,
}

#[contractevent(topics = ["pool_allowed"])]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PoolAllowed {
    #[topic]
    pub group_id: u32,
    #[topic]
    pub pool: Address,
    pub allowed: bool,
}

#[contractevent(topics = ["pool_binding_set"])]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PoolBindingSet {
    #[topic]
    pub group_id: u32,
    #[topic]
    pub pool: Address,
    pub pool_id: BytesN<32>,
    pub allowed: bool,
}

#[contractevent(topics = ["upgraded"])]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Upgraded {
    /// The upgraded contract (this factory, or a group's controller or swap adapter).
    #[topic]
    pub contract: Address,
    pub new_wasm_hash: BytesN<32>,
}

#[contractevent(topics = ["upgrade_proposed"])]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct UpgradeProposed {
    #[topic]
    pub contract: Address,
    pub new_wasm_hash: BytesN<32>,
}

#[contractevent(topics = ["wasm_set"])]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct WasmSet {
    pub audited: BytesN<32>,
    pub swap_adapter: BytesN<32>,
}

#[contractevent(topics = ["pool_trust_set"])]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PoolTrustSet {
    #[topic]
    pub pool: Address,
    pub trusted: bool,
}

#[contract]
pub struct MarginFactory;

#[contractimpl]
impl MarginFactory {
    pub fn __constructor(env: Env, admin: Address, market_factory: Address) {
        env.storage().instance().set(&Key::Admin, &admin);
        env.storage().instance().set(&Key::MarketFactory, &market_factory);
        env.storage().instance().set(&Key::RegistryEnforced, &false);
        bump_instance(&env);
    }

    // ------------------------------------------------------------------ admin (Peridot)

    /// Set the Wasm hashes deployed per group (built with MARGIN_INIT_ADMIN = this factory).
    pub fn set_wasm(env: Env, admin: Address, wasm: MarginWasmHashes) -> Result<(), MarginError> {
        require_admin(&env, &admin)?;
        env.storage().instance().set(&Key::Wasm, &wasm);
        WasmSet {
            audited: wasm.audited,
            swap_adapter: wasm.swap_adapter,
        }
        .publish(&env);
        Ok(())
    }

    /// Aquarius router stored in each new group swap adapter (`swap-adapter.initialize`).
    pub fn set_router(env: Env, admin: Address, router: Address) -> Result<(), MarginError> {
        require_admin(&env, &admin)?;
        env.storage().instance().set(&Key::Router, &router);
        Ok(())
    }

    /// Immediate upgrade of this factory (new contracts upgrade without a timelock).
    pub fn upgrade(env: Env, admin: Address, new_wasm_hash: BytesN<32>) -> Result<(), MarginError> {
        require_admin(&env, &admin)?;
        Upgraded {
            contract: env.current_contract_address(),
            new_wasm_hash: new_wasm_hash.clone(),
        }
        .publish(&env);
        env.deployer().update_current_contract_wasm(new_wasm_hash);
        Ok(())
    }

    /// Optional hardening: when enforced, owners may only allowlist pools Peridot has trusted.
    pub fn set_pool_registry_enforced(
        env: Env,
        admin: Address,
        enforced: bool,
    ) -> Result<(), MarginError> {
        require_admin(&env, &admin)?;
        env.storage().instance().set(&Key::RegistryEnforced, &enforced);
        Ok(())
    }

    pub fn set_pool_trusted(
        env: Env,
        admin: Address,
        pool: Address,
        trusted: bool,
    ) -> Result<(), MarginError> {
        require_admin(&env, &admin)?;
        let key = Key::TrustedPool(pool.clone());
        if trusted {
            env.storage().persistent().set(&key, &true);
            extend_persistent(&env, &key);
        } else {
            env.storage().persistent().remove(&key);
        }
        PoolTrustSet { pool, trusted }.publish(&env);
        Ok(())
    }

    /// Audited controller upgrade, step 1: the controller's built-in timelocked path
    /// (`propose_upgrade_wasm`, 60s here). Step 2 is `upgrade_group_margin` with the same hash.
    pub fn propose_group_margin_upgrade(
        env: Env,
        admin: Address,
        group_id: u32,
        new_wasm_hash: BytesN<32>,
    ) -> Result<(), MarginError> {
        require_admin(&env, &admin)?;
        let rec = load_record(&env, group_id)?;
        let xf = env.current_contract_address();
        MarginControllerClient::new(&env, &rec.controller).propose_upgrade_wasm(&xf, &new_wasm_hash);
        UpgradeProposed {
            contract: rec.controller,
            new_wasm_hash,
        }
        .publish(&env);
        Ok(())
    }

    /// Audited controller upgrade, step 2 (reverts until the controller's timelock has passed and
    /// the hash equals the proposed one).
    pub fn upgrade_group_margin(
        env: Env,
        admin: Address,
        group_id: u32,
        new_wasm_hash: BytesN<32>,
    ) -> Result<(), MarginError> {
        require_admin(&env, &admin)?;
        let rec = load_record(&env, group_id)?;
        let xf = env.current_contract_address();
        MarginControllerClient::new(&env, &rec.controller).upgrade_wasm(&xf, &new_wasm_hash);
        Upgraded {
            contract: rec.controller,
            new_wasm_hash,
        }
        .publish(&env);
        Ok(())
    }

    /// Same two-step path for the group's swap adapter, step 1.
    pub fn propose_group_sa_upgrade(
        env: Env,
        admin: Address,
        group_id: u32,
        new_wasm_hash: BytesN<32>,
    ) -> Result<(), MarginError> {
        require_admin(&env, &admin)?;
        let rec = load_record(&env, group_id)?;
        let xf = env.current_contract_address();
        SwapAdapterClient::new(&env, &rec.swap_adapter).propose_upgrade_wasm(&xf, &new_wasm_hash);
        UpgradeProposed {
            contract: rec.swap_adapter,
            new_wasm_hash,
        }
        .publish(&env);
        Ok(())
    }

    /// Same two-step path for the group's swap adapter, step 2.
    pub fn upgrade_group_sa(
        env: Env,
        admin: Address,
        group_id: u32,
        new_wasm_hash: BytesN<32>,
    ) -> Result<(), MarginError> {
        require_admin(&env, &admin)?;
        let rec = load_record(&env, group_id)?;
        let xf = env.current_contract_address();
        SwapAdapterClient::new(&env, &rec.swap_adapter).upgrade_wasm(&xf, &new_wasm_hash);
        Upgraded {
            contract: rec.swap_adapter,
            new_wasm_hash,
        }
        .publish(&env);
        Ok(())
    }

    // ------------------------------------------------------------------ group owner

    /// Deploy and wire a swap adapter and an audited margin controller for the group.
    /// Needs `set_wasm` and `set_router` first. The incentive stages for 60s on the group controller
    /// (`get_margin_status` reports it); trading itself does not wait for it.
    pub fn enable_margin(
        env: Env,
        owner: Address,
        group_id: u32,
        cfg: GroupMarginConfig,
    ) -> Result<Address, MarginError> {
        bump_instance(&env);
        let group = require_owner(&env, &owner, group_id)?;
        if env.storage().persistent().has(&Key::Margin(group_id)) || group.margin_controller.is_some()
        {
            return Err(MarginError::AlreadyEnabled);
        }
        validate_cfg(&cfg)?;
        // Phase 3 (custom controller with per-asset caps and fees) plugs in here.
        if cfg.variant != MarginVariant::Audited {
            return Err(MarginError::VariantUnavailable);
        }
        let wasm: MarginWasmHashes = env
            .storage()
            .instance()
            .get(&Key::Wasm)
            .ok_or(MarginError::WasmNotSet)?;
        let router: Address = env
            .storage()
            .instance()
            .get(&Key::Router)
            .ok_or(MarginError::RouterNotSet)?;
        let xf = env.current_contract_address();

        let swap_adapter = env
            .deployer()
            .with_current_contract(salt(&env, group_id, 1))
            .deploy_v2(wasm.swap_adapter, ());
        let controller = env
            .deployer()
            .with_current_contract(salt(&env, group_id, 2))
            .deploy_v2(wasm.audited, ());

        let sa = SwapAdapterClient::new(&env, &swap_adapter);
        sa.initialize(&xf, &router);
        // The margin controller must be an allowlisted "pool" on its adapter before it initializes.
        sa.set_pool_allowed(&xf, &controller, &true);

        let mc = MarginControllerClient::new(&env, &controller);
        mc.initialize(&xf, &group.controller, &swap_adapter, &cfg.max_leverage);
        mc.set_max_slippage_scaled(&xf, &cfg.max_slippage);

        MarketFactoryClient::new(&env, &market_factory(&env)).wire_margin(
            &xf,
            &group_id,
            &controller,
            &cfg.liquidation_incentive,
            &cfg.liquidation_fee,
        );

        let mut rec = MarginRecord {
            controller: controller.clone(),
            swap_adapter: swap_adapter.clone(),
            variant: cfg.variant,
            cfg: cfg.clone(),
            markets: Vec::new(&env),
            tokens: Vec::new(&env),
            active: Vec::new(&env),
            incentive_staged_at: 0,
        };
        let applied = refresh_staging(&env, &mut rec, &group.controller, true);
        save_record(&env, group_id, &rec);
        env.storage()
            .persistent()
            .set(&Key::Pools(group_id), &Vec::<Address>::new(&env));
        extend_persistent(&env, &Key::Pools(group_id));
        MarginEnabled {
            group_id,
            owner,
            controller: controller.clone(),
            swap_adapter,
            max_leverage: cfg.max_leverage,
            max_slippage: cfg.max_slippage,
            liquidation_incentive: cfg.liquidation_incentive,
            liquidation_fee: cfg.liquidation_fee,
            incentive_applied: applied,
        }
        .publish(&env);
        Ok(controller)
    }

    /// Change max leverage, slippage, liquidation incentive or fee. A changed incentive stages for
    /// 60s on the group controller; `apply_margin` applies it afterwards.
    pub fn update_margin(
        env: Env,
        owner: Address,
        group_id: u32,
        cfg: GroupMarginConfig,
    ) -> Result<(), MarginError> {
        bump_instance(&env);
        let group = require_owner(&env, &owner, group_id)?;
        let mut rec = load_record(&env, group_id)?;
        validate_cfg(&cfg)?;
        if cfg.variant != rec.variant {
            return Err(MarginError::VariantChange);
        }
        let xf = env.current_contract_address();
        let old = rec.cfg.clone();
        let leverage_changed = cfg.max_leverage != old.max_leverage;
        let slippage_changed = cfg.max_slippage != old.max_slippage;
        let incentive_changed = cfg.liquidation_incentive != old.liquidation_incentive;
        let fee_changed = cfg.liquidation_fee != old.liquidation_fee;
        let now = env.ledger().timestamp();
        let pending = rec.incentive_staged_at != 0;
        let ready = pending && now >= rec.incentive_staged_at.saturating_add(STAGE_DELAY_SECS);
        // The group controller rejects a repeat of the staged incentive before its delay, and
        // `update_margin_params` always resends the incentive, so a fee-only change must wait.
        if pending && !incentive_changed && !ready && fee_changed {
            return Err(MarginError::IncentivePending);
        }

        let mc = MarginControllerClient::new(&env, &rec.controller);
        if leverage_changed {
            mc.set_params(&xf, &cfg.max_leverage);
        }
        if slippage_changed {
            mc.set_max_slippage_scaled(&xf, &cfg.max_slippage);
        }
        rec.cfg = cfg.clone();
        if incentive_changed || fee_changed || ready {
            MarketFactoryClient::new(&env, &market_factory(&env)).update_margin_params(
                &xf,
                &group_id,
                &cfg.liquidation_incentive,
                &cfg.liquidation_fee,
            );
        }
        let applied = refresh_staging(&env, &mut rec, &group.controller, incentive_changed);
        if leverage_changed || incentive_changed {
            apply_all_pairs(&env, &rec);
        }
        save_record(&env, group_id, &rec);
        MarginUpdated {
            group_id,
            max_leverage: cfg.max_leverage,
            max_slippage: cfg.max_slippage,
            liquidation_incentive: cfg.liquidation_incentive,
            liquidation_fee: cfg.liquidation_fee,
            incentive_applied: applied,
        }
        .publish(&env);
        Ok(())
    }

    /// Re-send the stored incentive after the 60s stage so the group controller applies it.
    /// Owner-gated like every config call; the UI shows `incentive_apply_after`.
    pub fn apply_margin(env: Env, owner: Address, group_id: u32) -> Result<(), MarginError> {
        bump_instance(&env);
        let group = require_owner(&env, &owner, group_id)?;
        let mut rec = load_record(&env, group_id)?;
        let xf = env.current_contract_address();
        MarketFactoryClient::new(&env, &market_factory(&env)).update_margin_params(
            &xf,
            &group_id,
            &rec.cfg.liquidation_incentive,
            &rec.cfg.liquidation_fee,
        );
        let applied = refresh_staging(&env, &mut rec, &group.controller, false);
        save_record(&env, group_id, &rec);
        MarginUpdated {
            group_id,
            max_leverage: rec.cfg.max_leverage,
            max_slippage: rec.cfg.max_slippage,
            liquidation_incentive: rec.cfg.liquidation_incentive,
            liquidation_fee: rec.cfg.liquidation_fee,
            incentive_applied: applied,
        }
        .publish(&env);
        Ok(())
    }

    /// Enable or disable margin trading for one market of the group.
    /// Enabling requires: market belongs to the group, price mode is not AquariusOnly, 7-decimal
    /// underlying, and an allowlisted pool that trades the underlying. Disabling sets every pair
    /// that touches the market to 1x, which blocks new opens while existing positions can still be
    /// closed and liquidated; the vault link is left in place on purpose.
    pub fn set_market_margin(
        env: Env,
        owner: Address,
        group_id: u32,
        market: Address,
        enabled: bool,
    ) -> Result<(), MarginError> {
        bump_instance(&env);
        let group = require_owner(&env, &owner, group_id)?;
        let mut rec = load_record(&env, group_id)?;
        let xf = env.current_contract_address();
        let mf = MarketFactoryClient::new(&env, &market_factory(&env));

        if !group.markets.contains(&market) {
            return Err(MarginError::MarketNotInGroup);
        }
        let token = mf.market_token(&group_id, &market);
        let idx = rec.markets.first_index_of(&market);

        if enabled {
            if let PriceConfig::AquariusOnly(_) = mf.get_market_config(&group_id, &market).price {
                return Err(MarginError::PriceModeNotAllowed);
            }
            if token::TokenClient::new(&env, &token).decimals() != REQUIRED_UNDERLYING_DECIMALS {
                return Err(MarginError::UnsupportedDecimals);
            }
            let pools = load_pools(&env, group_id);
            if !any_pool_trades(&env, &pools, &token) {
                return Err(MarginError::NoAllowlistedPool);
            }
            match idx {
                Some(i) => rec.active.set(i, true),
                None => {
                    if rec.markets.len() >= MAX_MARGIN_MARKETS {
                        return Err(MarginError::TooManyMarkets);
                    }
                    MarginControllerClient::new(&env, &rec.controller)
                        .set_market(&xf, &token, &market);
                    mf.link_margin_market(&xf, &group_id, &market, &Some(rec.controller.clone()));
                    rec.markets.push_back(market.clone());
                    rec.tokens.push_back(token.clone());
                    rec.active.push_back(true);
                }
            }
            let lev = rec.cfg.max_leverage;
            apply_token_pairs(&env, &rec, &token, lev);
        } else {
            let i = idx.ok_or(MarginError::UnknownMarket)?;
            rec.active.set(i, false);
            apply_token_pairs(&env, &rec, &token, 1);
        }
        save_record(&env, group_id, &rec);
        MarketMarginSet {
            group_id,
            market,
            token,
            enabled,
        }
        .publish(&env);
        Ok(())
    }

    /// Allow or remove a pool on the group's swap adapter. Allowing requires a pool that trades two
    /// underlyings of the group's markets (and a Peridot-trusted pool when the registry is enforced).
    /// V3 trading also needs the pool binding: see `set_pool_binding`.
    pub fn set_pool_allowed(
        env: Env,
        owner: Address,
        group_id: u32,
        pool: Address,
        allowed: bool,
    ) -> Result<(), MarginError> {
        bump_instance(&env);
        let group = require_owner(&env, &owner, group_id)?;
        let rec = load_record(&env, group_id)?;
        let xf = env.current_contract_address();
        let mut pools = load_pools(&env, group_id);
        let sa = SwapAdapterClient::new(&env, &rec.swap_adapter);
        if allowed {
            if env
                .storage()
                .instance()
                .get::<_, bool>(&Key::RegistryEnforced)
                .unwrap_or(false)
                && !env
                    .storage()
                    .persistent()
                    .get::<_, bool>(&Key::TrustedPool(pool.clone()))
                    .unwrap_or(false)
            {
                return Err(MarginError::PoolNotTrusted);
            }
            check_pool_tokens(&env, &group, group_id, &pool)?;
            if !pools.contains(&pool) {
                if pools.len() >= MAX_POOLS {
                    return Err(MarginError::TooManyPools);
                }
                pools.push_back(pool.clone());
            }
            sa.set_pool_allowed(&xf, &pool, &true);
        } else {
            if let Some(i) = pools.first_index_of(&pool) {
                pools.remove(i);
            }
            sa.set_pool_allowed(&xf, &pool, &false);
        }
        env.storage().persistent().set(&Key::Pools(group_id), &pools);
        extend_persistent(&env, &Key::Pools(group_id));
        PoolAllowed {
            group_id,
            pool,
            allowed,
        }
        .publish(&env);
        Ok(())
    }

    /// Bind an Aquarius pool index (`pool_id`) to an allowlisted pool. V3 opens, closes and
    /// liquidations only route through (pool_id, pool) bindings.
    pub fn set_pool_binding(
        env: Env,
        owner: Address,
        group_id: u32,
        pool_id: BytesN<32>,
        pool: Address,
        allowed: bool,
    ) -> Result<(), MarginError> {
        bump_instance(&env);
        require_owner(&env, &owner, group_id)?;
        let rec = load_record(&env, group_id)?;
        if allowed && !load_pools(&env, group_id).contains(&pool) {
            return Err(MarginError::PoolNotAllowed);
        }
        let xf = env.current_contract_address();
        SwapAdapterClient::new(&env, &rec.swap_adapter).set_pool_binding(
            &xf, &pool_id, &pool, &allowed,
        );
        PoolBindingSet {
            group_id,
            pool,
            pool_id,
            allowed,
        }
        .publish(&env);
        Ok(())
    }

    // ------------------------------------------------------------------ views

    pub fn get_margin(env: Env, group_id: u32) -> Option<MarginInfo> {
        bump_instance(&env);
        let rec = read_record(&env, group_id)?;
        Some(MarginInfo {
            controller: rec.controller.clone(),
            swap_adapter: rec.swap_adapter.clone(),
            variant: rec.variant,
            cfg: rec.cfg.clone(),
            enabled_markets: enabled_markets(&env, &rec),
        })
    }

    /// Configured versus live values, including the 60s staging of the liquidation incentive.
    pub fn get_margin_status(env: Env, group_id: u32) -> Option<MarginStatus> {
        bump_instance(&env);
        let rec = read_record(&env, group_id)?;
        let group = group_of(&env, group_id);
        let ctl = GroupControllerClient::new(&env, &group.controller);
        let applied_li = ctl.get_liquidation_incentive_scaled();
        let incentive_applied = applied_li == rec.cfg.liquidation_incentive;
        Some(MarginStatus {
            controller: rec.controller.clone(),
            swap_adapter: rec.swap_adapter.clone(),
            variant: rec.variant,
            cfg: rec.cfg.clone(),
            enabled_markets: enabled_markets(&env, &rec),
            applied_liquidation_incentive: applied_li,
            applied_liquidation_fee: ctl.get_liquidation_fee_scaled(),
            incentive_applied,
            incentive_apply_after: if incentive_applied || rec.incentive_staged_at == 0 {
                0
            } else {
                rec.incentive_staged_at.saturating_add(STAGE_DELAY_SECS)
            },
            pair_liquidation_incentive: pair_incentive(rec.cfg.liquidation_incentive),
            maintenance_margin: MAINTENANCE_MARGIN,
            pools: load_pools(&env, group_id),
        })
    }

    /// `min(group max leverage, 1 / (1 - collateral factor))` for a margin-enabled market, floored;
    /// 0 when the market is not margin-enabled.
    pub fn effective_max_leverage(
        env: Env,
        group_id: u32,
        market: Address,
    ) -> Result<u128, MarginError> {
        bump_instance(&env);
        let rec = load_record(&env, group_id)?;
        let i = rec
            .markets
            .first_index_of(&market)
            .ok_or(MarginError::UnknownMarket)?;
        if !rec.active.get(i).unwrap_or(false) {
            return Ok(0);
        }
        let group = group_of(&env, group_id);
        let cf = GroupControllerClient::new(&env, &group.controller).get_market_cf(&market);
        let by_cf = if cf >= SCALE { u128::MAX } else { SCALE / (SCALE - cf) };
        Ok(by_cf.min(rec.cfg.max_leverage))
    }

    pub fn get_admin(env: Env) -> Address {
        env.storage().instance().get(&Key::Admin).unwrap()
    }

    pub fn get_market_factory(env: Env) -> Address {
        market_factory(&env)
    }

    pub fn get_wasm(env: Env) -> Option<MarginWasmHashes> {
        env.storage().instance().get(&Key::Wasm)
    }
}

// ---------------------------------------------------------------------- helpers

fn bump_instance(env: &Env) {
    env.storage()
        .instance()
        .extend_ttl(TTL_THRESHOLD, TTL_EXTEND_TO);
}

fn extend_persistent(env: &Env, key: &Key) {
    if env.storage().persistent().has(key) {
        env.storage()
            .persistent()
            .extend_ttl(key, TTL_THRESHOLD, TTL_EXTEND_TO);
    }
}

fn require_admin(env: &Env, admin: &Address) -> Result<(), MarginError> {
    bump_instance(env);
    admin.require_auth();
    let stored: Address = env.storage().instance().get(&Key::Admin).unwrap();
    if stored != *admin {
        return Err(MarginError::NotAdmin);
    }
    Ok(())
}

fn market_factory(env: &Env) -> Address {
    env.storage().instance().get(&Key::MarketFactory).unwrap()
}

fn group_of(env: &Env, group_id: u32) -> Group {
    MarketFactoryClient::new(env, &market_factory(env)).get_group(&group_id)
}

/// `owner.require_auth()`, then verify the owner against the market-factory group record.
fn require_owner(env: &Env, owner: &Address, group_id: u32) -> Result<Group, MarginError> {
    owner.require_auth();
    let group = group_of(env, group_id);
    if group.owner != *owner {
        return Err(MarginError::NotOwner);
    }
    Ok(group)
}

fn validate_cfg(cfg: &GroupMarginConfig) -> Result<(), MarginError> {
    if cfg.max_leverage < MIN_GROUP_LEVERAGE || cfg.max_leverage > MAX_GROUP_LEVERAGE {
        return Err(MarginError::InvalidLeverage);
    }
    if cfg.liquidation_incentive < MIN_LIQUIDATION_INCENTIVE
        || cfg.liquidation_incentive > MAX_LIQUIDATION_INCENTIVE
    {
        return Err(MarginError::InvalidIncentive);
    }
    if cfg.max_slippage == 0 || cfg.max_slippage > MAX_SLIPPAGE {
        return Err(MarginError::InvalidSlippage);
    }
    if cfg.liquidation_fee > MAX_LIQUIDATION_FEE {
        return Err(MarginError::InvalidFee);
    }
    Ok(())
}

fn salt(env: &Env, group_id: u32, kind: u8) -> BytesN<32> {
    let mut b = [0u8; 32];
    b[0..4].copy_from_slice(&group_id.to_be_bytes());
    b[4] = kind;
    BytesN::from_array(env, &b)
}

fn read_record(env: &Env, group_id: u32) -> Option<MarginRecord> {
    let key = Key::Margin(group_id);
    let rec = env.storage().persistent().get(&key);
    if rec.is_some() {
        extend_persistent(env, &key);
    }
    rec
}

fn load_record(env: &Env, group_id: u32) -> Result<MarginRecord, MarginError> {
    read_record(env, group_id).ok_or(MarginError::NotEnabled)
}

fn save_record(env: &Env, group_id: u32, rec: &MarginRecord) {
    let key = Key::Margin(group_id);
    env.storage().persistent().set(&key, rec);
    extend_persistent(env, &key);
}

fn load_pools(env: &Env, group_id: u32) -> Vec<Address> {
    let key = Key::Pools(group_id);
    extend_persistent(env, &key);
    env.storage()
        .persistent()
        .get(&key)
        .unwrap_or(Vec::new(env))
}

fn enabled_markets(env: &Env, rec: &MarginRecord) -> Vec<Address> {
    let mut out = Vec::new(env);
    for i in 0..rec.markets.len() {
        if rec.active.get(i).unwrap_or(false) {
            out.push_back(rec.markets.get(i).unwrap());
        }
    }
    out
}

/// Tokens of `pool`, if it answers `get_tokens`.
fn pool_tokens(env: &Env, pool: &Address) -> Option<Vec<Address>> {
    match PoolClient::new(env, pool).try_get_tokens() {
        Ok(Ok(tokens)) => Some(tokens),
        _ => None,
    }
}

fn any_pool_trades(env: &Env, pools: &Vec<Address>, token: &Address) -> bool {
    for pool in pools.iter() {
        if let Some(tokens) = pool_tokens(env, &pool) {
            if tokens.contains(token) {
                return true;
            }
        }
    }
    false
}

/// A pool must trade exactly two tokens and both must be underlyings of the group's markets.
fn check_pool_tokens(
    env: &Env,
    group: &Group,
    group_id: u32,
    pool: &Address,
) -> Result<(), MarginError> {
    let tokens = pool_tokens(env, pool).ok_or(MarginError::PoolNotInGroup)?;
    if tokens.len() != 2 {
        return Err(MarginError::PoolNotInGroup);
    }
    let mf = MarketFactoryClient::new(env, &market_factory(env));
    let mut found = 0u32;
    for market in group.markets.iter() {
        let underlying = mf.market_token(&group_id, &market);
        if tokens.contains(&underlying) {
            found += 1;
        }
    }
    if found != 2 {
        return Err(MarginError::PoolNotInGroup);
    }
    Ok(())
}

/// Group incentive `1.0x` maps to a pair incentive `x`, clamped to the controller's pair maximum.
fn pair_incentive(group_incentive: u128) -> u128 {
    group_incentive
        .saturating_sub(SCALE)
        .min(MAX_PAIR_LIQUIDATION_INCENTIVE)
}

fn set_pair(env: &Env, rec: &MarginRecord, a: &Address, b: &Address, leverage: u128) {
    let xf = env.current_contract_address();
    let mc = MarginControllerClient::new(env, &rec.controller);
    let li = pair_incentive(rec.cfg.liquidation_incentive);
    mc.set_perps_pair_config(&xf, a, b, &PositionSide::Long, &leverage, &MAINTENANCE_MARGIN, &li);
    mc.set_perps_pair_config(&xf, a, b, &PositionSide::Short, &leverage, &MAINTENANCE_MARGIN, &li);
}

/// Pairs between `token` and every other known token, both orders. Pairs with an inactive token
/// stay at 1x; a pair is only opened up when both sides are active.
fn apply_token_pairs(env: &Env, rec: &MarginRecord, token: &Address, leverage: u128) {
    for i in 0..rec.tokens.len() {
        let other = rec.tokens.get(i).unwrap();
        if other == *token {
            continue;
        }
        let both_active = leverage > 1 && rec.active.get(i).unwrap_or(false);
        let lev = if both_active { leverage } else { 1 };
        set_pair(env, rec, token, &other, lev);
        set_pair(env, rec, &other, token, lev);
    }
}

fn apply_all_pairs(env: &Env, rec: &MarginRecord) {
    for i in 0..rec.tokens.len() {
        if !rec.active.get(i).unwrap_or(false) {
            continue;
        }
        for j in 0..rec.tokens.len() {
            if i == j || !rec.active.get(j).unwrap_or(false) {
                continue;
            }
            set_pair(
                env,
                rec,
                &rec.tokens.get(i).unwrap(),
                &rec.tokens.get(j).unwrap(),
                rec.cfg.max_leverage,
            );
        }
    }
}

/// Update `incentive_staged_at` from the live group-controller value. Returns true when the target
/// incentive is live. `restage` marks a fresh change (starts a new 60s window).
fn refresh_staging(env: &Env, rec: &mut MarginRecord, controller: &Address, restage: bool) -> bool {
    let applied = GroupControllerClient::new(env, controller).get_liquidation_incentive_scaled();
    if applied == rec.cfg.liquidation_incentive {
        rec.incentive_staged_at = 0;
        true
    } else {
        if restage || rec.incentive_staged_at == 0 {
            rec.incentive_staged_at = env.ledger().timestamp();
        }
        false
    }
}
