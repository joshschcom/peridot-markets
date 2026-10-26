//! Fixed-price testnet escrow. Buyers claim after success or receive full refunds after failure.
//! Unsold supply returns to the creator. No liquidity pool or vesting is configured.
//! Upgrade is permanently disabled after the first purchase, protecting buyer escrow from admin changes.
#![no_std]
pub mod types;
pub use types::{Config, IcoParams, Position, State, SCALE};
use soroban_sdk::{contract, contracterror, contractevent, contractimpl, contracttype, token, Address, BytesN, Env};

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum IcoError {
    InvalidParams = 101, NotFunded = 102, NotAdmin = 103, Paused = 104,
    BeforeStart = 105, SaleClosed = 106, InvalidAmount = 107, HardCap = 108,
    BuyerCap = 109, Dust = 110, NotEnded = 111, NotSuccessful = 112,
    NotFailed = 113, NothingToClaim = 114, AlreadyClaimed = 115, AlreadyRefunded = 116,
    NotCreator = 117, AlreadyWithdrawn = 118, UpgradeLocked = 119,
}
#[contracttype]
enum Key { Config, State, Buyer(Address) }
#[contractevent(topics = ["create"])]
pub struct Created { pub token: Address, pub creator: Address, pub params: IcoParams }
#[contractevent(topics = ["buy"])]
pub struct Bought { #[topic] pub user: Address, pub quote: i128, pub tokens: i128 }
#[contractevent(topics = ["finalize"])]
pub struct Finalized { pub phase: u32, pub raised: i128 }
#[contractevent(topics = ["claim"])]
pub struct Claimed { #[topic] pub user: Address, pub tokens: i128 }
#[contractevent(topics = ["refund"])]
pub struct Refunded { #[topic] pub user: Address, pub quote: i128 }
#[contractevent(topics = ["withdraw"])]
pub struct Withdrawn { pub quote: i128, pub tokens: i128 }

fn bump(e: &Env) { e.storage().instance().extend_ttl(100_000, 400_000); }
fn cfg(e: &Env) -> Config { e.storage().instance().get(&Key::Config).unwrap() }
fn state(e: &Env) -> State { e.storage().instance().get(&Key::State).unwrap() }
fn save(e: &Env, s: &State) { e.storage().instance().set(&Key::State, s); bump(e); }
fn position(e: &Env, user: &Address) -> Position {
    let key = Key::Buyer(user.clone());
    if e.storage().persistent().has(&key) { e.storage().persistent().extend_ttl(&key, 100_000, 400_000); }
    e.storage().persistent().get(&key).unwrap_or_default()
}
fn save_position(e: &Env, user: &Address, p: &Position) {
    let key = Key::Buyer(user.clone());
    e.storage().persistent().set(&key, p);
    e.storage().persistent().extend_ttl(&key, 100_000, 400_000);
}
fn admin_address(e: &Env) -> Address {
    let value = if cfg!(test) {
        option_env!("ICO_INIT_ADMIN").unwrap_or("GBZ7C3N43KURCM3DWN4LOOKR5XWHNU6EZEJQT5VGRLHKUUQQYL7UXFMJ")
    } else { option_env!("ICO_INIT_ADMIN").expect("ICO_INIT_ADMIN must be set at build time") };
    Address::from_str(e, value)
}
fn auth_admin(e: &Env, admin: &Address) -> Result<(), IcoError> {
    if *admin != admin_address(e) { return Err(IcoError::NotAdmin); }
    admin.require_auth(); Ok(())
}
#[contract]
pub struct Ico;
#[contractimpl]
impl Ico {
    pub fn __constructor(e: Env, token: Address, creator: Address, params: IcoParams) {
        if !params.valid(e.ledger().timestamp()) || token == params.quote_token
            || token::Client::new(&e, &params.quote_token).decimals() != 7
            || token::Client::new(&e, &token).decimals() != 7 {
            soroban_sdk::panic_with_error!(&e, IcoError::InvalidParams);
        }
        if token::Client::new(&e, &token).balance(&e.current_contract_address()) < params.supply {
            soroban_sdk::panic_with_error!(&e, IcoError::NotFunded);
        }
        e.storage().instance().set(&Key::Config, &Config { token: token.clone(), creator: creator.clone(), params: params.clone() });
        save(&e, &State { phase: 0, raised: 0, allocated: 0, paused: false, withdrawn: false });
        Created { token, creator, params }.publish(&e);
    }
    pub fn get_config(e: Env) -> Config { bump(&e); cfg(&e) }
    pub fn get_state(e: Env) -> State { bump(&e); state(&e) }
    pub fn get_position(e: Env, user: Address) -> Position { bump(&e); position(&e, &user) }
    /// Exact quote input, rejected rather than partially filled when the hard cap would be exceeded.
    /// Each purchase rounds tokens down. Dust that buys no token base unit is rejected.
    pub fn buy(e: Env, user: Address, amount: i128) -> Result<i128, IcoError> {
        user.require_auth();
        let c = cfg(&e); let mut s = state(&e); let mut p = position(&e, &user);
        if s.paused { return Err(IcoError::Paused); }
        if e.ledger().timestamp() < c.params.start { return Err(IcoError::BeforeStart); }
        if e.ledger().timestamp() >= c.params.end || s.phase != 0 { return Err(IcoError::SaleClosed); }
        if amount <= 0 { return Err(IcoError::InvalidAmount); }
        if amount > c.params.hard_cap - s.raised { return Err(IcoError::HardCap); }
        if c.params.buyer_cap > 0 && amount > c.params.buyer_cap - p.paid { return Err(IcoError::BuyerCap); }
        let tokens = amount * SCALE / c.params.price;
        if tokens == 0 { return Err(IcoError::Dust); }
        s.raised += amount; s.allocated += tokens; p.paid += amount; p.tokens += tokens;
        save(&e, &s); save_position(&e, &user, &p);
        token::Client::new(&e, &c.params.quote_token).transfer(&user, &e.current_contract_address(), &amount);
        Bought { user, quote: amount, tokens }.publish(&e); Ok(tokens)
    }
    pub fn finalize(e: Env) -> Result<u32, IcoError> {
        let c = cfg(&e); let mut s = state(&e);
        if e.ledger().timestamp() < c.params.end { return Err(IcoError::NotEnded); }
        if s.phase == 0 {
            s.phase = if s.raised >= c.params.soft_cap { 1 } else { 2 };
            save(&e, &s); Finalized { phase: s.phase, raised: s.raised }.publish(&e);
        }
        Ok(s.phase)
    }
    /// Auto-finalizes, so buyers do not depend on the creator or admin to unlock their claim.
    pub fn claim(e: Env, user: Address) -> Result<i128, IcoError> {
        user.require_auth();
        if Self::finalize(e.clone())? != 1 { return Err(IcoError::NotSuccessful); }
        let mut p = position(&e, &user);
        if p.claimed { return Err(IcoError::AlreadyClaimed); }
        if p.tokens == 0 { return Err(IcoError::NothingToClaim); }
        p.claimed = true; save_position(&e, &user, &p);
        token::Client::new(&e, &cfg(&e).token).transfer(&e.current_contract_address(), &user, &p.tokens);
        Claimed { user, tokens: p.tokens }.publish(&e); Ok(p.tokens)
    }
    pub fn refund(e: Env, user: Address) -> Result<i128, IcoError> {
        user.require_auth();
        if Self::finalize(e.clone())? != 2 { return Err(IcoError::NotFailed); }
        let mut p = position(&e, &user);
        if p.refunded { return Err(IcoError::AlreadyRefunded); }
        if p.paid == 0 { return Err(IcoError::NothingToClaim); }
        p.refunded = true; save_position(&e, &user, &p);
        token::Client::new(&e, &cfg(&e).params.quote_token).transfer(&e.current_contract_address(), &user, &p.paid);
        Refunded { user, quote: p.paid }.publish(&e); Ok(p.paid)
    }
    /// Success: raised quote and unsold tokens. Failure: all tokens, with quote reserved for refunds.
    pub fn withdraw(e: Env, creator: Address) -> Result<(i128, i128), IcoError> {
        let c = cfg(&e);
        if creator != c.creator { return Err(IcoError::NotCreator); }
        creator.require_auth(); Self::finalize(e.clone())?;
        let mut s = state(&e);
        if s.withdrawn { return Err(IcoError::AlreadyWithdrawn); }
        let quote = if s.phase == 1 { s.raised } else { 0 };
        let tokens = if s.phase == 1 { c.params.supply - s.allocated } else { c.params.supply };
        s.withdrawn = true; save(&e, &s);
        if quote > 0 { token::Client::new(&e, &c.params.quote_token).transfer(&e.current_contract_address(), &creator, &quote); }
        if tokens > 0 { token::Client::new(&e, &c.token).transfer(&e.current_contract_address(), &creator, &tokens); }
        Withdrawn { quote, tokens }.publish(&e); Ok((quote, tokens))
    }
    pub fn set_paused(e: Env, admin: Address, paused: bool) -> Result<(), IcoError> {
        auth_admin(&e, &admin)?; let mut s = state(&e); s.paused = paused; save(&e, &s); Ok(())
    }
    pub fn upgrade(e: Env, admin: Address, hash: BytesN<32>) -> Result<(), IcoError> {
        auth_admin(&e, &admin)?;
        if state(&e).raised != 0 { return Err(IcoError::UpgradeLocked); }
        e.deployer().update_current_contract_wasm(hash); Ok(())
    }
}
#[cfg(test)]
mod test;
