use soroban_sdk::{contractevent, Address, BytesN, Symbol};

use peridot_interfaces::{KeeperMode, PriceConfig};

#[contractevent(topics = ["group_created"])]
pub struct GroupCreated {
    #[topic]
    pub group_id: u32,
    pub owner: Address,
    pub name: Symbol,
    pub controller: Address,
    pub price_router: Address,
}

#[contractevent(topics = ["market_added"])]
pub struct MarketAdded {
    #[topic]
    pub group_id: u32,
    pub market: Address,
    pub token: Address,
    pub jump_rate_model: Address,
}

#[contractevent(topics = ["market_activated"])]
pub struct MarketActivated {
    #[topic]
    pub group_id: u32,
    pub market: Address,
}

#[contractevent(topics = ["yield_attached"])]
pub struct YieldAttached {
    #[topic]
    pub group_id: u32,
    pub market: Address,
    pub boosted_vault: Address,
    pub adapter: Option<Address>,
}

#[contractevent(topics = ["rewards_set"])]
pub struct RewardsSet {
    #[topic]
    pub group_id: u32,
    pub distributor: Address,
    pub reward_token: Address,
}

#[contractevent(topics = ["reward_speed_set"])]
pub struct RewardSpeedSet {
    #[topic]
    pub group_id: u32,
    pub market: Address,
    pub supply_per_sec: u128,
    pub borrow_per_sec: u128,
}

#[contractevent(topics = ["margin_enabled"])]
pub struct MarginEnabled {
    #[topic]
    pub group_id: u32,
    pub margin_controller: Address,
}

#[contractevent(topics = ["margin_linked"])]
pub struct MarginLinked {
    #[topic]
    pub group_id: u32,
    pub market: Address,
    pub margin_controller: Option<Address>,
}

/// `param` is a short name ("cf", "supply_cap", "borrow_cap", "reserve_factor", "rates",
/// "idle_buffer", "pause_deposit", "pause_borrow", "liq_incentive", "liq_fee", ...); values are
/// the decimal numbers as u128 (booleans as 0/1).
#[contractevent(topics = ["param_updated"])]
pub struct ParamUpdated {
    #[topic]
    pub group_id: u32,
    pub market: Option<Address>,
    pub param: Symbol,
    pub old: u128,
    pub new: u128,
}

#[contractevent(topics = ["price_staged"])]
pub struct PriceStaged {
    #[topic]
    pub group_id: u32,
    pub market: Address,
    pub config: PriceConfig,
    pub execute_after: u64,
}

#[contractevent(topics = ["price_applied"])]
pub struct PriceApplied {
    #[topic]
    pub group_id: u32,
    pub market: Address,
    pub config: PriceConfig,
}

#[contractevent(topics = ["cf_staged"])]
pub struct CfStaged {
    #[topic]
    pub group_id: u32,
    pub market: Address,
    pub cf: u128,
    pub execute_after: u64,
}

#[contractevent(topics = ["keeper_mode_set"])]
pub struct KeeperModeSet {
    #[topic]
    pub group_id: u32,
    pub mode: KeeperMode,
}

#[contractevent(topics = ["ownership_transferred"])]
pub struct OwnershipTransferred {
    #[topic]
    pub group_id: u32,
    pub old_owner: Address,
    pub new_owner: Address,
}

#[contractevent(topics = ["upgraded"])]
pub struct Upgraded {
    pub contract: Address,
    pub wasm_hash: BytesN<32>,
}

#[contractevent(topics = ["core_upgrade_proposed"])]
pub struct CoreUpgradeProposed {
    #[topic]
    pub group_id: u32,
    pub contract: Address,
    pub wasm_hash: BytesN<32>,
}
