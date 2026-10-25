//! Typed clients for the contracts the margin factory calls. Declared as traits (not Wasm imports)
//! so this contract does not embed other contracts' Wasm. Argument order and types must match the
//! deployed ABI exactly.
use peridot_interfaces::{Group, MarketConfig};
use soroban_sdk::{contractclient, contracttype, Address, BytesN, Env, Vec};

/// Same layout as the controller's `PositionSide` (a `contracttype` enum is encoded by variant name).
#[contracttype]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum PositionSide {
    Long,
    Short,
}

/// market-factory (MF). `wire_margin`, `link_margin_market`, `update_margin_params` are callable
/// only by this contract (the registered margin-factory).
#[contractclient(name = "MarketFactoryClient")]
pub trait MarketFactoryApi {
    fn get_group(env: Env, group_id: u32) -> Group;
    fn get_market_config(env: Env, group_id: u32, market: Address) -> MarketConfig;
    fn market_token(env: Env, group_id: u32, market: Address) -> Address;
    fn wire_margin(
        env: Env,
        caller: Address,
        group_id: u32,
        margin_controller: Address,
        liquidation_incentive: u128,
        liquidation_fee: u128,
    );
    fn link_margin_market(
        env: Env,
        caller: Address,
        group_id: u32,
        market: Address,
        margin_controller: Option<Address>,
    );
    fn update_margin_params(
        env: Env,
        caller: Address,
        group_id: u32,
        liquidation_incentive: u128,
        liquidation_fee: u128,
    );
}

/// Audited `margin-controller` (V3 staged flow). Admin is this factory.
#[contractclient(name = "MarginControllerClient")]
pub trait MarginControllerApi {
    fn initialize(
        env: Env,
        admin: Address,
        peridottroller: Address,
        swap_adapter: Address,
        max_leverage: u128,
    );
    fn set_market(env: Env, admin: Address, asset: Address, vault: Address);
    fn set_params(env: Env, admin: Address, max_leverage: u128);
    fn set_max_slippage_scaled(env: Env, admin: Address, max_slippage_scaled: u128);
    fn set_perps_pair_config(
        env: Env,
        admin: Address,
        margin_asset: Address,
        base_asset: Address,
        side: PositionSide,
        max_leverage: u128,
        maintenance_margin_scaled: u128,
        liquidation_incentive_scaled: u128,
    );
    fn propose_upgrade_wasm(env: Env, admin: Address, new_wasm_hash: BytesN<32>);
    fn upgrade_wasm(env: Env, admin: Address, new_wasm_hash: BytesN<32>);
}

/// Audited `swap-adapter`. Admin is this factory.
#[contractclient(name = "SwapAdapterClient")]
pub trait SwapAdapterApi {
    fn initialize(env: Env, admin: Address, router: Address);
    fn set_pool_allowed(env: Env, admin: Address, pool: Address, allowed: bool);
    fn set_pool_binding(
        env: Env,
        admin: Address,
        pool_id: BytesN<32>,
        pool: Address,
        allowed: bool,
    );
    fn propose_upgrade_wasm(env: Env, admin: Address, new_wasm_hash: BytesN<32>);
    fn upgrade_wasm(env: Env, admin: Address, new_wasm_hash: BytesN<32>);
}

/// Group controller (`simple-peridottroller`) views only.
#[contractclient(name = "GroupControllerClient")]
pub trait GroupControllerApi {
    fn get_market_cf(env: Env, market: Address) -> u128;
    fn get_liquidation_incentive_scaled(env: Env) -> u128;
    fn get_liquidation_fee_scaled(env: Env) -> u128;
}

/// Aquarius-style pool view used to check which tokens a pool trades.
#[contractclient(name = "PoolClient")]
pub trait PoolApi {
    fn get_tokens(env: Env) -> Vec<Address>;
}
