//! Reward distributor: registered as the group controller's reward token (`set_peridot_token`).
//!
//! What the audited core controller actually does at claim time (core/simple-peridottroller
//! `pay_accrued_rewards`, NOT the `mint(to, amount)` described in the early handoff notes):
//!
//! 1. `token.balance(controller)`, then `payable = min(balance, accrued)`; if `payable <= 0` the
//!    claim is a soft failure and the user's accrued balance is kept.
//! 2. `env.authorize_as_current_contract` for `token.transfer(controller, user, payable)`, then
//!    `try_invoke_contract(token, "transfer", (controller, user, payable))`. Any failure is a soft
//!    failure (event, accrued kept). On success it subtracts exactly `payable` from accrued, so a
//!    partial payout (balance below accrued) is correct and the remainder stays claimable.
//!
//! This contract therefore presents a minimal SEP-41-shaped surface to the controller:
//! `balance(controller)` is the reward balance held here and `transfer(controller, to, amount)`
//! pays that amount of the real reward token to `to`. `mint(to, amount)` is kept as an alias
//! (controller auth) so the `RewardDistributor` trait client keeps working. The controller never
//! calls anything else on its reward token (`set_peridot_token` only stores the address).
#![no_std]

use soroban_sdk::{
    contract, contracterror, contractevent, contractimpl, contracttype, token, Address, BytesN,
    Env, String,
};

/// Instance TTL bump (ledgers): threshold ~1 day, extend to ~30 days at 5s ledgers.
const TTL_THRESHOLD: u32 = 17_280;
const TTL_EXTEND_TO: u32 = 518_400;

#[contracttype]
#[derive(Clone)]
enum DataKey {
    Admin,
    Controller,
    RewardToken,
    TotalPaid,
    TotalFunded,
    TotalWithdrawn,
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum RewardError {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    Unauthorized = 3,
    InvalidAmount = 4,
    InsufficientBalance = 5,
    MathOverflow = 6,
    InvalidAddress = 7,
}

#[contractevent(topics = ["funded"])]
pub struct Funded {
    pub from: Address,
    pub amount: i128,
}

#[contractevent(topics = ["paid"])]
pub struct Paid {
    pub to: Address,
    pub amount: i128,
}

#[contractevent(topics = ["withdrawn"])]
pub struct Withdrawn {
    pub to: Address,
    pub amount: i128,
}

#[contractevent(topics = ["upgraded"])]
pub struct Upgraded {
    pub new_wasm_hash: BytesN<32>,
}

#[contract]
pub struct RewardDistributor;

fn bump(env: &Env) {
    env.storage()
        .instance()
        .extend_ttl(TTL_THRESHOLD, TTL_EXTEND_TO);
}

fn get_addr(env: &Env, key: DataKey) -> Result<Address, RewardError> {
    env.storage()
        .instance()
        .get(&key)
        .ok_or(RewardError::NotInitialized)
}

fn get_total(env: &Env, key: DataKey) -> i128 {
    env.storage().instance().get(&key).unwrap_or(0i128)
}

fn add_total(env: &Env, key: DataKey, amount: i128) -> Result<(), RewardError> {
    let next = get_total(env, key.clone())
        .checked_add(amount)
        .ok_or(RewardError::MathOverflow)?;
    env.storage().instance().set(&key, &next);
    Ok(())
}

fn require_admin(env: &Env, admin: &Address) -> Result<(), RewardError> {
    let stored = get_addr(env, DataKey::Admin)?;
    if *admin != stored {
        return Err(RewardError::Unauthorized);
    }
    admin.require_auth();
    Ok(())
}

fn real_token(env: &Env) -> Result<token::Client<'_>, RewardError> {
    Ok(token::Client::new(
        env,
        &get_addr(env, DataKey::RewardToken)?,
    ))
}

fn available(env: &Env) -> Result<i128, RewardError> {
    Ok(real_token(env)?.balance(&env.current_contract_address()))
}

/// Pays exactly `amount` of the real token to `to`, or errors. Never partial.
fn pay_out(env: &Env, to: &Address, amount: i128) -> Result<(), RewardError> {
    if amount <= 0 {
        return Err(RewardError::InvalidAmount);
    }
    let this = env.current_contract_address();
    if to == &this {
        return Err(RewardError::InvalidAddress);
    }
    let tok = real_token(env)?;
    if tok.balance(&this) < amount {
        return Err(RewardError::InsufficientBalance);
    }
    add_total(env, DataKey::TotalPaid, amount)?;
    tok.transfer(&this, to, &amount);
    Paid {
        to: to.clone(),
        amount,
    }
    .publish(env);
    Ok(())
}

#[contractimpl]
impl RewardDistributor {
    /// `admin` is the market-factory contract. `controller` is the group controller that will be
    /// allowed to draw rewards. `reward_token` is the real SEP-41 token that is paid out.
    pub fn __constructor(
        env: Env,
        admin: Address,
        controller: Address,
        reward_token: Address,
    ) -> Result<(), RewardError> {
        if env.storage().instance().has(&DataKey::Admin) {
            return Err(RewardError::AlreadyInitialized);
        }
        let this = env.current_contract_address();
        if reward_token == this || controller == this {
            return Err(RewardError::InvalidAddress);
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage()
            .instance()
            .set(&DataKey::Controller, &controller);
        env.storage()
            .instance()
            .set(&DataKey::RewardToken, &reward_token);
        bump(&env);
        Ok(())
    }

    // ---------------------------------------------------------------------------------------
    // Controller-facing surface
    // ---------------------------------------------------------------------------------------

    /// Trait-compatible alias for a controller payout. Callable only by the group controller.
    /// Pays exactly `amount` or fails. `amount <= 0` is rejected.
    pub fn mint(env: Env, to: Address, amount: i128) -> Result<(), RewardError> {
        bump(&env);
        let controller = get_addr(&env, DataKey::Controller)?;
        controller.require_auth();
        pay_out(&env, &to, amount)
    }

    /// SEP-41-shaped transfer used by the core controller's `claim`. `from` must be the controller
    /// (the controller authorizes it as the current contract). Pays `amount` of the real token to
    /// `to` or fails; the controller treats failure as a soft failure and keeps accrued rewards.
    pub fn transfer(
        env: Env,
        from: Address,
        to: Address,
        amount: i128,
    ) -> Result<(), RewardError> {
        bump(&env);
        let controller = get_addr(&env, DataKey::Controller)?;
        if from != controller {
            return Err(RewardError::Unauthorized);
        }
        from.require_auth();
        pay_out(&env, &to, amount)
    }

    /// SEP-41-shaped balance read. The controller reads `balance(controller)` to size a payout.
    /// Only the controller has a reward balance (the funded pool); every other address is zero.
    pub fn balance(env: Env, id: Address) -> Result<i128, RewardError> {
        bump(&env);
        if id == get_addr(&env, DataKey::Controller)? {
            available(&env)
        } else {
            Ok(0)
        }
    }

    // ---------------------------------------------------------------------------------------
    // Funding and admin
    // ---------------------------------------------------------------------------------------

    /// Anyone with auth can top up the reward balance.
    pub fn fund(env: Env, from: Address, amount: i128) -> Result<(), RewardError> {
        bump(&env);
        from.require_auth();
        if amount <= 0 {
            return Err(RewardError::InvalidAmount);
        }
        let this = env.current_contract_address();
        if from == this {
            return Err(RewardError::InvalidAddress);
        }
        add_total(&env, DataKey::TotalFunded, amount)?;
        real_token(&env)?.transfer(&from, &this, &amount);
        Funded { from, amount }.publish(&env);
        Ok(())
    }

    /// Factory only (on owner request). Withdrawing can leave accrued rewards unclaimable until
    /// the balance is refunded.
    pub fn withdraw_unallocated(
        env: Env,
        admin: Address,
        to: Address,
        amount: i128,
    ) -> Result<(), RewardError> {
        bump(&env);
        require_admin(&env, &admin)?;
        if amount <= 0 {
            return Err(RewardError::InvalidAmount);
        }
        let this = env.current_contract_address();
        if to == this {
            return Err(RewardError::InvalidAddress);
        }
        let tok = real_token(&env)?;
        if tok.balance(&this) < amount {
            return Err(RewardError::InsufficientBalance);
        }
        add_total(&env, DataKey::TotalWithdrawn, amount)?;
        tok.transfer(&this, &to, &amount);
        Withdrawn { to, amount }.publish(&env);
        Ok(())
    }

    /// Immediate upgrade, factory (admin) only.
    pub fn upgrade(
        env: Env,
        admin: Address,
        new_wasm_hash: BytesN<32>,
    ) -> Result<(), RewardError> {
        bump(&env);
        require_admin(&env, &admin)?;
        env.deployer()
            .update_current_contract_wasm(new_wasm_hash.clone());
        Upgraded { new_wasm_hash }.publish(&env);
        Ok(())
    }

    // ---------------------------------------------------------------------------------------
    // Views
    // ---------------------------------------------------------------------------------------

    pub fn reward_token(env: Env) -> Result<Address, RewardError> {
        bump(&env);
        get_addr(&env, DataKey::RewardToken)
    }

    pub fn controller(env: Env) -> Result<Address, RewardError> {
        bump(&env);
        get_addr(&env, DataKey::Controller)
    }

    pub fn admin(env: Env) -> Result<Address, RewardError> {
        bump(&env);
        get_addr(&env, DataKey::Admin)
    }

    /// Real reward-token balance held by this contract (what can be paid out right now).
    pub fn balance_available(env: Env) -> Result<i128, RewardError> {
        bump(&env);
        available(&env)
    }

    /// Cumulative amount paid to users through the controller.
    pub fn total_paid(env: Env) -> Result<i128, RewardError> {
        bump(&env);
        get_addr(&env, DataKey::Admin)?;
        Ok(get_total(&env, DataKey::TotalPaid))
    }

    pub fn total_funded(env: Env) -> Result<i128, RewardError> {
        bump(&env);
        get_addr(&env, DataKey::Admin)?;
        Ok(get_total(&env, DataKey::TotalFunded))
    }

    pub fn total_withdrawn(env: Env) -> Result<i128, RewardError> {
        bump(&env);
        get_addr(&env, DataKey::Admin)?;
        Ok(get_total(&env, DataKey::TotalWithdrawn))
    }

    // SEP-41 read compatibility, forwarded to the real reward token.
    pub fn decimals(env: Env) -> Result<u32, RewardError> {
        bump(&env);
        Ok(real_token(&env)?.decimals())
    }

    pub fn symbol(env: Env) -> Result<String, RewardError> {
        bump(&env);
        Ok(real_token(&env)?.symbol())
    }

    pub fn name(env: Env) -> Result<String, RewardError> {
        bump(&env);
        Ok(real_token(&env)?.name())
    }
}

#[cfg(test)]
mod test;
