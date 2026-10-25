use soroban_sdk::{contracttype, Address};

use crate::params::CurveParams;

/// Lifecycle: `Trading -> Graduatable -> Graduated`. `Graduatable` is derived from `real_quote` and can fall
/// back to `Trading` if a sell lowers `real_quote` below the target before anyone graduates (see SPECS).
/// `Graduated` is terminal and only reachable by the stage 2 `graduate` implementation.
#[contracttype]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum Phase {
    Trading = 0,
    Graduatable = 1,
    Graduated = 2,
}

/// Immutable configuration, written once by the constructor.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Config {
    pub token: Address,
    pub quote_token: Address,
    pub creator: Address,
    /// The launch factory: the only address that may call `upgrade`.
    pub factory: Address,
    pub treasury: Address,
    pub params: CurveParams,
    /// `virtual_quote * virtual_token`.
    pub k: u128,
}

/// Mutable state.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct State {
    pub real_quote: i128,
    pub sold: i128,
    /// Cumulative tokens bought by the creator address (sells do not reduce it).
    pub creator_bought: i128,
    pub fees_treasury: i128,
    pub fees_creator: i128,
    pub phase: Phase,
}

/// Read model for the app.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CurveInfo {
    pub phase: Phase,
    /// Marginal price: quote base units per token base unit, scaled by 1e7.
    pub price: i128,
    /// `real_quote / graduation_target` in bps, capped at 10_000.
    pub progress_bps: u32,
    pub real_quote: i128,
    pub sold: i128,
    pub tokens_remaining: i128,
    pub virtual_quote: i128,
    pub virtual_token: i128,
    pub graduation_target: i128,
    /// Fully diluted value in quote: `price * (curve_supply + lp_supply) / 1e7`.
    pub fully_diluted_value: i128,
    pub creator_bought: i128,
    pub creator_cap: i128,
    pub fees_treasury_pending: i128,
    pub fees_creator_pending: i128,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct BuyQuote {
    /// Quote that would be charged (less than requested when clamped).
    pub quote_spent: i128,
    pub fee: i128,
    pub tokens_out: i128,
    pub clamped: bool,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct SellQuote {
    pub gross_quote: i128,
    pub fee: i128,
    pub quote_out: i128,
}
