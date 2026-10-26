/** `xoxno` vault kind: schema, validation, init_args encoding and preview for the vault-factory
 * `create_vault(owner, kind, salt, init_args)`. Pure data and helpers (no network access).
 *
 * Constructor order (contracts/xoxno-vault `__constructor`): owner, depositor, underlying, hub_id, spoke_id,
 * keeper, deposit_cap (i128, 7 decimals), min_deposit (i128), fee_bps (u32). The XOXNO controller and the
 * protocol admin are baked into the Wasm, so they are not form fields. */
import { Address, nativeToScVal, StrKey, xdr } from '@stellar/stellar-sdk';

export const XOXNO_KIND_ID = 'xoxno';
export const XOXNO_MAX_FEE_BPS = 2000;
export const XOXNO_DECIMALS = 7;

export type XoxnoFieldId = 'depositor' | 'underlying' | 'hubId' | 'spokeId' | 'keeper' | 'depositCap' | 'minDeposit' | 'feeBps';
export interface XoxnoConfig {
  /** The connected wallet; becomes init_args[0] and must equal the `owner` the factory is called with. */
  owner: string;
  depositor: string;
  underlying: string;
  hubId: number;
  spokeId: number;
  keeper: string;
  /** Whole tokens. */
  depositCap: string;
  /** Whole tokens. */
  minDeposit: string;
  /** Performance fee on yield in basis points, 0 to 2000. */
  feeBps: number;
}

export interface XoxnoFieldSpec {
  id: XoxnoFieldId;
  label: string;
  kind: 'address' | 'integer' | 'amount' | 'bps';
  help: string;
  min?: number;
  max?: number;
}

export const XOXNO_FIELDS: readonly XoxnoFieldSpec[] = [
  { id: 'depositor', label: 'Depositor', kind: 'address', help: 'The only address that can deposit: your wallet for a standalone vault, or a Peridot market vault to use it as a yield route. Anyone holding shares can withdraw.' },
  { id: 'underlying', label: 'Asset (token contract)', kind: 'address', help: 'The token supplied to XOXNO Lending. Its hub and spoke must list it, the vault refuses to deploy otherwise.' },
  { id: 'hubId', label: 'XOXNO hub id', kind: 'integer', min: 1, max: 1000, help: 'The XOXNO hub (isolated group of markets), 1 to 3 today.' },
  { id: 'spokeId', label: 'XOXNO spoke id', kind: 'integer', min: 1, max: 1000, help: 'The risk profile of the vault account. Testnet: 1 Main. Mainnet: 1 Blue Chip, 4 Stables and FX.' },
  { id: 'keeper', label: 'Keeper', kind: 'address', help: 'Calls harvest, which books the performance fee. Defaults to you.' },
  { id: 'depositCap', label: 'Deposit cap', kind: 'amount', help: 'Maximum total value in the vault, in whole tokens. You can change it later but never to zero.' },
  { id: 'minDeposit', label: 'Minimum deposit', kind: 'amount', help: 'Smallest deposit accepted, in whole tokens. Must not exceed the cap.' },
  { id: 'feeBps', label: 'Performance fee (bps)', kind: 'bps', min: 0, max: XOXNO_MAX_FEE_BPS, help: 'Share of the yield paid to you as vault shares. Hard maximum 2000 (20%). 0 for none.' },
];

export function defaultXoxnoConfig(owner: string, underlying = ''): XoxnoConfig {
  return { owner, depositor: owner, underlying, hubId: 1, spokeId: 1, keeper: owner, depositCap: '1000', minDeposit: '1', feeBps: 1000 };
}

function isContract(v: string) { return StrKey.isValidContract(v); }
function isAccountOrContract(v: string) { return StrKey.isValidEd25519PublicKey(v) || StrKey.isValidContract(v); }

/** Whole-token decimal string to stroops (7 decimals). Returns null when malformed or not positive. */
export function toBaseUnits(v: string): bigint | null {
  const m = /^(\d+)(?:\.(\d{1,7}))?$/.exec(v.trim());
  if (!m) return null;
  const n = BigInt(m[1]) * 10n ** BigInt(XOXNO_DECIMALS) + BigInt((m[2] ?? '').padEnd(XOXNO_DECIMALS, '0') || '0');
  return n > 0n ? n : null;
}

/** Returns one message per invalid field. The contract re-checks every bound in its constructor. */
export function validateXoxno(c: XoxnoConfig): Partial<Record<XoxnoFieldId | 'owner', string>> {
  const e: Partial<Record<XoxnoFieldId | 'owner', string>> = {};
  if (!isAccountOrContract(c.owner)) e.owner = 'Connect a wallet first.';
  if (!isAccountOrContract(c.depositor)) e.depositor = 'Enter a valid G... or C... address.';
  if (!isContract(c.underlying)) e.underlying = 'Enter the token contract address (C...).';
  if (!isAccountOrContract(c.keeper)) e.keeper = 'Enter a valid G... or C... address.';
  if (!Number.isInteger(c.hubId) || c.hubId < 1 || c.hubId > 1000) e.hubId = 'A whole number from 1 to 1000.';
  if (!Number.isInteger(c.spokeId) || c.spokeId < 1 || c.spokeId > 1000) e.spokeId = 'A whole number from 1 to 1000.';
  const cap = toBaseUnits(c.depositCap), min = toBaseUnits(c.minDeposit);
  if (cap === null) e.depositCap = 'A positive amount with at most 7 decimals.';
  if (min === null) e.minDeposit = 'A positive amount with at most 7 decimals.';
  if (cap !== null && min !== null && min > cap) e.minDeposit = 'Cannot exceed the deposit cap.';
  if (!Number.isInteger(c.feeBps) || c.feeBps < 0 || c.feeBps > XOXNO_MAX_FEE_BPS) e.feeBps = `A whole number from 0 to ${XOXNO_MAX_FEE_BPS}.`;
  return e;
}

/** The `init_args` Vec<Val> for `create_vault`, in constructor order. Throws when invalid. */
export function encodeXoxnoInitArgs(c: XoxnoConfig): xdr.ScVal[] {
  const errors = validateXoxno(c);
  if (Object.keys(errors).length) throw new Error(`Invalid XOXNO vault config: ${Object.values(errors).join(' ')}`);
  return [
    new Address(c.owner).toScVal(),
    new Address(c.depositor).toScVal(),
    new Address(c.underlying).toScVal(),
    nativeToScVal(c.hubId, { type: 'u32' }),
    nativeToScVal(c.spokeId, { type: 'u32' }),
    new Address(c.keeper).toScVal(),
    nativeToScVal(toBaseUnits(c.depositCap)!, { type: 'i128' }),
    nativeToScVal(toBaseUnits(c.minDeposit)!, { type: 'i128' }),
    nativeToScVal(c.feeBps, { type: 'u32' }),
  ];
}

export interface PreviewRow { label: string; value: string }
/** Plain-language summary shown before signing. */
export function previewXoxno(c: XoxnoConfig): PreviewRow[] {
  const short = (a: string) => (a.length > 12 ? `${a.slice(0, 6)}...${a.slice(-6)}` : a);
  return [
    { label: 'Venue', value: 'XOXNO Lending (supply only, never borrows)' },
    { label: 'Owner', value: short(c.owner) },
    { label: 'Depositor', value: c.depositor === c.owner ? 'Owner wallet' : short(c.depositor) },
    { label: 'Asset', value: short(c.underlying) },
    { label: 'XOXNO market', value: `hub ${c.hubId}, spoke ${c.spokeId}` },
    { label: 'Deposit cap', value: `${c.depositCap} tokens` },
    { label: 'Minimum deposit', value: `${c.minDeposit} tokens` },
    { label: 'Performance fee', value: `${(c.feeBps / 100).toFixed(2)}% of yield, paid as vault shares to the owner` },
    { label: 'Keeper', value: c.keeper === c.owner ? 'Owner wallet' : short(c.keeper) },
    { label: 'Trust', value: 'Peridot admin can pause deposits and upgrade the code. Only share holders can withdraw funds.' },
  ];
}
