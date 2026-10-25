//! Pure curve math. Every function is checked (`None` on overflow) and rounds in favour of the curve.
//!
//! Notation: `x = virtual_quote + real_quote`, `y = virtual_token - sold`, `k = virtual_quote * virtual_token`.
//! The state always satisfies `x * y >= k`. Buys set `y' = ceil(k / x')`, sells set `x' = ceil(k / y')`, so the
//! curve never pays out more than the closed form of the constant-product curve.
use crate::params::{ceil_div, BPS};

#[derive(Copy, Clone, Debug, Eq, PartialEq)]
pub struct BuyCalc {
    /// Quote actually charged (equals the requested amount unless the buy was clamped at the target).
    pub gross: u128,
    pub fee: u128,
    /// `gross - fee`, added to `real_quote`.
    pub net: u128,
    pub tokens_out: u128,
    pub clamped: bool,
}

#[derive(Copy, Clone, Debug, Eq, PartialEq)]
pub struct SellCalc {
    /// Quote leaving the curve reserves (`real_quote` decreases by this).
    pub gross: u128,
    pub fee: u128,
    /// `gross - fee`, paid to the seller.
    pub quote_out: u128,
}

pub fn fee_of(amount: u128, bps: u128) -> Option<u128> {
    Some(ceil_div(amount.checked_mul(bps)?, BPS))
}

/// Smallest gross amount whose net (after the ceil fee) is at least `needed`.
pub fn gross_for_net(needed: u128, fee_bps: u128) -> Option<u128> {
    Some(ceil_div(needed.checked_mul(BPS)?, BPS.checked_sub(fee_bps)?))
}

/// Quote a buy. `needed` is `graduation_target - real_quote` (must be positive).
/// Returns `None` on overflow or when the trade is too small to yield a positive net or output.
pub fn buy(
    k: u128,
    x: u128,
    y: u128,
    needed: u128,
    quote_in: u128,
    fee_bps: u128,
) -> Option<BuyCalc> {
    let gross_cap = gross_for_net(needed, fee_bps)?;
    let (gross, clamped) = if quote_in > gross_cap { (gross_cap, true) } else { (quote_in, false) };
    let fee = fee_of(gross, fee_bps)?;
    let net = gross.checked_sub(fee)?;
    if net == 0 || net > needed {
        return None;
    }
    let y_new = ceil_div(k, x.checked_add(net)?);
    let tokens_out = y.checked_sub(y_new)?;
    if tokens_out == 0 {
        return None;
    }
    Some(BuyCalc { gross, fee, net, tokens_out, clamped })
}

/// Quote a sell of `tokens_in`. Caller guarantees `tokens_in <= sold`, so `y + tokens_in <= virtual_token`.
pub fn sell(k: u128, x: u128, y: u128, tokens_in: u128, fee_bps: u128) -> Option<SellCalc> {
    let x_new = ceil_div(k, y.checked_add(tokens_in)?);
    let gross = x.checked_sub(x_new)?;
    if gross == 0 {
        return None;
    }
    let fee = fee_of(gross, fee_bps)?;
    let quote_out = gross.checked_sub(fee)?;
    if quote_out == 0 {
        return None;
    }
    Some(SellCalc { gross, fee, quote_out })
}
