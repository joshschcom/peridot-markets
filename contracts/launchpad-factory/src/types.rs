use soroban_sdk::{contracttype, Address, String};

/// Graduation-speed presets. The numbers behind a preset are configured per quote token by the admin
/// (`set_preset` / `set_default_presets`) and pass the same guardrails as the curve constructor.
#[contracttype]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum Preset {
    /// Lowest graduation target.
    Fast = 0,
    Standard = 1,
    /// Highest graduation target.
    Slow = 2,
}

/// What a creator chooses. Everything else comes from the preset.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct LaunchParams {
    pub quote_token: Address,
    pub preset: Preset,
    /// Optional image or metadata URI; empty string for none.
    pub metadata_uri: String,
    /// Optional atomic first buy by the creator, in quote (0 = none). Counts against the creator cap.
    pub creator_buy: i128,
    /// Slippage bound for `creator_buy` (must be positive when `creator_buy > 0`).
    pub min_tokens_out: i128,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct LaunchInfo {
    pub id: u32,
    pub token: Address,
    pub curve: Address,
    pub creator: Address,
    pub quote_token: Address,
    pub preset: Preset,
    pub name: String,
    pub symbol: String,
    pub created_at: u64,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct FactoryConfig {
    pub admin: Address,
    pub treasury: Address,
    pub paused: bool,
    pub wasm_set: bool,
    pub fee_token: Option<Address>,
    pub launch_fee: i128,
    pub launch_count: u32,
}
