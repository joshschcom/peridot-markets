use soroban_sdk::{contracttype, Address, Symbol};

use crate::reflector::Asset;

/// 6.1 State snapshot every YieldVault adapter reports.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct VaultState {
    pub kind: Symbol,
    pub underlying: Address,
    pub total_shares: i128,
    pub total_value: i128,
    pub principal: i128,
    pub reserve: i128,
    pub last_harvest_ts: u64,
    pub last_harvest_amount: i128,
    pub apy_hint_bps: u32,
    pub paused: bool,
}

/// 6.2 Payloads of [`PriceConfig`]. `#[contracttype]` enums allow only unit and tuple
/// variants, so the named fields of the handoff sketch live in these structs.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ReflectorOnlyCfg {
    pub oracle: Address,
    pub asset: Asset,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ReflectorGuardCfg {
    pub oracle: Address,
    pub asset: Asset,
    pub pool: Address,
    pub quote_token: Address,
    pub max_dev_bps: u32,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AquariusOnlyCfg {
    pub pool: Address,
    pub quote_token: Address,
}

/// 6.2 Per-token price derivation mode of the group price router.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum PriceConfig {
    /// Phase 1.
    ReflectorOnly(ReflectorOnlyCfg),
    /// Phase 3.
    ReflectorWithAquariusGuard(ReflectorGuardCfg),
    /// Phase 3, restricted (lower CF, no margin).
    AquariusOnly(AquariusOnlyCfg),
}

/// `status` is one of "ok" | "stale" | "deviation" | "unavailable".
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PriceCheck {
    pub mode: Symbol,
    pub reflector_price: Option<i128>,
    pub aquarius_price: Option<i128>,
    pub deviation_bps: Option<u32>,
    pub status: Symbol,
    pub timestamp: u64,
}
