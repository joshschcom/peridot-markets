//! TEST ONLY mock of the XOXNO Lending controller subset used by `xoxno-vault`.
//! Same ABI as the real controller (`supply`, `withdraw`, `get_collateral_amount`, `account_exists`,
//! `get_pool_address`, `get_spoke_asset`). Supply pulls the token from `caller` to the mock "pool" (this
//! contract) with a plain `transfer`, so the real auth shape (a token transfer by the caller) is exercised.
//! `accrue` simulates supply interest. `set_liquidity` simulates a pool without liquidity.
#![no_std]

use soroban_sdk::{contract, contractimpl, contracttype, token, Address, Env, Vec};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct HubAssetKey {
    pub asset: Address,
    pub hub_id: u32,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct SpokeAssetConfig {
    pub borrow_cap: i128,
    pub frozen: bool,
    pub is_borrowable: bool,
    pub is_collateralizable: bool,
    pub liquidation_bonus: u32,
    pub liquidation_fees: u32,
    pub liquidation_threshold: u32,
    pub loan_to_value: u32,
    pub no_seize: bool,
    pub paused: bool,
    pub supply_cap: i128,
}

#[contracttype]
enum Key {
    NextId,
    Owner(u64),
    Amount(u64),
    Frozen,
    MaxWithdraw,
}

#[contract]
pub struct MockXoxnoLending;

#[contractimpl]
impl MockXoxnoLending {
    pub fn get_pool_address(env: Env) -> Address {
        env.current_contract_address()
    }

    pub fn get_spoke_asset(env: Env, _spoke_id: u32, _hub_asset: HubAssetKey) -> SpokeAssetConfig {
        SpokeAssetConfig {
            borrow_cap: 0,
            frozen: env.storage().instance().get(&Key::Frozen).unwrap_or(false),
            is_borrowable: true,
            is_collateralizable: true,
            liquidation_bonus: 0,
            liquidation_fees: 0,
            liquidation_threshold: 0,
            loan_to_value: 0,
            no_seize: false,
            paused: false,
            supply_cap: i128::MAX,
        }
    }

    pub fn set_frozen(env: Env, frozen: bool) {
        env.storage().instance().set(&Key::Frozen, &frozen);
    }

    /// Caps what one `withdraw` call can release (simulates missing pool liquidity).
    pub fn set_max_withdraw(env: Env, max: i128) {
        env.storage().instance().set(&Key::MaxWithdraw, &max);
    }

    pub fn account_exists(env: Env, account_id: u64) -> bool {
        env.storage().persistent().has(&Key::Owner(account_id))
    }

    pub fn get_collateral_amount(env: Env, account_id: u64, _hub_asset: HubAssetKey) -> i128 {
        env.storage().persistent().get(&Key::Amount(account_id)).unwrap_or(0)
    }

    pub fn supply(
        env: Env,
        caller: Address,
        account_id: u64,
        _spoke_id: u32,
        assets: Vec<(HubAssetKey, i128)>,
    ) -> u64 {
        caller.require_auth();
        let mut id = account_id;
        if id == 0 {
            id = env.storage().instance().get(&Key::NextId).unwrap_or(0u64) + 1;
            env.storage().instance().set(&Key::NextId, &id);
            env.storage().persistent().set(&Key::Owner(id), &caller);
        } else {
            let owner: Address = env.storage().persistent().get(&Key::Owner(id)).expect("no account");
            if owner != caller {
                panic!("not owner");
            }
        }
        for (key, amount) in assets.iter() {
            token::Client::new(&env, &key.asset).transfer(&caller, &env.current_contract_address(), &amount);
            let cur: i128 = env.storage().persistent().get(&Key::Amount(id)).unwrap_or(0);
            env.storage().persistent().set(&Key::Amount(id), &(cur + amount));
        }
        id
    }

    /// `amount == 0` withdraws everything (XOXNO `WITHDRAW_ALL`). Deletes the account when it empties.
    pub fn withdraw(
        env: Env,
        caller: Address,
        account_id: u64,
        withdrawals: Vec<(HubAssetKey, i128)>,
        _to: Option<Address>,
    ) -> Vec<(HubAssetKey, i128)> {
        caller.require_auth();
        let owner: Address = env.storage().persistent().get(&Key::Owner(account_id)).expect("no account");
        if owner != caller {
            panic!("not owner");
        }
        let mut out = Vec::new(&env);
        for (key, amount) in withdrawals.iter() {
            let cur: i128 = env.storage().persistent().get(&Key::Amount(account_id)).unwrap_or(0);
            let amt = if amount == 0 { cur } else { amount };
            if amt > cur {
                panic!("insufficient");
            }
            let max: i128 = env.storage().instance().get(&Key::MaxWithdraw).unwrap_or(i128::MAX);
            if amt > max {
                panic!("no liquidity");
            }
            env.storage().persistent().set(&Key::Amount(account_id), &(cur - amt));
            token::Client::new(&env, &key.asset).transfer(&env.current_contract_address(), &caller, &amt);
            out.push_back((key, amt));
        }
        let left: i128 = env.storage().persistent().get(&Key::Amount(account_id)).unwrap_or(0);
        if left == 0 {
            env.storage().persistent().remove(&Key::Owner(account_id));
            env.storage().persistent().remove(&Key::Amount(account_id));
        }
        out
    }

    /// Test helper: credit interest to an account (the token must already be minted to this contract).
    pub fn accrue(env: Env, account_id: u64, amount: i128) {
        let cur: i128 = env.storage().persistent().get(&Key::Amount(account_id)).unwrap_or(0);
        env.storage().persistent().set(&Key::Amount(account_id), &(cur + amount));
    }
}
