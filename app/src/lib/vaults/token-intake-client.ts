import { Address, xdr } from '@stellar/stellar-sdk';
import { canonicalTokenSymbol, findReflectorFeed, normalizeContract, scAddress, scEnum, scSymbol } from '@/lib/peridot/factory';
import { getDeployments, network } from '@/lib/peridot/network';
import { MOCK_CUSTOM_TOKENS, MOCK_NOFEED_TOKEN, readMockState } from '@/lib/peridot/mock';
import { readContract, readContractRaw } from '@/lib/peridot/rpc';
import { decodeMarginPoolRegistry } from '@/lib/peridot/margin';
import type { PriceConfig } from '@/lib/peridot/types';
import { AQUARIUS_ROUTER, USDC_ADDRESS } from './aquarius-pools';
import { kindForKey, type FeedKind, oraclesListing, priceToNumber, type LiveQuote, type OracleKey, type OracleSnapshot } from './price-sources';
import { NotATokenError, decidePricing, parseTokenInput, readTokenInfo, type ParsedToken, type PricingDecision, type TokenInfo } from './token-intake';

export interface Inspection {
  parsed: Extract<ParsedToken, { kind: 'contract' | 'classic' }>;
  info: TokenInfo;
  /** Present only when the factory approved the mapping. */
  price: PriceConfig | undefined;
  pricing: PricingDecision;
  /** Kind of the oracle behind the approved mapping (null in demo mode or when no mapping is approved). */
  source: FeedKind | null;
  /** Live quote of the approved mapping, when it could be read. */
  quote: LiveQuote | null;
  /** Leverage rule shown to owners: any token with seven decimals can be switched on. */
  leverage: { available: boolean; reason: string };
}

async function mockInfo(address: string): Promise<TokenInfo> {
  const custom = MOCK_CUSTOM_TOKENS[address];
  if (custom) return { address, name: custom.name, symbol: custom.symbol, decimals: custom.decimals, totalSupply: custom.totalSupply };
  const known = readMockState().tokens[address];
  if (known) return { address, name: known.symbol, symbol: known.symbol, decimals: known.decimals, totalSupply: null };
  throw new NotATokenError('demo mode (try the demo tokens PDEMO or NOFEED)');
}
async function findUsdcPool(token: string): Promise<{ address: string; depthUsd: number | null } | null> {
  if (network.useMocks) return token === MOCK_NOFEED_TOKEN ? { address: 'mock-nofeed-pool', depthUsd: 12_000 } : null;
  const usdc = USDC_ADDRESS[network.name];
  if (token === usdc) return null;
  try {
    const [a, b] = [token, usdc].map(t => new Address(t).toScAddress().toXDR()) as [Buffer, Buffer];
    const sorted = Buffer.compare(a, b) <= 0 ? [token, usdc] : [usdc, token];
    const pools = decodeMarginPoolRegistry(await readContractRaw(AQUARIUS_ROUTER[network.name], 'get_pools', [xdr.ScVal.scvVec(sorted.map(t => new Address(t).toScVal()))]));
    let best: { address: string; depthUsd: number | null } | null = null;
    for (const { pool } of pools) {
      let depth: number | null = null;
      try {
        const tokens = await readContract<string[]>(pool, 'get_tokens'), reserves = await readContract<Array<bigint | number>>(pool, 'get_reserves');
        const i = tokens.indexOf(usdc);
        if (i >= 0 && reserves[i] !== undefined) depth = Number(reserves[i]) / 1e7;
      } catch { /* depth stays unknown */ }
      if (!best || (depth ?? -1) > (best.depthUsd ?? -1)) best = { address: pool, depthUsd: depth };
    }
    return best;
  } catch { return null; }
}

let oracleCache: Promise<OracleSnapshot[]> | null = null;
/** Read assets(), decimals() and resolution() of the Reflector oracles in the deployment manifest. Cached for the session; mock mode has none. */
export function loadOracleSnapshots(): Promise<OracleSnapshot[]> {
  if (network.useMocks) return Promise.resolve([]);
  if (!oracleCache) {
    oracleCache = (async () => {
      const external = getDeployments().external ?? {};
      const out: OracleSnapshot[] = [];
      for (const key of ['reflector_stellar', 'reflector_external'] as OracleKey[]) {
        const address = external[key];
        if (typeof address !== 'string' || !address) continue;
        try {
          const [assets, decimals, resolution] = await Promise.all([readContract(address, 'assets'), readContract<number>(address, 'decimals'), readContract<number>(address, 'resolution')]);
          const list = normalizeContract<Array<{ tag: string; values: readonly [string] }>>(assets);
          out.push({ key, address, kind: kindForKey(key), decimals: Number(decimals), resolution: Number(resolution), assets: list.filter(a => (a.tag === 'Stellar' || a.tag === 'Other') && typeof a.values?.[0] === 'string').map(a => ({ tag: a.tag as 'Stellar' | 'Other', value: a.values[0] })) });
        } catch { /* one oracle being unreachable must not hide the other */ }
      }
      return out;
    })();
    oracleCache.then(r => { if (!r.length) oracleCache = null; }, () => { oracleCache = null; });
  }
  return oracleCache;
}

/** lastprice() of the oracle in the approved mapping, as a plain number with its timestamp. Null when unreadable or empty. */
async function readLiveQuote(price: PriceConfig, snapshots: readonly OracleSnapshot[]): Promise<LiveQuote | null> {
  if (price.tag !== 'ReflectorOnly') return null;
  const { oracle, asset } = price.values[0];
  const snap = snapshots.find(s => s.address === oracle);
  if (!snap) return null;
  try {
    const raw = await readContract<{ price: bigint | number | string; timestamp: bigint | number | string } | null>(oracle, 'lastprice', [scEnum(asset.tag, asset.tag === 'Stellar' ? scAddress(asset.values[0]) : scSymbol(asset.values[0]))]);
    if (!raw) return null;
    return { kind: snap.kind, price: priceToNumber(BigInt(raw.price), snap.decimals), timestamp: Number(raw.timestamp), resolution: snap.resolution };
  } catch { return null; }
}

/** Everything the add-market form shows after a paste: parse, SEP-41 reads, pricing explanation. Throws a readable Error on a bad input. */
export async function inspectToken(raw: string): Promise<Inspection> {
  const parsed = parseTokenInput(raw, network.passphrase);
  if (parsed.kind === 'invalid') throw new Error(parsed.reason);
  const info = network.useMocks ? await mockInfo(parsed.address) : await readTokenInfo((c, m) => readContract(c, m), parsed.address, network.name);
  info.symbol = canonicalTokenSymbol(info.address, info.symbol);
  let price: PriceConfig | undefined;
  try { price = await findReflectorFeed(parsed.address, info.symbol); } catch { price = undefined; }
  const pool = price ? null : await findUsdcPool(parsed.address);
  const snapshots = await loadOracleSnapshots().catch(() => [] as OracleSnapshot[]);
  const quote = price ? (network.useMocks ? undefined : await readLiveQuote(price, snapshots)) : undefined;
  // Only a DEX listing is exact (contract id); an external listing is by symbol and needs a verified token to be believed.
  const listedOn = price ? null : oraclesListing(snapshots, parsed.address, info.symbol).find(s => s.kind === 'dex')?.kind ?? null;
  const pricing = decidePricing({ reflectorApproved: !!price, pool, symbol: info.symbol, quote, listedOn });
  const leverage = info.decimals !== 7
    ? { available: false, reason: `Leverage needs seven decimals. ${info.symbol} has ${info.decimals}.` }
    : pricing.canSubmit ? { available: true, reason: `Any token with an approved Reflector price and seven decimals can have leverage. ${info.symbol} is priced by the ${pricing.title.replace('Priced by ', '')}. You choose it per market; it also needs an approved Aquarius pool to another leveraged market.` }
      : { available: false, reason: 'Leverage needs a priced market first.' };
  const source = price?.tag === 'ReflectorOnly' ? snapshots.find(s => s.address === price.values[0].oracle)?.kind ?? null : null;
  return { parsed, info, price, pricing, source, quote: quote ?? null, leverage };
}
