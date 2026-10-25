//! Curve parameters and their validation. Pure integer code with no host calls, so the launch factory can
//! include this very file (`#[path]`) and apply the identical guardrails when an admin configures a preset.
//!
//! Bounds: every reserve-like amount is at most `MAX_AMOUNT` (1e19 base units). With `k = vq * vt <= 1e38` and
//! `X, Y <= 2e19` all products used by the curve fit in `u128` (max about 3.4e38), so the math is plain checked
//! `u128` with no wide-integer fallback needed.
use soroban_sdk::contracttype;

pub const BPS: u128 = 10_000;
/// Trade fee ceiling: 5%.
pub const MAX_FEE_BPS: u32 = 500;
/// Creator share of the trade fee: at most 50%.
pub const MAX_CREATOR_SHARE_BPS: u32 = 5_000;
/// Creator buy cap as a share of `curve_supply`: at most 20%.
pub const MAX_CREATOR_CAP_BPS: u32 = 2_000;
/// Default creator cap (5% of curve supply) and default trade fee (1%).
pub const DEFAULT_CREATOR_CAP_BPS: u32 = 500;
pub const DEFAULT_TRADE_FEE_BPS: u32 = 100;
/// Upper bound for every reserve, supply and target (base units).
pub const MAX_AMOUNT: i128 = 10_000_000_000_000_000_000; // 1e19

/// Immutable economic parameters of one launch.
///
/// Reserve naming: `virtual_quote` and `virtual_token` are the initial virtual reserves; the curve invariant is
/// `(virtual_quote + real_quote) * (virtual_token - sold) >= k` with `k = virtual_quote * virtual_token`.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CurveParams {
    pub virtual_quote: i128,
    pub virtual_token: i128,
    /// Tokens that can be sold along the curve.
    pub curve_supply: i128,
    /// Tokens reserved for the liquidity pool at graduation (stage 2).
    pub lp_supply: i128,
    /// Real quote (net of fees) at which trading stops and the curve becomes graduatable.
    pub graduation_target: i128,
    pub trade_fee_bps: u32,
    /// Share of each trade fee that accrues to the creator (rest to the treasury), in bps of the fee.
    pub creator_fee_share_bps: u32,
    /// Cumulative creator buy cap in bps of `curve_supply`.
    pub creator_cap_bps: u32,
}

#[derive(Copy, Clone, Debug, Eq, PartialEq)]
pub enum ParamError {
    NonPositive,
    TooLarge,
    CurveSupplyNotBelowVirtual,
    FeeTooHigh,
    CreatorShareTooHigh,
    CreatorCapTooHigh,
    TargetSellsTooMuch,
}

pub fn ceil_div(a: u128, b: u128) -> u128 {
    a / b + u128::from(a % b != 0)
}

/// Maximum tokens sold when `real_quote == graduation_target`: `vt - ceil(k / (vq + target))`.
pub fn sold_at_target(p: &CurveParams) -> Option<u128> {
    let vq = p.virtual_quote as u128;
    let vt = p.virtual_token as u128;
    let k = vq.checked_mul(vt)?;
    let x = vq.checked_add(p.graduation_target as u128)?;
    vt.checked_sub(ceil_div(k, x))
}

pub fn validate(p: &CurveParams) -> Result<(), ParamError> {
    for v in [p.virtual_quote, p.virtual_token, p.curve_supply, p.lp_supply, p.graduation_target] {
        if v <= 0 {
            return Err(ParamError::NonPositive);
        }
        if v > MAX_AMOUNT {
            return Err(ParamError::TooLarge);
        }
    }
    if p.curve_supply >= p.virtual_token {
        return Err(ParamError::CurveSupplyNotBelowVirtual);
    }
    if p.trade_fee_bps > MAX_FEE_BPS {
        return Err(ParamError::FeeTooHigh);
    }
    if p.creator_fee_share_bps > MAX_CREATOR_SHARE_BPS {
        return Err(ParamError::CreatorShareTooHigh);
    }
    if p.creator_cap_bps > MAX_CREATOR_CAP_BPS {
        return Err(ParamError::CreatorCapTooHigh);
    }
    // The curve must never be asked to sell more than `curve_supply` on the way to the target.
    match sold_at_target(p) {
        Some(s) if s <= p.curve_supply as u128 => Ok(()),
        _ => Err(ParamError::TargetSellsTooMuch),
    }
}
