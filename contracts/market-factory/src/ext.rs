//! Minimal client traits for the contracts the factory administers. They are written by hand (not
//! `contractimport!`) so the factory Wasm stays small and does not depend on core build order.
//! Argument types must match the deployed ABI exactly; the integration tests run against the real Wasm.
#![allow(dead_code)]
use soroban_sdk::{contractclient, Address, BytesN, Env, Vec};

#[contractclient(name = "ControllerClient")]
pub trait Controller {
    fn initialize(env: Env, admin: Address);
    fn set_oracle(env: Env, oracle: Address);
    fn get_oracle(env: Env) -> Option<Address>;
    fn add_market(env: Env, market: Address);
    fn set_market_cf(env: Env, market: Address, cf_scaled: u128);
    fn get_market_cf(env: Env, market: Address) -> u128;
    fn set_peridot_token(env: Env, token: Address);
    fn set_supply_speed(env: Env, market: Address, speed_per_sec: u128);
    fn set_borrow_speed(env: Env, market: Address, speed_per_sec: u128);
    fn set_pause_deposit(env: Env, market: Address, paused: bool);
    fn set_pause_borrow(env: Env, market: Address, paused: bool);
    fn set_pause_redeem(env: Env, market: Address, paused: bool);
    fn set_margin_liquidation_ctrl(env: Env, controller: Address, allowed: bool);
    fn set_liquidation_incentive(env: Env, li_scaled: u128);
    fn set_liquidation_fee(env: Env, fee_scaled: u128);
    fn propose_upgrade_wasm(env: Env, new_wasm_hash: BytesN<32>);
    fn upgrade_wasm(env: Env, new_wasm_hash: BytesN<32>);
}

#[contractclient(name = "MarketVaultClient")]
pub trait MarketVault {
    fn initialize(
        env: Env,
        token_address: Address,
        supply_yearly_rate_scaled: u128,
        borrow_yearly_rate_scaled: u128,
        admin: Address,
    );
    fn set_peridottroller(env: Env, peridottroller: Address);
    fn set_interest_model(env: Env, model: Address);
    fn set_reserve_factor(env: Env, reserve_factor_scaled: u128);
    fn set_flash_loan_fee(env: Env, fee_scaled: u128);
    fn set_supply_cap(env: Env, cap: u128);
    fn set_borrow_cap(env: Env, cap: u128);
    fn set_boosted_vault(env: Env, admin: Address, boosted_vault: Address);
    fn get_boosted_vault(env: Env) -> Option<Address>;
    fn set_idle_cash_buffer_bps(env: Env, admin: Address, idle_cash_buffer_bps: u32);
    fn set_margin_controller(env: Env, admin: Address, margin_controller: Option<Address>);
    fn get_underlying_token(env: Env) -> Address;
    fn reduce_reserves(env: Env, amount: u128);
    fn get_total_reserves(env: Env) -> u128;
    fn propose_upgrade_wasm(env: Env, new_wasm_hash: BytesN<32>);
    fn upgrade_wasm(env: Env, new_wasm_hash: BytesN<32>);
}

#[contractclient(name = "RateModelClient")]
pub trait RateModel {
    fn initialize(env: Env, base: u128, multiplier: u128, jump: u128, kink: u128, admin: Address);
    fn set_params(env: Env, admin: Address, base: u128, multiplier: u128, jump: u128, kink: u128);
    fn propose_upgrade_wasm(env: Env, admin: Address, new_wasm_hash: BytesN<32>);
    fn upgrade_wasm(env: Env, admin: Address, new_wasm_hash: BytesN<32>);
}

/// DeFindex vault (partner protocol). Only the read calls the factory needs for validation.
#[contractclient(name = "DefindexVaultClient")]
pub trait DefindexVault {
    fn get_asset_amounts_per_shares(env: Env, vault_shares: i128) -> Vec<i128>;
    fn get_assets(env: Env) -> Vec<DefindexAssetStrategySet>;
}

#[soroban_sdk::contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct DefindexStrategy {
    pub address: Address,
    pub name: soroban_sdk::String,
    pub paused: bool,
}

#[soroban_sdk::contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct DefindexAssetStrategySet {
    pub address: Address,
    pub strategies: Vec<DefindexStrategy>,
}

/// SEP-41 read used to validate reward tokens and market underlyings.
#[contractclient(name = "TokenReadClient")]
pub trait TokenRead {
    fn decimals(env: Env) -> u32;
    fn symbol(env: Env) -> soroban_sdk::String;
}

/// Blend fee vault (script3/fee-vault): only the pool getter the adapter constructor checks against.
#[contractclient(name = "FeeVaultReadClient")]
pub trait FeeVaultRead {
    fn get_pool(env: Env) -> Address;
}

/// The launchpad factory: tells the market factory whether an address is a curve it deployed.
#[contractclient(name = "LaunchpadViewClient")]
pub trait LaunchpadView {
    fn is_curve(env: Env, curve: Address) -> bool;
}
