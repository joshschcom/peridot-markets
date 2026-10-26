//! Test-only vault kind for the vault-factory tests: constructor (owner, n), n in 1..=10.
#![no_std]
use soroban_sdk::{contract, contractimpl, Address, Env};

#[contract]
pub struct MockKindVault;

#[contractimpl]
impl MockKindVault {
    pub fn __constructor(env: Env, owner: Address, n: u32) {
        if n == 0 || n > 10 {
            panic!("n out of range");
        }
        env.storage().instance().set(&0u32, &owner);
        env.storage().instance().set(&1u32, &n);
    }
    pub fn owner(env: Env) -> Address {
        env.storage().instance().get(&0u32).unwrap()
    }
    pub fn n(env: Env) -> u32 {
        env.storage().instance().get(&1u32).unwrap()
    }
}
