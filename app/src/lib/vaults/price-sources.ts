/** Reflector price sources for the add-market token step. Pure and node-testable; the RPC wiring is in price-sources-client.ts.
 * Mainnet runs several Reflector oracles: an external CEX/FX feed keyed by symbol and a Stellar DEX feed keyed by token contract.
 * The factory approves one (token, oracle, asset) tuple at a time; coverage here only says an oracle lists the asset. */

export type FeedKind = 'dex' | 'external';
export type OracleKey = 'reflector_stellar' | 'reflector_external';
export interface OracleAsset { tag: 'Stellar' | 'Other'; value: string }
export interface OracleSnapshot {
  key: OracleKey;
  address: string;
  kind: FeedKind;
  decimals: number;
  /** Seconds between oracle rounds. */
  resolution: number;
  assets: readonly OracleAsset[];
}
export interface FeedCoverage { dex: ReadonlySet<string>; cex: ReadonlySet<string> }

/** The price router treats a quote as stale after this many resolutions (price-router-ext STALE_K). */
export const STALE_RESOLUTIONS = 2;

export const kindForKey = (key: OracleKey): FeedKind => key === 'reflector_stellar' ? 'dex' : 'external';
export const feedLabel = (kind: FeedKind | null): string => kind === 'dex' ? 'Reflector DEX oracle' : kind === 'external' ? 'Reflector CEX/FX oracle' : 'Reflector';
/** Short form for the token picker badge. */
export const feedBadge = (kind: FeedKind): string => kind === 'dex' ? 'Reflector DEX feed' : 'Reflector CEX/FX feed';

/** Turn the oracle `assets()` lists into the sets the catalog needs: DEX feeds match by contract id, external feeds by symbol. */
export function coverageFrom(snapshots: readonly OracleSnapshot[]): FeedCoverage {
  const dex = new Set<string>(), cex = new Set<string>();
  for (const s of snapshots) for (const a of s.assets) {
    if (s.kind === 'dex' && a.tag === 'Stellar') dex.add(a.value);
    if (s.kind === 'external' && a.tag === 'Other') cex.add(a.value.toUpperCase());
  }
  return { dex, cex };
}

/** Which oracle lists this token. A DEX listing is exact (contract id). An external listing is by symbol only, so callers must not
 *  trust it for an unverified token: the factory tuple allowlist is the real proof. */
export function oraclesListing(snapshots: readonly OracleSnapshot[], token: string, symbol: string): OracleSnapshot[] {
  const sym = symbol.toUpperCase();
  return snapshots.filter(s => s.assets.some(a => (a.tag === 'Stellar' && a.value === token) || (s.kind === 'external' && a.tag === 'Other' && a.value.toUpperCase() === sym)));
}

export interface Freshness { ageSecs: number; fresh: boolean; text: string }
export function maxAgeSecs(resolution: number): number { return resolution * STALE_RESOLUTIONS; }
export function ageText(ageSecs: number): string {
  if (ageSecs < 90) return `${Math.max(0, Math.round(ageSecs))} seconds ago`;
  const m = Math.round(ageSecs / 60);
  return m < 90 ? `${m} minutes ago` : `${Math.round(m / 60)} hours ago`;
}
/** Age of an oracle quote against the router's staleness window (resolution * 2). A timestamp in the future counts as not fresh. */
export function freshness(timestampSecs: number, nowSecs: number, resolution: number): Freshness {
  const ageSecs = nowSecs - timestampSecs;
  return { ageSecs, fresh: ageSecs >= -5 && ageSecs <= maxAgeSecs(resolution), text: ageText(ageSecs) };
}

/** Oracle fixed-point integer to a plain number. Display only. */
export function priceToNumber(raw: bigint, decimals: number): number {
  const base = 10n ** BigInt(decimals);
  return Number(raw / base) + Number(raw % base) / Number(base);
}
export function formatPriceUsd(p: number): string {
  if (!Number.isFinite(p) || p <= 0) return 'n/a';
  if (p >= 1000) return `$${Math.round(p).toLocaleString('en-US')}`;
  if (p >= 1) return `$${p.toFixed(4)}`;
  const digits = Math.min(10, Math.max(4, 2 - Math.floor(Math.log10(p)) + 1));
  return `$${p.toFixed(digits)}`;
}

export interface LiveQuote { kind: FeedKind | null; price: number; timestamp: number; resolution: number }
