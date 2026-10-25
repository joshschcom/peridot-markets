use peridot_interfaces::PriceConfig;
use soroban_sdk::{contracttype, Address, BytesN};

use crate::params::CurveParams;

/// Lifecycle: `Trading -> Graduatable -> Graduating -> Graduated`.
/// - `Graduatable` is STICKY: it is entered once `real_quote` reaches the target and never left. Buys are
///   closed from then on; sells keep working until the first graduation step.
/// - `Graduating` starts with the first graduation step (the pool step). All trading is closed.
/// - `Graduated` is terminal (the last market step ran).
/// `Graduating = 3` keeps the stage 1 numbering (`Graduated = 2`) stable for existing readers.
#[contracttype]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum Phase {
    Trading = 0,
    Graduatable = 1,
    Graduated = 2,
    Graduating = 3,
}

/// Where the graduated liquidity lives. Extension point only: `Aquarius` is the single implemented venue
/// (standard constant-product pool, 30 bps).
#[contracttype]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum GraduationVenue {
    Aquarius = 0,
}

/// Immutable graduation wiring, chosen by the launch factory at deployment.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct GraduationConfig {
    pub venue: GraduationVenue,
    /// Aquarius AMM router.
    pub router: Address,
    /// Peridot market factory (the curve becomes the owner of the new group until `claim_group`).
    pub market_factory: Address,
    /// Price config of the QUOTE asset market (a `ReflectorOnly` mapping the market factory has approved).
    pub quote_price: PriceConfig,
}

/// Steps of the permissionless `graduate` state machine. Each call performs the NEXT step.
#[contracttype]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum GradStep {
    NotStarted = 0,
    /// Pool created and seeded, LP shares burned, unsold curve tokens burned.
    PoolCreated = 1,
    /// Market group created (the curve is its owner).
    GroupCreated = 2,
    QuoteMarketAdded = 3,
    QuoteMarketActivated = 4,
    TokenMarketAdded = 5,
    /// Token market activated: graduation is complete.
    Graduated = 6,
}

/// Facts recorded by the graduation steps.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Graduation {
    pub step: GradStep,
    pub pool: Address,
    pub pool_index: BytesN<32>,
    pub share_token: Address,
    /// Quote and token amounts seeded into the pool.
    pub quote_in_pool: i128,
    pub token_in_pool: i128,
    pub lp_shares_burned: i128,
    pub unsold_burned: i128,
    /// Valid from `GroupCreated`.
    pub group_id: u32,
    pub quote_market: Option<Address>,
    pub token_market: Option<Address>,
    /// True once the creator took the group with `claim_group`.
    pub claimed: bool,
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
    pub graduation: GraduationConfig,
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
