/** Pure helpers for the lending-account health readout on the group page.
 *
 * Idea adapted from PeridotV2Full 86ae3795 `hooks/use-borrowing-power.ts` and
 * `hooks/use-borrow-balance.ts` (collateral, debt, available borrowing power and a risk tier).
 * The EVM hook recomputed everything client side from per-asset config prices. Here the group
 * controller is authoritative: `account_liquidity(user) -> (liquidity, shortfall)` already applies
 * each market's collateral factor and oracle price, and the per-market USD values come from
 * `get_price_usd(token) -> Option<(price, scale)>`.
 *
 * Units (core/simple-peridottroller/src/contract.rs, `sum_positions_usd_for_markets`):
 *   usd = underlying_base_units * price / scale
 * so a USD figure carries the token's own decimals (7 on Stellar for SAC assets). Divide by
 * 10^decimals to get dollars. A group whose markets use different decimals produces an
 * ill-defined on-chain sum; the component passes the common decimals and notes the caveat. */

export const U128_MAX = 2n ** 128n - 1n;
export const SCALE_1E6 = 1_000_000n;

export interface HealthPosition {
  symbol: string;
  decimals: number;
  /** Underlying supplied amount in base units (receipt balance times exchange rate / 1e6). */
  underlying: bigint;
  /** Borrowed amount in base units. */
  debt: bigint;
  /** 1e6-scaled collateral factor from the market config. */
  collateralFactor: bigint;
  /** Market entered by the user (only entered supply counts as collateral). */
  entered: boolean;
  /** Oracle price and its scale from `get_price_usd`; undefined when the controller returned None. */
  price?: bigint;
  priceScale?: bigint;
}

export interface LiquidityReading { liquidity: bigint; shortfall: bigint }
export type HealthState = 'empty' | 'safe' | 'watch' | 'risk' | 'unavailable';

export interface AccountHealthSummary {
  /** Dollar value of supply that counts as collateral (entered markets, before the collateral factor). */
  collateralUsd: number;
  /** Dollar value of all supply, entered or not. */
  suppliedUsd: number;
  /** Dollar value of all debt. */
  debtUsd: number;
  /** Maximum debt the collateral supports (collateral times collateral factor). */
  borrowLimitUsd: number;
  /** Borrowing power left in dollars (never negative). */
  availableUsd: number;
  /** Dollars by which debt exceeds the borrow limit (0 when healthy). */
  shortfallUsd: number;
  /** debt / borrowLimit, null when there is no limit and no debt. Can exceed 1. */
  utilization: number | null;
  state: HealthState;
  /** 'contract' when `account_liquidity` was usable, 'derived' when summed client side. */
  source: 'contract' | 'derived';
  /** Symbols whose oracle price was unavailable; their value is counted as 0. */
  priceMissing: string[];
}

/** The controller returns (0, u128::MAX) when a price or debt read failed and the account state is indeterminate. */
export function isIndeterminate(reading: LiquidityReading | null | undefined): boolean {
  return !!reading && reading.shortfall === U128_MAX;
}

/** Dollars from base units and an oracle (price, scale) pair. */
export function usdValue(units: bigint, decimals: number, price: bigint, scale: bigint): number {
  if (units <= 0n || price <= 0n || scale <= 0n) return 0;
  return Number(units * price / scale) / 10 ** decimals;
}

/** Dollars from a controller USD figure (which carries the token decimals). */
export function scaledUsd(value: bigint, decimals: number): number {
  if (value <= 0n) return 0;
  return Number(value) / 10 ** decimals;
}

/** Decimals shared by the markets the user holds; 7 when nothing is held or when they disagree. */
export function commonDecimals(positions: ReadonlyArray<HealthPosition>): number {
  const held = positions.filter(p => p.underlying > 0n || p.debt > 0n);
  const set = new Set(held.map(p => p.decimals));
  return set.size === 1 ? held[0].decimals : 7;
}

export function mixedDecimals(positions: ReadonlyArray<HealthPosition>): boolean {
  return new Set(positions.filter(p => p.underlying > 0n || p.debt > 0n).map(p => p.decimals)).size > 1;
}

export const WATCH_UTILIZATION = 0.75;

export function healthState(debtUsd: number, borrowLimitUsd: number, shortfallUsd: number): HealthState {
  if (debtUsd <= 0 && borrowLimitUsd <= 0) return 'empty';
  if (shortfallUsd > 0 || (debtUsd > 0 && borrowLimitUsd <= 0)) return 'risk';
  if (debtUsd <= 0) return 'safe';
  return debtUsd / borrowLimitUsd >= WATCH_UTILIZATION ? 'watch' : 'safe';
}

export function summarizeHealth(positions: ReadonlyArray<HealthPosition>, reading: LiquidityReading | null | undefined, decimals: number = commonDecimals(positions)): AccountHealthSummary {
  let collateralUsd = 0, suppliedUsd = 0, debtUsd = 0, derivedLimitUsd = 0;
  const priceMissing: string[] = [];
  for (const p of positions) {
    if (p.underlying <= 0n && p.debt <= 0n) continue;
    if (p.price === undefined || p.priceScale === undefined) { priceMissing.push(p.symbol); continue; }
    const supplied = usdValue(p.underlying, p.decimals, p.price, p.priceScale);
    suppliedUsd += supplied;
    if (p.entered) {
      collateralUsd += supplied;
      derivedLimitUsd += usdValue(p.underlying * p.collateralFactor / SCALE_1E6, p.decimals, p.price, p.priceScale);
    }
    debtUsd += usdValue(p.debt, p.decimals, p.price, p.priceScale);
  }
  if (reading && isIndeterminate(reading)) {
    return { collateralUsd, suppliedUsd, debtUsd, borrowLimitUsd: derivedLimitUsd, availableUsd: 0, shortfallUsd: 0, utilization: null, state: 'unavailable', source: 'contract', priceMissing };
  }
  let availableUsd: number, shortfallUsd: number, borrowLimitUsd: number, source: AccountHealthSummary['source'];
  if (reading) {
    availableUsd = scaledUsd(reading.liquidity, decimals);
    shortfallUsd = scaledUsd(reading.shortfall, decimals);
    // Reconstruct the controller's own limit so the three numbers agree with each other.
    borrowLimitUsd = Math.max(0, shortfallUsd > 0 ? debtUsd - shortfallUsd : availableUsd + debtUsd);
    source = 'contract';
  } else {
    availableUsd = Math.max(0, derivedLimitUsd - debtUsd);
    shortfallUsd = Math.max(0, debtUsd - derivedLimitUsd);
    borrowLimitUsd = derivedLimitUsd;
    source = 'derived';
  }
  const utilization = borrowLimitUsd > 0 ? debtUsd / borrowLimitUsd : debtUsd > 0 ? Infinity : null;
  return { collateralUsd, suppliedUsd, debtUsd, borrowLimitUsd, availableUsd, shortfallUsd, utilization, state: healthState(debtUsd, borrowLimitUsd, shortfallUsd), source, priceMissing };
}

export const STATE_COPY: Record<HealthState, { label: string; tone: 'neutral' | 'success' | 'warn' | 'danger'; text: string }> = {
  empty: { label: 'No position', tone: 'neutral', text: 'Supply and enable a market to build borrowing power.' },
  safe: { label: 'Safe', tone: 'success', text: 'Debt is well below the borrow limit.' },
  watch: { label: 'Watch', tone: 'warn', text: 'Debt uses most of the borrow limit. A price move could make this account liquidatable.' },
  risk: { label: 'At risk', tone: 'danger', text: 'Debt exceeds the borrow limit. This account can be liquidated now. Repay debt or add collateral.' },
  unavailable: { label: 'Unavailable', tone: 'warn', text: 'The controller could not price every position (a price feed or debt read failed). Health cannot be confirmed right now.' },
};

export function fmtUsd(value: number): string {
  if (!Number.isFinite(value)) return 'n/a';
  if (value > 0 && value < 0.01) return '<$0.01';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(value);
}
