use soroban_sdk::{contracttype, Address, Symbol};

/// Copied byte for byte from core `simple-peridottroller/src/reflector.rs`.
/// The `contracttype` layout must match what the controller decodes.
#[contracttype]
#[derive(Debug, Clone, Eq, PartialEq, Ord, PartialOrd)]
pub enum Asset {
    Stellar(Address),
    Other(Symbol),
}

#[contracttype]
#[derive(Debug, Clone, Eq, PartialEq, Ord, PartialOrd)]
pub struct PriceData {
    pub price: i128,
    pub timestamp: u64,
}
