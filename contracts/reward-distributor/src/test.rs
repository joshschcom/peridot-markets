#![cfg(test)]
//! Tests run against the real core Wasm in `build/test/` (controller, receipt-vault, jump-rate-model).
//! Those Wasm bake in `TEST_ADMIN_ADDRESS` as their permitted initial admin.

use super::*;
use mock_token::{MockToken, MockTokenClient};
use peridot_interfaces::{RewardDistributorClient, TEST_ADMIN_ADDRESS};
use soroban_sdk::{
    testutils::{Address as _, Events as _, Ledger as _, MockAuth, MockAuthInvoke},
    token, Address, BytesN, Env, IntoVal, String,
};

mod controller_wasm {
    soroban_sdk::contractimport!(file = "../../build/test/simple_peridottroller.wasm");
}
/// The receipt-vault Wasm declares two events named `Mint`, which `contractimport!` cannot
/// generate types for, so register the bytes directly and use a minimal hand-written client.
const VAULT_WASM: &[u8] = include_bytes!("../../../build/test/receipt_vault.wasm");

#[soroban_sdk::contractclient(name = "VaultClient")]
#[allow(dead_code)]
trait VaultApi {
    fn initialize(
        env: Env,
        token_address: Address,
        supply_yearly_rate_scaled: u128,
        borrow_yearly_rate_scaled: u128,
        admin: Address,
    );
    fn enable_static_rates(env: Env, admin: Address);
    fn set_interest_model(env: Env, model: Address);
    fn set_peridottroller(env: Env, peridottroller: Address);
    fn deposit(env: Env, user: Address, amount: u128);
}
mod jrm_wasm {
    soroban_sdk::contractimport!(file = "../../build/test/jump_rate_model.wasm");
}

const START_TS: u64 = 1_000_000;

struct Fixture<'a> {
    env: Env,
    admin: Address,
    user: Address,
    underlying: Address,
    reward: MockTokenClient<'a>,
    vault: VaultClient<'a>,
    vault_id: Address,
    controller: controller_wasm::Client<'a>,
    controller_id: Address,
    dist: RewardDistributorClient<'a>,
    dist_id: Address,
}

fn reward_token(env: &Env) -> MockTokenClient<'_> {
    let id = env.register(MockToken, ());
    let c = MockTokenClient::new(env, &id);
    c.initialize(
        &String::from_str(env, "Group Reward"),
        &String::from_str(env, "GRW"),
        &7u32,
    );
    c
}

/// Real controller + real receipt-vault market (jump rate model) + distributor registered as the
/// controller's reward token. One user has supplied `deposit` underlying.
fn setup<'a>(env: &'a Env, deposit: u128) -> Fixture<'a> {
    env.mock_all_auths_allowing_non_root_auth();
    env.ledger().set_timestamp(START_TS);

    let admin = Address::from_str(env, TEST_ADMIN_ADDRESS);
    let user = Address::generate(env);

    let underlying = env
        .register_stellar_asset_contract_v2(Address::generate(env))
        .address();

    // Jump rate model + market.
    let model_id = env.register(jrm_wasm::WASM, ());
    let model = jrm_wasm::Client::new(env, &model_id);
    model.initialize(&20_000u128, &180_000u128, &4_000_000u128, &800_000u128, &admin);

    let vault_id = env.register(VAULT_WASM, ());
    let vault = VaultClient::new(env, &vault_id);
    vault.initialize(&underlying, &0u128, &0u128, &admin);
    vault.enable_static_rates(&admin);
    vault.set_interest_model(&model_id);

    // Controller.
    let controller_id = env.register(controller_wasm::WASM, ());
    let controller = controller_wasm::Client::new(env, &controller_id);
    controller.initialize(&admin);
    controller.add_market(&vault_id);
    vault.set_peridottroller(&controller_id);
    controller.enter_market(&user, &vault_id);

    // Distributor as the controller's reward token. Admin is a stand-in for the market-factory.
    let reward = reward_token(env);
    let dist_id = env.register(
        RewardDistributor,
        (admin.clone(), controller_id.clone(), reward.address.clone()),
    );
    let dist = RewardDistributorClient::new(env, &dist_id);
    controller.set_peridot_token(&dist_id);

    if deposit > 0 {
        token::StellarAssetClient::new(env, &underlying).mint(&user, &(deposit as i128));
        vault.deposit(&user, &deposit);
    }

    Fixture {
        env: env.clone(),
        admin,
        user,
        underlying,
        reward,
        vault,
        vault_id,
        controller,
        controller_id,
        dist,
        dist_id,
    }
}

fn advance(env: &Env, secs: u64) {
    let now = env.ledger().timestamp();
    env.ledger().set_timestamp(now + secs);
}

/// `claim` where only the user's own auth is mocked, so the controller's
/// `authorize_as_current_contract` entry is what satisfies `controller.require_auth()` in the
/// distributor (this proves the real auth path works, not just `mock_all_auths`).
fn claim_with_user_auth_only(f: &Fixture, user: &Address) {
    f.env.mock_auths(&[MockAuth {
        address: user,
        invoke: &MockAuthInvoke {
            contract: &f.controller_id,
            fn_name: "claim",
            args: (user.clone(),).into_val(&f.env),
            sub_invokes: &[],
        },
    }]);
    f.controller.claim(user);
}

fn fund_direct(f: &Fixture, amount: i128) {
    // Mock token mint is unauthenticated; funding straight to the distributor address.
    f.reward.mint(&f.dist_id, &amount);
}

// -------------------------------------------------------------------------------------------
// 1. Pays through the real controller claim
// -------------------------------------------------------------------------------------------

#[test]
fn pays_through_real_controller_claim() {
    let env = Env::default();
    let f = setup(&env, 100);
    f.controller.set_supply_speed(&f.vault_id, &10u128);

    // Fund through the public entrypoint.
    let funder = Address::generate(&env);
    f.reward.mint(&funder, &10_000);
    f.dist.fund(&funder, &10_000);
    assert_eq!(f.dist.balance_available(), 10_000);
    assert_eq!(f.dist.total_paid(), 0);

    // Controller sees the pool as its reward balance, nobody else has one.
    assert_eq!(
        token::Client::new(&env, &f.dist_id).balance(&f.controller_id),
        10_000
    );
    assert_eq!(token::Client::new(&env, &f.dist_id).balance(&f.user), 0);

    advance(&env, 5);
    claim_with_user_auth_only(&f, &f.user);

    // 10 per second for 5 seconds, sole supplier.
    assert_eq!(f.reward.balance(&f.user), 50);
    assert_eq!(f.controller.get_accrued(&f.user), 0);
    assert_eq!(f.dist.balance_available(), 9_950);
    assert_eq!(f.dist.total_paid(), 50);
    assert_eq!(f.reward.balance(&f.controller_id), 0);
}

#[test]
fn set_peridot_token_only_stores_address() {
    // The controller must not need anything from the token at set time. A bare address that is not
    // a contract at all is accepted, so the distributor is trivially accepted too.
    let env = Env::default();
    let f = setup(&env, 0);
    assert_eq!(f.dist.reward_token(), f.reward.address);
    assert_eq!(f.dist.controller(), f.controller_id);
    // Same token again is idempotent, a different one panics.
    f.controller.set_peridot_token(&f.dist_id);
    assert!(f
        .controller
        .try_set_peridot_token(&Address::generate(&env))
        .is_err());
}

// -------------------------------------------------------------------------------------------
// 2. Empty / underfunded distributor
// -------------------------------------------------------------------------------------------

#[test]
fn empty_distributor_claim_fails_softly_then_refund_pays() {
    let env = Env::default();
    let f = setup(&env, 100);
    f.controller.set_supply_speed(&f.vault_id, &10u128);

    advance(&env, 5);
    // No funds: claim does not revert, nothing paid, accrued kept.
    claim_with_user_auth_only(&f, &f.user);
    assert_eq!(f.reward.balance(&f.user), 0);
    assert_eq!(f.controller.get_accrued(&f.user), 50);
    assert_eq!(f.dist.total_paid(), 0);

    // Refund, then claim succeeds for the full accrued amount.
    fund_direct(&f, 1_000);
    claim_with_user_auth_only(&f, &f.user);
    assert_eq!(f.reward.balance(&f.user), 50);
    assert_eq!(f.controller.get_accrued(&f.user), 0);
    assert_eq!(f.dist.balance_available(), 950);
    assert_eq!(f.dist.total_paid(), 50);
}

#[test]
fn underfunded_distributor_pays_what_it_has_and_keeps_remainder_accrued() {
    let env = Env::default();
    let f = setup(&env, 100);
    f.controller.set_supply_speed(&f.vault_id, &10u128);
    fund_direct(&f, 30);

    advance(&env, 5);
    claim_with_user_auth_only(&f, &f.user);
    // The controller sizes the payout to min(balance, accrued); the rest stays claimable.
    assert_eq!(f.reward.balance(&f.user), 30);
    assert_eq!(f.controller.get_accrued(&f.user), 20);
    assert_eq!(f.dist.balance_available(), 0);

    fund_direct(&f, 500);
    claim_with_user_auth_only(&f, &f.user);
    assert_eq!(f.reward.balance(&f.user), 50);
    assert_eq!(f.controller.get_accrued(&f.user), 0);
    assert_eq!(f.dist.total_paid(), 50);
}

#[test]
fn transfer_and_mint_never_pay_partially() {
    let env = Env::default();
    let f = setup(&env, 0);
    fund_direct(&f, 40);
    let to = Address::generate(&env);

    let r = f.dist.try_mint(&to, &41);
    assert!(r.is_err());
    assert_eq!(f.reward.balance(&to), 0);
    assert_eq!(f.dist.balance_available(), 40);
    assert_eq!(f.dist.total_paid(), 0);

    f.dist.mint(&to, &40);
    assert_eq!(f.reward.balance(&to), 40);
    assert_eq!(f.dist.balance_available(), 0);
    assert_eq!(f.dist.total_paid(), 40);
}

#[test]
fn non_positive_amounts_are_rejected() {
    let env = Env::default();
    let f = setup(&env, 0);
    fund_direct(&f, 40);
    let to = Address::generate(&env);
    assert!(f.dist.try_mint(&to, &0).is_err());
    assert!(f.dist.try_mint(&to, &-5).is_err());
    assert!(f.dist.try_fund(&to, &0).is_err());
    assert!(f.dist.try_fund(&to, &-1).is_err());
    assert!(f
        .dist
        .try_withdraw_unallocated(&f.admin, &to, &0)
        .is_err());
    let tok = token::Client::new(&env, &f.dist_id);
    assert!(tok.try_transfer(&f.controller_id, &to, &0).is_err());
}

// -------------------------------------------------------------------------------------------
// 3. Non-controller mint/transfer rejected (real auth, no mock_all_auths)
// -------------------------------------------------------------------------------------------

fn bare_distributor(env: &Env) -> (Address, Address, MockTokenClient<'_>, Address, RewardDistributorClient<'_>) {
    let admin = Address::generate(env);
    let controller = Address::generate(env);
    let reward = reward_token(env);
    let dist_id = env.register(
        RewardDistributor,
        (admin.clone(), controller.clone(), reward.address.clone()),
    );
    let dist = RewardDistributorClient::new(env, &dist_id);
    (admin, controller, reward, dist_id, dist)
}

#[test]
fn non_controller_mint_is_rejected() {
    let env = Env::default();
    let (_admin, controller, reward, dist_id, dist) = bare_distributor(&env);
    reward.mint(&dist_id, &1_000);
    let attacker = Address::generate(&env);

    // Attacker signs their own mint call: controller.require_auth() is not satisfied.
    env.mock_auths(&[MockAuth {
        address: &attacker,
        invoke: &MockAuthInvoke {
            contract: &dist_id,
            fn_name: "mint",
            args: (attacker.clone(), 100i128).into_val(&env),
            sub_invokes: &[],
        },
    }]);
    assert!(dist.try_mint(&attacker, &100).is_err());
    assert_eq!(reward.balance(&attacker), 0);

    // No auth at all.
    let env2 = Env::default();
    let (_a, _c, reward2, dist_id2, dist2) = bare_distributor(&env2);
    reward2.mint(&dist_id2, &1_000);
    let who = Address::generate(&env2);
    assert!(dist2.try_mint(&who, &100).is_err());

    // The controller's own auth works.
    env.mock_auths(&[MockAuth {
        address: &controller,
        invoke: &MockAuthInvoke {
            contract: &dist_id,
            fn_name: "mint",
            args: (attacker.clone(), 100i128).into_val(&env),
            sub_invokes: &[],
        },
    }]);
    dist.mint(&attacker, &100);
    assert_eq!(reward.balance(&attacker), 100);
}

#[test]
fn transfer_from_non_controller_is_rejected_and_balance_is_controller_only() {
    let env = Env::default();
    env.mock_all_auths();
    let (admin, controller, reward, dist_id, _dist) = bare_distributor(&env);
    reward.mint(&dist_id, &1_000);
    let tok = token::Client::new(&env, &dist_id);
    let thief = Address::generate(&env);

    // Even with every auth mocked, `from` must be the stored controller.
    assert!(tok.try_transfer(&thief, &thief, &10).is_err());
    assert!(tok.try_transfer(&admin, &thief, &10).is_err());
    assert_eq!(reward.balance(&thief), 0);

    assert_eq!(tok.balance(&controller), 1_000);
    assert_eq!(tok.balance(&thief), 0);
    assert_eq!(tok.balance(&admin), 0);

    tok.transfer(&controller, &thief, &10);
    assert_eq!(reward.balance(&thief), 10);
}

// -------------------------------------------------------------------------------------------
// 4. Speed changes mid-way
// -------------------------------------------------------------------------------------------

#[test]
fn speed_changes_mid_way_accrue_exactly() {
    let env = Env::default();
    let f = setup(&env, 100);
    fund_direct(&f, 1_000_000);

    f.controller.set_supply_speed(&f.vault_id, &10u128);
    advance(&env, 100); // 1_000
    f.controller.set_supply_speed(&f.vault_id, &25u128);
    advance(&env, 40); // 1_000
    f.controller.set_supply_speed(&f.vault_id, &0u128);
    advance(&env, 500); // nothing
    f.controller.set_supply_speed(&f.vault_id, &4u128);
    advance(&env, 10); // 40

    claim_with_user_auth_only(&f, &f.user);
    assert_eq!(f.reward.balance(&f.user), 2_040);
    assert_eq!(f.controller.get_accrued(&f.user), 0);
    assert_eq!(f.dist.total_paid(), 2_040);
    assert_eq!(f.dist.balance_available(), 1_000_000 - 2_040);

    // A second claim with no time passing pays nothing more.
    claim_with_user_auth_only(&f, &f.user);
    assert_eq!(f.reward.balance(&f.user), 2_040);
}

#[test]
fn two_suppliers_split_by_share_and_late_joiner() {
    let env = Env::default();
    let f = setup(&env, 100);
    fund_direct(&f, 1_000_000);
    f.controller.set_supply_speed(&f.vault_id, &10u128);
    advance(&env, 10); // user alone: 100

    let user2 = Address::generate(&env);
    f.controller.enter_market(&user2, &f.vault_id);
    token::StellarAssetClient::new(&env, &f.underlying).mint(&user2, &100);
    f.vault.deposit(&user2, &100u128);
    advance(&env, 20); // 10/s split 50/50: 100 each

    claim_with_user_auth_only(&f, &f.user);
    claim_with_user_auth_only(&f, &user2);
    assert_eq!(f.reward.balance(&f.user), 200);
    assert_eq!(f.reward.balance(&user2), 100);
    assert_eq!(f.dist.total_paid(), 300);
}

// -------------------------------------------------------------------------------------------
// 5. fund / withdraw_unallocated
// -------------------------------------------------------------------------------------------

#[test]
fn fund_is_open_to_anyone_with_auth_and_tracks_totals() {
    let env = Env::default();
    let (_admin, _controller, reward, dist_id, dist) = bare_distributor(&env);
    let a = Address::generate(&env);
    reward.mint(&a, &500);

    // No auth: rejected.
    assert!(dist.try_fund(&a, &100).is_err());

    // A signs fund and the nested token transfer.
    env.mock_auths(&[MockAuth {
        address: &a,
        invoke: &MockAuthInvoke {
            contract: &dist_id,
            fn_name: "fund",
            args: (a.clone(), 100i128).into_val(&env),
            sub_invokes: &[MockAuthInvoke {
                contract: &reward.address,
                fn_name: "transfer",
                args: (a.clone(), dist_id.clone(), 100i128).into_val(&env),
                sub_invokes: &[],
            }],
        },
    }]);
    dist.fund(&a, &100);
    assert_eq!(reward.balance(&a), 400);
    assert_eq!(dist.balance_available(), 100);
    assert_eq!(
        env.as_contract(&dist_id, || get_total(&env, DataKey::TotalFunded)),
        100
    );

    // Insufficient sender balance fails without changing anything visible.
    env.mock_all_auths();
    assert!(dist.try_fund(&a, &10_000).is_err());
    assert_eq!(dist.balance_available(), 100);
}

#[test]
fn withdraw_unallocated_is_admin_only() {
    let env = Env::default();
    let (admin, _controller, reward, dist_id, dist) = bare_distributor(&env);
    reward.mint(&dist_id, &1_000);
    let to = Address::generate(&env);
    let other = Address::generate(&env);

    // Wrong admin address, even with its auth.
    env.mock_auths(&[MockAuth {
        address: &other,
        invoke: &MockAuthInvoke {
            contract: &dist_id,
            fn_name: "withdraw_unallocated",
            args: (other.clone(), to.clone(), 100i128).into_val(&env),
            sub_invokes: &[],
        },
    }]);
    assert!(dist.try_withdraw_unallocated(&other, &to, &100).is_err());

    // Right admin address, but no signature.
    env.mock_auths(&[]);
    assert!(dist.try_withdraw_unallocated(&admin, &to, &100).is_err());
    assert_eq!(reward.balance(&to), 0);

    // Admin with auth.
    env.mock_auths(&[MockAuth {
        address: &admin,
        invoke: &MockAuthInvoke {
            contract: &dist_id,
            fn_name: "withdraw_unallocated",
            args: (admin.clone(), to.clone(), 400i128).into_val(&env),
            sub_invokes: &[],
        },
    }]);
    dist.withdraw_unallocated(&admin, &to, &400);
    assert_eq!(reward.balance(&to), 400);
    assert_eq!(dist.balance_available(), 600);

    // Cannot withdraw more than is held.
    env.mock_all_auths();
    assert!(dist.try_withdraw_unallocated(&admin, &to, &601).is_err());
    dist.withdraw_unallocated(&admin, &to, &600);
    assert_eq!(dist.balance_available(), 0);
}

#[test]
fn withdrawing_can_leave_rewards_unclaimable_until_refunded() {
    let env = Env::default();
    let f = setup(&env, 100);
    f.controller.set_supply_speed(&f.vault_id, &10u128);
    fund_direct(&f, 1_000);
    advance(&env, 5);

    let owner = Address::generate(&env);
    f.dist.withdraw_unallocated(&f.admin, &owner, &1_000);
    assert_eq!(f.reward.balance(&owner), 1_000);

    claim_with_user_auth_only(&f, &f.user);
    assert_eq!(f.reward.balance(&f.user), 0);
    assert_eq!(f.controller.get_accrued(&f.user), 50);

    env.mock_all_auths_allowing_non_root_auth();
    f.dist.fund(&owner, &1_000);
    claim_with_user_auth_only(&f, &f.user);
    assert_eq!(f.reward.balance(&f.user), 50);
}

// -------------------------------------------------------------------------------------------
// 6. upgrade, constructor, views, events
// -------------------------------------------------------------------------------------------

#[test]
fn upgrade_is_admin_only() {
    let env = Env::default();
    let (admin, _controller, _reward, dist_id, dist) = bare_distributor(&env);
    let hash: BytesN<32> = env.deployer().upload_contract_wasm(jrm_wasm::WASM);
    let other = Address::generate(&env);

    // Not the admin address.
    env.mock_auths(&[MockAuth {
        address: &other,
        invoke: &MockAuthInvoke {
            contract: &dist_id,
            fn_name: "upgrade",
            args: (other.clone(), hash.clone()).into_val(&env),
            sub_invokes: &[],
        },
    }]);
    assert!(dist.try_upgrade(&other, &hash).is_err());

    // Admin address without signature.
    env.mock_auths(&[]);
    assert!(dist.try_upgrade(&admin, &hash).is_err());

    // Admin with signature: executable switches immediately to the uploaded Wasm.
    env.mock_auths(&[MockAuth {
        address: &admin,
        invoke: &MockAuthInvoke {
            contract: &dist_id,
            fn_name: "upgrade",
            args: (admin.clone(), hash.clone()).into_val(&env),
            sub_invokes: &[],
        },
    }]);
    dist.upgrade(&admin, &hash);
    // The instance now runs the jump-rate-model code, which does not export `reward_token`.
    assert!(dist.try_reward_token().is_err());
}

#[test]
fn constructor_sets_state_and_views_forward_to_token() {
    let env = Env::default();
    let (admin, controller, reward, _dist_id, dist) = bare_distributor(&env);
    assert_eq!(dist.reward_token(), reward.address);
    assert_eq!(dist.controller(), controller);
    assert_eq!(dist.balance_available(), 0);
    assert_eq!(dist.total_paid(), 0);
    assert_eq!(dist.decimals(), 7);
    assert_eq!(dist.symbol(), String::from_str(&env, "GRW"));
    assert_eq!(dist.name(), String::from_str(&env, "Group Reward"));
    let _ = admin;
}

#[test]
fn events_are_emitted_for_fund_pay_withdraw() {
    let env = Env::default();
    env.mock_all_auths();
    let (admin, _controller, reward, dist_id, dist) = bare_distributor(&env);
    let a = Address::generate(&env);
    reward.mint(&a, &100);

    let ours = |env: &Env| env.events().all().filter_by_contract(&dist_id).events().len();
    dist.fund(&a, &100);
    assert_eq!(ours(&env), 1);
    dist.mint(&a, &30);
    assert_eq!(ours(&env), 1);
    dist.withdraw_unallocated(&admin, &a, &20);
    assert_eq!(ours(&env), 1);
    assert_eq!(dist.total_paid(), 30);
    assert_eq!(dist.balance_available(), 50);
}
