use peridot_interfaces::{Group, MarketConfig, PriceConfig, WasmHashes};
use soroban_sdk::{contracttype, Address, Env, Vec};

use crate::errors::FactoryError;

const TTL_THRESHOLD: u32 = 100_000; // below testnet's 120_960 default so creation never bumps
const TTL_EXTEND_TO: u32 = 400_000;

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Admin,
    Treasury,
    MarginFactory,
    Wasm,
    AllowlistMode,
    CreatorAllowed(Address),
    OracleAllowed(Address),
    YieldVaultAllowed(Address),
    PriceFeedAllowed(Address, Address, peridot_interfaces::Asset),
    NextGroupId,
    Group(u32),
    GroupNonce(u32),
    OwnerGroups(Address),
    Market(u32, Address),
    TokenMarket(u32, Address),
    PendingCount(u32),
}

/// Everything the factory remembers about a market beyond the group's `markets` list.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct MarketRecord {
    /// Applied configuration (`collateral_factor` is the value live on the controller).
    pub cfg: MarketConfig,
    pub jump_rate_model: Address,
    /// False between `add_market` and `activate_market`.
    pub active: bool,
    pub boosted_vault: Option<Address>,
    /// Adapter contract deployed by the factory for the yield route (None for DeFindex or no route).
    pub adapter: Option<Address>,
    pub created_at: u64,
    /// At most one staged CF change (a Vec because optional structs do not round-trip in SDK test builds).
    pub pending_cf: Vec<PendingCf>,
    /// At most one staged price change.
    pub pending_price: Vec<PendingPrice>,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PendingCf {
    pub cf: u128,
    pub execute_after: u64,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PendingPrice {
    pub config: PriceConfig,
    pub execute_after: u64,
}

pub fn bump_instance(env: &Env) {
    env.storage().instance().extend_ttl(TTL_THRESHOLD, TTL_EXTEND_TO);
}

pub fn admin(env: &Env) -> Address {
    bump_instance(env);
    env.storage().instance().get(&DataKey::Admin).unwrap()
}

pub fn wasm(env: &Env) -> Result<WasmHashes, FactoryError> {
    bump_instance(env);
    env.storage().instance().get(&DataKey::Wasm).ok_or(FactoryError::WasmNotSet)
}

pub fn get_group(env: &Env, id: u32) -> Result<Group, FactoryError> {
    let key = DataKey::Group(id);
    let g: Group = env.storage().persistent().get(&key).ok_or(FactoryError::GroupNotFound)?;
    env.storage().persistent().extend_ttl(&key, TTL_THRESHOLD, TTL_EXTEND_TO);
    Ok(g)
}

pub fn set_group(env: &Env, g: &Group) {
    let key = DataKey::Group(g.id);
    env.storage().persistent().set(&key, g);
    env.storage().persistent().extend_ttl(&key, TTL_THRESHOLD, TTL_EXTEND_TO);
}

pub fn get_market(env: &Env, group_id: u32, market: &Address) -> Result<MarketRecord, FactoryError> {
    let key = DataKey::Market(group_id, market.clone());
    let m: MarketRecord = env.storage().persistent().get(&key).ok_or(FactoryError::MarketNotFound)?;
    env.storage().persistent().extend_ttl(&key, TTL_THRESHOLD, TTL_EXTEND_TO);
    Ok(m)
}

pub fn set_market(env: &Env, group_id: u32, market: &Address, rec: &MarketRecord) {
    let key = DataKey::Market(group_id, market.clone());
    env.storage().persistent().set(&key, rec);
    env.storage().persistent().extend_ttl(&key, TTL_THRESHOLD, TTL_EXTEND_TO);
}

pub fn owner_groups(env: &Env, owner: &Address) -> Vec<u32> {
    let key = DataKey::OwnerGroups(owner.clone());
    let v: Vec<u32> = env.storage().persistent().get(&key).unwrap_or(Vec::new(env));
    if env.storage().persistent().has(&key) {
        env.storage().persistent().extend_ttl(&key, TTL_THRESHOLD, TTL_EXTEND_TO);
    }
    v
}

pub fn set_owner_groups(env: &Env, owner: &Address, v: &Vec<u32>) {
    let key = DataKey::OwnerGroups(owner.clone());
    env.storage().persistent().set(&key, v);
    env.storage().persistent().extend_ttl(&key, TTL_THRESHOLD, TTL_EXTEND_TO);
}

/// Per-group deploy counter, used in salts so every deployment gets a unique address.
pub fn next_nonce(env: &Env, group_id: u32) -> u32 {
    let key = DataKey::GroupNonce(group_id);
    let n: u32 = env.storage().persistent().get(&key).unwrap_or(0);
    env.storage().persistent().set(&key, &(n + 1));
    env.storage().persistent().extend_ttl(&key, TTL_THRESHOLD, TTL_EXTEND_TO);
    n
}

pub fn token_market(env: &Env, group_id: u32, token: &Address) -> Option<Address> {
    env.storage().persistent().get(&DataKey::TokenMarket(group_id, token.clone()))
}

pub fn set_token_market(env: &Env, group_id: u32, token: &Address, market: &Address) {
    let key = DataKey::TokenMarket(group_id, token.clone());
    env.storage().persistent().set(&key, market);
    env.storage().persistent().extend_ttl(&key, TTL_THRESHOLD, TTL_EXTEND_TO);
}

/// Markets added but not yet activated (counts toward the per-group market limit).
pub fn pending_count(env: &Env, group_id: u32) -> u32 {
    env.storage().persistent().get(&DataKey::PendingCount(group_id)).unwrap_or(0)
}

pub fn bump_pending(env: &Env, group_id: u32, delta: i32) {
    let key = DataKey::PendingCount(group_id);
    let n = pending_count(env, group_id) as i32 + delta;
    env.storage().persistent().set(&key, &(if n < 0 { 0 } else { n as u32 }));
    env.storage().persistent().extend_ttl(&key, TTL_THRESHOLD, TTL_EXTEND_TO);
}
