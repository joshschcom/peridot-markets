/** Pure bonding-curve math and input validation, mirroring `contracts/launchpad-curve/src/{math,params}.rs` and the
 * text checks of `contracts/launchpad-factory/src/lib.rs`. Everything that feeds a transaction is exact bigint
 * arithmetic that rounds in favour of the curve exactly like the contract; floats appear only in chart sampling. */
import { formatAmount, parseAmount } from '../peridot/amount';
import type { CurveParams, GradStep, Phase } from './types';

export const BPS = 10_000n;
/** Contract `PRICE_SCALE`: prices are quote base units per token base unit times 1e7. */
export const PRICE_SCALE = 10_000_000n;
export const QUOTE_DECIMALS = 7;
export const TOKEN_DECIMALS = 7;
export const MAX_NAME_LEN = 32;
export const MAX_SYMBOL_LEN = 12;
export const MAX_URI_LEN = 256;
export const MAX_SLIPPAGE_BPS = 5_000;
export const DEFAULT_SLIPPAGE_BPS = 100;

export function ceilDiv(a: bigint, b: bigint): bigint {
  if (b <= 0n) throw new Error('Division by a non-positive number.');
  return a / b + (a % b === 0n ? 0n : 1n);
}
/** `ceil(amount * bps / 10000)`. */
export function feeOf(amount: bigint, feeBps: number | bigint): bigint { return ceilDiv(amount * BigInt(feeBps), BPS); }
/** Smallest gross amount whose net after the ceil fee is at least `needed`. */
export function grossForNet(needed: bigint, feeBps: number | bigint): bigint { return ceilDiv(needed * BPS, BPS - BigInt(feeBps)); }

export interface Reserves { k: bigint; x: bigint; y: bigint }
/** `x = virtual_quote + real_quote`, `y = virtual_token - sold`, `k = virtual_quote * virtual_token`. */
export function reserves(p: CurveParams, realQuote: bigint, sold: bigint): Reserves {
  return { k: p.virtual_quote * p.virtual_token, x: p.virtual_quote + realQuote, y: p.virtual_token - sold };
}
/** The same reserves from a `get_state` read, which carries the virtual reserves alongside the live state. */
export function reservesFromState(s: { virtual_quote: bigint; virtual_token: bigint; real_quote: bigint; sold: bigint }): Reserves {
  return { k: s.virtual_quote * s.virtual_token, x: s.virtual_quote + s.real_quote, y: s.virtual_token - s.sold };
}

export interface BuyCalc { gross: bigint; fee: bigint; net: bigint; tokensOut: bigint; clamped: boolean }
export interface SellCalc { gross: bigint; fee: bigint; quoteOut: bigint }

/** Quote a buy. `needed` is `graduation_target - real_quote` (must be positive). Null when the trade is dust. */
export function quoteBuy(r: Reserves, needed: bigint, quoteIn: bigint, feeBps: number | bigint): BuyCalc | null {
  if (quoteIn <= 0n || needed <= 0n) return null;
  const grossCap = grossForNet(needed, feeBps);
  const clamped = quoteIn > grossCap;
  const gross = clamped ? grossCap : quoteIn;
  const fee = feeOf(gross, feeBps);
  const net = gross - fee;
  if (net <= 0n || net > needed) return null;
  const yNew = ceilDiv(r.k, r.x + net);
  const tokensOut = r.y - yNew;
  if (tokensOut <= 0n) return null;
  return { gross, fee, net, tokensOut, clamped };
}

/** Quote a sell of `tokensIn` (caller guarantees `tokensIn <= sold`). Null when the trade is dust. */
export function quoteSell(r: Reserves, tokensIn: bigint, feeBps: number | bigint): SellCalc | null {
  if (tokensIn <= 0n) return null;
  const xNew = ceilDiv(r.k, r.y + tokensIn);
  const gross = r.x - xNew;
  if (gross <= 0n) return null;
  const fee = feeOf(gross, feeBps);
  const quoteOut = gross - fee;
  if (quoteOut <= 0n) return null;
  return { gross, fee, quoteOut };
}

/** Tokens sold when `real_quote == graduation_target`: `vt - ceil(k / (vq + target))`. */
export function soldAtTarget(p: CurveParams): bigint {
  const k = p.virtual_quote * p.virtual_token;
  return p.virtual_token - ceilDiv(k, p.virtual_quote + p.graduation_target);
}
/** Marginal price (contract scale) from the reserves: `x * 1e7 / y`. */
export function marginalPrice(r: Reserves): bigint { return r.x * PRICE_SCALE / r.y; }
/** Closed-form marginal price after `sold` tokens: `k * 1e7 / (vt - sold)^2`. */
export function priceAtSold(p: CurveParams, sold: bigint): bigint {
  const y = p.virtual_token - sold;
  if (y <= 0n) throw new Error('Sold exceeds the virtual token reserve.');
  return p.virtual_quote * p.virtual_token * PRICE_SCALE / (y * y);
}
/** Display scale for prices: the contract's 1e7 scale truncates launch prices of a few stroops per token, so the
 * app shows the same ratio at 1e-14 quote units per token. Display only, never fed to a transaction. */
export const FINE_SCALE = 10n ** 14n;
export const FINE_DECIMALS = 14;
export function finePrice(r: Reserves): bigint { return r.x * FINE_SCALE / r.y; }
export function finePriceAtSold(p: CurveParams, sold: bigint): bigint {
  const y = p.virtual_token - sold;
  if (y <= 0n) throw new Error('Sold exceeds the virtual token reserve.');
  return p.virtual_quote * p.virtual_token * FINE_SCALE / (y * y);
}
/** Format a fine-scale price with four significant digits: "0.0000001645", "1.235". */
export function fmtPrice(fine: bigint, significant = 4): string {
  if (fine <= 0n) return '0';
  const text = formatAmount(fine, FINE_DECIMALS);
  const [whole, fraction = ''] = text.split('.');
  if (whole !== '0') return fraction ? `${whole}.${fraction.slice(0, Math.max(0, significant - whole.length)).replace(/0+$/, '')}`.replace(/\.$/, '') : whole;
  const lead = fraction.search(/[1-9]/);
  if (lead < 0) return '0';
  return `0.${fraction.slice(0, lead + significant).replace(/0+$/, '')}`;
}
/** Net quote the curve holds once `sold` tokens are out: `ceil(k / (vt - sold)) - vq`. */
export function quoteRaisedAt(p: CurveParams, sold: bigint): bigint {
  const y = p.virtual_token - sold;
  if (y <= 0n) throw new Error('Sold exceeds the virtual token reserve.');
  return ceilDiv(p.virtual_quote * p.virtual_token, y) - p.virtual_quote;
}
/** Circulating value in quote base units: `price * sold / 1e7`. */
export function marketCap(price: bigint, sold: bigint): bigint { return price * sold / PRICE_SCALE; }
/** Fully diluted value: `price * (curve_supply + lp_supply) / 1e7`, as `get_state` reports it. */
export function fullyDilutedValue(price: bigint, p: CurveParams): bigint { return price * (p.curve_supply + p.lp_supply) / PRICE_SCALE; }
export function creatorCap(p: CurveParams): bigint { return p.curve_supply * BigInt(p.creator_cap_bps) / BPS; }

/** Minimum acceptable output for a slippage tolerance. Floors, and never below 1 because the contract rejects
 * a zero bound (`InvalidSlippageBound`). */
export function minOut(amount: bigint, slippageBps: number): bigint {
  if (!Number.isInteger(slippageBps) || slippageBps < 0 || slippageBps > MAX_SLIPPAGE_BPS) throw new Error('Slippage must be between 0% and 50%.');
  const v = amount * (BPS - BigInt(slippageBps)) / BPS;
  return v < 1n ? 1n : v;
}
/** Percent string ("1", "0.5") to basis points. */
export function parseSlippage(value: string): number {
  const clean = value.trim();
  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(clean)) throw new Error('Enter slippage as a percent with up to two decimals.');
  const bps = Math.round(Number(clean) * 100);
  if (bps < 0 || bps > MAX_SLIPPAGE_BPS) throw new Error('Slippage must be between 0% and 50%.');
  return bps;
}
/** A positive 7-decimal amount in base units. */
export function parsePositiveAmount(value: string, decimals = QUOTE_DECIMALS): bigint {
  const amount = parseAmount(value, decimals);
  if (amount <= 0n) throw new Error('Enter an amount above zero.');
  return amount;
}

/** Factory `check_text` for names: 1 to 32 characters, letters, digits, space, `-`, `_`, `.`; no outer spaces. */
export function validateName(name: string): string | null {
  if (name.length < 1 || name.length > MAX_NAME_LEN) return `Name must be 1 to ${MAX_NAME_LEN} characters.`;
  if (!/^[A-Za-z0-9 ._-]+$/.test(name)) return 'Name may use letters, digits, spaces, dots, hyphens and underscores only.';
  if (name.startsWith(' ') || name.endsWith(' ')) return 'Name cannot start or end with a space.';
  return null;
}
/** Factory `check_text` for symbols: 2 to 12 letters or digits. */
export function validateSymbol(symbol: string): string | null {
  if (symbol.length < 2 || symbol.length > MAX_SYMBOL_LEN) return `Symbol must be 2 to ${MAX_SYMBOL_LEN} characters.`;
  if (!/^[A-Za-z0-9]+$/.test(symbol)) return 'Symbol may use letters and digits only.';
  return null;
}
/** Optional image or metadata URI: at most 256 bytes (the contract checks only the length). */
export function validateMetadataUri(uri: string): string | null {
  if (!uri) return null;
  if (new TextEncoder().encode(uri).length > MAX_URI_LEN) return `Image URI must be at most ${MAX_URI_LEN} bytes.`;
  if (/\s/.test(uri)) return 'Image URI cannot contain spaces.';
  return null;
}

export interface CurvePoint { sold: number; price: number; raised: number }
/** Display samples of the curve from zero to the graduation point (prices in quote units per token). */
export function curveChartPoints(p: CurveParams, samples = 64): CurvePoint[] {
  const end = soldAtTarget(p);
  const points: CurvePoint[] = [];
  for (let i = 0; i <= samples; i++) {
    const sold = end * BigInt(i) / BigInt(samples);
    points.push({ sold: Number(sold) / 1e7, price: Number(finePriceAtSold(p, sold)) / 1e14, raised: Number(quoteRaisedAt(p, sold)) / 1e7 });
  }
  return points;
}

export function phaseLabel(phase: Phase | number): string {
  return phase === 0 ? 'Trading' : phase === 1 ? 'Graduatable' : phase === 3 ? 'Graduating' : phase === 2 ? 'Graduated' : 'Unknown';
}
export const GRAD_STEPS: ReadonlyArray<{ step: GradStep; short: string; title: string; detail: string }> = [
  { step: 1, short: 'Pool', title: 'Create the Aquarius pool', detail: 'Pulls the AQUA creation fee from the payer, creates the 30 bps pool, deposits all raised XLM and the LP allocation, locks the LP shares and burns unsold curve tokens. Trading ends for good.' },
  { step: 2, short: 'Group', title: 'Create the market group', detail: 'Creates the token\'s own isolated lending group on the market factory. The curve owns it until the creator claims it.' },
  { step: 3, short: 'XLM market', title: 'Add the XLM market', detail: 'Adds the quote asset market with the approved Reflector price mapping and a 60% collateral factor.' },
  { step: 4, short: 'Activate XLM', title: 'Activate the XLM market', detail: 'Lists the quote market on the group controller.' },
  { step: 5, short: 'Token market', title: 'Add the token market', detail: 'Adds the token market priced from its Aquarius pool, 25% collateral factor, caps sized from the pool.' },
  { step: 6, short: 'Done', title: 'Activate the token market', detail: 'Lists the token market. The phase becomes Graduated and the lending market is live.' },
];
export function stepLabel(step: GradStep | number): string {
  return GRAD_STEPS.find(s => s.step === step)?.title ?? (step === 0 ? 'Not started' : 'Unknown');
}

/** Largest simple-token supply in whole tokens (the contract's `MAX_PLAIN_SUPPLY`). */
export const MAX_PLAIN_SUPPLY = 1_000_000_000_000n;
/** Parses a whole-token supply typed by the user ("1,000,000" and "1_000" are accepted). Returns null when invalid. */
export function parsePlainSupply(value: string): bigint | null {
  const cleaned = value.trim().replace(/[,_\s]/g, '');
  if (!/^\d+$/.test(cleaned)) return null;
  const n = BigInt(cleaned);
  return n >= 1n && n <= MAX_PLAIN_SUPPLY ? n : null;
}
export function validatePlainSupply(value: string): string | null {
  if (!value.trim()) return 'Enter a supply.';
  return parsePlainSupply(value) === null ? 'Supply must be a whole number between 1 and 1,000,000,000,000.' : null;
}
