//! Unit tests against `mock-xoxno-lending` (same ABI as the real XOXNO controller). Integration with the
//! REAL XOXNO testnet/mainnet controller is exercised by `scripts/xoxno_vault_testnet.sh` (see SPECS).
extern crate std;

use super::*;
use mock_token::{MockToken, MockTokenClient};
use mock_xoxno_lending::{MockXoxnoLending, MockXoxnoLendingClient};
use soroban_sdk::testutils::Address as _;

type Args = (Address, Address, Address, u32, u32, Address, i128, i128, u32);

fn try_reg(env: &Env, args: Args) -> Result<Address, ()> {
    std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| env.register(XoxnoVault, args))).map_err(|_| ())
}

const E7: i128 = 10_000_000;

struct Ctx {
    env: Env,
    owner: Address,
    market: Address,
    keeper: Address,
    token: MockTokenClient<'static>,
    xoxno: MockXoxnoLendingClient<'static>,
    vault: XoxnoVaultClient<'static>,
}

fn make(env: &Env, owner: &Address, market: &Address, keeper: &Address, token: &Address, cap: i128, min: i128, fee: u32)
    -> Result<Address, ()> {
    let id = env.register(
        XoxnoVault,
        (owner.clone(), market.clone(), token.clone(), 1u32, 1u32, keeper.clone(), cap, min, fee),
    );
    Ok(id)
}

fn setup_with(fee: u32) -> Ctx {
    let env = Env::default();
    env.mock_all_auths_allowing_non_root_auth();
    let owner = Address::generate(&env);
    let market = Address::generate(&env);
    let keeper = Address::generate(&env);
    let token_id = env.register(MockToken, ());
    let token = MockTokenClient::new(&env, &token_id);
    token.initialize(&soroban_sdk::String::from_str(&env, "USDC"), &soroban_sdk::String::from_str(&env, "USDC"), &7);
    let xoxno_id = env.register_at(&Address::from_str(&env, DEFAULT_CONTROLLER), MockXoxnoLending, ());
    let xoxno = MockXoxnoLendingClient::new(&env, &xoxno_id);
    let vault_id = make(&env, &owner, &market, &keeper, &token_id, 1_000_000 * E7, E7, fee).unwrap();
    token.mint(&market, &(10_000 * E7));
    let vault = XoxnoVaultClient::new(&env, &vault_id);
    // SAFETY: the clients borrow `env`, which lives as long as `Ctx` (they are dropped together).
    let ctx = Ctx {
        owner,
        market,
        keeper,
        token: unsafe { core::mem::transmute(token) },
        xoxno: unsafe { core::mem::transmute(xoxno) },
        vault: unsafe { core::mem::transmute(vault) },
        env,
    };
    ctx
}

fn setup() -> Ctx {
    setup_with(1_000)
}

fn dep(c: &Ctx, amount: i128) {
    c.vault.deposit(&vec![&c.env, amount], &vec![&c.env, amount], &c.market, &true);
}

/// Credits `interest` of yield to the vault's XOXNO account.
fn accrue(c: &Ctx, interest: i128) {
    c.token.mint(&c.xoxno.address, &interest);
    c.xoxno.accrue(&c.vault.account_id().unwrap(), &interest);
}

#[test]
fn deposit_withdraw_roundtrip() {
    let c = setup();
    dep(&c, 100 * E7);
    assert_eq!(c.vault.balance(&c.market), 100 * E7);
    assert_eq!(c.vault.total_supply(), 100 * E7);
    assert_eq!(c.vault.get_asset_amounts_per_shares(&(100 * E7)), vec![&c.env, 100 * E7]);
    assert_eq!(c.token.balance(&c.market), 9_900 * E7);
    let out = c.vault.withdraw(&(40 * E7), &vec![&c.env, 0], &c.market);
    assert_eq!(out, vec![&c.env, 40 * E7]);
    assert_eq!(c.token.balance(&c.market), 9_940 * E7);
    assert_eq!(c.vault.get_state().principal, 60 * E7);
    // full exit closes the XOXNO account and forgets the id
    c.vault.withdraw(&(60 * E7), &vec![&c.env, 0], &c.market);
    assert_eq!(c.vault.account_id(), None);
    assert_eq!(c.vault.total_supply(), 0);
    assert_eq!(c.token.balance(&c.market), 10_000 * E7);
    // reopen
    dep(&c, 10 * E7);
    assert!(c.vault.account_id().is_some());
    assert_eq!(c.vault.balance(&c.market), 10 * E7);
}

#[test]
fn yield_accrues_to_depositors_and_fee_goes_to_owner() {
    let c = setup(); // 10% fee
    dep(&c, 100 * E7);
    accrue(&c, 10 * E7); // 110 value
    assert_eq!(c.vault.get_asset_amounts_per_shares(&(100 * E7)), vec![&c.env, 110 * E7]);
    c.env.as_contract(&c.vault.address, || {});
    let fee = c.vault.harvest(&c.keeper, &0);
    assert_eq!(fee, E7); // 10% of the 10 gain
    let owner_shares = c.vault.balance(&c.owner);
    assert!(owner_shares > 0);
    // owner's shares are worth ~ the fee, the depositor keeps the rest
    let owner_val = c.vault.get_asset_amounts_per_shares(&owner_shares).get(0).unwrap();
    assert!((owner_val - E7).abs() <= 2, "owner value {owner_val}");
    let dep_val = c.vault.get_asset_amounts_per_shares(&c.vault.balance(&c.market)).get(0).unwrap();
    assert!((dep_val - 109 * E7).abs() <= 2);
    // a second harvest with no new gain mints nothing
    assert_eq!(c.vault.harvest(&c.keeper, &0), 0);
    // depositor redeems everything
    c.vault.withdraw(&c.vault.balance(&c.market), &vec![&c.env, 0], &c.market);
    assert!(c.token.balance(&c.market) > 10_008 * E7);
}

#[test]
fn deposit_after_yield_prices_shares_against_value() {
    let c = setup_with(0);
    dep(&c, 100 * E7);
    accrue(&c, 100 * E7); // value doubles
    dep(&c, 100 * E7);
    assert_eq!(c.vault.balance(&c.market), 150 * E7); // 100 + 100 * 100/200
    assert_eq!(c.vault.get_asset_amounts_per_shares(&(150 * E7)), vec![&c.env, 300 * E7]);
}

#[test]
fn only_depositor_can_deposit() {
    let c = setup();
    let other = Address::generate(&c.env);
    c.token.mint(&other, &(10 * E7));
    let r = c.vault.try_deposit(&vec![&c.env, 5 * E7], &vec![&c.env, 0], &other, &true);
    assert_eq!(r.err().unwrap().unwrap(), Error::NotDepositor);
}

#[test]
fn cap_min_and_bad_vectors() {
    let c = setup();
    let r = c.vault.try_deposit(&vec![&c.env, E7 / 2], &vec![&c.env, 0], &c.market, &true);
    assert_eq!(r.err().unwrap().unwrap(), Error::BelowMinDeposit);
    c.vault.set_deposit_cap(&c.owner, &(50 * E7));
    let r = c.vault.try_deposit(&vec![&c.env, 51 * E7], &vec![&c.env, 0], &c.market, &true);
    assert_eq!(r.err().unwrap().unwrap(), Error::CapExceeded);
    let r = c.vault.try_deposit(&vec![&c.env, 1, 2], &vec![&c.env, 0], &c.market, &true);
    assert_eq!(r.err().unwrap().unwrap(), Error::InvalidVector);
    dep(&c, 50 * E7);
    let r = c.vault.try_deposit(&vec![&c.env, E7], &vec![&c.env, 0], &c.market, &true);
    assert_eq!(r.err().unwrap().unwrap(), Error::CapExceeded);
}

#[test]
fn pause_blocks_deposits_not_withdrawals() {
    let c = setup();
    dep(&c, 10 * E7);
    c.vault.pause(&c.owner, &true);
    assert!(c.vault.get_state().paused);
    let r = c.vault.try_deposit(&vec![&c.env, E7], &vec![&c.env, 0], &c.market, &true);
    assert_eq!(r.err().unwrap().unwrap(), Error::Paused);
    c.vault.withdraw(&(5 * E7), &vec![&c.env, 0], &c.market);
    // the protocol admin can pause too, strangers cannot
    c.vault.pause(&c.vault.admin(), &false);
    let stranger = Address::generate(&c.env);
    let r = c.vault.try_pause(&stranger, &true);
    assert_eq!(r.err().unwrap().unwrap(), Error::NotAdmin);
}

#[test]
fn bounded_owner_powers() {
    let c = setup();
    let stranger = Address::generate(&c.env);
    assert_eq!(c.vault.try_set_fee_bps(&stranger, &100).err().unwrap().unwrap(), Error::NotOwner);
    assert_eq!(c.vault.try_set_fee_bps(&c.owner, &(MAX_FEE_BPS + 1)).err().unwrap().unwrap(), Error::InvalidConfig);
    c.vault.set_fee_bps(&c.owner, &MAX_FEE_BPS);
    assert_eq!(c.vault.params().fee_bps, MAX_FEE_BPS);
    assert_eq!(c.vault.try_set_deposit_cap(&c.owner, &0).err().unwrap().unwrap(), Error::InvalidConfig);
    assert_eq!(c.vault.try_set_deposit_cap(&stranger, &5).err().unwrap().unwrap(), Error::NotOwner);
    let k2 = Address::generate(&c.env);
    c.vault.set_keeper(&c.owner, &k2);
    assert_eq!(c.vault.keeper(), k2);
    // old keeper can no longer harvest
    assert_eq!(c.vault.try_harvest(&c.keeper, &0).err().unwrap().unwrap(), Error::NotKeeper);
    // upgrade: only the baked admin
    let h = BytesN::from_array(&c.env, &[7; 32]);
    assert_eq!(c.vault.try_upgrade(&c.owner, &h).err().unwrap().unwrap(), Error::NotAdmin);
}

#[test]
fn constructor_bounds() {
    let env = Env::default();
    env.mock_all_auths_allowing_non_root_auth();
    let a = Address::generate(&env);
    let token_id = env.register(MockToken, ());
    env.register_at(&Address::from_str(&env, DEFAULT_CONTROLLER), MockXoxnoLending, ());
    // fee above the bound
    assert!(try_reg(&env, (a.clone(), a.clone(), token_id.clone(), 1u32, 1u32, a.clone(), 100i128, 1i128, MAX_FEE_BPS + 1)).is_err());
    // zero cap
    assert!(try_reg(&env, (a.clone(), a.clone(), token_id.clone(), 1u32, 1u32, a.clone(), 0i128, 1i128, 0u32)).is_err());
    // min deposit above cap
    assert!(try_reg(&env, (a.clone(), a.clone(), token_id.clone(), 1u32, 1u32, a.clone(), 10i128, 11i128, 0u32)).is_err());
    // ok
    assert!(try_reg(&env, (a.clone(), a.clone(), token_id, 1u32, 1u32, a, 10i128, 1i128, 100u32)).is_ok());
}

#[test]
fn constructor_rejects_frozen_market() {
    let env = Env::default();
    env.mock_all_auths_allowing_non_root_auth();
    let a = Address::generate(&env);
    let token_id = env.register(MockToken, ());
    let x = env.register_at(&Address::from_str(&env, DEFAULT_CONTROLLER), MockXoxnoLending, ());
    MockXoxnoLendingClient::new(&env, &x).set_frozen(&true);
    assert!(try_reg(&env, (a.clone(), a.clone(), token_id, 1u32, 1u32, a, 10i128, 1i128, 0u32)).is_err());
}

#[test]
fn liquidity_shortfall_changes_nothing() {
    let c = setup();
    dep(&c, 100 * E7);
    c.xoxno.set_max_withdraw(&(10 * E7));
    let r = c.vault.try_withdraw(&(50 * E7), &vec![&c.env, 0], &c.market);
    assert_eq!(r.err().unwrap().unwrap(), Error::LiquidityShortfall);
    assert_eq!(c.vault.balance(&c.market), 100 * E7);
    c.vault.withdraw(&(10 * E7), &vec![&c.env, 0], &c.market);
}

#[test]
fn views_never_panic_when_empty() {
    let c = setup();
    assert_eq!(c.vault.get_asset_amounts_per_shares(&E7), vec![&c.env, 0]);
    let s = c.vault.get_state();
    assert_eq!((s.total_shares, s.total_value, s.principal), (0, 0, 0));
    assert_eq!(c.vault.kind(), symbol_short!("xoxno"));
    assert_eq!(c.vault.market(), c.market);
}

#[test]
fn slippage_and_overdraw_rejected() {
    let c = setup();
    dep(&c, 10 * E7);
    let r = c.vault.try_withdraw(&(11 * E7), &vec![&c.env, 0], &c.market);
    assert_eq!(r.err().unwrap().unwrap(), Error::InsufficientShares);
    let r = c.vault.try_withdraw(&(5 * E7), &vec![&c.env, 6 * E7], &c.market);
    assert_eq!(r.err().unwrap().unwrap(), Error::SlippageExceeded);
}

#[test]
fn get_assets_matches_check_defindex_shape() {
    let c = setup();
    let a = c.vault.get_assets();
    assert_eq!(a.len(), 1);
    let set = a.get(0).unwrap();
    assert_eq!(set.address, c.token.address);
    assert_eq!(set.strategies.len(), 1);
    assert!(!set.strategies.get(0).unwrap().paused);
    c.vault.pause(&c.owner, &true);
    assert!(c.vault.get_assets().get(0).unwrap().strategies.get(0).unwrap().paused);
    assert_eq!(c.vault.get_asset_amounts_per_shares(&0).len(), 1);
}

#[test]
fn bind_market_is_one_time_owner_only_and_needs_an_empty_vault() {
    let c = setup();
    let m2 = Address::generate(&c.env);
    let stranger = Address::generate(&c.env);
    assert_eq!(c.vault.try_bind_market(&stranger, &m2).err().unwrap().unwrap(), Error::NotOwner);
    dep(&c, 5 * E7);
    assert_eq!(c.vault.try_bind_market(&c.owner, &m2).err().unwrap().unwrap(), Error::HasShares);
    c.vault.withdraw(&(5 * E7), &vec![&c.env, 0], &c.market);
    c.vault.bind_market(&c.owner, &m2);
    assert_eq!(c.vault.market(), m2);
    assert_eq!(c.vault.try_bind_market(&c.owner, &c.market).err().unwrap().unwrap(), Error::AlreadyBound);
    // the old depositor is locked out
    let r = c.vault.try_deposit(&vec![&c.env, E7], &vec![&c.env, 0], &c.market, &true);
    assert_eq!(r.err().unwrap().unwrap(), Error::NotDepositor);
}
