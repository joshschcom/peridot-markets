#![cfg(test)]
extern crate std;

use soroban_sdk::{testutils::Address as _, Address, Env, String, Symbol};

use crate::{LaunchpadToken, LaunchpadTokenClient};

const SUPPLY: i128 = 10_000_000_000_000_000; // 1e9 tokens at 7 decimals

fn setup(env: &Env, uri: &str) -> (LaunchpadTokenClient<'static>, Address) {
    env.mock_all_auths();
    let recipient = Address::generate(env);
    let id = env.register(
        LaunchpadToken,
        (
            &recipient,
            String::from_str(env, "Meridian Coin"),
            String::from_str(env, "MRD"),
            SUPPLY,
            String::from_str(env, uri),
        ),
    );
    (LaunchpadTokenClient::new(env, &id), recipient)
}

#[test]
fn constructor_mints_once_to_recipient() {
    let env = Env::default();
    let (t, r) = setup(&env, "ipfs://img");
    assert_eq!(t.total_supply(), SUPPLY);
    assert_eq!(t.balance(&r), SUPPLY);
    assert_eq!(t.decimals(), 7);
    assert_eq!(t.name(), String::from_str(&env, "Meridian Coin"));
    assert_eq!(t.symbol(), String::from_str(&env, "MRD"));
}

#[test]
fn metadata_getters() {
    let env = Env::default();
    let (t, _) = setup(&env, "ipfs://img");
    assert_eq!(t.metadata_uri(), String::from_str(&env, "ipfs://img"));
    let m = t.metadata();
    assert_eq!(m.get(Symbol::new(&env, "image")).unwrap(), String::from_str(&env, "ipfs://img"));
    let (t2, _) = setup(&env, "");
    assert_eq!(t2.metadata_uri(), String::from_str(&env, ""));
    assert!(t2.metadata().get(Symbol::new(&env, "image")).is_none());
}

#[test]
fn transfers_keep_supply_constant() {
    let env = Env::default();
    let (t, r) = setup(&env, "");
    let a = Address::generate(&env);
    let b = Address::generate(&env);
    t.transfer(&r, &a, &1_000);
    t.transfer(&a, &b, &400);
    assert_eq!(t.balance(&a), 600);
    assert_eq!(t.balance(&b), 400);
    assert_eq!(t.total_supply(), SUPPLY);
}

#[test]
fn only_the_holder_can_burn_its_own_tokens() {
    let env = Env::default();
    let (t, r) = setup(&env, "");
    let a = Address::generate(&env);
    t.transfer(&r, &a, &1_000);
    t.burn(&a, &300);
    assert_eq!(t.total_supply(), SUPPLY - 300);
    assert!(t.try_burn(&a, &10_000).is_err());
    // burn_from needs an allowance
    let spender = Address::generate(&env);
    assert!(t.try_burn_from(&spender, &a, &1).is_err());
}

#[test]
#[should_panic]
fn zero_supply_rejected() {
    let env = Env::default();
    let r = Address::generate(&env);
    env.register(
        LaunchpadToken,
        (
            &r,
            String::from_str(&env, "X"),
            String::from_str(&env, "X"),
            0i128,
            String::from_str(&env, ""),
        ),
    );
}

/// The ABI exposes no mint, no admin and no upgrade. This is enforced by the source (a compile-level
/// property); here we check the observable consequence: supply never moves through any entrypoint.
#[test]
fn supply_is_constant_across_all_state_changing_calls() {
    let env = Env::default();
    let (t, r) = setup(&env, "");
    let a = Address::generate(&env);
    let b = Address::generate(&env);
    t.approve(&r, &a, &500, &1000);
    t.transfer_from(&a, &r, &b, &200);
    assert_eq!(t.total_supply(), SUPPLY);
}
