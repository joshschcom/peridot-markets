//! Launchpad bonding curve (docs/SPECS.md, launchpad sections), one contract per launch.
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
//! Graduation (stage 2): once the target is reached, the permissionless `graduate(payer)` state machine
//! (see `graduation.rs` and docs/SPECS.md) seeds an Aquarius standard pool with all raised quote and the whole
//! `lp_supply`, burns the LP shares (liquidity locked for good) and the unsold curve tokens, then builds the
//! token's own Peridot market group. The curve owns the group until the creator calls `claim_group`.
#![no_std]

mod errors;
mod events;
mod graduation;
mod math;
pub mod params;
mod types;

#[cfg(test)]
mod test;
#[cfg(test)]
mod test_aquarius;
#[cfg(test)]
mod test_grad;

use soroban_sdk::{contract, contractimpl, token, Address, BytesN, Env};

use graduation::{MarketFactoryClient};

pub use errors::CurveError;
pub use params::{CurveParams, DEFAULT_CREATOR_CAP_BPS, DEFAULT_TRADE_FEE_BPS};
pub use types::{
    BuyQuote, Config, CurveInfo, GradStep, Graduation, GraduationConfig, GraduationVenue, Phase, SellQuote, State,
};

use params::{validate, ParamError, BPS};

const TTL_THRESHOLD: u32 = 100_000; // below testnet's 120_960 default so creation never bumps
const TTL_EXTEND_TO: u32 = 400_000;
/// Price scale: quote base units per token base unit, times 1e7.
const PRICE_SCALE: u128 = 10_000_000;

#[soroban_sdk::contracttype]
enum DataKey {
    Config,
    State,
    Graduation,
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

fn graduation_state(env: &Env) -> Option<Graduation> {
    env.storage().instance().get(&DataKey::Graduation)
}

fn save_graduation(env: &Env, g: &Graduation) {
    env.storage().instance().set(&DataKey::Graduation, g);
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

/// Enters `Graduatable` once `real_quote` reaches the target, emitting `StateChanged`. `Graduatable` is
/// STICKY: later sells never move the phase back to `Trading`, so buys stay closed.
fn sync_phase(env: &Env, cfg: &Config, s: &mut State) {
    if s.phase == Phase::Trading && s.real_quote >= cfg.params.graduation_target {
        events::StateChanged { from: s.phase, to: Phase::Graduatable, real_quote: s.real_quote }.publish(env);
        s.phase = Phase::Graduatable;
    }
}

fn set_phase(env: &Env, s: &mut State, to: Phase) {
    if s.phase != to {
        events::StateChanged { from: s.phase, to, real_quote: s.real_quote }.publish(env);
        s.phase = to;
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
    // Sells work in `Trading` and `Graduatable` only: after the first graduation step all trading ends.
    if s.phase == Phase::Graduating || s.phase == Phase::Graduated {
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
        graduation: GraduationConfig,
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
        let cfg = Config { token, quote_token, creator, factory, treasury, params, k, graduation };
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

    /// Permissionless graduation, one step per call (Soroban bounds the ledger entries a transaction may touch).
    /// Each call performs the NEXT step and returns the step reached; the last one returns `Graduated`:
    /// 1. `PoolCreated`: pulls the Aquarius creation fee (live from the router, in AQUA) from `payer`, creates the
    ///    standard 30 bps pool, seeds it with all raised quote and `lp_supply`, burns the LP shares and the unsold
    ///    curve tokens. Trading is closed from here on. Only this step needs `payer`'s signature; later steps
    ///    ignore it. Unspent fee (pool already existed) is refunded to `payer`.
    /// 2. `GroupCreated`: `market_factory.create_group(owner = this curve, name = token symbol)`.
    /// 3. `QuoteMarketAdded`, 4. `QuoteMarketActivated`: the quote asset market.
    /// 5. `TokenMarketAdded`, 6. `Graduated`: the token market priced from the pool (`AquariusOnly`).
    /// Reverts `NotGraduatable` before the target, `AlreadyGraduated` after the last step.
    pub fn graduate(env: Env, payer: Address) -> Result<GradStep, CurveError> {
        let cfg = config(&env);
        let mut s = state(&env);
        let mut g = match graduation_state(&env) {
            Some(g) => g,
            None => {
                if s.phase != Phase::Graduatable {
                    return Err(CurveError::NotGraduatable);
                }
                payer.require_auth();
                let g = graduation::pool_step(&env, &cfg, &payer, s.real_quote)?;
                set_phase(&env, &mut s, Phase::Graduating);
                save_state(&env, &s);
                save_graduation(&env, &g);
                bump(&env);
                return Ok(GradStep::PoolCreated);
            }
        };
        let this = env.current_contract_address();
        let mf = MarketFactoryClient::new(&env, &cfg.graduation.market_factory);
        match g.step {
            GradStep::PoolCreated => {
                g.group_id = mf.create_group(&this, &graduation::group_name(&env, &cfg.token));
                g.step = GradStep::GroupCreated;
                events::GroupCreated { group_id: g.group_id }.publish(&env);
            }
            GradStep::GroupCreated => {
                let m = mf.add_market(&this, &g.group_id, &graduation::quote_market_config(&cfg, &g));
                events::MarketAdded { group_id: g.group_id, market: m.clone(), underlying: cfg.quote_token.clone(), is_quote: true }
                    .publish(&env);
                g.quote_market = Some(m);
                g.step = GradStep::QuoteMarketAdded;
            }
            GradStep::QuoteMarketAdded => {
                let m = g.quote_market.clone().expect("quote market");
                mf.activate_market(&this, &g.group_id, &m);
                events::MarketActivated { group_id: g.group_id, market: m, is_quote: true }.publish(&env);
                g.step = GradStep::QuoteMarketActivated;
            }
            GradStep::QuoteMarketActivated => {
                let m = mf.add_market(&this, &g.group_id, &graduation::token_market_config(&cfg, &g));
                events::MarketAdded { group_id: g.group_id, market: m.clone(), underlying: cfg.token.clone(), is_quote: false }
                    .publish(&env);
                g.token_market = Some(m);
                g.step = GradStep::TokenMarketAdded;
            }
            GradStep::TokenMarketAdded => {
                let m = g.token_market.clone().expect("token market");
                mf.activate_market(&this, &g.group_id, &m);
                events::MarketActivated { group_id: g.group_id, market: m, is_quote: false }.publish(&env);
                g.step = GradStep::Graduated;
                set_phase(&env, &mut s, Phase::Graduated);
                save_state(&env, &s);
                events::Graduated { token: cfg.token.clone(), pool: g.pool.clone(), group_id: g.group_id }.publish(&env);
            }
            _ => return Err(CurveError::AlreadyGraduated),
        }
        save_graduation(&env, &g);
        bump(&env);
        Ok(g.step)
    }

    /// The creator takes the market group (the curve is its owner until now). Requires `Graduated` and the
    /// creator's signature (the market factory needs the new owner to sign `transfer_ownership`).
    pub fn claim_group(env: Env, creator: Address) -> Result<u32, CurveError> {
        let cfg = config(&env);
        if creator != cfg.creator {
            return Err(CurveError::NotCreator);
        }
        creator.require_auth();
        let mut g = match graduation_state(&env) {
            Some(g) if g.step == GradStep::Graduated => g,
            _ => return Err(CurveError::NotGraduated),
        };
        if g.claimed {
            return Err(CurveError::GroupAlreadyClaimed);
        }
        g.claimed = true;
        save_graduation(&env, &g);
        bump(&env);
        MarketFactoryClient::new(&env, &cfg.graduation.market_factory).transfer_ownership(
            &env.current_contract_address(),
            &g.group_id,
            &creator,
        );
        events::GroupClaimed { group_id: g.group_id, owner: creator }.publish(&env);
        Ok(g.group_id)
    }

    /// `(fee token, amount)` the payer of the pool step must hold: read live from the Aquarius router (a pool
    /// that already exists costs nothing, and any unspent amount is refunded).
    pub fn graduation_cost(env: Env) -> Result<(Address, i128), CurveError> {
        graduation::creation_fee(&env, &config(&env))
    }

    /// Graduation facts (None until the pool step ran).
    pub fn get_graduation(env: Env) -> Option<Graduation> {
        graduation_state(&env)
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
