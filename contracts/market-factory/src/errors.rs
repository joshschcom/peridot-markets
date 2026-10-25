use soroban_sdk::contracterror;

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum FactoryError {
    NotAdmin = 1,
    NotOwner = 2,
    WasmNotSet = 3,
    GroupNotFound = 4,
    MarketNotFound = 5,
    MarketAlreadyExists = 6,
    CreatorNotAllowed = 7,
    MarketAlreadyActive = 10,
    MarketNotActive = 11,
    MarginFactoryNotSet = 8,
    NotMarginFactory = 9,
    // guardrails
    CollateralFactorTooHigh = 20,
    CollateralFactorTooLow = 21,
    CapRequired = 22,
    IdleBufferOutOfRange = 23,
    ReserveFactorTooHigh = 24,
    RatesOutOfRange = 25,
    PriceModeNotAllowed = 26,
    OracleNotAllowed = 27,
    RewardSpeedTooHigh = 28,
    TooManyMarkets = 29,
    InvalidRoute = 30,
    MarginNotAllowedForMode = 31,
    // flows
    RewardsAlreadySet = 40,
    RewardsNotSet = 41,
    YieldAlreadyAttached = 42,
    NothingPending = 43,
    NotYetApplicable = 44,
    InvalidToken = 45,
    InvalidYieldVault = 46,
    YieldVaultNotAllowed = 49,
    Unsupported = 47,
    BadArgument = 48,
}
