/** Live yield quotes per venue, from read-only contract simulations (and the Aquarius pool contract for rewards).
 * Every quote carries the formula it used, so the UI can show the number with its derivation. Reads are coalesced and
 * cached for a minute in this module (rpc.ts itself never caches settled state, by design). In demo mode nothing is
 * read and every venue answers "n/a" with the reason, so no number is ever invented. */
import { getDeployments, network } from '@/lib/peridot/network';
import { readContract } from '@/lib/peridot/rpc';
import { scAddress, scI128, scMap, scU32 } from '@/lib/peridot/factory';
import { aquariusRewardApr, blendRates, continuousApy, rayToFraction, sharePrice, sharePriceDriftApy, spotPrice, type YieldQuote } from './apy';
import { defaultDefindexVault } from './defindex-defaults';
import { ZENEX_ADDRESSES } from './kinds/zenex';
import type { AppNetwork, VaultId } from './registry';

const TTL_MS = 60_000;
const cache = new Map<string, { at: number; value: Promise<YieldQuote> }>();
/** Coalesce identical quotes for a minute. A rejected read is dropped so the next render retries. */
export function cachedQuote(key: string, make: () => Promise<YieldQuote>): Promise<YieldQuote> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value;
  const value = make().catch(e => { cache.delete(key); throw e; });
  cache.set(key, { at: Date.now(), value });
  return value;
}
export function clearYieldCache(): void { cache.clear(); }

const na = (label: string, reason: string, facts: Array<[string, string]> = []): YieldQuote => ({ kind: 'na', label, formula: 'No rate is shown without on-chain inputs.', reason, facts, asOf: Date.now() });
const pct = (v: number, d = 2) => `${(v * 100).toFixed(d)}%`;
const amount = (v: bigint, decimals = 7, maxFraction = 2) => (Number(v) / Math.pow(10, decimals)).toLocaleString('en-US', { maximumFractionDigits: maxFraction });

/** AQUA/USDC constant-product pool used only to price AQUA (peridot-contracts/addresses.md, "AQUA/USDC route pool"). */
const AQUA_USDC_POOL = 'CA6GAFOJCW4MGQQBUCQUSA3CLIH25G4SNKB2JHYKZCVWZTNW5VXMSC4O';
/** Example concentrated pool for the venue card when no vault is chosen (addresses.md, USDC/EURC concentrated 0.3%). */
export const AQUARIUS_EXAMPLE_POOL = 'CDTSE6RLRI7ZO25JSER6E4SQR4PHJJNONEGS5HDJ3Y6LAKECRZKYN5CA';
const ZERO_ACCOUNT = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF';
/** XOXNO Lending controller on mainnet (docs/ui/VAULTS-UI.md, XOXNO mainnet runbook). The pool is read from it. */
const XOXNO_CONTROLLER: Record<AppNetwork, string> = { mainnet: 'CAUCMIN5KSXEVZ7NMXR3LZATGD5EFIEUI5XWTFLYRO2R5OTXI22WE5JX', testnet: '' };

interface BlendReserve { config: { r_base: number; r_one: number; r_two: number; r_three: number; util: number }; data: { b_rate: bigint; b_supply: bigint; d_rate: bigint; d_supply: bigint; ir_mod: bigint } }

/** Share price samples per vault, kept in the browser so a drift APY can be computed after a few hours. */
export interface SampleStore { getItem(key: string): string | null; setItem(key: string, value: string): void }
function sampleStore(): SampleStore | null { try { return window.localStorage; } catch { return null; } }
export function driftFromSamples(store: SampleStore | null, key: string, price: number, now = Date.now()): { apy: number | null; since: number | null } {
  if (!store) return { apy: null, since: null };
  let first: { t: number; p: number } | null = null;
  try { const raw = store.getItem(key); first = raw ? JSON.parse(raw) : null; } catch { first = null; }
  if (!first || !(first.p > 0)) { try { store.setItem(key, JSON.stringify({ t: now, p: price })); } catch { /* storage is a convenience */ } return { apy: null, since: now }; }
  return { apy: sharePriceDriftApy(first.p, first.t, price, now), since: first.t };
}

async function blendSupply(pool: string, token: string) {
  const [reserve, config] = await Promise.all([readContract<BlendReserve>(pool, 'get_reserve', [scAddress(token)]), readContract<{ bstop_rate: number }>(pool, 'get_config')]);
  const r = blendRates({ rBase: reserve.config.r_base, rOne: reserve.config.r_one, rTwo: reserve.config.r_two, rThree: reserve.config.r_three, targetUtil: reserve.config.util, irMod: reserve.data.ir_mod, bRate: reserve.data.b_rate, bSupply: reserve.data.b_supply, dRate: reserve.data.d_rate, dSupply: reserve.data.d_supply, bstopRate: config.bstop_rate });
  return { ...r, bstopRate: config.bstop_rate / 10_000_000 };
}
const BLEND_FORMULA = 'Blend pool get_reserve(token) and get_config(): utilization = d_supply * d_rate / (b_supply * b_rate); borrow APR = Blend three-slope curve (r_base, r_one, r_two, r_three, target util) * ir_mod; supply APR = borrow APR * utilization * (1 - bstop_rate); APY = e^APR - 1 (the b_rate index accrues every ledger).';

export async function quoteBlend(token: string): Promise<YieldQuote> {
  if (network.useMocks) return na('n/a', 'Demo mode: no chain reads.');
  const ext = getDeployments().external as Record<string, unknown>;
  const feeVault = typeof ext.blend_fee_vault === 'string' ? ext.blend_fee_vault : '';
  if (!feeVault) return na('n/a', `No Blend fee vault is configured on ${network.name}.`);
  if (!token) return na('n/a', 'Verify a token to read its Blend reserve.');
  return cachedQuote(`blend:${network.name}:${token}`, async () => {
    const pool = await readContract<string>(feeVault, 'get_pool');
    const r = await blendSupply(pool, token);
    return { kind: 'apy', value: continuousApy(r.supplyApr), label: 'APY, before fee vault take', formula: `${BLEND_FORMULA} The fee vault keeps a share of the yield (set_fee_mode); it has no getter, so the take is not subtracted here.`, facts: [['Pool utilization', pct(r.utilization, 1)], ['Borrow APR', pct(r.borrowApr)], ['Backstop take', pct(r.bstopRate, 0)], ['Fee vault take', 'unknown, no getter']], asOf: Date.now() };
  });
}

export async function quoteDefindex(token: string, vault?: string): Promise<YieldQuote> {
  if (network.useMocks) return na('n/a', 'Demo mode: no chain reads.');
  const d = vault ? { vault, token } : defaultDefindexVault(network.name, token);
  if (!d) return na('n/a', 'No DeFindex vault for this token.');
  return cachedQuote(`defindex:${network.name}:${d.vault}`, async () => {
    const [assets, per, supply] = await Promise.all([
      readContract<Array<{ address: string; strategies: Array<{ address: string; name: string; paused: boolean }> }>>(d.vault, 'get_assets'),
      readContract<bigint[]>(d.vault, 'get_asset_amounts_per_shares', [scI128(10_000_000n)]),
      readContract<bigint>(d.vault, 'total_supply'),
    ]);
    const price = sharePrice(per[0] ?? 0n, 7);
    const strategy = assets[0]?.strategies.find(s => !s.paused);
    const facts: Array<[string, string]> = [['Share price', `${price.toFixed(6)} ${'per share'}`], ['Vault TVL', `${amount(supply * (per[0] ?? 0n) / 10_000_000n)} tokens`], ['Strategy', strategy?.name ?? 'none unpaused']];
    const drift = driftFromSamples(sampleStore(), `peridot:pps:v1:${network.name}:${d.vault}`, price);
    if (drift.apy !== null) return { kind: 'apy', value: drift.apy, label: 'APY, share price drift', formula: `get_asset_amounts_per_shares(1 share) now versus the first sample this browser recorded (${new Date(drift.since ?? 0).toLocaleString()}): APY = (price now / price then) ^ (year / elapsed) - 1.`, facts, asOf: Date.now() };
    const ext = getDeployments().external as Record<string, unknown>;
    const pool = typeof ext.blend_pool === 'string' ? ext.blend_pool : '';
    if (strategy && /blend/i.test(strategy.name) && pool) {
      const r = await blendSupply(pool, d.token);
      return { kind: 'apr-est', value: r.supplyApr, label: 'APR est., underlying Blend rate', formula: `The vault's unpaused strategy (${strategy.name}) autocompounds a Blend position, so the estimate is the Blend pool supply APR for this token: ${BLEND_FORMULA} BLND emissions and DeFindex fees are not included. A share price drift APY replaces this once the browser has two samples at least six hours apart (first sample recorded now).`, facts: [...facts, ['Blend utilization', pct(r.utilization, 1)]], asOf: Date.now() };
    }
    return { kind: 'na', label: 'n/a', formula: 'Share price drift needs two samples at least six hours apart.', reason: 'The first share price sample was recorded in this browser now; an APY appears after six hours.', facts, asOf: Date.now() };
  });
}

export async function quoteXoxno(token: string, hubId = 1, vault?: string): Promise<YieldQuote> {
  if (network.useMocks) return na('n/a', 'Demo mode: no chain reads.');
  const controller = XOXNO_CONTROLLER[network.name];
  if (!controller) return na('n/a', `XOXNO Lending is mainnet only; nothing to read on ${network.name}.`);
  if (!token) return na('n/a', 'Verify a token to read its XOXNO market rate.');
  return cachedQuote(`xoxno:${network.name}:${token}:${hubId}:${vault ?? ''}`, async () => {
    const pool = await readContract<string>(controller, 'get_pool_address');
    const key = scMap({ asset: scAddress(token), hub_id: scU32(hubId) });
    const [rate, util, supplied] = await Promise.all([readContract<bigint>(pool, 'get_deposit_rate', [key]), readContract<bigint>(pool, 'get_utilisation', [key]), readContract<bigint>(pool, 'get_supplied_amount', [key])]);
    const apr = rayToFraction(rate);
    const facts: Array<[string, string]> = [['Deposit APR', pct(apr, 4)], ['Utilization', pct(rayToFraction(util), 3)], ['Supplied on XOXNO', `${amount(supplied)} tokens`]];
    let fee = 0;
    if (vault) { try { const p = await readContract<{ fee_bps: number }>(vault, 'params'); fee = p.fee_bps / 10_000; facts.push(['Your vault performance fee', pct(fee, 1)]); } catch { facts.push(['Your vault performance fee', 'unreadable']); } }
    const apy = continuousApy(apr) * (1 - fee);
    return { kind: 'apy', value: apy, label: fee ? 'APY, after your vault fee' : 'APY', formula: `XOXNO controller ${controller.slice(0, 8)}... get_pool_address(), then pool get_deposit_rate({asset, hub ${hubId}}) in RAY (1e27) as an annual rate; APY = e^rate - 1${fee ? ', times (1 - performance fee)' : ''}. Utilization and supplied amount come from get_utilisation and get_supplied_amount on the same pool.`, facts, asOf: Date.now() };
  });
}

export async function quoteZenex(vault?: string): Promise<YieldQuote> {
  if (network.useMocks) return na('n/a', 'Demo mode: no chain reads.');
  if (network.name !== 'mainnet') return na('n/a', 'Zenex is mainnet only; testnet runs a mock with no yield.');
  const zx = ZENEX_ADDRESSES.mainnet;
  return cachedQuote(`zenex:${network.name}:${vault ?? zx.vault}`, async () => {
    const [assets, supply, perShare] = await Promise.all([readContract<bigint>(zx.vault, 'total_assets'), readContract<bigint>(zx.vault, 'total_supply'), readContract<bigint>(zx.vault, 'preview_redeem', [scI128(10_000_000_000_000n), scI128(0n)])]);
    const price = sharePrice(perShare, 7);
    const facts: Array<[string, string]> = [['Zenex vault share price', `${price.toFixed(4)} USDC`], ['Zenex vault TVL', `${amount(assets)} USDC`], ['Zenex shares', amount(supply, 13, 0)]];
    if (vault) { try { const own = await readContract<bigint[]>(vault, 'get_asset_amounts_per_shares', [scI128(10_000_000n)]); facts.push(['Your vault share price', own[0] ? `${sharePrice(own[0], 7).toFixed(4)} USDC` : 'no shares yet']); } catch { facts.push(['Your vault share price', 'unreadable']); } }
    const drift = driftFromSamples(sampleStore(), `peridot:pps:v1:mainnet:${zx.vault}`, price);
    if (drift.apy !== null) return { kind: 'apy', value: drift.apy, label: 'APY, Zenex share price drift', formula: `Zenex strategy vault preview_redeem(1 share, net_pnl 0) now versus the first sample this browser recorded (${new Date(drift.since ?? 0).toLocaleString()}): APY = (price now / price then) ^ (year / elapsed) - 1. Perps fees accrue to the share price; traders' profits reduce it.`, facts, asOf: Date.now() };
    return { kind: 'na', label: 'n/a', formula: 'Share price drift needs two samples at least six hours apart.', reason: 'Zenex publishes no rate on chain. The first share price sample was recorded in this browser now; an APY appears after six hours.', facts, asOf: Date.now() };
  });
}

export async function quoteAquarius(pool = AQUARIUS_EXAMPLE_POOL): Promise<YieldQuote> {
  if (network.useMocks) return na('n/a', 'Demo mode: no chain reads.');
  if (network.name !== 'mainnet') return na('n/a', 'AQUA rewards are read from mainnet pools only.');
  return cachedQuote(`aquarius:${network.name}:${pool}`, async () => {
    const [info, reserves, tokens, aquaReserves] = await Promise.all([
      readContract<Map<string, bigint> | Record<string, bigint>>(pool, 'get_rewards_info', [scAddress(ZERO_ACCOUNT)]),
      readContract<bigint[]>(pool, 'get_reserves'), readContract<string[]>(pool, 'get_tokens'), readContract<bigint[]>(AQUA_USDC_POOL, 'get_reserves'),
    ]);
    const get = (k: string): bigint => { const v = info instanceof Map ? info.get(k) : info[k]; return typeof v === 'bigint' ? v : BigInt(v ?? 0); };
    const usdc = getDeployments().external.usdc as string;
    const usdcIndex = tokens.indexOf(usdc);
    const tvl = usdcIndex >= 0 ? Number(reserves[usdcIndex]) / 1e7 * 2 : null;
    const aquaUsd = spotPrice(aquaReserves[0], aquaReserves[1]);
    const tps = get('tps'), expAt = Number(get('exp_at'));
    const apr = tvl && aquaUsd ? aquariusRewardApr(tps, aquaUsd, tvl) : null;
    const facts: Array<[string, string]> = [['AQUA per day', amount(tps * 86_400n, 7, 0)], ['AQUA price', aquaUsd ? `${aquaUsd.toFixed(5)} USD` : 'n/a'], ['Pool TVL (approx.)', tvl ? `${tvl.toLocaleString('en-US', { maximumFractionDigits: 0 })} USD` : 'n/a'], ['Rewards configured until', expAt ? new Date(expAt * 1000).toLocaleString() : 'n/a']];
    if (apr === null) return { kind: 'na', label: 'n/a', formula: 'Reward APR needs the pool TVL in USD and an AQUA price.', reason: usdcIndex < 0 ? 'The pool has no USDC side, so its TVL cannot be approximated.' : 'Pool reserves or the AQUA price are unavailable.', facts, asOf: Date.now() };
    return { kind: 'apr-est', value: apr, label: 'APR est., AQUA rewards only', formula: `Pool get_rewards_info().tps (AQUA per second) * seconds per year * AQUA price (AQUA/USDC pool spot from reserves) / pool TVL (approximated as twice the USDC reserve). Before boost weighting (rewards go to the working supply) and before the ladder's own range efficiency. Swap fee APR is not included: the Aquarius API publishes no volume window.`, facts, asOf: Date.now() };
  });
}

/** The quote for a venue card. `token` is the market token when known, `vault` the user's created vault. */
export function quoteVenue(id: VaultId, opts: { token?: string; vault?: string; pool?: string; symbol?: string } = {}): Promise<YieldQuote> {
  switch (id) {
    case 'blend': return quoteBlend(opts.token ?? '');
    case 'defindex': return quoteDefindex(opts.token ?? '', opts.vault);
    case 'xoxno': return quoteXoxno(opts.token ?? (network.name === 'mainnet' ? (getDeployments().external.xlm as string) : ''), 1, opts.vault);
    case 'zenex': return quoteZenex(opts.vault);
    case 'aquarius': return quoteAquarius(opts.pool);
    default: return Promise.resolve(na('Market rate', 'Keep in Peridot pays the market supply rate: borrow APR * utilization * (1 - reserve factor). It depends on borrowers, so it is shown per market, not here.'));
  }
}
