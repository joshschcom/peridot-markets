use peridot_interfaces::PriceConfig;
use soroban_sdk::{contractevent, Address, BytesN, String};

use crate::types::Preset;

#[contractevent(topics = ["launched"])]
pub struct Launched {
    #[topic]
    pub id: u32,
    #[topic]
    pub creator: Address,
    pub token: Address,
    pub curve: Address,
    pub quote_token: Address,
    pub preset: Preset,
}

#[contractevent(topics = ["wasm_set"])]
pub struct WasmSet {
    pub token_hash: BytesN<32>,
    pub curve_hash: BytesN<32>,
}

#[contractevent(topics = ["preset_set"])]
pub struct PresetSet {
    #[topic]
    pub quote_token: Address,
    pub preset: Preset,
    pub enabled: bool,
}

#[contractevent(topics = ["launch_fee_set"])]
pub struct LaunchFeeSet {
    pub fee_token: Address,
    pub amount: i128,
}

#[contractevent(topics = ["paused"])]
pub struct PausedSet {
    pub paused: bool,
}

#[contractevent(topics = ["admin_set"])]
pub struct AdminSet {
    pub admin: Address,
}

#[contractevent(topics = ["treasury_set"])]
pub struct TreasurySet {
    pub treasury: Address,
}

#[contractevent(topics = ["upgraded"])]
pub struct Upgraded {
    pub wasm_hash: BytesN<32>,
}

#[contractevent(topics = ["launch_upgraded"])]
pub struct LaunchUpgraded {
    #[topic]
    pub curve: Address,
    pub wasm_hash: BytesN<32>,
}

#[contractevent(topics = ["graduation_set"])]
pub struct GraduationSet {
    pub router: Address,
    pub market_factory: Address,
}

#[contractevent(topics = ["quote_price_set"])]
pub struct QuotePriceSet {
    #[topic]
    pub quote_token: Address,
    pub price: PriceConfig,
}

#[contractevent(topics = ["plain_token_created"])]
pub struct PlainTokenCreated {
    #[topic]
    pub id: u32,
    #[topic]
    pub creator: Address,
    pub token: Address,
    pub symbol: String,
    pub supply: i128,
}
