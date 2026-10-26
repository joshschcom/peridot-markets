/** Yield math for every venue the app can show a rate for. Pure, node-testable, no network access.
 * Every function documents the formula it applies; the UI copies that text into the tooltip so a number is never
 * shown without the way it was computed. Rates are plain fractions (0.05 = 5%) unless a name says otherwise. */

export type RateKind = 'apy' | 'apr' | 'apr-est' | 'na';
export interface YieldQuote {
  /** `apy`: on-chain data through a documented compounding formula. `apr`: on-chain simple rate. `apr-est`: an estimate
   * with an external or approximate input. `na`: nothing honest to show, `reason` says why. */
  kind: RateKind;
  /** Fraction, present unless kind is `na`. */
  value?: number;
  /** One line, for example "APY" or "APR est." plus a qualifier. */
  label: string;
  /** The formula and the inputs used, verbatim in the tooltip. */
  formula: string;
  reason?: string;
  /** Facts worth showing next to the number (utilization, share price, TVL). */
  facts: Array<[string, string]>;
  /** Unix ms when the inputs were read. */
  asOf: number;
}

export const SECONDS_PER_YEAR = 31_536_000;

/** APR to APY under continuous compounding: APY = e^APR - 1. Used for venues whose index accrues every ledger. */
export function continuousApy(apr: number): number {
  if (!Number.isFinite(apr)) return NaN;
  return Math.exp(apr) - 1;
}

/** Annualized growth of a share price between two samples: (p1 / p0) ^ (year / dt) - 1. Needs dt >= minSeconds. */
export function sharePriceDriftApy(p0: number, t0Ms: number, p1: number, t1Ms: number, minSeconds = 6 * 3600): number | null {
  const dt = (t1Ms - t0Ms) / 1000;
  if (!(p0 > 0) || !(p1 > 0) || !Number.isFinite(dt) || dt < minSeconds) return null;
  return Math.pow(p1 / p0, SECONDS_PER_YEAR / dt) - 1;
}

/** Blend v2 reserve maths. Amounts share the reserve `scalar` (10^decimals); b_rate and d_rate are 12 decimals;
 * config rates and `util` are 7 decimals; `bstop_rate` (pool config) is 7 decimals. */
export interface BlendReserveInput {
  rBase: number; rOne: number; rTwo: number; rThree: number; targetUtil: number; irMod: bigint;
  bRate: bigint; bSupply: bigint; dRate: bigint; dSupply: bigint; bstopRate: number;
}
export interface BlendRates { utilization: number; borrowApr: number; supplyApr: number }
const SEVEN = 10_000_000;
const RATE_SCALAR = 1_000_000_000_000n;
/** utilization = d_supply * d_rate / (b_supply * b_rate); borrow APR is Blend's three-slope curve times ir_mod;
 * supply APR = borrow APR * utilization * (1 - bstop_rate). */
export function blendRates(i: BlendReserveInput): BlendRates {
  const liabilities = Number(i.dSupply * i.dRate / RATE_SCALAR);
  const supply = Number(i.bSupply * i.bRate / RATE_SCALAR);
  const utilization = supply > 0 ? Math.min(1, liabilities / supply) : 0;
  const rBase = i.rBase / SEVEN, rOne = i.rOne / SEVEN, rTwo = i.rTwo / SEVEN, rThree = i.rThree / SEVEN, target = i.targetUtil / SEVEN;
  const irMod = Number(i.irMod) / SEVEN;
  let borrowApr: number;
  if (utilization <= target) borrowApr = irMod * (rBase + rOne * (target > 0 ? utilization / target : 0));
  else if (utilization <= 0.95) borrowApr = irMod * (rBase + rOne + rTwo * (utilization - target) / (0.95 - target));
  else borrowApr = irMod * (rBase + rOne + rTwo) + rThree * (utilization - 0.95) / 0.05;
  const supplyApr = borrowApr * utilization * (1 - i.bstopRate / SEVEN);
  return { utilization, borrowApr, supplyApr };
}

/** XOXNO pool rates are annual fractions in RAY (1e27). */
export const RAY = 1_000_000_000_000_000_000_000_000_000n;
export function rayToFraction(v: bigint): number { return Number(v) / 1e27; }

/** Aquarius AQUA emissions on a pool: tps (AQUA per second, 7 decimals) * seconds per year * AQUA price in USD,
 * divided by the pool TVL in USD. An estimate: TVL is approximate and rewards go to the boosted working supply. */
export function aquariusRewardApr(tpsRaw: bigint, aquaUsd: number, tvlUsd: number): number | null {
  if (!(aquaUsd > 0) || !(tvlUsd > 0)) return null;
  const perYear = Number(tpsRaw) / SEVEN * SECONDS_PER_YEAR;
  return perYear * aquaUsd / tvlUsd;
}

/** Spot price of token0 in token1 from constant-product reserves, both 7 decimals. */
export function spotPrice(reserve0: bigint, reserve1: bigint): number | null {
  if (reserve0 <= 0n || reserve1 <= 0n) return null;
  return Number(reserve1) / Number(reserve0);
}

/** Share price in underlying per whole share: amounts per `10^shareDecimals` shares divided by 10^assetDecimals. */
export function sharePrice(amountPerWholeShare: bigint, assetDecimals: number): number {
  return Number(amountPerWholeShare) / Math.pow(10, assetDecimals);
}

export function fmtRate(q: YieldQuote): string {
  if (q.kind === 'na' || q.value === undefined || !Number.isFinite(q.value)) return 'n/a';
  const pct = q.value * 100;
  const digits = Math.abs(pct) >= 10 ? 1 : 2;
  return `${pct.toFixed(digits)}%`;
}
