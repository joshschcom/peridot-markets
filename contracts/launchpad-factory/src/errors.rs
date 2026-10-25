use soroban_sdk::contracterror;

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum FactoryError {
    NotAdmin = 1,
    WasmNotSet = 2,
    Paused = 3,
    /// No preset configured for this (quote token, preset) pair.
    PresetNotSet = 4,
    InvalidName = 5,
    InvalidSymbol = 6,
    InvalidMetadataUri = 7,
    InvalidCreatorBuy = 8,
    TooManyLaunches = 9,
    LaunchNotFound = 10,
    /// The curve parameters failed the shared guardrails (see `launchpad-curve/src/params.rs`).
    BadCurveParams = 11,
    InvalidFee = 12,
    Overflow = 13,
}
