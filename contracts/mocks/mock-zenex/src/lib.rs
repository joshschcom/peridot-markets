//! TEST-ONLY mock of Zenex's market + strategy vault (docs.zenex.trade, verified against the mainnet
//! interfaces of CAOZCITW... and CB2MX4WX... on 2026-10-26). Zenex has NO testnet deployment, so testnet
//! integration of `zenex-vault` runs against this mock. Never deploy to mainnet.
//!
//! Faithful bits: `create_vault_order` escrows `amount + exec_fee` (deposit) or shares + `exec_fee`
//! (redeem) from `user` INSIDE the market frame (so the caller must pre-authorize those transfers), orders
//! are keyed (user, id) with ids from 1, `get_vault_order` traps 750 when absent, the vault prices with
//! F1..F4 (decimals_offset 6, virtual shares, +1 floor), deposit fee 0.1%, redeem fee 0.25%, redeem lock.
//! `mock_fill(user, id, reject)` plays the keeper (no price report needed).
#![no_std]
use soroban_sdk::{
    contract, contractclient, contracterror, contractimpl, contracttype, token, Address, Env, MuxedAddress, String,
};

pub const OFFSET: u32 = 6;
const BPS: i128 = 10_000;
pub const DEPOSIT_FEE_BPS: i128 = 10;
pub const REDEEM_FEE_BPS: i128 = 25;

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum MockError {
    InvalidOrder = 732,
    VaultOrderNotFound = 750,
    VaultOrderLocked = 751,
    VaultBalanceExceeded = 753,
    InvalidAmount = 800,
    InsufficientBalance = 100,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct VaultOrder {
    pub amount: i128,
    pub created_at: u64,
    pub exec_fee: i128,
    pub kind: u32,
    pub min_out: i128,
}

/// Subset of Zenex's 34-field `Config` (the adapter decodes it as a Map, so extra fields are fine).
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Config {
    pub deposit_fee: i128,
    pub exec_fee: i128,
    pub max_vault_balance: i128,
    pub min_deposit: i128,
    pub redeem_fee: i128,
    pub redeem_lock: u64,
}

#[contractclient(name = "VaultApiClient")]
pub trait VaultApi {
    fn preview_deposit(env: Env, assets_in: i128, net_pnl: i128) -> i128;
    fn preview_redeem(env: Env, shares: i128, net_pnl: i128) -> i128;
    fn mint_for_fill(env: Env, to: Address, shares: i128);
    fn burn_for_fill(env: Env, from: Address, shares: i128, receiver: Address, assets_out: i128);
}

#[contracttype]
#[derive(Clone)]
enum MKey {
    Token,
    Vault,
    Config,
    Status,
    Counter(Address),
    Order(Address, u32),
    Credit(Address),
}

#[cfg(feature = "market")]
#[contract]
pub struct MockZenexMarket;

#[cfg(feature = "market")]
#[contractimpl]
impl MockZenexMarket {
    pub fn __constructor(env: Env, token: Address, vault: Address, cfg: Config) {
        env.storage().instance().set(&MKey::Token, &token);
        env.storage().instance().set(&MKey::Vault, &vault);
        env.storage().instance().set(&MKey::Config, &cfg);
        env.storage().instance().set(&MKey::Status, &0u32);
    }
    pub fn get_token(env: Env) -> Address {
        env.storage().instance().get(&MKey::Token).unwrap()
    }
    pub fn get_vault(env: Env) -> Address {
        env.storage().instance().get(&MKey::Vault).unwrap()
    }
    pub fn get_status(env: Env) -> u32 {
        env.storage().instance().get(&MKey::Status).unwrap()
    }
    pub fn get_config(env: Env) -> Config {
        env.storage().instance().get(&MKey::Config).unwrap()
    }
    pub fn get_claimable_credit(env: Env, user: Address) -> i128 {
        env.storage().persistent().get(&MKey::Credit(user)).unwrap_or(0)
    }
    /// Test hook: park `amount` already held by the market as a credit for `user`.
    pub fn park_credit(env: Env, user: Address, amount: i128) {
        env.storage().persistent().set(&MKey::Credit(user), &amount);
    }
    pub fn claim_credit(env: Env, user: Address) -> i128 {
        user.require_auth();
        let c = Self::get_claimable_credit(env.clone(), user.clone());
        if c > 0 {
            env.storage().persistent().remove(&MKey::Credit(user.clone()));
            token::Client::new(&env, &Self::get_token(env.clone())).transfer(&env.current_contract_address(), &user, &c);
        }
        c
    }
    pub fn set_config(env: Env, cfg: Config) {
        env.storage().instance().set(&MKey::Config, &cfg);
    }

    pub fn create_vault_order(env: Env, user: Address, kind: u32, amount: i128, min_out: i128) -> Result<u32, MockError> {
        user.require_auth();
        if kind > 1 || amount <= 0 || min_out < 0 {
            return Err(MockError::InvalidOrder);
        }
        let cfg = Self::get_config(env.clone());
        let me = env.current_contract_address();
        let tok = token::Client::new(&env, &Self::get_token(env.clone()));
        if kind == 0 {
            if amount < cfg.min_deposit {
                return Err(MockError::InvalidOrder);
            }
            tok.transfer(&user, &me, &(amount + cfg.exec_fee));
        } else {
            token::Client::new(&env, &Self::get_vault(env.clone())).transfer(&user, &me, &amount);
            if cfg.exec_fee > 0 {
                tok.transfer(&user, &me, &cfg.exec_fee);
            }
        }
        let id: u32 = env.storage().persistent().get(&MKey::Counter(user.clone())).unwrap_or(0) + 1;
        env.storage().persistent().set(&MKey::Counter(user.clone()), &id);
        env.storage().persistent().set(
            &MKey::Order(user, id),
            &VaultOrder { amount, created_at: env.ledger().timestamp(), exec_fee: cfg.exec_fee, kind, min_out },
        );
        Ok(id)
    }

    pub fn get_vault_order(env: Env, user: Address, id: u32) -> Result<VaultOrder, MockError> {
        env.storage().persistent().get(&MKey::Order(user, id)).ok_or(MockError::VaultOrderNotFound)
    }

    pub fn cancel_vault_order(env: Env, user: Address, id: u32) -> Result<i128, MockError> {
        user.require_auth();
        let o = Self::get_vault_order(env.clone(), user.clone(), id)?;
        env.storage().persistent().remove(&MKey::Order(user.clone(), id));
        let me = env.current_contract_address();
        if o.kind == 0 {
            token::Client::new(&env, &Self::get_token(env.clone())).transfer(&me, &user, &(o.amount + o.exec_fee));
        } else {
            token::Client::new(&env, &Self::get_vault(env.clone())).transfer(&me, &user, &o.amount);
            if o.exec_fee > 0 {
                token::Client::new(&env, &Self::get_token(env.clone())).transfer(&me, &user, &o.exec_fee);
            }
        }
        Ok(o.amount)
    }

    /// Plays the Zenex keeper. `reject` simulates a fill below `min_out` (principal refunded, exec fee kept).
    pub fn mock_fill(env: Env, user: Address, id: u32, reject: bool) -> Result<i128, MockError> {
        let o = Self::get_vault_order(env.clone(), user.clone(), id)?;
        let cfg = Self::get_config(env.clone());
        let me = env.current_contract_address();
        let tok = token::Client::new(&env, &Self::get_token(env.clone()));
        let vault_addr = Self::get_vault(env.clone());
        let vault = VaultApiClient::new(&env, &vault_addr);
        env.storage().persistent().remove(&MKey::Order(user.clone(), id));
        if o.kind == 0 {
            if reject {
                tok.transfer(&me, &user, &o.amount);
                return Ok(0);
            }
            let fee = o.amount * DEPOSIT_FEE_BPS / BPS;
            let net = o.amount - fee;
            let quote = vault.preview_deposit(&net, &0);
            if o.min_out > 0 && quote < o.min_out {
                tok.transfer(&me, &user, &o.amount);
                return Ok(0);
            }
            tok.transfer(&me, &vault_addr, &net);
            // the real vault pulls from the market; here the assets are already moved, so mint directly
            vault.mint_for_fill(&user, &quote);
            if tok.balance(&vault_addr) > cfg.max_vault_balance {
                return Err(MockError::VaultBalanceExceeded);
            }
            Ok(quote)
        } else {
            if env.ledger().timestamp() < o.created_at + cfg.redeem_lock {
                env.storage().persistent().set(&MKey::Order(user, id), &o);
                return Err(MockError::VaultOrderLocked);
            }
            if reject {
                token::Client::new(&env, &vault_addr).transfer(&me, &user, &o.amount);
                return Ok(0);
            }
            let gross = vault.preview_redeem(&o.amount, &0);
            let fee = gross * REDEEM_FEE_BPS / BPS;
            if o.min_out > 0 && gross - fee < o.min_out {
                token::Client::new(&env, &vault_addr).transfer(&me, &user, &o.amount);
                return Ok(0);
            }
            vault.burn_for_fill(&me, &o.amount, &me, &gross);
            tok.transfer(&me, &user, &(gross - fee));
            Ok(gross - fee)
        }
    }
}

#[cfg(feature = "vault")]
#[contracttype]
#[derive(Clone)]
enum VKey {
    Asset,
    Supply,
    Bal(Address),
}

#[cfg(feature = "vault")]
#[contract]
pub struct MockZenexVault;

#[cfg(feature = "vault")]
fn supply(env: &Env) -> i128 {
    env.storage().instance().get(&VKey::Supply).unwrap_or(0)
}
#[cfg(feature = "vault")]
fn bal(env: &Env, a: &Address) -> i128 {
    env.storage().persistent().get(&VKey::Bal(a.clone())).unwrap_or(0)
}
#[cfg(feature = "vault")]
fn set_bal(env: &Env, a: &Address, v: i128) {
    env.storage().persistent().set(&VKey::Bal(a.clone()), &v);
}
#[cfg(feature = "vault")]
fn assets(env: &Env) -> i128 {
    let a: Address = env.storage().instance().get(&VKey::Asset).unwrap();
    token::Client::new(env, &a).balance(&env.current_contract_address())
}

#[cfg(feature = "vault")]
#[contractimpl]
impl MockZenexVault {
    pub fn __constructor(env: Env, asset: Address) {
        env.storage().instance().set(&VKey::Asset, &asset);
    }
    pub fn name(env: Env) -> String {
        String::from_str(&env, "Mock Zenex Vault")
    }
    pub fn symbol(env: Env) -> String {
        String::from_str(&env, "mxv")
    }
    pub fn decimals(_env: Env) -> u32 {
        7 + OFFSET
    }
    pub fn query_asset(env: Env) -> Address {
        env.storage().instance().get(&VKey::Asset).unwrap()
    }
    pub fn total_assets(env: Env) -> i128 {
        assets(&env)
    }
    pub fn total_supply(env: Env) -> i128 {
        supply(&env)
    }
    pub fn balance(env: Env, account: Address) -> i128 {
        bal(&env, &account)
    }
    pub fn transfer(env: Env, from: Address, to: MuxedAddress, amount: i128) -> Result<(), MockError> {
        from.require_auth();
        let to = to.address();
        let b = bal(&env, &from);
        if amount < 0 || b < amount {
            return Err(MockError::InsufficientBalance);
        }
        set_bal(&env, &from, b - amount);
        set_bal(&env, &to, bal(&env, &to) + amount);
        Ok(())
    }
    /// F3: shares = assets * (supply + 10^offset) / (assets_total - net_pnl + 1)
    pub fn preview_deposit(env: Env, assets_in: i128, net_pnl: i128) -> i128 {
        let basis = assets(&env) - net_pnl + 1;
        assets_in * (supply(&env) + 10i128.pow(OFFSET)) / basis
    }
    /// F4: assets = shares * (assets_total - net_pnl + 1) / (supply + 10^offset)
    pub fn preview_redeem(env: Env, shares: i128, net_pnl: i128) -> i128 {
        let basis = assets(&env) - net_pnl + 1;
        shares * basis / (supply(&env) + 10i128.pow(OFFSET))
    }
    // test hooks standing in for strategy_deposit / strategy_redeem (the assets move in mock_fill)
    pub fn mint_for_fill(env: Env, to: Address, shares: i128) {
        set_bal(&env, &to, bal(&env, &to) + shares);
        env.storage().instance().set(&VKey::Supply, &(supply(&env) + shares));
    }
    pub fn burn_for_fill(env: Env, from: Address, shares: i128, receiver: Address, assets_out: i128) {
        set_bal(&env, &from, bal(&env, &from) - shares);
        env.storage().instance().set(&VKey::Supply, &(supply(&env) - shares));
        let a: Address = env.storage().instance().get(&VKey::Asset).unwrap();
        token::Client::new(&env, &a).transfer(&env.current_contract_address(), &receiver, &assets_out);
    }
    /// Simulates trader losses/profit swings: a donation raises assets, `drain` lowers them.
    pub fn drain(env: Env, to: Address, amount: i128) {
        let a: Address = env.storage().instance().get(&VKey::Asset).unwrap();
        token::Client::new(&env, &a).transfer(&env.current_contract_address(), &to, &amount);
    }
}
