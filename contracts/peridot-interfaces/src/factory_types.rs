use soroban_sdk::{contracttype, Address, BytesN, Symbol, Vec};

use crate::types::PriceConfig;

/// 6.4 Interest curve in core `jump-rate-model` units. All zeros is valid (0% borrow).
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RateModel {
    pub base: u128,
    pub multiplier: u128,
    pub jump: u128,
    pub kink: u128,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct DefindexRoute {
    pub vault: Address,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct BlendRoute {
    /// The Peridot-administered Blend fee vault.
    pub fee_vault: Address,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AquariusRoute {
    pub pool: Address,
    pub pair_token: Address,
    pub reserve_cut_bps: u32,
    pub reserve_cap_bps: u32,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ZenexRoute {
    pub market: Address,
    pub vault: Address,
    pub target_buffer_bps: u32,
    pub min_buffer_bps: u32,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct XoxnoRoute {
    pub hub_id: u32,
    pub spoke_id: u32,
}

/// Tuple variants with payload structs (see `PriceConfig`).
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum YieldRoute {
    None,
    /// Phase 1. Attached directly, no adapter.
    Defindex(DefindexRoute),
    /// Phase 1.
    Blend(BlendRoute),
    /// Phase 2.
    Aquarius(AquariusRoute),
    /// Phase 3, USDC only, async (10-VAULT-ZENEX.md).
    Zenex(ZenexRoute),
    /// Phase 4.
    Xoxno(XoxnoRoute),
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct MarketConfig {
    pub token: Address,
    /// 1e6 scale.
    pub collateral_factor: u128,
    /// Both must be > 0.
    pub supply_cap: u128,
    pub borrow_cap: u128,
    /// 1e6 scale.
    pub reserve_factor: u128,
    pub rates: RateModel,
    pub idle_buffer_bps: u32,
    pub yield_route: YieldRoute,
    pub price: PriceConfig,
    pub margin_enabled: bool,
    /// Reward token base units per second; 0 if no rewards.
    pub supply_reward_per_sec: u128,
    pub borrow_reward_per_sec: u128,
}

#[contracttype]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum MarginVariant {
    Audited,
    /// Phase 3.
    Custom,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct GroupMarginConfig {
    pub variant: MarginVariant,
    /// 1..=5 per group; Custom adds per-asset caps.
    pub max_leverage: u128,
    /// 1e6 scale, at most 10%.
    pub max_slippage: u128,
    /// 1e6 scale, 1_020_000..=1_150_000.
    pub liquidation_incentive: u128,
    /// 1e6 scale, protocol share.
    pub liquidation_fee: u128,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct MarginInfo {
    pub controller: Address,
    pub swap_adapter: Address,
    pub variant: MarginVariant,
    pub cfg: GroupMarginConfig,
    pub enabled_markets: Vec<Address>,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum KeeperMode {
    None,
    PeridotHosted,
    SelfHosted(Address),
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Group {
    pub id: u32,
    pub owner: Address,
    pub name: Symbol,
    pub controller: Address,
    pub price_router: Address,
    pub reward_distributor: Option<Address>,
    pub margin_controller: Option<Address>,
    pub markets: Vec<Address>,
    pub created_at: u64,
    pub keeper_mode: KeeperMode,
    pub keeper_paid_until: u64,
}

/// Wasm hashes the factory deploys with `deploy_v2`. Phase 1 fields are required,
/// later phases are optional until their contracts exist.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct WasmHashes {
    pub controller: BytesN<32>,
    pub receipt_vault: BytesN<32>,
    pub jump_rate: BytesN<32>,
    pub price_router: BytesN<32>,
    pub reward_distributor: BytesN<32>,
    pub blend_adapter: Option<BytesN<32>>,
    pub aquarius_vault: Option<BytesN<32>>,
    pub aquarius_reserve: Option<BytesN<32>>,
    pub zenex_adapter: Option<BytesN<32>>,
    pub xoxno_adapter: Option<BytesN<32>>,
}

/// Wasm hashes the margin factory deploys per group. Built with INIT_ADMIN = margin-factory address.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct MarginWasmHashes {
    pub audited: BytesN<32>,
    /// Phase 3.
    pub custom: Option<BytesN<32>>,
    pub swap_adapter: BytesN<32>,
}

/// Constructor config of the Blend vault adapter. `blend_pool` must equal `fee_vault.get_pool()`; the factory reads it.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct BlendAdapterConfig {
    pub fee_vault: Address,
    pub blend_pool: Address,
}
