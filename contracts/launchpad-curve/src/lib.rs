//! Launchpad bonding curve (docs/handoff/12-LAUNCHPAD.md), one contract per launch.
//!
//! Constant product on virtual reserves quoted in a quote token (XLM SAC by default, any SEP-41 works):
//! `(virtual_quote + real_quote) * (virtual_token - sold) >= k`, `k = virtual_quote * virtual_token`.
//!
//! Safety properties (all enforced here, none depend on an admin):
//! - Parameters are immutable after the constructor and validated (see `params.rs`).
//! - No function moves raised quote out before graduation. The only outflows are: sellers (against tokens
//!   they return to the curve) and `claim_fees`, which can only pay out the accrued fee counters.
//! - Rounding always favours the curve: buys output `y - ceil(k / x')`, sells pay `x - ceil(k / y')`.
//! - Creator buys are capped cumulatively (`creator_cap_bps` of `curve_supply`).
//! - `upgrade` is callable only through the launch factory (immediate, house rule). That is the one trust
//!   assumption besides the token, which is immutable.
//!
//! Stage 2 (graduation into an Aquarius pool, locked LP, market group) plugs into `graduate`, which is a stub.
#![no_std]

mod errors;
mod events;
mod math;
pub mod params;
mod types;

#[cfg(test)]
mod test;

use soroban_sdk::{contract, contractimpl, token, Address, BytesN, Env};

pub use errors::CurveError;
pub use params::{CurveParams, DEFAULT_CREATOR_CAP_BPS, DEFAULT_TRADE_FEE_BPS};
pub use types::{BuyQuote, Config, CurveInfo, Phase, SellQuote, State};

use params::{validate, ParamError, BPS};

const TTL_THRESHOLD: u32 = 100_000; // below testnet's 120_960 default so creation never bumps
const TTL_EXTEND_TO: u32 = 400_000;
/// Price scale: quote base units per token base unit, times 1e7.
const PRICE_SCALE: u128 = 10_000_000;

#[soroban_sdk::contracttype]
enum DataKey {
    Config,
    State,
}

fn config(env: &Env) -> Config {
    env.storage().instance().get(&DataKey::Config).expect("not initialized")
}

fn state(env: &Env) -> State {
    env.storage().instance().get(&DataKey::State).expect("not initialized")
}

fn save_state(env: &Env, s: &State) {
    env.storage().instance().set(&DataKey::State, s);
}

fn bump(env: &Env) {
    env.storage().instance().extend_ttl(TTL_THRESHOLD, TTL_EXTEND_TO);
}

fn map_param_error(e: ParamError) -> CurveError {
    match e {
        ParamError::NonPositive => CurveError::NonPositiveParam,
        ParamError::TooLarge => CurveError::ParamTooLarge,
        ParamError::CurveSupplyNotBelowVirtual => CurveError::CurveSupplyNotBelowVirtual,
        ParamError::FeeTooHigh => CurveError::FeeTooHigh,
        ParamError::CreatorShareTooHigh => CurveError::CreatorShareTooHigh,
        ParamError::CreatorCapTooHigh => CurveError::CreatorCapTooHigh,
        ParamError::TargetSellsTooMuch => CurveError::TargetSellsTooMuch,
    }
}

fn u(v: i128) -> u128 {
    // All stored i128 values are non-negative by construction.
    v as u128
}

fn i(v: u128) -> Result<i128, CurveError> {
    i128::try_from(v).map_err(|_| CurveError::Overflow)
}

/// Current reserves `(x, y)`.
fn reserves(cfg: &Config, s: &State) -> Result<(u128, u128), CurveError> {
    let x = u(cfg.params.virtual_quote).checked_add(u(s.real_quote)).ok_or(CurveError::Overflow)?;
    let y = u(cfg.params.virtual_token).checked_sub(u(s.sold)).ok_or(CurveError::Overflow)?;
    Ok((x, y))
}

fn creator_cap(cfg: &Config) -> i128 {
    // curve_supply <= 1e19 and bps <= 2000, no overflow.
    cfg.params.curve_supply * i128::from(cfg.params.creator_cap_bps) / BPS as i128
}

/// Re-derives the phase from `real_quote`, emitting `StateChanged` on a transition. `Graduated` is terminal.
fn sync_phase(env: &Env, cfg: &Config, s: &mut State) {
    if s.phase == Phase::Graduated {
        return;
    }
    let next = if s.real_quote >= cfg.params.graduation_target { Phase::Graduatable } else { Phase::Trading };
    if next != s.phase {
        events::StateChanged { from: s.phase, to: next, real_quote: s.real_quote }.publish(env);
        s.phase = next;
    }
}

fn quote_buy_inner(cfg: &Config, s: &State, quote_in: i128) -> Result<math::BuyCalc, CurveError> {
    if quote_in <= 0 {
        return Err(CurveError::InvalidAmount);
    }
    if s.phase != Phase::Trading {
        return Err(CurveError::TradingClosed);
    }
    let (x, y) = reserves(cfg, s)?;
    let needed = u(cfg.params.graduation_target)
        .checked_sub(u(s.real_quote))
        .filter(|n| *n > 0)
        .ok_or(CurveError::TradingClosed)?;
    math::buy(cfg.k, x, y, needed, u(quote_in), u128::from(cfg.params.trade_fee_bps)).ok_or(CurveError::DustTrade)
}

fn quote_sell_inner(cfg: &Config, s: &State, tokens_in: i128) -> Result<math::SellCalc, CurveError> {
    if tokens_in <= 0 {
        return Err(CurveError::InvalidAmount);
    }
    if s.phase == Phase::Graduated {
        return Err(CurveError::TradingClosed);
    }
    if tokens_in > s.sold {
        return Err(CurveError::ExceedsSold);
    }
    let (x, y) = reserves(cfg, s)?;
    let c = math::sell(cfg.k, x, y, u(tokens_in), u128::from(cfg.params.trade_fee_bps)).ok_or(CurveError::DustTrade)?;
    if c.gross > u(s.real_quote) {
        // Unreachable by the invariant; kept as a hard guard.
        return Err(CurveError::Overflow);
    }
    Ok(c)
}

#[contract]
pub struct LaunchpadCurve;

#[contractimpl]
impl LaunchpadCurve {
    /// `token` must already hold at least `curve_supply + lp_supply` for this contract (the factory deploys the
    /// token first, minting its whole supply to this contract's pre-computed address).
    pub fn __constructor(
        env: Env,
        token: Address,
        quote_token: Address,
        creator: Address,
        factory: Address,
        treasury: Address,
        params: CurveParams,
    ) -> Result<(), CurveError> {
        validate(&params).map_err(map_param_error)?;
        if token == quote_token {
            return Err(CurveError::SameTokens);
        }
        let needed = params.curve_supply.checked_add(params.lp_supply).ok_or(CurveError::Overflow)?;
        let held = token::Client::new(&env, &token).balance(&env.current_contract_address());
        if held < needed {
            return Err(CurveError::CurveNotFunded);
        }
        let k = u(params.virtual_quote).checked_mul(u(params.virtual_token)).ok_or(CurveError::Overflow)?;
        let cfg = Config { token, quote_token, creator, factory, treasury, params, k };
        env.storage().instance().set(&DataKey::Config, &cfg);
        save_state(
            &env,
            &State {
                real_quote: 0,
                sold: 0,
                creator_bought: 0,
                fees_treasury: 0,
                fees_creator: 0,
                phase: Phase::Trading,
            },
        );
        Ok(())
    }

    /// Buys tokens with up to `quote_in` quote (fee included). Reverts unless at least `min_tokens_out`
    /// (strictly positive) tokens are delivered. A buy that would cross the graduation target is CLAMPED:
    /// only the quote needed to reach the target is charged and the remainder stays with the buyer, so the
    /// call is a partial fill, never a revert. Returns the tokens delivered.
    pub fn buy(env: Env, user: Address, quote_in: i128, min_tokens_out: i128) -> Result<i128, CurveError> {
        user.require_auth();
        if min_tokens_out <= 0 {
            return Err(CurveError::InvalidSlippageBound);
        }
        let cfg = config(&env);
        let mut s = state(&env);
        let c = quote_buy_inner(&cfg, &s, quote_in)?;
        let tokens_out = i(c.tokens_out)?;
        if tokens_out < min_tokens_out {
            return Err(CurveError::SlippageExceeded);
        }
        if user == cfg.creator {
            let total = s.creator_bought.checked_add(tokens_out).ok_or(CurveError::Overflow)?;
            if total > creator_cap(&cfg) {
                return Err(CurveError::CreatorCapExceeded);
            }
            s.creator_bought = total;
        }
        let (gross, fee, net) = (i(c.gross)?, i(c.fee)?, i(c.net)?);
        let creator_part = fee * i128::from(cfg.params.creator_fee_share_bps) / BPS as i128;
        s.real_quote += net;
        s.sold += tokens_out;
        s.fees_creator += creator_part;
        s.fees_treasury += fee - creator_part;
        sync_phase(&env, &cfg, &mut s);
        save_state(&env, &s);
        bump(&env);

        let this = env.current_contract_address();
        token::Client::new(&env, &cfg.quote_token).transfer(&user, &this, &gross);
        token::Client::new(&env, &cfg.token).transfer(&this, &user, &tokens_out);

        events::Buy {
            user,
            quote_in: gross,
            fee,
            tokens_out,
            clamped: c.clamped,
            real_quote: s.real_quote,
            sold: s.sold,
        }
        .publish(&env);
        Ok(tokens_out)
    }

    /// Sells `tokens_in` back to the curve. Reverts unless at least `min_quote_out` (strictly positive) quote
    /// is paid out. Allowed in `Trading` and `Graduatable` (holders are never locked in while a graduation is
    /// pending); a sell that takes `real_quote` below the target moves the phase back to `Trading`.
    pub fn sell(env: Env, user: Address, tokens_in: i128, min_quote_out: i128) -> Result<i128, CurveError> {
        user.require_auth();
        if min_quote_out <= 0 {
            return Err(CurveError::InvalidSlippageBound);
        }
        let cfg = config(&env);
        let mut s = state(&env);
        let c = quote_sell_inner(&cfg, &s, tokens_in)?;
        let quote_out = i(c.quote_out)?;
        if quote_out < min_quote_out {
            return Err(CurveError::SlippageExceeded);
        }
        let (gross, fee) = (i(c.gross)?, i(c.fee)?);
        let creator_part = fee * i128::from(cfg.params.creator_fee_share_bps) / BPS as i128;
        s.real_quote -= gross;
        s.sold -= tokens_in;
        s.fees_creator += creator_part;
        s.fees_treasury += fee - creator_part;
        sync_phase(&env, &cfg, &mut s);
        save_state(&env, &s);
        bump(&env);

        let this = env.current_contract_address();
        token::Client::new(&env, &cfg.token).transfer(&user, &this, &tokens_in);
        token::Client::new(&env, &cfg.quote_token).transfer(&this, &user, &quote_out);

        events::Sell { user, tokens_in, quote_out, fee, real_quote: s.real_quote, sold: s.sold }.publish(&env);
        Ok(quote_out)
    }

    /// Permissionless: pays the accrued fees to the treasury and the creator. This can only move the fee
    /// counters, never `real_quote`. Returns `(treasury_amount, creator_amount)`.
    pub fn claim_fees(env: Env) -> Result<(i128, i128), CurveError> {
        let cfg = config(&env);
        let mut s = state(&env);
        let (t, c) = (s.fees_treasury, s.fees_creator);
        s.fees_treasury = 0;
        s.fees_creator = 0;
        save_state(&env, &s);
        bump(&env);
        let this = env.current_contract_address();
        let q = token::Client::new(&env, &cfg.quote_token);
        if t > 0 {
            q.transfer(&this, &cfg.treasury, &t);
        }
        if c > 0 {
            q.transfer(&this, &cfg.creator, &c);
        }
        events::FeesClaimed { treasury_amount: t, creator_amount: c }.publish(&env);
        Ok((t, c))
    }

    /// Quote for a buy of up to `quote_in`. Does not apply the per-address creator cap.
    pub fn quote_buy(env: Env, quote_in: i128) -> Result<BuyQuote, CurveError> {
        let cfg = config(&env);
        let s = state(&env);
        let c = quote_buy_inner(&cfg, &s, quote_in)?;
        Ok(BuyQuote { quote_spent: i(c.gross)?, fee: i(c.fee)?, tokens_out: i(c.tokens_out)?, clamped: c.clamped })
    }

    pub fn quote_sell(env: Env, tokens_in: i128) -> Result<SellQuote, CurveError> {
        let cfg = config(&env);
        let s = state(&env);
        let c = quote_sell_inner(&cfg, &s, tokens_in)?;
        Ok(SellQuote { gross_quote: i(c.gross)?, fee: i(c.fee)?, quote_out: i(c.quote_out)? })
    }

    pub fn get_state(env: Env) -> Result<CurveInfo, CurveError> {
        let cfg = config(&env);
        let s = state(&env);
        let (x, y) = reserves(&cfg, &s)?;
        let p = &cfg.params;
        let price = x.checked_mul(PRICE_SCALE).ok_or(CurveError::Overflow)? / y;
        let total_supply = u(p.curve_supply + p.lp_supply);
        let fdv = price.checked_mul(total_supply).ok_or(CurveError::Overflow)? / PRICE_SCALE;
        let progress = (u(s.real_quote).min(u(p.graduation_target)) * BPS / u(p.graduation_target)) as u32;
        Ok(CurveInfo {
            phase: s.phase,
            price: i(price)?,
            progress_bps: progress,
            real_quote: s.real_quote,
            sold: s.sold,
            tokens_remaining: p.curve_supply - s.sold,
            virtual_quote: p.virtual_quote,
            virtual_token: p.virtual_token,
            graduation_target: p.graduation_target,
            fully_diluted_value: i(fdv)?,
            creator_bought: s.creator_bought,
            creator_cap: creator_cap(&cfg),
            fees_treasury_pending: s.fees_treasury,
            fees_creator_pending: s.fees_creator,
        })
    }

    pub fn get_config(env: Env) -> Config {
        config(&env)
    }

    /// Permissionless graduation. STAGE 2: not implemented. Reverts `NotGraduatable` before the target is
    /// reached and `NotImplemented` once it is, so the state machine is already enforced.
    pub fn graduate(env: Env) -> Result<(), CurveError> {
        let s = state(&env);
        if s.phase != Phase::Graduatable {
            return Err(CurveError::NotGraduatable);
        }
        Err(CurveError::NotImplemented)
    }

    /// Immediate upgrade (house rule). `admin` must be the launch factory, which exposes it to its own admin.
    pub fn upgrade(env: Env, admin: Address, new_wasm_hash: BytesN<32>) -> Result<(), CurveError> {
        let cfg = config(&env);
        if admin != cfg.factory {
            return Err(CurveError::NotFactory);
        }
        admin.require_auth();
        env.deployer().update_current_contract_wasm(new_wasm_hash.clone());
        events::Upgraded { wasm_hash: new_wasm_hash }.publish(&env);
        Ok(())
    }
}
