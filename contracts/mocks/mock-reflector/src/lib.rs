//! Test-only Reflector (SEP-40 subset). Prices are set by the test, not by an oracle network.
#![no_std]
use peridot_interfaces::{Asset, PriceData};
use soroban_sdk::{contract, contractimpl, contracttype, Env, Vec};

#[contracttype]
#[derive(Clone)]
enum Key {
    Decimals,
    Resolution,
    Price(Asset),
    Assets,
}

#[contract]
pub struct MockReflector;

#[contractimpl]
impl MockReflector {
    pub fn __constructor(env: Env, decimals: u32, resolution: u32) {
        env.storage().instance().set(&Key::Decimals, &decimals);
        env.storage().instance().set(&Key::Resolution, &resolution);
        env.storage().instance().set(&Key::Assets, &Vec::<Asset>::new(&env));
    }

    /// Test helper. `timestamp` is in seconds, like Reflector's `PriceData`.
    pub fn set_price(env: Env, asset: Asset, price: i128, timestamp: u64) {
        env.storage()
            .instance()
            .set(&Key::Price(asset.clone()), &PriceData { price, timestamp });
        let mut assets: Vec<Asset> = env.storage().instance().get(&Key::Assets).unwrap();
        if !assets.contains(&asset) {
            assets.push_back(asset);
            env.storage().instance().set(&Key::Assets, &assets);
        }
    }

    /// Test helper: makes `lastprice` return None for the asset.
    pub fn clear_price(env: Env, asset: Asset) {
        env.storage().instance().remove(&Key::Price(asset));
    }

    pub fn decimals(env: Env) -> u32 {
        env.storage().instance().get(&Key::Decimals).unwrap()
    }

    pub fn resolution(env: Env) -> u32 {
        env.storage().instance().get(&Key::Resolution).unwrap()
    }

    pub fn assets(env: Env) -> Vec<Asset> {
        env.storage().instance().get(&Key::Assets).unwrap()
    }

    pub fn lastprice(env: Env, asset: Asset) -> Option<PriceData> {
        env.storage().instance().get(&Key::Price(asset))
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::{symbol_short, Env};

    #[test]
    fn returns_set_price_and_none_when_cleared() {
        let env = Env::default();
        let id = env.register(MockReflector, (14u32, 300u32));
        let c = MockReflectorClient::new(&env, &id);
        let a = Asset::Other(symbol_short!("XLM"));
        assert!(c.lastprice(&a).is_none());
        c.set_price(&a, &(12_000_000_000_000i128), &1_000u64);
        assert_eq!(c.lastprice(&a).unwrap().price, 12_000_000_000_000i128);
        assert_eq!(c.decimals(), 14);
        assert_eq!(c.resolution(), 300);
        c.clear_price(&a);
        assert!(c.lastprice(&a).is_none());
    }
}
