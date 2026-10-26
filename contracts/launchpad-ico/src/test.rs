use super::*;
use soroban_sdk::{testutils::{Address as _, Ledger}, token::{Client, StellarAssetClient}};

struct Ctx { e: Env, id: Address, token: Address, quote: Address, creator: Address, a: Address, b: Address }
impl Ctx {
    fn new(soft: i128, price: i128, cap: i128) -> Self {
        let e = Env::default(); e.mock_all_auths();
        let creator = Address::generate(&e); let a = Address::generate(&e); let b = Address::generate(&e);
        let token = e.register_stellar_asset_contract_v2(creator.clone()).address();
        let quote = e.register_stellar_asset_contract_v2(creator.clone()).address();
        let id = Address::generate(&e);
        StellarAssetClient::new(&e, &token).mint(&id, &1000_0000000);
        for user in [&a, &b] { StellarAssetClient::new(&e, &quote).mint(user, &1000_0000000); }
        e.register_at(&id, Ico, (token.clone(), creator.clone(), IcoParams {
            quote_token: quote.clone(), supply: 1000_0000000, price, soft_cap: soft, hard_cap: 100_0000000,
            start: 100, end: 700, buyer_cap: cap,
        }));
        Self { e, id, token, quote, creator, a, b }
    }
    fn c(&self) -> IcoClient<'_> { IcoClient::new(&self.e, &self.id) }
    fn time(&self, n: u64) { self.e.ledger().with_mut(|l| l.timestamp = n); }
    fn balance(&self, token: &Address, owner: &Address) -> i128 { Client::new(&self.e, token).balance(owner) }
}
#[test]
fn success_two_buyers_withdraw_then_claim_and_double_claim() {
    let x = Ctx::new(50_0000000, SCALE, 0); x.time(100);
    x.c().buy(&x.a, &30_0000000); x.c().buy(&x.b, &20_0000000);
    assert_eq!(x.c().try_withdraw(&x.creator), Err(Ok(IcoError::NotEnded)));
    assert_eq!(x.c().try_claim(&x.a), Err(Ok(IcoError::NotEnded)));
    x.time(700); assert_eq!(x.c().finalize(), 1); assert_eq!(x.c().finalize(), 1);
    assert_eq!(x.c().withdraw(&x.creator), (50_0000000, 950_0000000));
    assert_eq!(x.c().try_withdraw(&x.creator), Err(Ok(IcoError::AlreadyWithdrawn)));
    assert_eq!(x.c().claim(&x.a), 30_0000000); assert_eq!(x.c().claim(&x.b), 20_0000000);
    assert_eq!(x.c().try_claim(&x.a), Err(Ok(IcoError::AlreadyClaimed)));
    assert_eq!(x.c().try_refund(&x.a), Err(Ok(IcoError::NotFailed)));
    assert_eq!(x.balance(&x.token, &x.id), 0); assert_eq!(x.balance(&x.quote, &x.id), 0);
}
#[test]
fn failed_sale_full_refunds_creator_reclaim_and_double_refund() {
    let x = Ctx::new(80_0000000, SCALE, 0); x.time(100);
    x.c().buy(&x.a, &30_0000000); x.c().buy(&x.b, &20_0000000);
    x.time(700); assert_eq!(x.c().withdraw(&x.creator), (0, 1000_0000000));
    assert_eq!(x.c().refund(&x.a), 30_0000000); assert_eq!(x.c().refund(&x.b), 20_0000000);
    assert_eq!(x.c().try_refund(&x.a), Err(Ok(IcoError::AlreadyRefunded)));
    assert_eq!(x.c().try_claim(&x.a), Err(Ok(IcoError::NotSuccessful)));
    assert_eq!(x.balance(&x.quote, &x.a), 1000_0000000); assert_eq!(x.balance(&x.quote, &x.id), 0);
}
#[test]
fn time_hard_cap_and_invalid_amount_bounds() {
    let x = Ctx::new(50_0000000, SCALE, 0);
    assert_eq!(x.c().try_buy(&x.a, &1), Err(Ok(IcoError::BeforeStart)));
    x.time(100);
    assert_eq!(x.c().try_buy(&x.a, &0), Err(Ok(IcoError::InvalidAmount)));
    assert_eq!(x.c().try_buy(&x.a, &-1), Err(Ok(IcoError::InvalidAmount)));
    assert_eq!(x.c().try_buy(&x.a, &i128::MAX), Err(Ok(IcoError::HardCap)));
    x.c().buy(&x.a, &100_0000000);
    assert_eq!(x.c().try_buy(&x.b, &1), Err(Ok(IcoError::HardCap)));
    assert_eq!(x.c().try_finalize(), Err(Ok(IcoError::NotEnded)));
    x.time(700); assert_eq!(x.c().try_buy(&x.b, &1), Err(Ok(IcoError::SaleClosed)));
}
#[test]
fn cumulative_wallet_cap_and_rounding_dust() {
    let x = Ctx::new(50_0000000, 3 * SCALE, 30_0000000); x.time(100);
    assert_eq!(x.c().try_buy(&x.a, &1), Err(Ok(IcoError::Dust)));
    assert_eq!(x.c().buy(&x.a, &10_0000000), 33_333_333);
    assert_eq!(x.c().buy(&x.a, &20_0000000), 66_666_666);
    assert_eq!(x.c().try_buy(&x.a, &3), Err(Ok(IcoError::BuyerCap)));
    assert_eq!(x.c().get_position(&x.a).tokens, 99_999_999);
    x.time(700); assert_eq!(x.c().refund(&x.a), 30_0000000);
}
#[test]
fn pause_never_traps_claims_or_refunds_and_upgrade_locks() {
    for soft in [10_0000000, 80_0000000] {
        let x = Ctx::new(soft, SCALE, 0); x.time(100);
        let admin = admin_address(&x.e);
        assert_eq!(x.c().try_set_paused(&x.a, &true), Err(Ok(IcoError::NotAdmin)));
        x.c().buy(&x.a, &10_0000000); x.c().set_paused(&admin, &true);
        assert_eq!(x.c().try_buy(&x.b, &1), Err(Ok(IcoError::Paused)));
        assert_eq!(x.c().try_upgrade(&admin, &BytesN::from_array(&x.e, &[0;32])), Err(Ok(IcoError::UpgradeLocked)));
        x.time(700);
        if soft == 10_0000000 { x.c().claim(&x.a); } else { x.c().refund(&x.a); }
        x.c().withdraw(&x.creator);
    }
}
#[test]
fn authorization_and_empty_positions() {
    let x = Ctx::new(10_0000000, SCALE, 0); x.time(100);
    assert_eq!(x.c().try_withdraw(&x.a), Err(Ok(IcoError::NotCreator)));
    x.e.mock_all_auths_allowing_non_root_auth(); x.c().buy(&x.a, &10_0000000); x.time(700);
    assert_eq!(x.c().try_claim(&x.b), Err(Ok(IcoError::NothingToClaim)));
    x.e.mock_auths(&[]);
    assert!(x.c().try_claim(&x.a).is_err());
    assert!(x.c().try_withdraw(&x.creator).is_err());
}
#[test]
fn parameter_ranges_and_overflow_are_rejected() {
    let x = Ctx::new(10_0000000, SCALE, 0); let p = x.c().get_config().params;
    assert!(p.valid(100)); assert!(!p.valid(101));
    for duration in [0, 599, 2_592_001] { let mut q = p.clone(); q.end = q.start + duration; assert!(!q.valid(0)); }
    let mut q = p.clone(); q.end = q.start + 2_592_000; assert!(q.valid(0));
    for amount in [-1, 0, i128::MAX] {
        let mut q = p.clone(); q.price = amount; assert!(!q.valid(0));
        let mut q = p.clone(); q.supply = amount; assert!(!q.valid(0));
        let mut q = p.clone(); q.hard_cap = amount; assert!(!q.valid(0));
    }
    let mut q = p.clone(); q.soft_cap = q.hard_cap + 1; assert!(!q.valid(0));
    let mut q = p.clone(); q.supply = 1; assert!(!q.valid(0));
}
#[test]
#[should_panic]
fn unfunded_constructor_rejected() {
    let x = Ctx::new(10_0000000, SCALE, 0);
    x.e.register(Ico, (x.token.clone(), x.creator.clone(), x.c().get_config().params));
}
