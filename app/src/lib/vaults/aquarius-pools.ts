/** Aquarius asset registry: USDC pools, read only.
 *
 * Source order (see memory note "Aquarius /pools/ API is incomplete"):
 *   1. the router's on-chain `get_pools(tokens)` for USDC against a list of counterparties (authoritative),
 *   2. the Aquarius AMM HTTP API (broad, but it hides some live pools),
 *   3. a static list of pools verified on chain by the Peridot team (so the page is never blank),
 *   4. demo data when the app runs with NEXT_PUBLIC_USE_MOCKS=true.
 * Everything here is pure or takes an injected reader so it is unit-testable in node. */

/** Minimum depth in whole USD of each pool side that price-router-ext requires before it serves an AquariusOnly price. */
export const MIN_DEPTH_USD = 500;

export type PoolType = 'constant_product' | 'stable' | 'concentrated' | 'unknown';
export type PoolSource = 'chain' | 'api' | 'registry' | 'demo';
export type Net = 'mainnet' | 'testnet';

export interface PoolToken { address: string; symbol: string }
export interface AquariusPool {
  address: string;
  /** 32 byte pool index as hex, when known. */
  poolIndex?: string;
  tokens: [PoolToken, PoolToken];
  type: PoolType;
  /** Swap fee in basis points (30 = 0.30%). */
  feeBps: number | null;
  /** Approximate TVL in USD (twice the dollar-token reserve), null when not cheaply available. */
  tvlUsd: number | null;
  /** Lifetime volume in USD, null when unknown. */
  volumeUsd: number | null;
  source: PoolSource;
}

const MAINNET_TOKENS: Record<string, string> = {
  CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA: 'XLM',
  CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75: 'USDC',
  CDTKPWPLOURQA2SGTKTUQOWRCBZEORB4BWBOMJ3D3ZTQQSGE5F6JBQLV: 'EURC',
  CCCRWH6Q3FNP3I2I57BDLM5AFAT7O6OF6GKQOC6SSJNDAVRZ57SPHGU2: 'PYUSD',
  CBZVSNVB55ANF24QVJL2K5QCLOAB6XITGTGXYEAF6NPTXYKEJUYQOHFC: 'yXLM',
  CAUIKL3IYGMERDRUN6YSCLWVAKIFG5Q4YJHUKM4S4NJZQIA3BAS6OJPK: 'AQUA',
  CD25MNVTZDL4Y3XBCPCJXGXATV5WUHHOWMYFF4YBEGU5FCPGMYTVG5JY: 'BLND',
};
const TESTNET_TOKENS: Record<string, string> = {
  CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC: 'XLM',
  CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA: 'USDC',
  CAQCFVLOBK5GIULPNZRGATJJMIZL5BSP7X5YJVMGCPTUEPFM4AVSRCJU: 'USDC',
  CDPXNHHVSLX3HFAHV7XOISM23MZH36WSXTO45RNDOBIDFZBGTSOVD4OY: 'USDT',
  CDNVQW44C3HALYNVQ4SOBXY5EWYTGVYXX6JPESOLQDABJI5FC5LTRRUE: 'AQUA',
  CB22KRA3YZVCNCQI64JQ5WE7UY2VAV7WFLK6A2JN3HEX56T2EDAFO7QF: 'BLND',
};
export const KNOWN_TOKENS: Record<Net, Record<string, string>> = { mainnet: MAINNET_TOKENS, testnet: TESTNET_TOKENS };
export const USDC_ADDRESS: Record<Net, string> = {
  mainnet: 'CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75',
  testnet: 'CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA',
};
/** Counterparties checked against USDC through the router (sorted pair lookups). */
export const COUNTERPARTIES: Record<Net, string[]> = {
  mainnet: ['EURC', 'PYUSD', 'XLM', 'yXLM', 'AQUA'].map(s => addressOf('mainnet', s)).filter(Boolean),
  testnet: ['XLM', 'AQUA'].map(s => addressOf('testnet', s)).filter(Boolean),
};
function addressOf(net: Net, symbol: string): string {
  return Object.entries(KNOWN_TOKENS[net]).find(([, s]) => s === symbol)?.[0] ?? '';
}

export const AQUARIUS_ROUTER: Record<Net, string> = {
  mainnet: 'CBQDHNBFBZYE4MKPWBSJOPIYLW4SFSXAXUTSXJN76GNKYVYPCKWC6QUK',
  testnet: 'CBCFTQSPDBAIZ6R6PJQKSQWKNKWH2QIV3I4J72SHWBIK3ADRRAM5A6GD',
};
export const AQUARIUS_API: Record<Net, string> = {
  mainnet: 'https://amm-api.aqua.network/api/external/v2',
  testnet: 'https://amm-api-testnet.aqua.network/api/external/v2',
};

/** Dollar-like tokens: a pool containing one of these counts as a "USDC pair" on the page. Testnet has no Circle pairs for Peridot, so its mock USDT stands in. */
export function isUsdc(net: Net, token: PoolToken): boolean {
  return token.symbol === 'USDC' || token.address === USDC_ADDRESS[net];
}
export function isDollarToken(net: Net, token: PoolToken): boolean {
  return isUsdc(net, token) || (net === 'testnet' && token.symbol === 'USDT');
}
const STABLE_SYMBOLS = new Set(['USDC', 'EURC', 'PYUSD', 'USDT', 'USDx']);
/** Both sides pegged: the vault uses a full range position. Otherwise it centres a range around the price. */
export function isStablePair(pool: Pick<AquariusPool, 'tokens'>): boolean {
  return pool.tokens.every(t => STABLE_SYMBOLS.has(t.symbol));
}
/** Which side of the pair is the dollar token (the market underlying for a USDC vault). Index into the pool's token order. */
export function underlyingIndex(net: Net, pool: Pick<AquariusPool, 'tokens'>): 0 | 1 | null {
  if (isUsdc(net, pool.tokens[0])) return 0;
  if (isUsdc(net, pool.tokens[1])) return 1;
  if (isDollarToken(net, pool.tokens[0])) return 0;
  if (isDollarToken(net, pool.tokens[1])) return 1;
  return null;
}
export function pairLabel(pool: Pick<AquariusPool, 'tokens'>): string {
  return `${pool.tokens[0].symbol}/${pool.tokens[1].symbol}`;
}
/** The existing aquarius-lp-vault contract only accepts concentrated pools (initialize panics otherwise). */
export function isVaultEligible(pool: Pick<AquariusPool, 'type'>): boolean {
  return pool.type === 'concentrated';
}
export function vaultIneligibleReason(pool: Pick<AquariusPool, 'type'>): string | null {
  if (isVaultEligible(pool)) return null;
  const kind = pool.type === 'constant_product' ? 'a constant product pool' : pool.type === 'stable' ? 'a stable swap pool' : 'a pool of unknown type';
  return `This is ${kind}. The Aquarius LP vault needs a concentrated liquidity pool.`;
}

export function formatFee(feeBps: number | null): string {
  if (feeBps === null || !Number.isFinite(feeBps)) return 'n/a';
  return `${(feeBps / 100).toFixed(2)}%`;
}
export function formatUsd(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return 'n/a';
  if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
  if (value >= 1e3) return `$${(value / 1e3).toFixed(1)}K`;
  return `$${value.toFixed(0)}`;
}
export function shortAddress(a: string): string { return a.length > 14 ? `${a.slice(0, 6)}...${a.slice(-6)}` : a; }

/** Highest TVL first, unknown TVL after known, then concentrated before the rest, then pair label for a stable order. */
export function sortPools(pools: readonly AquariusPool[]): AquariusPool[] {
  return [...pools].sort((a, b) => {
    const av = a.tvlUsd ?? -1, bv = b.tvlUsd ?? -1;
    if (av !== bv) return bv - av;
    const ac = isVaultEligible(a) ? 0 : 1, bc = isVaultEligible(b) ? 0 : 1;
    if (ac !== bc) return ac - bc;
    return pairLabel(a).localeCompare(pairLabel(b)) || a.address.localeCompare(b.address);
  });
}
export function filterUsdcPairs(net: Net, pools: readonly AquariusPool[]): AquariusPool[] {
  return pools.filter(p => p.tokens.some(t => isDollarToken(net, t)));
}
export type PoolFilter = 'all' | 'vault-eligible';
export function applyPoolFilter(pools: readonly AquariusPool[], filter: PoolFilter, query = ''): AquariusPool[] {
  const q = query.trim().toLowerCase();
  return pools.filter(p => (filter === 'all' || isVaultEligible(p)) && (!q || pairLabel(p).toLowerCase().includes(q) || p.address.toLowerCase().includes(q)));
}
/** Merge pool lists; the first list wins on conflicts but missing numbers are filled from later ones. */
export function mergePools(...lists: ReadonlyArray<readonly AquariusPool[]>): AquariusPool[] {
  const byAddress = new Map<string, AquariusPool>();
  for (const list of lists) for (const p of list) {
    const old = byAddress.get(p.address);
    if (!old) { byAddress.set(p.address, p); continue; }
    byAddress.set(p.address, {
      ...old,
      type: old.type === 'unknown' ? p.type : old.type,
      feeBps: old.feeBps ?? p.feeBps,
      tvlUsd: old.tvlUsd ?? p.tvlUsd,
      volumeUsd: old.volumeUsd ?? p.volumeUsd,
      poolIndex: old.poolIndex ?? p.poolIndex,
    });
  }
  return [...byAddress.values()];
}

// ---------- API ----------
function symbolFromApi(str: string): string {
  if (str === 'native') return 'XLM';
  const code = str.split(':')[0];
  return code || str;
}
function toType(raw: unknown): PoolType {
  return raw === 'constant_product' || raw === 'stable' || raw === 'concentrated' ? raw : 'unknown';
}
/** Fee comes as a decimal string ("0.0030" = 0.30%). */
export function apiFeeToBps(fee: unknown): number | null {
  const n = typeof fee === 'string' || typeof fee === 'number' ? Number(fee) : NaN;
  return Number.isFinite(n) && n >= 0 && n < 1 ? Math.round(n * 10_000) : null;
}
/** Parse one page of the AMM API listing. Malformed rows are skipped, never thrown on. */
export function parseApiPools(net: Net, body: unknown): AquariusPool[] {
  const results = (body as { results?: unknown })?.results;
  if (!Array.isArray(results)) throw new Error('Aquarius API returned an unexpected response.');
  const out: AquariusPool[] = [];
  for (const row of results) {
    if (!row || typeof row !== 'object') continue;
    const r = row as Record<string, unknown>;
    const addrs = r.tokens_addresses, strs = r.tokens_str;
    if (typeof r.address !== 'string' || !Array.isArray(addrs) || addrs.length !== 2 || !addrs.every(a => typeof a === 'string')) continue;
    const labels = Array.isArray(strs) && strs.length === 2 ? strs.map(s => symbolFromApi(String(s))) : [];
    const tokens = addrs.map((address: string, i) => ({ address, symbol: KNOWN_TOKENS[net][address] ?? labels[i] ?? shortAddress(address) })) as [PoolToken, PoolToken];
    out.push({ address: r.address, poolIndex: typeof r.index === 'string' ? r.index : undefined, tokens, type: toType(r.pool_type), feeBps: apiFeeToBps(r.fee), tvlUsd: null, volumeUsd: null, source: 'api' });
  }
  return out;
}
export type FetchLike = (url: string, init?: { signal?: AbortSignal }) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;
export async function fetchApiPools(net: Net, fetchFn: FetchLike, opts: { pages?: number; timeoutMs?: number } = {}): Promise<AquariusPool[]> {
  const pages = opts.pages ?? 3, timeoutMs = opts.timeoutMs ?? 8000;
  const all: AquariusPool[] = [];
  for (let page = 1; page <= pages; page++) {
    const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), timeoutMs);
    try {
      const res = await fetchFn(`${AQUARIUS_API[net]}/pools/?size=200&page=${page}`, { signal: ctl.signal });
      if (!res.ok) { if (page > 1 && res.status === 404) break; throw new Error(`Aquarius API answered ${res.status}.`); }
      const body = await res.json();
      all.push(...parseApiPools(net, body));
      if (!(body as { next?: unknown }).next) break;
    } finally { clearTimeout(timer); }
  }
  return filterUsdcPairs(net, all);
}

// ---------- chain ----------
export interface ChainReader {
  /** Router `get_pools(tokens)` for a sorted token pair. */
  getPools(tokens: [string, string]): Promise<Array<{ poolIndex: string; pool: string }>>;
  poolInfo(pool: string): Promise<{ tokens: string[]; type: PoolType; feeBps: number | null; reserves: bigint[] | null }>;
}
/** Soroban Address ordering is by XDR bytes, which for contract ids equals ordering of the raw 32 byte hashes; the app already sorts with the SDK, so the reader sorts. */
export async function discoverChainPools(net: Net, reader: ChainReader, counterparties: readonly string[] = COUNTERPARTIES[net]): Promise<AquariusPool[]> {
  const usdc = USDC_ADDRESS[net];
  const found = new Map<string, AquariusPool>();
  const failures: unknown[] = [];
  await Promise.all(counterparties.filter(c => c !== usdc).map(async other => {
    try {
      const pools = await reader.getPools([usdc, other]);
      await Promise.all(pools.map(async ({ pool, poolIndex }) => {
        const info = await reader.poolInfo(pool);
        if (info.tokens.length !== 2) return;
        const tokens = info.tokens.map(address => ({ address, symbol: KNOWN_TOKENS[net][address] ?? shortAddress(address) })) as [PoolToken, PoolToken];
        const usdcIdx = tokens.findIndex(t => t.address === usdc);
        // Constant product and stable pools are balanced in value, concentrated ones are not; the estimate is labelled approximate in the UI.
        const tvlUsd = info.reserves && usdcIdx >= 0 && info.reserves[usdcIdx] !== undefined ? Number(info.reserves[usdcIdx]) / 1e7 * 2 : null;
        found.set(pool, { address: pool, poolIndex, tokens, type: info.type, feeBps: info.feeBps, tvlUsd, volumeUsd: null, source: 'chain' });
      }));
    } catch (e) { failures.push(e); }
  }));
  if (found.size === 0 && failures.length > 0) throw failures[0] instanceof Error ? failures[0] : new Error('Router lookup failed.');
  return [...found.values()];
}

// ---------- static registry and demo ----------
function p(net: Net, address: string, a: string, b: string, type: PoolType, feeBps: number, tvlUsd: number | null, source: PoolSource): AquariusPool {
  const tok = (s: string): PoolToken => ({ symbol: s, address: addressOf(net, s) || s });
  return { address, tokens: [tok(a), tok(b)], type, feeBps, tvlUsd, volumeUsd: null, source };
}
/** Verified on chain by the Peridot team (checked 18 Sep 2026). TVL is unknown on purpose. */
export function registryPools(net: Net): AquariusPool[] {
  if (net === 'testnet') return [
    { address: 'CA6DAGOMK5D7GKBNWVCIEAYSTPJXLQUFWFKSZOMNEM6BVOTUBDCTIT5I', tokens: [{ symbol: 'USDT', address: addressOf('testnet', 'USDT') }, { symbol: 'XLM', address: addressOf('testnet', 'XLM') }], type: 'concentrated', feeBps: 30, tvlUsd: null, volumeUsd: null, source: 'registry' },
    { address: 'CCMNSENXDBNJSY72BDIPH5CCXLLHBKZ4LXTRKDLKZN4UI2NJFQLWTLD6', tokens: [{ symbol: 'USDT', address: addressOf('testnet', 'USDT') }, { symbol: 'XLM', address: addressOf('testnet', 'XLM') }], type: 'constant_product', feeBps: 30, tvlUsd: null, volumeUsd: null, source: 'registry' },
  ];
  return [
    p(net, 'CDTSE6RLRI7ZO25JSER6E4SQR4PHJJNONEGS5HDJ3Y6LAKECRZKYN5CA', 'USDC', 'EURC', 'concentrated', 30, null, 'registry'),
    p(net, 'CB37QM6EHVBDDNK7MAVQESV7WPLKV6G36TR7MHAOYWPZXLPQUWSDOK4E', 'USDC', 'EURC', 'constant_product', 30, null, 'registry'),
    p(net, 'CAPIOQNULTKVYOJT6X2W2XKGNIVUWZDY72Y42YG6HQKJ7DU7YTHIDQYX', 'PYUSD', 'USDC', 'concentrated', 10, null, 'registry'),
    p(net, 'CDMH535JSD224YXPET3B4SJOLXTQQ24GRSCWACGYBKSH2DKFJYWI7SUW', 'PYUSD', 'USDC', 'stable', 10, null, 'registry'),
    p(net, 'CBBMQBNHB2FYVZYV7VNHOJHUMTFJLR4PUMRVQYNW6RHIKZO2NQMIBUCV', 'XLM', 'USDC', 'constant_product', 30, null, 'registry'),
    p(net, 'CA6GAFOJCW4MGQQBUCQUSA3CLIH25G4SNKB2JHYKZCVWZTNW5VXMSC4O', 'AQUA', 'USDC', 'constant_product', 30, 520_000, 'registry'),
  ];
}
/** Clearly fake numbers for NEXT_PUBLIC_USE_MOCKS. Addresses are the real pools so links still make sense, but source is "demo". */
export function demoPools(net: Net): AquariusPool[] {
  const tvl: Record<string, number> = { CDTSE6RLRI7ZO25JSER6E4SQR4PHJJNONEGS5HDJ3Y6LAKECRZKYN5CA: 412_000, CAPIOQNULTKVYOJT6X2W2XKGNIVUWZDY72Y42YG6HQKJ7DU7YTHIDQYX: 186_000, CB37QM6EHVBDDNK7MAVQESV7WPLKV6G36TR7MHAOYWPZXLPQUWSDOK4E: 64_000, CA6GAFOJCW4MGQQBUCQUSA3CLIH25G4SNKB2JHYKZCVWZTNW5VXMSC4O: 520_000, CBBMQBNHB2FYVZYV7VNHOJHUMTFJLR4PUMRVQYNW6RHIKZO2NQMIBUCV: 91_000 };
  return registryPools(net).map(pool => ({ ...pool, tvlUsd: tvl[pool.address] ?? pool.tvlUsd, source: 'demo' as const }));
}

export interface LoadResult {
  pools: AquariusPool[];
  /** Per source outcome, for the page to explain what it is showing. */
  sources: { chain: 'ok' | 'error' | 'skipped'; api: 'ok' | 'error' | 'skipped' };
  /** Which source supplied the list the user sees. */
  primary: PoolSource;
  warnings: string[];
}
export interface LoadDeps { net: Net; demo: boolean; chain: ChainReader | null; fetchFn: FetchLike | null }
/** Never throws and never returns an empty list: the registry (or demo data) is the last resort. */
export async function loadAquariusPools(deps: LoadDeps): Promise<LoadResult> {
  const { net, demo } = deps;
  if (demo) return { pools: sortPools(demoPools(net)), sources: { chain: 'skipped', api: 'skipped' }, primary: 'demo', warnings: [] };
  const warnings: string[] = [];
  const sources: LoadResult['sources'] = { chain: 'skipped', api: 'skipped' };
  const [chainRes, apiRes] = await Promise.allSettled([
    deps.chain ? discoverChainPools(net, deps.chain) : Promise.reject(new Error('skip')),
    deps.fetchFn ? fetchApiPools(net, deps.fetchFn) : Promise.reject(new Error('skip')),
  ]);
  let chainPools: AquariusPool[] = [], apiPools: AquariusPool[] = [];
  if (deps.chain) {
    if (chainRes.status === 'fulfilled') { chainPools = chainRes.value; sources.chain = 'ok'; }
    else { sources.chain = 'error'; warnings.push(`On-chain router lookup failed: ${chainRes.reason instanceof Error ? chainRes.reason.message : 'unknown error'}.`); }
  }
  if (deps.fetchFn) {
    if (apiRes.status === 'fulfilled') { apiPools = apiRes.value; sources.api = 'ok'; }
    else { sources.api = 'error'; warnings.push(`Aquarius API unavailable: ${apiRes.reason instanceof Error ? apiRes.reason.message : 'unknown error'}.`); }
  }
  const merged = mergePools(chainPools, apiPools);
  if (merged.length === 0) {
    warnings.push('Showing the verified pool list shipped with this app instead.');
    return { pools: sortPools(registryPools(net)), sources, primary: 'registry', warnings };
  }
  // Verified pools that neither live source returned still appear, so a hidden pool never disappears from the page.
  const withRegistry = mergePools(merged, registryPools(net));
  return { pools: sortPools(withRegistry), sources, primary: chainPools.length ? 'chain' : 'api', warnings };
}
