/** Vault kind registry types. A kind = one Wasm registered in the vault-factory under `id`, plus a typed config schema
 * the app renders as a form and encodes into constructor arguments (`init_args`, owner first).
 * Pure data and helpers (no network access): safe in node unit tests and server rendering.
 *
 * To add a kind: create `kinds/<id>.ts` exporting a VaultKind, add it to `kinds/index.ts`. Nothing else changes:
 * the Create page, the live validation, the preview and "My vaults" are all driven by this schema. */
import type { xdr } from '@stellar/stellar-sdk';

export type Net = 'mainnet' | 'testnet';
/** How a form value becomes a contract argument. */
export type Encoding = 'address' | 'u32' | 'u64' | 'i128' | 'symbol' | 'bool';
export type FieldInput = 'text' | 'number' | 'select' | 'address' | 'amount' | 'toggle';

export interface FieldOption { value: string; label: string; hint?: string }
export interface FieldSpec {
  key: string;
  label: string;
  /** One or two plain sentences: what it does and the risk of getting it wrong. */
  help: string;
  group: string;
  input: FieldInput;
  encoding: Encoding;
  /** Shown after the input ("ticks", "%", "minutes", token symbol). */
  unit?: string;
  /** Inclusive limits in DISPLAY units. The contract constructor enforces the same bounds in raw units. */
  min?: number;
  max?: number;
  step?: number;
  /** Raw = round(display * scale). Percent to bps is 100, minutes to seconds is 60. Amounts use the token decimals instead. */
  scale?: number;
  options?: FieldOption[];
  /** Default as a display string. A function may use the context (owner address, network). */
  default: string | ((ctx: VaultCtx) => string);
  required?: boolean;
  /** Rendered read-only and forced to the connected wallet (the owner must sign the creation). */
  locked?: 'owner';
  /** Where the UI can offer ready-made values: Aquarius pools, tokens of the chosen pool, or the connected wallet. */
  suggest?: 'pools' | 'pool-tokens' | 'owner';
}

export interface VaultCtx {
  owner: string;
  net: Net;
  /** Decimals of the amount fields' token. Stellar Asset Contracts always have 7. */
  decimals: number;
  /** Optional facts the form learned (selected pool fee, token symbols). Kinds read what they need. */
  facts?: { feeBps?: number | null; tickSpacing?: number; symbols?: Record<string, string> };
}

export type Values = Record<string, string>;
export interface Validation { errors: Record<string, string>; warnings: string[] }

/** Data for the live strategy preview. The UI has one renderer per `type`. */
export type PreviewModel =
  | { type: 'ladder'; title: string; rungs: Array<{ index: number; lowerPct: number; upperPct: number; weightPct: number }>; caption: string }
  | { type: 'rows'; title: string; rows: Array<[string, string]> };

export interface VaultKind {
  /** Registered symbol in the factory (`create_vault(kind)`). Lowercase, at most 32 characters. */
  id: string;
  name: string;
  tagline: string;
  description: string;
  /** `live` kinds can be created; `soon` kinds are listed but locked. */
  status: 'live' | 'soon';
  fields: FieldSpec[];
  /** Cross-field rules on top of the per-field bounds. Return field keys for field errors. */
  validate?: (values: Values, ctx: VaultCtx) => Validation;
  /** Constructor arguments after validation. Index 0 MUST be the owner address (the factory enforces it). */
  encode?: (values: Values, ctx: VaultCtx) => xdr.ScVal[];
  preview?: (values: Values, ctx: VaultCtx) => PreviewModel | null;
  /** Plain-language one-liners shown in the summary box before signing. */
  summary?: (values: Values, ctx: VaultCtx) => string[];
  /** Risk lines always shown for this kind. */
  risks: string[];
}

export interface VaultRecordView {
  address: string;
  kind: string;
  owner: string;
  ledger: number;
  /** True for demo-mode records that are not contracts. */
  demo?: boolean;
  txHash?: string;
  createdAt?: number;
  /** Config the owner entered, kept for demo records and for display next to chain data. */
  values?: Values;
}
