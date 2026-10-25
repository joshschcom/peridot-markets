//! Test-only PriceRouter: same ABI as the real router (`PriceRouter` trait), prices are set by the
//! test with `set_price` (USD price at 14 decimals) and stamped with the ledger time.
#![no_std]
use peridot_interfaces::{Asset, PriceCheck, PriceConfig, PriceData};
use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short, Address, BytesN, Env,
};

#[contracttype]
#[derive(Clone)]
enum Key {
    Admin,
    Decimals,
    Resolution,
    Config(Address),
    Price(Address),
}

#[contract]
pub struct MockPriceRouter;

#[contractimpl]
impl MockPriceRouter {
    pub fn __constructor(env: Env, admin: Address, quote_decimals: u32, resolution: u32) {
        env.storage().instance().set(&Key::Admin, &admin);
        env.storage().instance().set(&Key::Decimals, &quote_decimals);
        env.storage().instance().set(&Key::Resolution, &resolution);
    }

    pub fn decimals(env: Env) -> u32 {
        env.storage().instance().get(&Key::Decimals).unwrap()
    }

    pub fn resolution(env: Env) -> u32 {
        env.storage().instance().get(&Key::Resolution).unwrap()
    }

    pub fn lastprice(env: Env, asset: Asset) -> Option<PriceData> {
        match asset {
            Asset::Stellar(token) => {
                let price: i128 = env.storage().persistent().get(&Key::Price(token))?;
                Some(PriceData { price, timestamp: env.ledger().timestamp() })
            }
            Asset::Other(_) => None,
        }
    }

    pub fn set_asset_config(env: Env, admin: Address, token: Address, cfg: PriceConfig) {
        let stored: Address = env.storage().instance().get(&Key::Admin).unwrap();
        assert!(stored == admin, "not admin");
        admin.require_auth();
        env.storage().persistent().set(&Key::Config(token), &cfg);
    }

    pub fn get_asset_config(env: Env, token: Address) -> Option<PriceConfig> {
        env.storage().persistent().get(&Key::Config(token))
    }

    pub fn check(env: Env, token: Address) -> PriceCheck {
        let price: Option<i128> = env.storage().persistent().get(&Key::Price(token));
        PriceCheck {
            mode: symbol_short!("mock"),
            reflector_price: price,
            aquarius_price: None,
            deviation_bps: None,
            status: if price.is_some() { symbol_short!("ok") } else { symbol_short!("unavail") },
            timestamp: env.ledger().timestamp(),
        }
    }

    pub fn upgrade(env: Env, admin: Address, new_wasm_hash: BytesN<32>) {
        let stored: Address = env.storage().instance().get(&Key::Admin).unwrap();
        assert!(stored == admin, "not admin");
        admin.require_auth();
        env.deployer().update_current_contract_wasm(new_wasm_hash);
    }

    /// Test helper (anyone).
    pub fn set_price(env: Env, token: Address, price: i128) {
        env.storage().persistent().set(&Key::Price(token), &price);
    }
}
