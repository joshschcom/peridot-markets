//! Canonical shared interfaces for Peridot Markets (00-DROPOFF.md section 6).
//!
//! Only Lead A changes this crate, and every change is announced in
//! `docs/COORDINATION.md` first. The TypeScript mirror lives in `ts/index.ts`.
#![no_std]

mod factory_types;
mod reflector;
mod traits;
mod types;

pub use factory_types::*;
pub use reflector::{Asset, PriceData};
pub use traits::*;
pub use types::*;

/// Fixed contract address that unit-test Wasm (`scripts/build_core.sh`, label `test`, committed under
/// `build/test/`) treats as the permitted initial admin. In tests, register the contract that must act
/// as admin at this address: `env.register_at(&Address::from_str(&env, TEST_ADMIN_ADDRESS), Contract, args)`.
pub const TEST_ADMIN_ADDRESS: &str = "CANYX4H5FXYBQKA4UF4NDUDAGRX3W5XXVZSJUGL5DNBLJUELNS6ALSXY";
