//! Test doubles for the Aquarius standard-pool router and pool (also included by the launch factory tests).
//!
//! They mirror what recorded mainnet simulations of router v220 showed, because a double that is more lenient
//! than the real contracts hides authorization bugs:
//! - `router.init_standard_pool(user, tokens, fee)`: `user.require_auth()`; the creation fee is an
//!   `AQUA.transfer(user, payment_address, fee)` made BY THE ROUTER (a child of the router call); a pair that
//!   already has a pool of that fee returns it and charges nothing; unsorted tokens fail with contract error 2002.
//! - `router.deposit(user, tokens, index, desired, min_shares)`: `user.require_auth()`, then
//!   `pool.deposit(user, desired, min_shares)`, which calls `user.require_auth()` again and pulls the DESIRED
//!   amounts with `token.transfer(user, pool, amount)`, refunding what it does not use. Shares are minted to
//!   `user` on a separate share token.
#![cfg(test)]

use mock_token::MockTokenClient;
use soroban_sdk::{
    contract, contractimpl, contracttype, panic_with_error, token, vec, Address, Bytes, BytesN, Env, Error, Map, Vec,
};

#[contracttype]
#[derive(Clone)]
enum RKey {
    PayToken,
    PayAddr,
    PayAmount,
    Queue,
    Pools(Vec<Address>),
    Share(Address),
}

#[contract]
pub struct TestRouter;

fn isqrt(n: u128) -> u128 {
    if n < 2 {
        return n;
    }
    let mut x = n;
    let mut y = (x + 1) / 2;
    while y < x {
        x = y;
        y = (x + n / x) / 2;
    }
    x
}

fn fee_index(env: &Env, fee: u32) -> BytesN<32> {
    let mut b = Bytes::new(env);
    b.extend_from_array(&fee.to_be_bytes());
    env.crypto().sha256(&b).to_bytes()
}

#[contractimpl]
impl TestRouter {
    pub fn __constructor(env: Env, pay_token: Address, pay_addr: Address, pay_amount: u128) {
        env.storage().instance().set(&RKey::PayToken, &pay_token);
        env.storage().instance().set(&RKey::PayAddr, &pay_addr);
        env.storage().instance().set(&RKey::PayAmount, &pay_amount);
        env.storage().instance().set(&RKey::Queue, &Vec::<(Address, Address)>::new(&env));
    }

    /// Test helper: a pre-registered (pool, share token) pair the next created pool will use.
    pub fn queue_pool(env: Env, pool: Address, share: Address) {
        let mut q: Vec<(Address, Address)> = env.storage().instance().get(&RKey::Queue).unwrap();
        q.push_back((pool, share));
        env.storage().instance().set(&RKey::Queue, &q);
    }

    pub fn set_pay_amount(env: Env, amount: u128) {
        env.storage().instance().set(&RKey::PayAmount, &amount);
    }

    pub fn get_init_pool_payment_token(env: Env) -> Address {
        env.storage().instance().get(&RKey::PayToken).unwrap()
    }

    pub fn get_init_pool_payment_address(env: Env) -> Address {
        env.storage().instance().get(&RKey::PayAddr).unwrap()
    }

    pub fn get_standard_pool_payment_amount(env: Env) -> u128 {
        env.storage().instance().get(&RKey::PayAmount).unwrap()
    }

    pub fn get_pools(env: Env, tokens: Vec<Address>) -> Map<BytesN<32>, Address> {
        env.storage().instance().get(&RKey::Pools(tokens)).unwrap_or(Map::new(&env))
    }

    pub fn share_id(env: Env, tokens: Vec<Address>, pool_index: BytesN<32>) -> Address {
        let pool = Self::get_pools(env.clone(), tokens).get(pool_index).expect("no such pool");
        env.storage().instance().get(&RKey::Share(pool)).unwrap()
    }

    pub fn init_standard_pool(env: Env, user: Address, tokens: Vec<Address>, fee_fraction: u32) -> (BytesN<32>, Address) {
        user.require_auth();
        if ![10u32, 30, 100].contains(&fee_fraction) {
            panic_with_error!(&env, Error::from_contract_error(302));
        }
        if tokens.len() != 2 || tokens.get(0).unwrap() >= tokens.get(1).unwrap() {
            // the real router: 2002 for unsorted (or duplicate) tokens
            panic_with_error!(&env, Error::from_contract_error(2002));
        }
        let index = fee_index(&env, fee_fraction);
        let key = RKey::Pools(tokens.clone());
        let mut pools: Map<BytesN<32>, Address> = env.storage().instance().get(&key).unwrap_or(Map::new(&env));
        if let Some(p) = pools.get(index.clone()) {
            return (index, p); // existing pool: no payment
        }
        let amount: u128 = env.storage().instance().get(&RKey::PayAmount).unwrap();
        if amount > 0 {
            let pay_token: Address = env.storage().instance().get(&RKey::PayToken).unwrap();
            let pay_addr: Address = env.storage().instance().get(&RKey::PayAddr).unwrap();
            // made by the router, so the user's authorization must cover this nested call
            token::Client::new(&env, &pay_token).transfer(&user, &pay_addr, &(amount as i128));
        }
        let mut q: Vec<(Address, Address)> = env.storage().instance().get(&RKey::Queue).unwrap();
        let (pool, share) = q.pop_front().expect("no pre-registered pool left");
        env.storage().instance().set(&RKey::Queue, &q);
        TestPoolClient::new(&env, &pool).init(&tokens, &share);
        env.storage().instance().set(&RKey::Share(pool.clone()), &share);
        pools.set(index.clone(), pool.clone());
        env.storage().instance().set(&key, &pools);
        (index, pool)
    }

    pub fn deposit(
        env: Env,
        user: Address,
        tokens: Vec<Address>,
        pool_index: BytesN<32>,
        desired_amounts: Vec<u128>,
        min_shares: u128,
    ) -> (Vec<u128>, u128) {
        user.require_auth();
        let pool = Self::get_pools(env.clone(), tokens).get(pool_index).expect("no such pool");
        TestPoolClient::new(&env, &pool).deposit(&user, &desired_amounts, &min_shares)
    }
}

#[contracttype]
#[derive(Clone)]
enum PKey {
    Tokens,
    Share,
    Reserves,
    Total,
}

#[contract]
pub struct TestPool;

#[contractimpl]
impl TestPool {
    pub fn init(env: Env, tokens: Vec<Address>, share: Address) {
        env.storage().instance().set(&PKey::Tokens, &tokens);
        env.storage().instance().set(&PKey::Share, &share);
        env.storage().instance().set(&PKey::Reserves, &vec![&env, 0u128, 0u128]);
        env.storage().instance().set(&PKey::Total, &0u128);
    }

    pub fn get_tokens(env: Env) -> Vec<Address> {
        env.storage().instance().get(&PKey::Tokens).unwrap()
    }

    pub fn get_reserves(env: Env) -> Vec<u128> {
        env.storage().instance().get(&PKey::Reserves).unwrap()
    }

    pub fn total_shares(env: Env) -> u128 {
        env.storage().instance().get(&PKey::Total).unwrap()
    }

    /// Constant product with the 0.3% fee on the input.
    pub fn estimate_swap(env: Env, in_idx: u32, out_idx: u32, in_amount: u128) -> u128 {
        let r = Self::get_reserves(env);
        let (rin, rout) = (r.get(in_idx).unwrap(), r.get(out_idx).unwrap());
        let net = in_amount * 9_970 / 10_000;
        rout * net / (rin + net)
    }

    pub fn deposit(env: Env, user: Address, desired: Vec<u128>, min_shares: u128) -> (Vec<u128>, u128) {
        user.require_auth(); // the standard pool authorizes the user itself
        let tokens: Vec<Address> = env.storage().instance().get(&PKey::Tokens).unwrap();
        let share: Address = env.storage().instance().get(&PKey::Share).unwrap();
        let mut res: Vec<u128> = env.storage().instance().get(&PKey::Reserves).unwrap();
        let total: u128 = env.storage().instance().get(&PKey::Total).unwrap();
        let this = env.current_contract_address();
        let (d0, d1) = (desired.get(0).unwrap(), desired.get(1).unwrap());
        let (r0, r1) = (res.get(0).unwrap(), res.get(1).unwrap());
        let (u0, u1, shares) = if total == 0 {
            (d0, d1, isqrt(d0 * d1))
        } else {
            let s = (d0 * total / r0).min(d1 * total / r1);
            ((s * r0).div_ceil(total), (s * r1).div_ceil(total), s)
        };
        if shares == 0 || shares < min_shares {
            panic!("slippage");
        }
        // pulls the DESIRED amounts first, then refunds the excess (as the deployed pool does)
        token::Client::new(&env, &tokens.get(0).unwrap()).transfer(&user, &this, &(d0 as i128));
        token::Client::new(&env, &tokens.get(1).unwrap()).transfer(&user, &this, &(d1 as i128));
        if d0 > u0 {
            token::Client::new(&env, &tokens.get(0).unwrap()).transfer(&this, &user, &((d0 - u0) as i128));
        }
        if d1 > u1 {
            token::Client::new(&env, &tokens.get(1).unwrap()).transfer(&this, &user, &((d1 - u1) as i128));
        }
        res.set(0, r0 + u0);
        res.set(1, r1 + u1);
        env.storage().instance().set(&PKey::Reserves, &res);
        env.storage().instance().set(&PKey::Total, &(total + shares));
        MockTokenClient::new(&env, &share).mint(&user, &(shares as i128));
        (vec![&env, u0, u1], shares)
    }
}
