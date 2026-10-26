/** Custom token intake for the add-market flow: parse what the user pasted, describe the token, explain pricing.
 * Pure and reader-injected so it runs in node tests. The RPC wiring is in token-intake-client.ts. */
import { Asset, StrKey } from '@stellar/stellar-sdk';
import { MIN_DEPTH_USD, type AquariusPool, type Net, type PoolToken } from './aquarius-pools';
import { feedLabel, formatPriceUsd, freshness, maxAgeSecs, type FeedKind, type LiveQuote } from './price-sources';

export type ParsedToken =
  | { kind: 'contract'; address: string }
  | { kind: 'classic'; code: string; issuer: string; address: string }
  | { kind: 'invalid'; reason: string };

/** Accepts a Soroban contract id (C...), `native`, or a classic asset `CODE:ISSUER` that is resolved to its Stellar Asset Contract id. */
export function parseTokenInput(raw: string, passphrase: string): ParsedToken {
  const input = raw.trim();
  if (!input) return { kind: 'invalid', reason: 'Paste a token contract address (C...) or a classic asset like USDC:G...' };
  if (/^C[A-Z2-7]{55}$/.test(input)) {
    return StrKey.isValidContract(input) ? { kind: 'contract', address: input } : { kind: 'invalid', reason: 'That contract address has a bad checksum. Check for a typo.' };
  }
  if (input.toLowerCase() === 'native') return { kind: 'classic', code: 'XLM', issuer: 'native', address: Asset.native().contractId(passphrase) };
  const m = /^([A-Za-z0-9]{1,12}):([A-Z2-7]{56})$/.exec(input);
  if (m) {
    if (!StrKey.isValidEd25519PublicKey(m[2])) return { kind: 'invalid', reason: 'The issuer is not a valid Stellar account (G...).' };
    try { return { kind: 'classic', code: m[1], issuer: m[2], address: new Asset(m[1], m[2]).contractId(passphrase) }; }
    catch { return { kind: 'invalid', reason: 'That is not a valid classic asset code and issuer.' }; }
  }
  if (/^G[A-Z2-7]{55}$/.test(input)) return { kind: 'invalid', reason: 'That is an account address (G...). Paste the token contract (C...) or CODE:ISSUER.' };
  return { kind: 'invalid', reason: 'Use a token contract address that starts with C and has 56 characters, or CODE:ISSUER for a classic asset.' };
}

export interface TokenInfo { address: string; name: string | null; symbol: string; decimals: number; totalSupply: bigint | null }
export type ContractReader = (contract: string, method: string) => Promise<unknown>;

export class NotATokenError extends Error {
  constructor(network: string) {
    super(`This address did not answer symbol() and decimals(), so it is not a Soroban token contract (SEP-41) on ${network}. Check the address and the network.`);
    this.name = 'NotATokenError';
  }
}
async function optional<T>(p: Promise<unknown>, guard: (v: unknown) => v is T): Promise<T | null> {
  try { const v = await p; return guard(v) ? v : null; } catch { return null; }
}
const isString = (v: unknown): v is string => typeof v === 'string' && v.length > 0;
const isBig = (v: unknown): v is bigint | number => typeof v === 'bigint' || (typeof v === 'number' && Number.isFinite(v));
/** SEP-41 gives symbol, decimals and name. total_supply exists on OpenZeppelin tokens (launchpad tokens) but not on Stellar Asset Contracts, so it is optional. */
export async function readTokenInfo(read: ContractReader, address: string, networkName: string): Promise<TokenInfo> {
  let symbol: unknown, decimals: unknown;
  try { [symbol, decimals] = await Promise.all([read(address, 'symbol'), read(address, 'decimals')]); }
  catch { throw new NotATokenError(networkName); }
  if (!isString(symbol) || typeof decimals !== 'number' || !Number.isInteger(decimals) || decimals < 0 || decimals > 18) throw new NotATokenError(networkName);
  const [name, supply] = await Promise.all([optional(read(address, 'name'), isString), optional(read(address, 'total_supply'), isBig)]);
  return { address, name, symbol, decimals, totalSupply: supply === null ? null : BigInt(supply) };
}
export function formatSupply(value: bigint | null, decimals: number): string {
  if (value === null) return 'Not reported by this token';
  const base = 10n ** BigInt(decimals), whole = value / base, frac = decimals ? (value % base).toString().padStart(decimals, '0').replace(/0+$/, '') : '';
  const w = whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return frac ? `${w}.${frac.slice(0, 4)}` : w;
}

// ---------- pricing ----------
export type PricingMode = 'reflector' | 'none';
export interface PricingInput {
  /** True when findReflectorFeed returned a mapping the factory has approved. */
  reflectorApproved: boolean;
  /** USDC-paired Aquarius pool found for the token, with its USDC-side reserve in whole USD (null when unreadable). */
  pool: { address: string; depthUsd: number | null } | null;
  symbol: string;
  /** Live quote read from the approved mapping's oracle (null when it could not be read, absent in demo mode). */
  quote?: LiveQuote | null;
  /** The kind of oracle that lists the token without a factory-approved mapping (null when no oracle lists it). */
  listedOn?: FeedKind | null;
  /** Wall clock in seconds, injected for tests. */
  nowSecs?: number;
}
export interface PricingDecision {
  mode: PricingMode;
  /** The factory will accept this market (add_market passes check_price_allowed). */
  canSubmit: boolean;
  title: string;
  lines: string[];
  /** Depth check the router applies to AquariusOnly pools, for information only. */
  aquariusDepthOk: boolean | null;
}
/** What contracts allow, from market-factory add_market: ReflectorOnly needs an allowlisted (token, oracle, asset) tuple;
 *  AquariusOnly is accepted only when the owner is a curve of the registered launchpad (graduation creates that market itself). */
export function decidePricing(input: PricingInput): PricingDecision {
  const depthOk = input.pool && input.pool.depthUsd !== null ? input.pool.depthUsd >= MIN_DEPTH_USD : null;
  if (input.reflectorApproved) {
    const q = input.quote ?? null;
    const label = feedLabel(q?.kind ?? null);
    const lines = [`${input.symbol} has a ${label === 'Reflector' ? 'Reflector feed' : label + ' feed'} that the factory has approved for this exact token.`];
    if (q) {
      const f = freshness(q.timestamp, input.nowSecs ?? Math.floor(Date.now() / 1000), q.resolution);
      lines.push(`Live price ${formatPriceUsd(q.price)} per ${input.symbol}, updated ${f.text}. ${f.fresh ? `Fresh: the router accepts quotes up to ${Math.round(maxAgeSecs(q.resolution) / 60)} minutes old.` : `Stale: older than the ${Math.round(maxAgeSecs(q.resolution) / 60)} minute limit, so borrowing and liquidation wait for the next oracle round.`}`);
    } else if (input.quote === null) lines.push('The live price could not be read right now. The factory approval is on chain.');
    if (q?.kind === 'dex') lines.push('The DEX oracle averages recent Stellar DEX trades and pool reserves in USDC. Thin markets can be moved, so keep the collateral factor and caps low.');
    lines.push('This is the price source the market uses. No fallback price is set.');
    return { mode: 'reflector', canSubmit: true, aquariusDepthOk: depthOk, title: `Priced by ${label}`, lines };
  }
  if (input.listedOn) {
    const label = feedLabel(input.listedOn);
    const lines = [`${input.symbol} is listed on the ${label}, but the factory has not approved that mapping yet, so a wallet-created market cannot use it.`];
    if (input.pool) lines.push('Pool pricing (AquariusOnly) can only be selected by markets that the launchpad creates when a token graduates. The factory rejects it for any other owner.');
    lines.push('Ask Peridot to approve this token with the ' + label + '. Once approved it can be listed here without any other change.');
    return { mode: 'none', canSubmit: false, aquariusDepthOk: depthOk, title: 'Feed found, waiting for Peridot approval', lines };
  }
  const lines = [`${input.symbol} is not listed on a Reflector oracle the factory knows, and Reflector is the only price source a wallet-created market can use today.`];
  if (input.pool) {
    lines.push(depthOk === null ? `An Aquarius pool with USDC exists (depth could not be read).` : depthOk
      ? `An Aquarius pool with USDC exists with about $${Math.round(input.pool.depthUsd!).toLocaleString('en-US')} per side, above the router's $${MIN_DEPTH_USD} per side guard.`
      : `An Aquarius pool with USDC exists but holds about $${Math.round(input.pool.depthUsd!).toLocaleString('en-US')} per side, below the router's $${MIN_DEPTH_USD} per side guard, so it could not price a market.`);
    lines.push('Pool pricing (AquariusOnly) can only be selected by markets that the launchpad creates when a token graduates. The factory rejects it for any other owner.');
  } else {
    lines.push('No Aquarius pool pairs it with USDC either, so there is nothing to price it from.');
  }
  lines.push('To list this token, ask Peridot to add and approve a Reflector feed for it, or launch it through the launchpad so graduation creates its market.');
  return { mode: 'none', canSubmit: false, aquariusDepthOk: depthOk, title: 'No price source available, market blocked', lines };
}

// ---------- registry picker ----------
export interface RegistryToken { token: PoolToken; pools: number }
/** Unique tokens across the registry pools, most pools first, USDC and XLM included. */
export function registryTokens(net: Net, pools: readonly AquariusPool[]): RegistryToken[] {
  const map = new Map<string, RegistryToken>();
  for (const p of pools) for (const t of p.tokens) {
    if (!StrKey.isValidContract(t.address)) continue;
    const e = map.get(t.address);
    if (e) e.pools += 1; else map.set(t.address, { token: t, pools: 1 });
  }
  void net;
  return [...map.values()].sort((a, b) => b.pools - a.pools || a.token.symbol.localeCompare(b.token.symbol));
}
export function searchTokens(tokens: readonly RegistryToken[], query: string, limit = 8): RegistryToken[] {
  const q = query.trim().toLowerCase();
  return tokens.filter(t => !q || t.token.symbol.toLowerCase().includes(q) || t.token.address.toLowerCase().includes(q)).slice(0, limit);
}
