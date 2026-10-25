//! Peridot market factory (00-DROPOFF.md section 8).
//!
//! The factory is the admin of every contract in an isolated group (controller, receipt-vaults,
//! jump-rate models, price router, reward distributor, yield adapters). A group owner acts through
//! the factory, which enforces guardrails on creation and on every update.
//!
//! Core Wasm bakes its permitted initial admin at compile time, so core Wasm for a network is built
//! with `INIT_ADMIN` = this contract's address and registered with `set_wasm` after deployment.
#![no_std]

mod errors;
mod events;
mod ext;
mod guardrails;
mod storage;

#[cfg(test)]
mod test;

use peridot_interfaces::{
    BlendAdapterConfig, Group, KeeperMode, MarketConfig, PriceConfig, PriceRouterClient, RateModel, RewardDistributorClient,
    WasmHashes, YieldRoute,
};
use soroban_sdk::{
    contract, contractimpl, vec, Address, Bytes, BytesN, Env, IntoVal, Symbol, Val, Vec,
};

pub use errors::FactoryError;
pub use storage::{MarketRecord, PendingCf, PendingPrice};

use ext::{
    ControllerClient, DefindexVaultClient, FeeVaultReadClient, LaunchpadViewClient, MarketVaultClient, RateModelClient,
    TokenReadClient,
};
use storage::DataKey;

// Deployment kinds, part of every salt.
const KIND_CONTROLLER: u32 = 1;
const KIND_ROUTER: u32 = 2;
const KIND_VAULT: u32 = 3;
const KIND_JRM: u32 = 4;
const KIND_DISTRIBUTOR: u32 = 5;
const KIND_ADAPTER: u32 = 6;

#[contract]
pub struct MarketFactory;

fn deploy(env: &Env, group_id: u32, kind: u32, hash: BytesN<32>, args: Vec<Val>) -> Address {
    let nonce = storage::next_nonce(env, group_id);
    let mut b = Bytes::new(env);
    b.extend_from_array(&group_id.to_be_bytes());
    b.extend_from_array(&kind.to_be_bytes());
    b.extend_from_array(&nonce.to_be_bytes());
    let salt: BytesN<32> = env.crypto().sha256(&b).to_bytes();
    env.deployer().with_current_contract(salt).deploy_v2(hash, args)
}

fn require_admin(env: &Env, admin: &Address) -> Result<(), FactoryError> {
    if storage::admin(env) != *admin {
        return Err(FactoryError::NotAdmin);
    }
    admin.require_auth();
    Ok(())
}

/// Loads the group and checks `owner` signed and owns it.
fn require_owner(env: &Env, owner: &Address, group_id: u32) -> Result<Group, FactoryError> {
    owner.require_auth();
    let g = storage::get_group(env, group_id)?;
    if g.owner != *owner {
        return Err(FactoryError::NotOwner);
    }
    Ok(g)
}

fn require_margin_factory(env: &Env, caller: &Address) -> Result<(), FactoryError> {
    let mf: Address = env
        .storage()
        .instance()
        .get(&DataKey::MarginFactory)
        .ok_or(FactoryError::MarginFactoryNotSet)?;
    if mf != *caller {
        return Err(FactoryError::NotMarginFactory);
    }
    caller.require_auth();
    Ok(())
}

/// The oracle must be allowlisted AND the (token, oracle, asset key) mapping approved by Peridot, so an owner cannot
/// price a token with another asset's feed entry. Re-checked whenever a price config is installed.
fn check_price_allowed(env: &Env, token: &Address, price: &PriceConfig) -> Result<(), FactoryError> {
    check_oracle_allowed(env, price)?;
    if let PriceConfig::ReflectorOnly(c) = price {
        let mapped: bool = env
            .storage()
            .instance()
            .get(&DataKey::PriceFeedAllowed(token.clone(), c.oracle.clone(), c.asset.clone()))
            .unwrap_or(false);
        if !mapped {
            return Err(FactoryError::PriceFeedNotAllowed);
        }
    }
    Ok(())
}

fn check_oracle_allowed(env: &Env, price: &PriceConfig) -> Result<(), FactoryError> {
    let oracle = match price {
        PriceConfig::ReflectorOnly(c) => c.oracle.clone(),
        PriceConfig::ReflectorWithAquariusGuard(c) => c.oracle.clone(),
        PriceConfig::AquariusOnly(_) => return Ok(()),
    };
    let ok: bool = env
        .storage()
        .instance()
        .get(&DataKey::OracleAllowed(oracle))
        .unwrap_or(false);
    if ok {
        Ok(())
    } else {
        Err(FactoryError::OracleNotAllowed)
    }
}

/// A DeFindex vault is attachable if Peridot reviewed it, it manages exactly one asset, that asset is the
/// market's underlying and at least one of its strategies is not paused.
fn check_defindex(env: &Env, vault: &Address, token: &Address) -> Result<(), FactoryError> {
    let allowed: bool = env.storage().instance().get(&DataKey::YieldVaultAllowed(vault.clone())).unwrap_or(false);
    if !allowed {
        return Err(FactoryError::YieldVaultNotAllowed);
    }
    let c = DefindexVaultClient::new(env, vault);
    let assets = match c.try_get_assets() {
        Ok(Ok(a)) => a,
        _ => return Err(FactoryError::InvalidYieldVault),
    };
    if assets.len() != 1 {
        return Err(FactoryError::InvalidYieldVault);
    }
    let set = assets.get(0).unwrap();
    if set.address != *token || !set.strategies.iter().any(|s| !s.paused) {
        return Err(FactoryError::InvalidYieldVault);
    }
    match c.try_get_asset_amounts_per_shares(&0i128) {
        Ok(Ok(v)) if v.len() == 1 => Ok(()),
        _ => Err(FactoryError::InvalidYieldVault),
    }
}

#[contractimpl]
impl MarketFactory {
    // ------------------------------------------------------------------
    // setup (Peridot admin)
    // ------------------------------------------------------------------

    pub fn __constructor(env: Env, admin: Address, treasury: Address) {
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::Treasury, &treasury);
        env.storage().instance().set(&DataKey::NextGroupId, &1u32);
        env.storage().instance().set(&DataKey::AllowlistMode, &false);
        storage::bump_instance(&env);
    }

    pub fn set_wasm(env: Env, admin: Address, wasm: WasmHashes) -> Result<(), FactoryError> {
        require_admin(&env, &admin)?;
        env.storage().instance().set(&DataKey::Wasm, &wasm);
        storage::bump_instance(&env);
        Ok(())
    }

    pub fn get_wasm(env: Env) -> Result<WasmHashes, FactoryError> {
        storage::wasm(&env)
    }

    pub fn set_allowlist_mode(env: Env, admin: Address, on: bool) -> Result<(), FactoryError> {
        require_admin(&env, &admin)?;
        env.storage().instance().set(&DataKey::AllowlistMode, &on);
        Ok(())
    }

    pub fn set_creator_allowed(env: Env, admin: Address, creator: Address, allowed: bool) -> Result<(), FactoryError> {
        require_admin(&env, &admin)?;
        env.storage().persistent().set(&DataKey::CreatorAllowed(creator), &allowed);
        Ok(())
    }

    /// Only Reflector feeds that Peridot has reviewed can be used as a price source.
    pub fn set_oracle_allowed(env: Env, admin: Address, oracle: Address, allowed: bool) -> Result<(), FactoryError> {
        require_admin(&env, &admin)?;
        env.storage().instance().set(&DataKey::OracleAllowed(oracle), &allowed);
        storage::bump_instance(&env);
        Ok(())
    }

    /// Only yield vaults that Peridot has reviewed can receive a market's idle liquidity: an arbitrary
    /// vault supplied by a group owner could take the depositors' funds.
    pub fn set_yield_vault_allowed(env: Env, admin: Address, vault: Address, allowed: bool) -> Result<(), FactoryError> {
        require_admin(&env, &admin)?;
        env.storage().instance().set(&DataKey::YieldVaultAllowed(vault), &allowed);
        storage::bump_instance(&env);
        Ok(())
    }

    pub fn is_yield_vault_allowed(env: Env, vault: Address) -> bool {
        env.storage().instance().get(&DataKey::YieldVaultAllowed(vault)).unwrap_or(false)
    }

    /// Approves one (token, oracle, asset key) price mapping. Owners can only choose mappings approved here.
    pub fn set_price_feed_allowed(
        env: Env,
        admin: Address,
        token: Address,
        oracle: Address,
        asset: peridot_interfaces::Asset,
        allowed: bool,
    ) -> Result<(), FactoryError> {
        require_admin(&env, &admin)?;
        env.storage().instance().set(&DataKey::PriceFeedAllowed(token, oracle, asset), &allowed);
        storage::bump_instance(&env);
        Ok(())
    }

    pub fn is_price_feed_allowed(env: Env, token: Address, oracle: Address, asset: peridot_interfaces::Asset) -> bool {
        env.storage().instance().get(&DataKey::PriceFeedAllowed(token, oracle, asset)).unwrap_or(false)
    }

    pub fn is_oracle_allowed(env: Env, oracle: Address) -> bool {
        env.storage().instance().get(&DataKey::OracleAllowed(oracle)).unwrap_or(false)
    }

    pub fn set_margin_factory(env: Env, admin: Address, margin_factory: Address) -> Result<(), FactoryError> {
        require_admin(&env, &admin)?;
        env.storage().instance().set(&DataKey::MarginFactory, &margin_factory);
        storage::bump_instance(&env);
        Ok(())
    }

    /// The launchpad FACTORY: its curves (`is_curve`) are the only owners allowed to create `AquariusOnly` markets.
    pub fn set_launchpad(env: Env, admin: Address, launchpad: Address) -> Result<(), FactoryError> {
        require_admin(&env, &admin)?;
        env.storage().instance().set(&DataKey::Launchpad, &launchpad);
        storage::bump_instance(&env);
        Ok(())
    }

    pub fn get_launchpad(env: Env) -> Option<Address> {
        env.storage().instance().get(&DataKey::Launchpad)
    }

    pub fn get_margin_factory(env: Env) -> Option<Address> {
        env.storage().instance().get(&DataKey::MarginFactory)
    }

    /// Immediate upgrade of the factory itself.
    pub fn upgrade(env: Env, admin: Address, new_wasm_hash: BytesN<32>) -> Result<(), FactoryError> {
        require_admin(&env, &admin)?;
        env.deployer().update_current_contract_wasm(new_wasm_hash.clone());
        events::Upgraded { contract: env.current_contract_address(), wasm_hash: new_wasm_hash }.publish(&env);
        Ok(())
    }

    /// Hotfix pass-through for NEW group contracts (price router, distributor, adapters): immediate.
    pub fn upgrade_group_contract(
        env: Env,
        admin: Address,
        group_id: u32,
        contract: Address,
        new_wasm_hash: BytesN<32>,
    ) -> Result<(), FactoryError> {
        require_admin(&env, &admin)?;
        storage::get_group(&env, group_id)?;
        let args: Vec<Val> = vec![&env, env.current_contract_address().into_val(&env), new_wasm_hash.clone().into_val(&env)];
        env.invoke_contract::<()>(&contract, &Symbol::new(&env, "upgrade"), args);
        events::Upgraded { contract, wasm_hash: new_wasm_hash }.publish(&env);
        Ok(())
    }

    /// Core contracts keep their two-step path (60s delay in the hackathon copy): step 1.
    pub fn propose_core_upgrade(
        env: Env,
        admin: Address,
        group_id: u32,
        contract: Address,
        new_wasm_hash: BytesN<32>,
    ) -> Result<(), FactoryError> {
        require_admin(&env, &admin)?;
        let g = storage::get_group(&env, group_id)?;
        core_upgrade_call(&env, &g, &contract, "propose_upgrade_wasm", &new_wasm_hash)?;
        events::CoreUpgradeProposed { group_id, contract, wasm_hash: new_wasm_hash }.publish(&env);
        Ok(())
    }

    /// Step 2, after the delay.
    pub fn execute_core_upgrade(
        env: Env,
        admin: Address,
        group_id: u32,
        contract: Address,
        new_wasm_hash: BytesN<32>,
    ) -> Result<(), FactoryError> {
        require_admin(&env, &admin)?;
        let g = storage::get_group(&env, group_id)?;
        core_upgrade_call(&env, &g, &contract, "upgrade_wasm", &new_wasm_hash)?;
        events::Upgraded { contract, wasm_hash: new_wasm_hash }.publish(&env);
        Ok(())
    }

    // ------------------------------------------------------------------
    // launch and grow (owner, one tx each)
    // ------------------------------------------------------------------

    /// Deploys the group controller and price router and wires the router as the controller's oracle
    /// (the first oracle set on a fresh controller applies immediately).
    pub fn create_group(env: Env, owner: Address, name: Symbol) -> Result<u32, FactoryError> {
        owner.require_auth();
        let wasm = storage::wasm(&env)?;
        if env.storage().instance().get(&DataKey::AllowlistMode).unwrap_or(false) {
            let ok: bool = env
                .storage()
                .persistent()
                .get(&DataKey::CreatorAllowed(owner.clone()))
                .unwrap_or(false);
            if !ok {
                return Err(FactoryError::CreatorNotAllowed);
            }
        }
        let id: u32 = env.storage().instance().get(&DataKey::NextGroupId).unwrap();
        env.storage().instance().set(&DataKey::NextGroupId, &(id + 1));
        storage::bump_instance(&env);

        let me = env.current_contract_address();
        let controller = deploy(&env, id, KIND_CONTROLLER, wasm.controller.clone(), Vec::new(&env));
        ControllerClient::new(&env, &controller).initialize(&me);

        let router = deploy(
            &env,
            id,
            KIND_ROUTER,
            wasm.price_router.clone(),
            vec![
                &env,
                me.clone().into_val(&env),
                guardrails::REFLECTOR_DECIMALS.into_val(&env),
                guardrails::ROUTER_RESOLUTION_SECS.into_val(&env),
            ],
        );
        ControllerClient::new(&env, &controller).set_oracle(&router);

        let g = Group {
            id,
            owner: owner.clone(),
            name: name.clone(),
            controller: controller.clone(),
            price_router: router.clone(),
            reward_distributor: None,
            margin_controller: None,
            markets: Vec::new(&env),
            created_at: env.ledger().timestamp(),
            keeper_mode: KeeperMode::None,
            keeper_paid_until: 0,
        };
        storage::set_group(&env, &g);
        let mut og = storage::owner_groups(&env, &owner);
        og.push_back(id);
        storage::set_owner_groups(&env, &owner, &og);
        events::GroupCreated { group_id: id, owner, name, controller, price_router: router }.publish(&env);
        Ok(id)
    }

    /// Step 1 of 2 (Soroban allows 100 ledger entries per transaction): validates the config, deploys the
    /// receipt-vault and its own jump-rate model and initializes both. The market is not usable until
    /// `activate_market` wires it into the controller. A non-`None` yield route is attached later by
    /// `attach_yield`.
    pub fn add_market(env: Env, owner: Address, group_id: u32, cfg: MarketConfig) -> Result<Address, FactoryError> {
        let g = require_owner(&env, &owner, group_id)?;
        // Audited-core limitation: once a reward token is set, `receipt-vault.set_peridottroller` calls
        // `accrue_user_market`, which calls back into the vault (re-entry trap). List every market first.
        if g.reward_distributor.is_some() {
            return Err(FactoryError::MarketsLockedByRewards);
        }
        guardrails::check_market_config(&cfg)?;
        if matches!(cfg.price, PriceConfig::AquariusOnly(_)) {
            // only a curve deployed by the registered launchpad factory may pick a pool-priced market
            // (the pool is the one that curve created at graduation)
            let lp: Option<Address> = env.storage().instance().get(&DataKey::Launchpad);
            let ok = match lp {
                Some(lp) => matches!(LaunchpadViewClient::new(&env, &lp).try_is_curve(&owner), Ok(Ok(true))),
                None => false,
            };
            if !ok {
                return Err(FactoryError::PriceModeNotAllowed);
            }
        }
        check_price_allowed(&env, &cfg.token, &cfg.price)?;
        if g.markets.len() + storage::pending_count(&env, group_id) >= guardrails::MAX_MARKETS_PER_GROUP {
            return Err(FactoryError::TooManyMarkets);
        }
        // a token can back only one market per group (the price router keys config by token)
        if storage::token_market(&env, group_id, &cfg.token).is_some() {
            return Err(FactoryError::MarketAlreadyExists);
        }
        if (cfg.supply_reward_per_sec > 0 || cfg.borrow_reward_per_sec > 0) && g.reward_distributor.is_none() {
            return Err(FactoryError::RewardsNotSet);
        }
        // reject non-token addresses early
        if TokenReadClient::new(&env, &cfg.token).try_decimals().is_err() {
            return Err(FactoryError::InvalidToken);
        }
        // yield route is validated again at attach time; here only reject routes this phase cannot serve
        if !matches!(cfg.yield_route, YieldRoute::None | YieldRoute::Defindex(_) | YieldRoute::Blend(_)) {
            return Err(FactoryError::Unsupported);
        }
        let wasm = storage::wasm(&env)?;
        let me = env.current_contract_address();

        let jrm = deploy(&env, group_id, KIND_JRM, wasm.jump_rate.clone(), Vec::new(&env));
        RateModelClient::new(&env, &jrm).initialize(
            &cfg.rates.base,
            &cfg.rates.multiplier,
            &cfg.rates.jump,
            &cfg.rates.kink,
            &me,
        );
        let vault = deploy(&env, group_id, KIND_VAULT, wasm.receipt_vault.clone(), Vec::new(&env));
        let v = MarketVaultClient::new(&env, &vault);
        v.initialize(&cfg.token, &0u128, &0u128, &me);
        v.set_interest_model(&jrm);
        v.set_reserve_factor(&cfg.reserve_factor);
        v.set_flash_loan_fee(&guardrails::DEFAULT_FLASH_LOAN_FEE);
        v.set_supply_cap(&cfg.supply_cap);
        v.set_borrow_cap(&cfg.borrow_cap);

        let rec = MarketRecord {
            cfg: cfg.clone(),
            jump_rate_model: jrm.clone(),
            active: false,
            boosted_vault: None,
            adapter: None,
            created_at: env.ledger().timestamp(),
            pending_cf: Vec::new(&env),
            pending_price: Vec::new(&env),
        };
        storage::set_market(&env, group_id, &vault, &rec);
        storage::set_token_market(&env, group_id, &cfg.token, &vault);
        storage::bump_pending(&env, group_id, 1);
        events::MarketAdded { group_id, market: vault.clone(), token: cfg.token, jump_rate_model: jrm }.publish(&env);
        Ok(vault)
    }

    /// Step 2 of 2: configures the vault, lists it on the controller, sets the price source and the
    /// collateral factor (the first CF for a market applies immediately), reward speeds and idle buffer.
    pub fn activate_market(env: Env, owner: Address, group_id: u32, market: Address) -> Result<(), FactoryError> {
        let mut g = require_owner(&env, &owner, group_id)?;
        if g.reward_distributor.is_some() {
            return Err(FactoryError::MarketsLockedByRewards);
        }
        let mut rec = storage::get_market(&env, group_id, &market)?;
        if rec.active {
            return Err(FactoryError::MarketAlreadyActive);
        }
        let cfg = rec.cfg.clone();
        check_price_allowed(&env, &cfg.token, &cfg.price)?;
        let me = env.current_contract_address();

        // price first: the vault's set_peridottroller smoke-tests get_price_usd
        PriceRouterClient::new(&env, &g.price_router).set_asset_config(&me, &cfg.token, &cfg.price);

        let v = MarketVaultClient::new(&env, &market);

        // add_market must precede the vault's set_peridottroller (it checks the market is supported)
        let ctrl = ControllerClient::new(&env, &g.controller);
        ctrl.add_market(&market);
        v.set_peridottroller(&g.controller);
        ctrl.set_market_cf(&market, &cfg.collateral_factor);
        v.set_idle_cash_buffer_bps(&me, &cfg.idle_buffer_bps);

        if cfg.supply_reward_per_sec > 0 {
            ctrl.set_supply_speed(&market, &cfg.supply_reward_per_sec);
        }
        if cfg.borrow_reward_per_sec > 0 {
            ctrl.set_borrow_speed(&market, &cfg.borrow_reward_per_sec);
        }

        rec.active = true;
        storage::set_market(&env, group_id, &market, &rec);
        g.markets.push_back(market.clone());
        storage::set_group(&env, &g);
        storage::bump_pending(&env, group_id, -1);
        events::MarketActivated { group_id, market }.publish(&env);
        Ok(())
    }

    /// Attaches the market's configured yield route. DeFindex is attached directly (no adapter);
    /// returns the adapter address for routes that deploy one.
    pub fn attach_yield(env: Env, owner: Address, group_id: u32, market: Address) -> Result<Option<Address>, FactoryError> {
        require_owner(&env, &owner, group_id)?;
        let mut rec = storage::get_market(&env, group_id, &market)?;
        if !rec.active {
            return Err(FactoryError::MarketNotActive);
        }
        if rec.boosted_vault.is_some() {
            return Err(FactoryError::YieldAlreadyAttached);
        }
        let me = env.current_contract_address();
        let v = MarketVaultClient::new(&env, &market);
        let (boosted, adapter): (Address, Option<Address>) = match rec.cfg.yield_route.clone() {
            YieldRoute::None => return Ok(None),
            YieldRoute::Defindex(r) => {
                check_defindex(&env, &r.vault, &rec.cfg.token)?;
                (r.vault, None)
            }
            YieldRoute::Blend(r) => {
                let allowed: bool = env
                    .storage()
                    .instance()
                    .get(&DataKey::YieldVaultAllowed(r.fee_vault.clone()))
                    .unwrap_or(false);
                if !allowed {
                    return Err(FactoryError::YieldVaultNotAllowed);
                }
                let pool = match FeeVaultReadClient::new(&env, &r.fee_vault).try_get_pool() {
                    Ok(Ok(p)) => p,
                    _ => return Err(FactoryError::InvalidYieldVault),
                };
                let wasm = storage::wasm(&env)?;
                let hash = wasm.blend_adapter.ok_or(FactoryError::WasmNotSet)?;
                // the adapter constructor re-checks the pool and that the fee vault has this reserve enabled
                let adapter = deploy(
                    &env,
                    group_id,
                    KIND_ADAPTER,
                    hash,
                    vec![
                        &env,
                        me.clone().into_val(&env),
                        market.clone().into_val(&env),
                        rec.cfg.token.clone().into_val(&env),
                        BlendAdapterConfig { fee_vault: r.fee_vault, blend_pool: pool }.into_val(&env),
                    ],
                );
                (adapter.clone(), Some(adapter))
            }
            _ => return Err(FactoryError::Unsupported),
        };
        v.set_boosted_vault(&me, &boosted);
        v.set_idle_cash_buffer_bps(&me, &rec.cfg.idle_buffer_bps);
        rec.boosted_vault = Some(boosted.clone());
        rec.adapter = adapter.clone();
        storage::set_market(&env, group_id, &market, &rec);
        events::YieldAttached { group_id, market, boosted_vault: boosted, adapter: adapter.clone() }.publish(&env);
        Ok(adapter)
    }

    /// Once per group: deploys the reward distributor for `reward_token` and registers it as the
    /// controller's reward token. The choice is permanent for the group.
    pub fn set_rewards(env: Env, owner: Address, group_id: u32, reward_token: Address) -> Result<Address, FactoryError> {
        let mut g = require_owner(&env, &owner, group_id)?;
        if g.reward_distributor.is_some() {
            return Err(FactoryError::RewardsAlreadySet);
        }
        if storage::pending_count(&env, group_id) > 0 {
            return Err(FactoryError::MarketNotActive); // activate pending markets before enabling rewards
        }
        if TokenReadClient::new(&env, &reward_token).try_decimals().is_err() {
            return Err(FactoryError::InvalidToken);
        }
        let wasm = storage::wasm(&env)?;
        let me = env.current_contract_address();
        let dist = deploy(
            &env,
            group_id,
            KIND_DISTRIBUTOR,
            wasm.reward_distributor.clone(),
            vec![
                &env,
                me.into_val(&env),
                g.controller.clone().into_val(&env),
                reward_token.clone().into_val(&env),
            ],
        );
        ControllerClient::new(&env, &g.controller).set_peridot_token(&dist);
        g.reward_distributor = Some(dist.clone());
        storage::set_group(&env, &g);
        events::RewardsSet { group_id, distributor: dist.clone(), reward_token }.publish(&env);
        Ok(dist)
    }

    pub fn set_reward_speeds(
        env: Env,
        owner: Address,
        group_id: u32,
        market: Address,
        supply_per_sec: u128,
        borrow_per_sec: u128,
    ) -> Result<(), FactoryError> {
        let g = require_owner(&env, &owner, group_id)?;
        if g.reward_distributor.is_none() {
            return Err(FactoryError::RewardsNotSet);
        }
        guardrails::check_speed(supply_per_sec)?;
        guardrails::check_speed(borrow_per_sec)?;
        let mut rec = storage::get_market(&env, group_id, &market)?;
        let ctrl = ControllerClient::new(&env, &g.controller);
        ctrl.set_supply_speed(&market, &supply_per_sec);
        ctrl.set_borrow_speed(&market, &borrow_per_sec);
        events::ParamUpdated {
            group_id,
            market: Some(market.clone()),
            param: Symbol::new(&env, "supply_reward"),
            old: rec.cfg.supply_reward_per_sec,
            new: supply_per_sec,
        }
        .publish(&env);
        events::ParamUpdated {
            group_id,
            market: Some(market.clone()),
            param: Symbol::new(&env, "borrow_reward"),
            old: rec.cfg.borrow_reward_per_sec,
            new: borrow_per_sec,
        }
        .publish(&env);
        rec.cfg.supply_reward_per_sec = supply_per_sec;
        rec.cfg.borrow_reward_per_sec = borrow_per_sec;
        storage::set_market(&env, group_id, &market, &rec);
        events::RewardSpeedSet { group_id, market, supply_per_sec, borrow_per_sec }.publish(&env);
        Ok(())
    }

    /// Withdrawing can leave accrued rewards unclaimable until the distributor is refunded.
    pub fn withdraw_unallocated(env: Env, owner: Address, group_id: u32, to: Address, amount: i128) -> Result<(), FactoryError> {
        let g = require_owner(&env, &owner, group_id)?;
        let dist = g.reward_distributor.ok_or(FactoryError::RewardsNotSet)?;
        RewardDistributorClient::new(&env, &dist).withdraw_unallocated(&env.current_contract_address(), &to, &amount);
        Ok(())
    }

    /// Phase 2+: records the mode. Wiring `set_keeper` on vaults lands with the Aquarius route.
    pub fn set_keeper_mode(env: Env, owner: Address, group_id: u32, mode: KeeperMode) -> Result<(), FactoryError> {
        let mut g = require_owner(&env, &owner, group_id)?;
        g.keeper_mode = mode.clone();
        storage::set_group(&env, &g);
        events::KeeperModeSet { group_id, mode }.publish(&env);
        Ok(())
    }

    // ------------------------------------------------------------------
    // control panel (owner)
    // ------------------------------------------------------------------

    /// Caps, reserve factor and a CF change. Caps and reserve factor apply immediately; a CF change
    /// is staged on the controller and applied by `apply_pending` after 60s.
    pub fn update_risk(
        env: Env,
        owner: Address,
        group_id: u32,
        market: Address,
        cf: u128,
        supply_cap: u128,
        borrow_cap: u128,
        reserve_factor: u128,
    ) -> Result<(), FactoryError> {
        let g = require_owner(&env, &owner, group_id)?;
        let mut rec = storage::get_market(&env, group_id, &market)?;
        guardrails::check_cf(cf, &rec.cfg.price)?;
        guardrails::check_caps(supply_cap, borrow_cap)?;
        guardrails::check_reserve_factor(reserve_factor)?;
        let v = MarketVaultClient::new(&env, &market);
        if supply_cap != rec.cfg.supply_cap {
            v.set_supply_cap(&supply_cap);
            events::ParamUpdated { group_id, market: Some(market.clone()), param: Symbol::new(&env, "supply_cap"), old: rec.cfg.supply_cap, new: supply_cap }.publish(&env);
            rec.cfg.supply_cap = supply_cap;
        }
        if borrow_cap != rec.cfg.borrow_cap {
            v.set_borrow_cap(&borrow_cap);
            events::ParamUpdated { group_id, market: Some(market.clone()), param: Symbol::new(&env, "borrow_cap"), old: rec.cfg.borrow_cap, new: borrow_cap }.publish(&env);
            rec.cfg.borrow_cap = borrow_cap;
        }
        if reserve_factor != rec.cfg.reserve_factor {
            v.set_reserve_factor(&reserve_factor);
            events::ParamUpdated { group_id, market: Some(market.clone()), param: Symbol::new(&env, "reserve_factor"), old: rec.cfg.reserve_factor, new: reserve_factor }.publish(&env);
            rec.cfg.reserve_factor = reserve_factor;
        }
        let now = env.ledger().timestamp();
        let live_cf = ControllerClient::new(&env, &g.controller).get_market_cf(&market);
        let staged = rec.pending_cf.first();
        if cf == live_cf {
            // The core keeps its pending proposal and deadline; it cannot be cancelled, only replaced by another value.
            if staged.is_some() {
                return Err(FactoryError::CfChangeStaged);
            }
        } else if staged.map(|p| p.cf) != Some(cf) {
            // not yet staged with this value: stage on the controller (replacing any other staged value)
            ControllerClient::new(&env, &g.controller).set_market_cf(&market, &cf);
            let execute_after = now + guardrails::STAGED_DELAY_SECS;
            rec.pending_cf = vec![&env, PendingCf { cf, execute_after }];
            events::CfStaged { group_id, market: market.clone(), cf, execute_after }.publish(&env);
        }
        storage::set_market(&env, group_id, &market, &rec);
        Ok(())
    }

    /// Deploys nothing: updates the market's existing jump-rate model (immediate in core).
    pub fn update_rates(env: Env, owner: Address, group_id: u32, market: Address, rates: RateModel) -> Result<(), FactoryError> {
        require_owner(&env, &owner, group_id)?;
        guardrails::check_rates(&rates)?;
        let mut rec = storage::get_market(&env, group_id, &market)?;
        RateModelClient::new(&env, &rec.jump_rate_model).set_params(
            &env.current_contract_address(),
            &rates.base,
            &rates.multiplier,
            &rates.jump,
            &rates.kink,
        );
        events::ParamUpdated { group_id, market: Some(market.clone()), param: Symbol::new(&env, "rates"), old: rec.cfg.rates.base, new: rates.base }.publish(&env);
        rec.cfg.rates = rates;
        storage::set_market(&env, group_id, &market, &rec);
        Ok(())
    }

    pub fn update_idle_buffer(env: Env, owner: Address, group_id: u32, market: Address, bps: u32) -> Result<(), FactoryError> {
        require_owner(&env, &owner, group_id)?;
        guardrails::check_idle(bps)?;
        let mut rec = storage::get_market(&env, group_id, &market)?;
        MarketVaultClient::new(&env, &market).set_idle_cash_buffer_bps(&env.current_contract_address(), &bps);
        events::ParamUpdated { group_id, market: Some(market.clone()), param: Symbol::new(&env, "idle_buffer"), old: rec.cfg.idle_buffer_bps as u128, new: bps as u128 }.publish(&env);
        rec.cfg.idle_buffer_bps = bps;
        storage::set_market(&env, group_id, &market, &rec);
        Ok(())
    }

    /// Stages a new price source for the market; `apply_pending` applies it after 60s.
    pub fn update_price(env: Env, owner: Address, group_id: u32, market: Address, cfg: PriceConfig) -> Result<(), FactoryError> {
        require_owner(&env, &owner, group_id)?;
        guardrails::check_price_mode(&cfg)?;
        if matches!(cfg, PriceConfig::AquariusOnly(_)) {
            return Err(FactoryError::PriceModeNotAllowed); // AquariusOnly is set at creation by the launchpad only
        }
        let mut rec = storage::get_market(&env, group_id, &market)?;
        check_price_allowed(&env, &rec.cfg.token, &cfg)?;
        let execute_after = env.ledger().timestamp() + guardrails::STAGED_DELAY_SECS;
        rec.pending_price = vec![&env, PendingPrice { config: cfg.clone(), execute_after }];
        storage::set_market(&env, group_id, &market, &rec);
        events::PriceStaged { group_id, market, config: cfg, execute_after }.publish(&env);
        Ok(())
    }

    /// Switching yield route detaches the old route and attaches the new one. Phase 4.
    pub fn switch_yield(_env: Env, _owner: Address, _group_id: u32, _market: Address, _route: YieldRoute) -> Result<(), FactoryError> {
        Err(FactoryError::Unsupported)
    }

    /// Pauses (or unpauses) deposits and borrows. The core controller auto-expires a pause after 72h.
    pub fn pause_market(env: Env, owner: Address, group_id: u32, market: Address, deposit: bool, borrow: bool) -> Result<(), FactoryError> {
        let g = require_owner(&env, &owner, group_id)?;
        storage::get_market(&env, group_id, &market)?;
        let ctrl = ControllerClient::new(&env, &g.controller);
        ctrl.set_pause_deposit(&market, &deposit);
        ctrl.set_pause_borrow(&market, &borrow);
        events::ParamUpdated { group_id, market: Some(market.clone()), param: Symbol::new(&env, "pause_deposit"), old: 0, new: deposit as u128 }.publish(&env);
        events::ParamUpdated { group_id, market: Some(market), param: Symbol::new(&env, "pause_borrow"), old: 0, new: borrow as u128 }.publish(&env);
        Ok(())
    }

    /// Core receipt-vault upgrades require redeem to be paused. Peridot admin only, used around `execute_core_upgrade`.
    pub fn set_redeem_pause(env: Env, admin: Address, group_id: u32, market: Address, paused: bool) -> Result<(), FactoryError> {
        require_admin(&env, &admin)?;
        let g = storage::get_group(&env, group_id)?;
        storage::get_market(&env, group_id, &market)?;
        ControllerClient::new(&env, &g.controller).set_pause_redeem(&market, &paused);
        events::ParamUpdated { group_id, market: Some(market), param: Symbol::new(&env, "pause_redeem"), old: 0, new: paused as u128 }.publish(&env);
        Ok(())
    }

    pub fn transfer_ownership(env: Env, owner: Address, group_id: u32, new_owner: Address) -> Result<(), FactoryError> {
        let mut g = require_owner(&env, &owner, group_id)?;
        new_owner.require_auth(); // the receiver accepts by signing
        let mut old_list = storage::owner_groups(&env, &owner);
        if let Some(i) = old_list.first_index_of(group_id) {
            old_list.remove(i);
        }
        storage::set_owner_groups(&env, &owner, &old_list);
        let mut new_list = storage::owner_groups(&env, &new_owner);
        new_list.push_back(group_id);
        storage::set_owner_groups(&env, &new_owner, &new_list);
        g.owner = new_owner.clone();
        storage::set_group(&env, &g);
        events::OwnershipTransferred { group_id, old_owner: owner, new_owner }.publish(&env);
        Ok(())
    }

    /// Applies staged changes once their 60s delay passed: the CF on the controller (second call of
    /// `set_market_cf`) and the price config on the router. `None` applies every market of the group.
    pub fn apply_pending(env: Env, owner: Address, group_id: u32, market: Option<Address>) -> Result<u32, FactoryError> {
        let g = require_owner(&env, &owner, group_id)?;
        let mut applied = 0u32;
        let now = env.ledger().timestamp();
        let me = env.current_contract_address();
        let list: Vec<Address> = match market.clone() {
            Some(m) => vec![&env, m],
            None => g.markets.clone(),
        };
        for m in list.iter() {
            let mut rec = storage::get_market(&env, group_id, &m)?;
            let mut touched = false;
            if let Some(p) = rec.pending_cf.first() {
                if now >= p.execute_after {
                    ControllerClient::new(&env, &g.controller).set_market_cf(&m, &p.cf);
                    if ControllerClient::new(&env, &g.controller).get_market_cf(&m) != p.cf {
                        return Err(FactoryError::NotYetApplicable);
                    }
                    events::ParamUpdated { group_id, market: Some(m.clone()), param: Symbol::new(&env, "cf"), old: rec.cfg.collateral_factor, new: p.cf }.publish(&env);
                    rec.cfg.collateral_factor = p.cf;
                    rec.pending_cf = Vec::new(&env);
                    touched = true;
                } else if market.is_some() {
                    return Err(FactoryError::NotYetApplicable);
                }
            }
            if let Some(p) = rec.pending_price.first() {
                if now >= p.execute_after {
                    check_price_allowed(&env, &rec.cfg.token, &p.config)?;
                    PriceRouterClient::new(&env, &g.price_router).set_asset_config(&me, &rec.cfg.token, &p.config);
                    events::PriceApplied { group_id, market: m.clone(), config: p.config.clone() }.publish(&env);
                    rec.cfg.price = p.config;
                    rec.pending_price = Vec::new(&env);
                    touched = true;
                } else if market.is_some() {
                    return Err(FactoryError::NotYetApplicable);
                }
            }
            if touched {
                storage::set_market(&env, group_id, &m, &rec);
                applied += 1;
            }
        }
        if applied == 0 && market.is_some() {
            return Err(FactoryError::NothingPending);
        }
        Ok(applied)
    }

    // ------------------------------------------------------------------
    // margin factory hooks (callable only by the registered margin factory)
    // ------------------------------------------------------------------

    pub fn wire_margin(
        env: Env,
        caller: Address,
        group_id: u32,
        margin_controller: Address,
        liquidation_incentive: u128,
        liquidation_fee: u128,
    ) -> Result<(), FactoryError> {
        require_margin_factory(&env, &caller)?;
        let mut g = storage::get_group(&env, group_id)?;
        let ctrl = ControllerClient::new(&env, &g.controller);
        ctrl.set_margin_liquidation_ctrl(&margin_controller, &true);
        // close factor and liquidation incentive always stage for 60s on the core controller
        ctrl.set_liquidation_incentive(&liquidation_incentive);
        ctrl.set_liquidation_fee(&liquidation_fee);
        g.margin_controller = Some(margin_controller.clone());
        storage::set_group(&env, &g);
        events::MarginEnabled { group_id, margin_controller }.publish(&env);
        Ok(())
    }

    pub fn link_margin_market(
        env: Env,
        caller: Address,
        group_id: u32,
        market: Address,
        margin_controller: Option<Address>,
    ) -> Result<(), FactoryError> {
        require_margin_factory(&env, &caller)?;
        storage::get_group(&env, group_id)?;
        storage::get_market(&env, group_id, &market)?;
        MarketVaultClient::new(&env, &market).set_margin_controller(&env.current_contract_address(), &margin_controller);
        events::MarginLinked { group_id, market, margin_controller }.publish(&env);
        Ok(())
    }

    pub fn update_margin_params(
        env: Env,
        caller: Address,
        group_id: u32,
        liquidation_incentive: u128,
        liquidation_fee: u128,
    ) -> Result<(), FactoryError> {
        require_margin_factory(&env, &caller)?;
        let g = storage::get_group(&env, group_id)?;
        let ctrl = ControllerClient::new(&env, &g.controller);
        ctrl.set_liquidation_incentive(&liquidation_incentive);
        ctrl.set_liquidation_fee(&liquidation_fee);
        events::ParamUpdated { group_id, market: None, param: Symbol::new(&env, "liq_incentive"), old: 0, new: liquidation_incentive }.publish(&env);
        events::ParamUpdated { group_id, market: None, param: Symbol::new(&env, "liq_fee"), old: 0, new: liquidation_fee }.publish(&env);
        Ok(())
    }

    // ------------------------------------------------------------------
    // views
    // ------------------------------------------------------------------

    pub fn get_group(env: Env, group_id: u32) -> Result<Group, FactoryError> {
        storage::get_group(&env, group_id)
    }

    pub fn group_count(env: Env) -> u32 {
        let next: u32 = env.storage().instance().get(&DataKey::NextGroupId).unwrap_or(1);
        next - 1
    }

    pub fn list_groups(env: Env, start: u32, limit: u32) -> Vec<Group> {
        let mut out = Vec::new(&env);
        let last = Self::group_count(env.clone());
        let mut id = if start == 0 { 1 } else { start };
        let limit = if limit > 50 { 50 } else { limit };
        while id <= last && out.len() < limit {
            if let Ok(g) = storage::get_group(&env, id) {
                out.push_back(g);
            }
            id += 1;
        }
        out
    }

    pub fn groups_of(env: Env, owner: Address) -> Vec<u32> {
        storage::owner_groups(&env, &owner)
    }

    pub fn get_market_config(env: Env, group_id: u32, market: Address) -> Result<MarketConfig, FactoryError> {
        Ok(storage::get_market(&env, group_id, &market)?.cfg)
    }

    pub fn get_market_record(env: Env, group_id: u32, market: Address) -> Result<MarketRecord, FactoryError> {
        storage::get_market(&env, group_id, &market)
    }

    pub fn market_token(env: Env, group_id: u32, market: Address) -> Result<Address, FactoryError> {
        Ok(storage::get_market(&env, group_id, &market)?.cfg.token)
    }

    pub fn treasury(env: Env) -> Address {
        env.storage().instance().get(&DataKey::Treasury).unwrap()
    }
}

fn core_upgrade_call(
    env: &Env,
    g: &Group,
    contract: &Address,
    func: &str,
    hash: &BytesN<32>,
) -> Result<(), FactoryError> {
    // only the group's own core contracts: controller, receipt-vaults, jump-rate models
    let known = *contract == g.controller
        || g.markets.contains(contract.clone())
        || is_group_jrm(env, g, contract);
    if !known {
        return Err(FactoryError::MarketNotFound);
    }
    let me = env.current_contract_address();
    let sym = Symbol::new(env, func);
    if *contract == g.controller || g.markets.contains(contract.clone()) {
        env.invoke_contract::<()>(contract, &sym, vec![env, hash.clone().into_val(env)]);
    } else {
        // jump-rate-model takes an explicit admin argument
        env.invoke_contract::<()>(contract, &sym, vec![env, me.into_val(env), hash.clone().into_val(env)]);
    }
    Ok(())
}

fn is_group_jrm(env: &Env, g: &Group, contract: &Address) -> bool {
    for m in g.markets.iter() {
        if let Ok(rec) = storage::get_market(env, g.id, &m) {
            if rec.jump_rate_model == *contract {
                return true;
            }
        }
    }
    false
}
