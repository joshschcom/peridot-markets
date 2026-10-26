//! Launchpad token template (docs/SPECS.md, launchpad sections).
//!
//! A fixed-supply SEP-41 token built on the OpenZeppelin fungible `Base`.
//!
//! - 7 decimals.
//! - The whole supply is minted exactly once, inside `__constructor`, to `recipient` (the bonding curve).
//! - There is no `mint` function, no admin, no freeze, no pause and no upgrade path: this is the only
//!   immutable contract of the launchpad. `burn` and `burn_from` exist because SEP-41 requires them, and they
//!   can only be used by a holder (or an approved spender) on that holder's own balance.
//! - `metadata_uri` is an optional image or metadata URI chosen at launch (empty string means none).
#![no_std]

#[allow(unused_imports)]
use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short, Address, Env, Map, MuxedAddress, String, Symbol,
};
use stellar_tokens::fungible::{burnable::FungibleBurnable, Base, FungibleToken};

pub const DECIMALS: u32 = 7;
/// Upper bound for the metadata URI, so a launch cannot bloat the instance entry.
pub const MAX_METADATA_URI_LEN: u32 = 256;

#[contracttype]
enum DataKey {
    MetadataUri,
}

#[contract]
pub struct LaunchpadToken;

#[contractimpl]
impl LaunchpadToken {
    /// Mints `supply` once to `recipient`. Reverts when `supply <= 0` or the URI is too long.
    pub fn __constructor(
        e: &Env,
        recipient: Address,
        name: String,
        symbol: String,
        supply: i128,
        metadata_uri: String,
    ) {
        if supply <= 0 {
            panic!("supply must be positive");
        }
        if metadata_uri.len() > MAX_METADATA_URI_LEN {
            panic!("metadata uri too long");
        }
        Base::set_metadata(e, DECIMALS, name, symbol);
        Base::mint(e, &recipient, supply);
        e.storage().instance().set(&DataKey::MetadataUri, &metadata_uri);
    }

    /// Optional image or metadata URI (empty when none was set).
    pub fn metadata_uri(e: &Env) -> String {
        e.storage()
            .instance()
            .get(&DataKey::MetadataUri)
            .unwrap_or_else(|| String::from_str(e, ""))
    }

    /// Metadata map with the keys `name`, `symbol` and, when set, `image`.
    pub fn metadata(e: &Env) -> Map<Symbol, String> {
        let mut m: Map<Symbol, String> = Map::new(e);
        m.set(symbol_short!("name"), Base::name(e));
        m.set(symbol_short!("symbol"), Base::symbol(e));
        let uri = Self::metadata_uri(e);
        if !uri.is_empty() {
            m.set(symbol_short!("image"), uri);
        }
        m
    }
}

#[contractimpl(contracttrait)]
impl FungibleToken for LaunchpadToken {
    type ContractType = Base;
}

#[contractimpl(contracttrait)]
impl FungibleBurnable for LaunchpadToken {}

#[cfg(test)]
mod test;
