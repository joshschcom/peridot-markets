/** TypeScript mirrors of `contracts/launchpad-curve/src/types.rs` and `contracts/launchpad-factory/src/types.rs`.
 * Integer enums (`#[repr(u32)]` with explicit discriminants) decode as plain numbers through `scValToNative`. */

export const Phase = { Trading: 0, Graduatable: 1, Graduated: 2, Graduating: 3 } as const;
export type Phase = (typeof Phase)[keyof typeof Phase];

export const GradStep = { NotStarted: 0, PoolCreated: 1, GroupCreated: 2, QuoteMarketAdded: 3, QuoteMarketActivated: 4, TokenMarketAdded: 5, Graduated: 6 } as const;
export type GradStep = (typeof GradStep)[keyof typeof GradStep];

export const Preset = { Fast: 0, Standard: 1, Slow: 2 } as const;
export type Preset = (typeof Preset)[keyof typeof Preset];
export const PRESETS: ReadonlyArray<{ value: Preset; label: string; blurb: string }> = [
  { value: 0, label: 'Fast', blurb: 'Lowest graduation target. Reaches the pool quickly.' },
  { value: 1, label: 'Standard', blurb: 'Balanced target for most launches.' },
  { value: 2, label: 'Slow', blurb: 'Highest target. Deepest pool at graduation.' },
];

export interface CurveParams {
  virtual_quote: bigint;
  virtual_token: bigint;
  curve_supply: bigint;
  lp_supply: bigint;
  graduation_target: bigint;
  trade_fee_bps: number;
  creator_fee_share_bps: number;
  creator_cap_bps: number;
}

export interface LaunchInfo {
  id: number;
  token: string;
  curve: string;
  creator: string;
  quote_token: string;
  preset: Preset;
  name: string;
  symbol: string;
  created_at: bigint;
}

/** `get_state`. Price is quote base units per token base unit, scaled by 1e7 (so 7-decimal XLM per token). */
export interface CurveInfo {
  phase: Phase;
  price: bigint;
  progress_bps: number;
  real_quote: bigint;
  sold: bigint;
  tokens_remaining: bigint;
  virtual_quote: bigint;
  virtual_token: bigint;
  graduation_target: bigint;
  fully_diluted_value: bigint;
  creator_bought: bigint;
  creator_cap: bigint;
  fees_treasury_pending: bigint;
  fees_creator_pending: bigint;
}

export interface CurveConfig {
  token: string;
  quote_token: string;
  creator: string;
  factory: string;
  treasury: string;
  params: CurveParams;
  k: bigint;
  graduation: { venue: number; router: string; market_factory: string; quote_price: unknown };
}

export interface BuyQuote { quote_spent: bigint; fee: bigint; tokens_out: bigint; clamped: boolean }
export interface SellQuote { gross_quote: bigint; fee: bigint; quote_out: bigint }

export interface Graduation {
  step: GradStep;
  pool: string;
  pool_index: Uint8Array | string;
  share_token: string;
  quote_in_pool: bigint;
  token_in_pool: bigint;
  lp_shares_burned: bigint;
  unsold_burned: bigint;
  group_id: number;
  quote_market: string | null;
  token_market: string | null;
  claimed: boolean;
}

export interface FactoryConfig {
  admin: string;
  treasury: string;
  paused: boolean;
  wasm_set: boolean;
  fee_token: string | null;
  launch_fee: bigint;
  launch_count: number;
}

/** A buy or sell decoded from the curve's contract events. */
export interface Trade {
  kind: 'buy' | 'sell';
  user: string;
  /** Quote charged (buy, fee included) or paid out (sell, after the fee). */
  quote: bigint;
  tokens: bigint;
  fee: bigint;
  clamped: boolean;
  hash: string;
  ledger: number;
  /** ISO close time of the ledger. */
  at: string;
}

export interface LaunchDraft {
  name: string;
  symbol: string;
  metadataUri: string;
  preset: Preset;
  /** Creator buy in quote (display string, 7 decimals). Empty for none. */
  creatorBuy: string;
  /** Slippage for the creator buy, percent string. */
  slippage: string;
}
