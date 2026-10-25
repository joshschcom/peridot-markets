//! Guardrails enforced on creation and every update (00-DROPOFF.md section 8).
//! Mirrored for the UI in `peridot-interfaces/ts/index.ts` (`GUARDRAILS`).
use peridot_interfaces::{MarketConfig, PriceConfig, RateModel};

use crate::errors::FactoryError;

pub const MAX_CF_REFLECTOR: u128 = 750_000; // 75%
pub const MAX_CF_AQUARIUS_ONLY: u128 = 500_000; // 50%
pub const MIN_CF: u128 = 10_000; // core minimum, 1%
pub const MIN_IDLE_BUFFER_BPS: u32 = 1_000; // 10%
pub const MAX_IDLE_BUFFER_BPS: u32 = 10_000; // 100%
pub const MAX_RESERVE_FACTOR: u128 = 500_000; // 50%
pub const MAX_RATE_PARAM: u128 = 10_000_000; // core jump-rate-model limit
pub const MAX_KINK: u128 = 1_000_000;
pub const MAX_REWARD_SPEED_PER_SEC: u128 = 1_000_000_000_000; // core controller limit
pub const MAX_MARKETS_PER_GROUP: u32 = 16;
pub const STAGED_DELAY_SECS: u64 = 60; // core ADMIN_PARAM_CHANGE_DELAY_SECS in the hackathon copy
pub const DEFAULT_FLASH_LOAN_FEE: u128 = 2_500; // 0.25%, same as the core mainnet deployment
pub const REFLECTOR_DECIMALS: u32 = 14;
pub const ROUTER_RESOLUTION_SECS: u32 = 300;

pub fn max_cf_for(price: &PriceConfig) -> u128 {
    match price {
        PriceConfig::AquariusOnly(_) => MAX_CF_AQUARIUS_ONLY,
        _ => MAX_CF_REFLECTOR,
    }
}

pub fn check_cf(cf: u128, price: &PriceConfig) -> Result<(), FactoryError> {
    if cf < MIN_CF {
        return Err(FactoryError::CollateralFactorTooLow);
    }
    if cf > max_cf_for(price) {
        return Err(FactoryError::CollateralFactorTooHigh);
    }
    Ok(())
}

pub fn check_caps(supply_cap: u128, borrow_cap: u128) -> Result<(), FactoryError> {
    if supply_cap == 0 || borrow_cap == 0 {
        return Err(FactoryError::CapRequired);
    }
    Ok(())
}

pub fn check_idle(bps: u32) -> Result<(), FactoryError> {
    if !(MIN_IDLE_BUFFER_BPS..=MAX_IDLE_BUFFER_BPS).contains(&bps) {
        return Err(FactoryError::IdleBufferOutOfRange);
    }
    Ok(())
}

pub fn check_reserve_factor(rf: u128) -> Result<(), FactoryError> {
    if rf > MAX_RESERVE_FACTOR {
        return Err(FactoryError::ReserveFactorTooHigh);
    }
    Ok(())
}

/// All zeros is valid (0% borrow rate).
pub fn check_rates(r: &RateModel) -> Result<(), FactoryError> {
    if r.base > MAX_RATE_PARAM
        || r.multiplier > MAX_RATE_PARAM
        || r.jump > MAX_RATE_PARAM
        || r.kink > MAX_KINK
    {
        return Err(FactoryError::RatesOutOfRange);
    }
    Ok(())
}

pub fn check_speed(speed: u128) -> Result<(), FactoryError> {
    if speed > MAX_REWARD_SPEED_PER_SEC {
        return Err(FactoryError::RewardSpeedTooHigh);
    }
    Ok(())
}

/// Phase 1 allows `ReflectorOnly` only. Phase 3 will lift the other two modes.
pub fn check_price_mode(price: &PriceConfig) -> Result<(), FactoryError> {
    match price {
        PriceConfig::ReflectorOnly(_) => Ok(()),
        _ => Err(FactoryError::PriceModeNotAllowed),
    }
}

pub fn check_market_config(cfg: &MarketConfig) -> Result<(), FactoryError> {
    check_price_mode(&cfg.price)?;
    check_cf(cfg.collateral_factor, &cfg.price)?;
    check_caps(cfg.supply_cap, cfg.borrow_cap)?;
    check_idle(cfg.idle_buffer_bps)?;
    check_reserve_factor(cfg.reserve_factor)?;
    check_rates(&cfg.rates)?;
    check_speed(cfg.supply_reward_per_sec)?;
    check_speed(cfg.borrow_reward_per_sec)?;
    if cfg.margin_enabled && matches!(cfg.price, PriceConfig::AquariusOnly(_)) {
        return Err(FactoryError::MarginNotAllowedForMode);
    }
    Ok(())
}
