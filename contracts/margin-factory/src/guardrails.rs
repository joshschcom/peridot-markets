//! Guardrails enforced by the margin factory (shown in the UI and in docs/SPECS.md "Margin").
//! All ratios are 1e6 scaled unless noted.

/// Group-wide max leverage (integer multiple). The audited controller itself allows up to 10.
pub const MIN_GROUP_LEVERAGE: u128 = 1;
pub const MAX_GROUP_LEVERAGE: u128 = 5;

/// Group controller liquidation incentive (1.02 to 1.10). Staged for 60s on the controller. The V3 margin
/// controller pays liquidators the pair incentive, capped at 10%, so 1.10 is the highest value that is honoured end to end.
pub const MIN_LIQUIDATION_INCENTIVE: u128 = 1_020_000;
pub const MAX_LIQUIDATION_INCENTIVE: u128 = 1_100_000;

/// Max swap slippage for margin opens (10%). The audited controller caps at 50%.
pub const MAX_SLIPPAGE: u128 = 100_000;

/// Protocol share of liquidations on the group controller (immediate). The controller allows up
/// to 100%; the factory caps it so a group cannot be configured to starve liquidators.
pub const MAX_LIQUIDATION_FEE: u128 = 500_000;

/// Maintenance margin used for every margin pair (5% of notional, the audited default).
/// A position is liquidatable when equity falls below this share of its current notional.
pub const MAINTENANCE_MARGIN: u128 = 50_000;

/// The V3 controller pays liquidators `liquidation_incentive_scaled` per trading pair, capped at
/// 10% (`MAX_PERPS_LIQUIDATION_INCENTIVE_SCALED`). The factory maps the group incentive `1.0x` to
/// a pair incentive of `x`, clamped here.
pub const MAX_PAIR_LIQUIDATION_INCENTIVE: u128 = 100_000;

/// The controller keeps at most 32 (margin asset, base asset, side) pair configs. With two sides
/// that allows 4 distinct margin markets per group (4 * 3 * 2 = 24; 5 would need 40).
pub const MAX_MARGIN_MARKETS: u32 = 4;

/// Pools tracked per group in the factory (the adapter itself allows 64).
pub const MAX_POOLS: u32 = 8;

/// Seconds the group controller stages `close factor` and `liquidation incentive` changes.
pub const STAGE_DELAY_SECS: u64 = 60;

/// The audited controller only supports 7-decimal underlyings.
pub const REQUIRED_UNDERLYING_DECIMALS: u32 = 7;

pub const SCALE: u128 = 1_000_000;

pub const TTL_THRESHOLD: u32 = 500_000;
pub const TTL_EXTEND_TO: u32 = 1_000_000;
