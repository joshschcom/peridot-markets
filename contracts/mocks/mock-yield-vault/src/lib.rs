//! Test-only `YieldVault` (00 section 6.1). Shares are 1:1 until a test donates underlying to the
//! vault address (simulated yield) or burns some from it (simulated loss); `total_value` is the
//! vault's real underlying balance, so share price follows automatically.
#![no_std]
use peridot_interfaces::VaultState;
use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short, token, vec, Address, BytesN, Env, Symbol,
    Vec,
};

#[contracttype]
#[derive(Clone)]
enum Key {
    Admin,
    Market,
    Underlying,
    Keeper,
    Paused,
    TotalShares,
    Shares(Address),
}

/// Same shape as the DeFindex vault's `get_assets` return, so the factory's attach validation can be tested.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Strategy {
    pub address: Address,
    pub name: soroban_sdk::String,
    pub paused: bool,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AssetStrategySet {
    pub address: Address,
    pub strategies: Vec<Strategy>,
}

#[contract]
pub struct MockYieldVault;

fn total_value(env: &Env) -> i128 {
    let u: Address = env.storage().instance().get(&Key::Underlying).unwrap();
    token::Client::new(env, &u).balance(&env.current_contract_address())
}

fn total_shares(env: &Env) -> i128 {
    env.storage().instance().get(&Key::TotalShares).unwrap_or(0)
}

fn value_of(env: &Env, shares: i128) -> i128 {
    let ts = total_shares(env);
    if ts == 0 {
        shares
    } else {
        shares * total_value(env) / ts
    }
}

#[contractimpl]
impl MockYieldVault {
    pub fn __constructor(env: Env, admin: Address, market: Address, underlying: Address) {
        env.storage().instance().set(&Key::Admin, &admin);
        env.storage().instance().set(&Key::Market, &market);
        env.storage().instance().set(&Key::Underlying, &underlying);
        env.storage().instance().set(&Key::Paused, &false);
    }

    pub fn balance(env: Env, id: Address) -> i128 {
        env.storage().persistent().get(&Key::Shares(id)).unwrap_or(0)
    }

    pub fn deposit(
        env: Env,
        amounts_desired: Vec<i128>,
        _amounts_min: Vec<i128>,
        from: Address,
        _invest: bool,
    ) -> Vec<i128> {
        let market: Address = env.storage().instance().get(&Key::Market).unwrap();
        assert!(from == market, "only market");
        assert!(!env.storage().instance().get(&Key::Paused).unwrap_or(false), "paused");
        let amount = amounts_desired.get(0).unwrap();
        assert!(amount > 0, "amount");
        let ts = total_shares(&env);
        let tv = total_value(&env);
        let minted = if ts == 0 || tv == 0 { amount } else { amount * ts / tv };
        let u: Address = env.storage().instance().get(&Key::Underlying).unwrap();
        // receipt-vault pre-authorizes exactly this transfer
        token::Client::new(&env, &u).transfer(&from, &env.current_contract_address(), &amount);
        env.storage().instance().set(&Key::TotalShares, &(ts + minted));
        let bal = Self::balance(env.clone(), from.clone());
        env.storage().persistent().set(&Key::Shares(from), &(bal + minted));
        vec![&env, amount]
    }

    pub fn withdraw(env: Env, shares: i128, min_amounts_out: Vec<i128>, from: Address) -> Vec<i128> {
        from.require_auth();
        let bal = Self::balance(env.clone(), from.clone());
        assert!(shares > 0 && shares <= bal, "shares");
        let out = value_of(&env, shares);
        assert!(out >= min_amounts_out.get(0).unwrap_or(0), "min out");
        let u: Address = env.storage().instance().get(&Key::Underlying).unwrap();
        env.storage().persistent().set(&Key::Shares(from.clone()), &(bal - shares));
        env.storage().instance().set(&Key::TotalShares, &(total_shares(&env) - shares));
        token::Client::new(&env, &u).transfer(&env.current_contract_address(), &from, &out);
        vec![&env, out]
    }

    pub fn get_asset_amounts_per_shares(env: Env, shares: i128) -> Vec<i128> {
        vec![&env, value_of(&env, shares)]
    }

    pub fn get_assets(env: Env) -> Vec<AssetStrategySet> {
        vec![
            &env,
            AssetStrategySet {
                address: Self::underlying(env.clone()),
                strategies: vec![
                    &env,
                    Strategy {
                        address: env.current_contract_address(),
                        name: soroban_sdk::String::from_str(&env, "mock"),
                        paused: false,
                    },
                ],
            },
        ]
    }

    pub fn underlying(env: Env) -> Address {
        env.storage().instance().get(&Key::Underlying).unwrap()
    }

    pub fn kind(_env: Env) -> Symbol {
        symbol_short!("mock")
    }

    pub fn market(env: Env) -> Address {
        env.storage().instance().get(&Key::Market).unwrap()
    }

    pub fn get_state(env: Env) -> VaultState {
        let tv = total_value(&env);
        VaultState {
            kind: symbol_short!("mock"),
            underlying: Self::underlying(env.clone()),
            total_shares: total_shares(&env),
            total_value: tv,
            principal: tv,
            reserve: 0,
            last_harvest_ts: 0,
            last_harvest_amount: 0,
            apy_hint_bps: 0,
            paused: env.storage().instance().get(&Key::Paused).unwrap_or(false),
        }
    }

    pub fn harvest(_env: Env, keeper: Address, _min_out: i128) -> i128 {
        keeper.require_auth();
        0
    }

    pub fn set_keeper(env: Env, admin: Address, keeper: Address) {
        require_admin(&env, &admin);
        env.storage().instance().set(&Key::Keeper, &keeper);
    }

    pub fn pause(env: Env, admin: Address, paused: bool) {
        require_admin(&env, &admin);
        env.storage().instance().set(&Key::Paused, &paused);
    }

    pub fn upgrade(env: Env, admin: Address, new_wasm_hash: BytesN<32>) {
        require_admin(&env, &admin);
        env.deployer().update_current_contract_wasm(new_wasm_hash);
    }
}

fn require_admin(env: &Env, admin: &Address) {
    let stored: Address = env.storage().instance().get(&Key::Admin).unwrap();
    assert!(&stored == admin, "not admin");
    admin.require_auth();
}
