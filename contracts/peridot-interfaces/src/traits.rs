//! Contract client traits. `#[contractclient]` generates a `*Client` for each,
//! so any crate can call a contract through the shared interface.
use soroban_sdk::{contractclient, Address, BytesN, Env, Symbol, Vec};

use crate::reflector::{Asset, PriceData};
use crate::types::{PriceCheck, PriceConfig, VaultState};

/// 6.1 Implemented by every vault adapter. DeFindex vaults match the first four calls.
///
/// The receipt-vault pre-authorizes exactly `token.transfer(from = market, to = this, amount)`
/// on `deposit`, so pull with exactly that call. On `withdraw` it authorizes this call as a
/// sub-invocation: `from.require_auth()`, burn, pay underlying to `from`.
#[contractclient(name = "YieldVaultClient")]
pub trait YieldVault {
    /// SEP-41 share balance.
    fn balance(env: Env, id: Address) -> i128;
    fn deposit(
        env: Env,
        amounts_desired: Vec<i128>,
        amounts_min: Vec<i128>,
        from: Address,
        invest: bool,
    ) -> Vec<i128>;
    fn withdraw(env: Env, shares: i128, min_amounts_out: Vec<i128>, from: Address) -> Vec<i128>;
    /// `[underlying]`, never panics.
    fn get_asset_amounts_per_shares(env: Env, shares: i128) -> Vec<i128>;

    // Peridot extensions
    fn underlying(env: Env) -> Address;
    fn kind(env: Env) -> Symbol;
    fn market(env: Env) -> Address;
    fn get_state(env: Env) -> VaultState;
    /// Returns 0 if nothing to harvest.
    fn harvest(env: Env, keeper: Address, min_out: i128) -> i128;
    fn set_keeper(env: Env, admin: Address, keeper: Address);
    fn pause(env: Env, admin: Address, paused: bool);
    /// Immediate, no timelock.
    fn upgrade(env: Env, admin: Address, new_wasm_hash: BytesN<32>);
}

/// 6.2 Reflector subset the controller calls, plus Peridot configuration.
#[contractclient(name = "PriceRouterClient")]
pub trait PriceRouter {
    fn decimals(env: Env) -> u32;
    fn resolution(env: Env) -> u32;
    fn lastprice(env: Env, asset: Asset) -> Option<PriceData>;
    fn set_asset_config(env: Env, admin: Address, token: Address, cfg: PriceConfig);
    fn get_asset_config(env: Env, token: Address) -> Option<PriceConfig>;
    /// Never panics; for the UI.
    fn check(env: Env, token: Address) -> PriceCheck;
    fn upgrade(env: Env, admin: Address, new_wasm_hash: BytesN<32>);
}

/// 6.3 Registered as the controller's reward token (`set_peridot_token`).
/// The controller calls `mint(to, amount)` in `claim`; the distributor pays the real token.
#[contractclient(name = "RewardDistributorClient")]
pub trait RewardDistributor {
    /// Callable only by the group controller. Pays exactly `amount` or fails.
    fn mint(env: Env, to: Address, amount: i128);
    /// Anyone, typically the owner.
    fn fund(env: Env, from: Address, amount: i128);
    fn withdraw_unallocated(env: Env, admin: Address, to: Address, amount: i128);
    fn reward_token(env: Env) -> Address;
    fn controller(env: Env) -> Address;
    fn balance_available(env: Env) -> i128;
    fn total_paid(env: Env) -> i128;
    fn upgrade(env: Env, admin: Address, new_wasm_hash: BytesN<32>);
    // SEP-41 read compatibility, forwarded to the reward token.
    fn decimals(env: Env) -> u32;
    fn symbol(env: Env) -> soroban_sdk::String;
    fn name(env: Env) -> soroban_sdk::String;
}
