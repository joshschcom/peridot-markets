/** One deduplicated asset list for every token picker in the app.
 * Pure and node-testable: known assets per network, plus Aquarius pool tokens and launchpad tokens, merged by contract id.
 * A token that trades in several pools is one asset with several pool choices, never a repeated row. */
import { StrKey } from '@stellar/stellar-sdk';
import { pairLabel, type AquariusPool, type Net, type PoolType } from './aquarius-pools';
import type { FeedCoverage, FeedKind } from './price-sources';

export type AssetOrigin = 'known' | 'aquarius' | 'launchpad' | 'demo';
export interface AssetPool { address: string; pair: string; type: PoolType; feeBps: number | null }
export interface CatalogAsset {
  address: string;
  symbol: string;
  name: string;
  decimals: number | null;
  /** In the curated per-network table (address verified by the Peridot team). */
  verified: boolean;
  /** Same symbol as a verified asset but a different contract: shown last and flagged, never hidden. */
  collision: boolean;
  origins: AssetOrigin[];
  pools: AssetPool[];
  /** Derived from the Reflector oracles' assets() lists. true: an oracle lists this asset. false: none does. null: oracle lists not loaded yet.
   *  Coverage is not approval: the factory approves each (token, oracle, asset) mapping separately and the token panel shows that. */
  reflector: boolean | null;
  /** Which kind of oracle lists it (the DEX oracle wins when both do). */
  feed: FeedKind | null;
  /** A yield vault (DeFindex) is configured for this asset in the deployment manifest. */
  vault: boolean;
}
export interface KnownAsset { address: string; symbol: string; name: string; decimals: number }

/** Order here is the default order of the dropdown. Decimals: every entry is a Stellar Asset Contract (7). */
export const KNOWN_ASSETS: Record<Net, readonly KnownAsset[]> = {
  mainnet: [
    { address: 'CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75', symbol: 'USDC', name: 'USD Coin (Circle)', decimals: 7 },
    { address: 'CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA', symbol: 'XLM', name: 'Stellar Lumens', decimals: 7 },
    { address: 'CDTKPWPLOURQA2SGTKTUQOWRCBZEORB4BWBOMJ3D3ZTQQSGE5F6JBQLV', symbol: 'EURC', name: 'Euro Coin (Circle)', decimals: 7 },
    { address: 'CAUIKL3IYGMERDRUN6YSCLWVAKIFG5Q4YJHUKM4S4NJZQIA3BAS6OJPK', symbol: 'AQUA', name: 'Aquarius', decimals: 7 },
    { address: 'CD25MNVTZDL4Y3XBCPCJXGXATV5WUHHOWMYFF4YBEGU5FCPGMYTVG5JY', symbol: 'BLND', name: 'Blend', decimals: 7 },
    { address: 'CCCRWH6Q3FNP3I2I57BDLM5AFAT7O6OF6GKQOC6SSJNDAVRZ57SPHGU2', symbol: 'PYUSD', name: 'PayPal USD', decimals: 7 },
    { address: 'CBZVSNVB55ANF24QVJL2K5QCLOAB6XITGTGXYEAF6NPTXYKEJUYQOHFC', symbol: 'yXLM', name: 'Ultra Stellar yXLM', decimals: 7 },
  ],
  testnet: [
    { address: 'CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA', symbol: 'USDC', name: 'USD Coin (Circle testnet)', decimals: 7 },
    { address: 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC', symbol: 'XLM', name: 'Stellar Lumens', decimals: 7 },
    { address: 'CDPXNHHVSLX3HFAHV7XOISM23MZH36WSXTO45RNDOBIDFZBGTSOVD4OY', symbol: 'USDT', name: 'Tether USD (testnet mock)', decimals: 7 },
    { address: 'CDNVQW44C3HALYNVQ4SOBXY5EWYTGVYXX6JPESOLQDABJI5FC5LTRRUE', symbol: 'AQUA', name: 'Aquarius', decimals: 7 },
    { address: 'CB22KRA3YZVCNCQI64JQ5WE7UY2VAV7WFLK6A2JN3HEX56T2EDAFO7QF', symbol: 'BLND', name: 'Blend', decimals: 7 },
    { address: 'CAQCFVLOBK5GIULPNZRGATJJMIZL5BSP7X5YJVMGCPTUEPFM4AVSRCJU', symbol: 'USDC', name: 'USD Coin (alternate testnet issuer)', decimals: 7 },
  ],
};

export interface ExtraAsset { address: string; symbol: string; name?: string; decimals?: number; origin: Exclude<AssetOrigin, 'known' | 'aquarius'> }
export interface MergeInput {
  pools?: readonly AquariusPool[];
  extra?: readonly ExtraAsset[];
  /** Symbols or addresses that have a configured yield vault (deployment manifest keys). */
  vaultKeys?: readonly string[];
  /** Coverage read from the oracles' assets() lists. Without it every asset's `reflector` stays null (unknown). */
  feeds?: FeedCoverage;
  /** When set, only these addresses are listed (demo mode knows a fixed token table). */
  allow?: ReadonlySet<string>;
}

/** Merge every source into one list keyed by contract id. Known assets win on symbol and name; pools attach to their asset. */
export function mergeAssets(net: Net, input: MergeInput = {}): CatalogAsset[] {
  const byAddress = new Map<string, CatalogAsset>();
  const order: string[] = [];
  const add = (a: CatalogAsset) => { byAddress.set(a.address, a); order.push(a.address); };
  for (const k of KNOWN_ASSETS[net]) {
    add({ address: k.address, symbol: k.symbol, name: k.name, decimals: k.decimals, verified: true, collision: false, origins: ['known'], pools: [], reflector: null, feed: null, vault: false });
  }
  for (const e of input.extra ?? []) {
    if (!StrKey.isValidContract(e.address)) continue;
    const existing = byAddress.get(e.address);
    if (existing) { if (!existing.origins.includes(e.origin)) existing.origins.push(e.origin); if (!existing.name && e.name) existing.name = e.name; continue; }
    add({ address: e.address, symbol: e.symbol, name: e.name ?? '', decimals: e.decimals ?? null, verified: false, collision: false, origins: [e.origin], pools: [], reflector: null, feed: null, vault: false });
  }
  for (const p of input.pools ?? []) {
    const pool: AssetPool = { address: p.address, pair: pairLabel(p), type: p.type, feeBps: p.feeBps };
    for (const t of p.tokens) {
      if (!StrKey.isValidContract(t.address)) continue;
      const existing = byAddress.get(t.address);
      if (existing) { if (!existing.origins.includes('aquarius')) existing.origins.push('aquarius'); if (!existing.pools.some(x => x.address === pool.address)) existing.pools.push(pool); continue; }
      add({ address: t.address, symbol: t.symbol, name: '', decimals: null, verified: false, collision: false, origins: ['aquarius'], pools: [pool], reflector: null, feed: null, vault: false });
    }
  }
  const verifiedSymbols = new Set(KNOWN_ASSETS[net].map(k => k.symbol.toUpperCase()));
  const vaultKeys = new Set((input.vaultKeys ?? []).map(k => k.toUpperCase()));
  for (const a of byAddress.values()) {
    if (!a.verified && verifiedSymbols.has(a.symbol.toUpperCase())) { a.collision = true; a.name = a.name || `Unverified ${a.symbol} issuer`; }
    if (input.feeds) {
      // DEX coverage is exact (contract id). External coverage is by symbol, so only the verified asset with that symbol counts.
      const feed: FeedKind | null = input.feeds.dex.has(a.address) ? 'dex' : a.verified && input.feeds.cex.has(a.symbol.toUpperCase()) ? 'external' : null;
      a.feed = feed; a.reflector = feed !== null;
    }
    a.vault = vaultKeys.has(a.symbol.toUpperCase()) || vaultKeys.has(a.address.toUpperCase());
  }
  const rank = (a: CatalogAsset) => a.collision ? 3 : a.verified ? 0 : a.origins.includes('launchpad') || a.origins.includes('demo') ? 1 : 2;
  return order.map(addr => byAddress.get(addr)!)
    .filter(a => !input.allow || input.allow.has(a.address))
    .map((a, i) => ({ a, i }))
    .sort((x, y) => rank(x.a) - rank(y.a) || (rank(x.a) === 2 ? y.a.pools.length - x.a.pools.length : 0) || x.i - y.i)
    .map(({ a }) => a);
}

/** Case-insensitive search over symbol, name and contract id. Symbol matches rank first, then name, then address. */
export function searchAssets(assets: readonly CatalogAsset[], query: string): CatalogAsset[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...assets];
  const score = (a: CatalogAsset): number => {
    const sym = a.symbol.toLowerCase(), name = a.name.toLowerCase(), addr = a.address.toLowerCase();
    if (sym === q) return 0;
    if (sym.startsWith(q)) return 1;
    if (sym.includes(q)) return 2;
    if (name.includes(q)) return 3;
    if (addr.includes(q)) return 4;
    return -1;
  };
  return assets.map((a, i) => ({ a, i, s: score(a) })).filter(x => x.s >= 0).sort((x, y) => x.s - y.s || x.i - y.i).map(x => x.a);
}

const BRAND_COLORS: Record<string, string> = { USDC: '#2775ca', EURC: '#1f8fd0', XLM: '#5b6b8c', AQUA: '#7b5cff', BLND: '#e8962e', PYUSD: '#0a5ba9', YXLM: '#c9a227', USDT: '#26a17b' };
/** Deterministic circle colour for an asset icon: brand-like for the known symbols, a stable hue for everything else. */
export function assetColor(symbol: string): string {
  const key = symbol.toUpperCase();
  if (BRAND_COLORS[key]) return BRAND_COLORS[key];
  let h = 0;
  for (const ch of key) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return `hsl(${h} 48% 42%)`;
}
export function assetInitials(symbol: string): string {
  const s = symbol.replace(/[^A-Za-z0-9]/g, '');
  return (s.length <= 3 ? s : s.slice(0, 2)).toUpperCase() || '?';
}
