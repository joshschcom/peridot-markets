use soroban_sdk::contracterror;

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum CurveError {
    // constructor parameter validation
    NonPositiveParam = 1,
    ParamTooLarge = 2,
    CurveSupplyNotBelowVirtual = 3,
    FeeTooHigh = 4,
    CreatorShareTooHigh = 5,
    CreatorCapTooHigh = 6,
    TargetSellsTooMuch = 7,
    SameTokens = 8,
    CurveNotFunded = 9,
    // trading
    InvalidAmount = 10,
    /// `min_*_out` must be positive: a zero bound is no bound.
    InvalidSlippageBound = 11,
    SlippageExceeded = 12,
    TradingClosed = 13,
    /// The trade is too small: it rounds to zero tokens or zero quote.
    DustTrade = 14,
    CreatorCapExceeded = 15,
    ExceedsSold = 16,
    Overflow = 17,
    // admin and lifecycle
    NotFactory = 18,
    NotGraduatable = 19,
    NotImplemented = 20,
}
