import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyPoolFilter, apiFeeToBps, demoPools, discoverChainPools, filterUsdcPairs, formatFee, formatUsd, isStablePair, isVaultEligible, loadAquariusPools,
  mergePools, pairLabel, parseApiPools, registryPools, sortPools, underlyingIndex, USDC_ADDRESS, KNOWN_TOKENS,
  type AquariusPool, type ChainReader, type FetchLike,
} from './aquarius-pools';

const EURC = 'CDTKPWPLOURQA2SGTKTUQOWRCBZEORB4BWBOMJ3D3ZTQQSGE5F6JBQLV';
const XLM = 'CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA';
const USDC = USDC_ADDRESS.mainnet;

test('fee and money formatting', () => {
  assert.equal(formatFee(30), '0.30%');
  assert.equal(formatFee(10), '0.10%');
  assert.equal(formatFee(null), 'n/a');
  assert.equal(apiFeeToBps('0.0030'), 30);
  assert.equal(apiFeeToBps('0.0010'), 10);
  assert.equal(apiFeeToBps('bad'), null);
  assert.equal(formatUsd(null), 'n/a');
  assert.equal(formatUsd(520_000), '$520.0K');
  assert.equal(formatUsd(2_500_000), '$2.50M');
});

test('parseApiPools reads symbols, maps native to XLM and skips malformed rows', () => {
  const pools = parseApiPools('mainnet', { results: [
    { address: 'CAAA', index: 'ab', tokens_addresses: [USDC, EURC], tokens_str: ['USDC:G1', 'EURC:G2'], pool_type: 'concentrated', fee: '0.0030' },
    { address: 'CBBB', tokens_addresses: ['CZZZ', XLM], tokens_str: ['FOO:G3', 'native'], pool_type: 'weird', fee: '0.01' },
    { address: 'CCCC', tokens_addresses: ['only-one'] },
    null,
  ] });
  assert.equal(pools.length, 2);
  assert.equal(pairLabel(pools[0]), 'USDC/EURC');
  assert.equal(pools[0].type, 'concentrated');
  assert.equal(pools[0].feeBps, 30);
  assert.equal(pairLabel(pools[1]), 'FOO/XLM');
  assert.equal(pools[1].type, 'unknown');
  assert.throws(() => parseApiPools('mainnet', { nope: 1 }), /unexpected/);
});

test('usdc pair filtering, stability and underlying side', () => {
  const pools = registryPools('mainnet');
  const usdcOnly = filterUsdcPairs('mainnet', pools);
  assert.equal(usdcOnly.length, pools.length, 'every registry pool has a USDC side');
  const eurc = pools.find(p => pairLabel(p) === 'USDC/EURC' && p.type === 'concentrated')!;
  assert.equal(isStablePair(eurc), true);
  assert.equal(underlyingIndex('mainnet', eurc), 0);
  const py = pools.find(p => pairLabel(p) === 'PYUSD/USDC')!;
  assert.equal(underlyingIndex('mainnet', py), 1);
  const aqua = pools.find(p => pairLabel(p) === 'AQUA/USDC')!;
  assert.equal(isStablePair(aqua), false);
  const none: AquariusPool = { ...eurc, tokens: [{ symbol: 'FOO', address: 'CF' }, { symbol: 'BAR', address: 'CB' }] };
  assert.equal(underlyingIndex('mainnet', none), null);
  assert.equal(filterUsdcPairs('mainnet', [none]).length, 0);
});

test('testnet treats the mock USDT as the dollar side', () => {
  const pools = registryPools('testnet');
  assert.ok(pools.length >= 1);
  assert.equal(filterUsdcPairs('testnet', pools).length, pools.length);
  assert.equal(underlyingIndex('testnet', pools[0]), 0);
});

test('sort puts known TVL first, then concentrated, and is stable', () => {
  const [a, b, c] = demoPools('mainnet');
  const sorted = sortPools([{ ...a, tvlUsd: null }, { ...b, tvlUsd: 5 }, { ...c, tvlUsd: 50 }]);
  assert.equal(sorted[0].tvlUsd, 50);
  assert.equal(sorted[1].tvlUsd, 5);
  assert.equal(sorted[2].tvlUsd, null);
});

test('filters: vault-eligible keeps only concentrated pools, query matches pair and address', () => {
  const pools = registryPools('mainnet');
  assert.ok(applyPoolFilter(pools, 'vault-eligible').every(isVaultEligible));
  assert.ok(applyPoolFilter(pools, 'vault-eligible').length < pools.length);
  assert.equal(applyPoolFilter(pools, 'all', 'pyusd').every(p => pairLabel(p).includes('PYUSD')), true);
  assert.equal(applyPoolFilter(pools, 'all', 'cdtse6').length, 1);
});

test('mergePools fills missing numbers from later lists without overriding', () => {
  const [p] = registryPools('mainnet');
  const merged = mergePools([{ ...p, source: 'chain', tvlUsd: null, feeBps: null }], [{ ...p, source: 'api', tvlUsd: 7, feeBps: 30 }]);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].source, 'chain');
  assert.equal(merged[0].tvlUsd, 7);
  assert.equal(merged[0].feeBps, 30);
});

function reader(overrides: Partial<ChainReader> = {}): ChainReader {
  return {
    async getPools([, other]) { return other === EURC ? [{ poolIndex: 'ff', pool: 'CPOOL1' }] : []; },
    async poolInfo() { return { tokens: [USDC, EURC], type: 'concentrated', feeBps: 30, reserves: [2_000_000_000_000n, 1n] }; },
    ...overrides,
  };
}

test('discoverChainPools finds USDC pools through the router and estimates TVL from the USDC reserve', async () => {
  const pools = await discoverChainPools('mainnet', reader(), [EURC, XLM]);
  assert.equal(pools.length, 1);
  assert.equal(pools[0].source, 'chain');
  assert.equal(pools[0].tvlUsd, 400_000);
  assert.equal(KNOWN_TOKENS.mainnet[pools[0].tokens[1].address], 'EURC');
});

test('discoverChainPools throws only when every lookup failed', async () => {
  await assert.rejects(discoverChainPools('mainnet', reader({ getPools: async () => { throw new Error('rpc down'); } }), [EURC]), /rpc down/);
  assert.deepEqual(await discoverChainPools('mainnet', reader({ getPools: async () => [] }), [EURC]), []);
});

const okFetch = (results: unknown[]): FetchLike => async () => ({ ok: true, status: 200, json: async () => ({ results, next: null }) });

test('load: demo mode never touches the network', async () => {
  const r = await loadAquariusPools({ net: 'mainnet', demo: true, chain: null, fetchFn: async () => { throw new Error('should not fetch'); } });
  assert.equal(r.primary, 'demo');
  assert.ok(r.pools.length > 0 && r.pools.every(p => p.source === 'demo'));
});

test('load: chain failure falls back to the API and keeps the verified pools', async () => {
  const api = okFetch([{ address: 'CAPIPOOL', tokens_addresses: [USDC, XLM], tokens_str: ['USDC:G', 'native'], pool_type: 'constant_product', fee: '0.0030' }]);
  const r = await loadAquariusPools({ net: 'mainnet', demo: false, chain: reader({ getPools: async () => { throw new Error('boom'); } }), fetchFn: api });
  assert.equal(r.sources.chain, 'error');
  assert.equal(r.sources.api, 'ok');
  assert.equal(r.primary, 'api');
  assert.ok(r.pools.some(p => p.address === 'CAPIPOOL'));
  assert.ok(r.pools.some(p => p.source === 'registry' && isVaultEligible(p)), 'verified concentrated pools stay listed');
  assert.match(r.warnings.join(' '), /router lookup failed/i);
});

test('load: both sources down returns the static registry, never an empty list', async () => {
  const r = await loadAquariusPools({ net: 'mainnet', demo: false, chain: reader({ getPools: async () => { throw new Error('boom'); } }), fetchFn: async () => ({ ok: false, status: 503, json: async () => ({}) }) });
  assert.equal(r.primary, 'registry');
  assert.ok(r.pools.length > 0);
  assert.equal(r.warnings.length, 3);
});

test('load: chain pools win over the API and the API only adds pools the chain missed', async () => {
  const api = okFetch([
    { address: 'CPOOL1', tokens_addresses: [USDC, EURC], tokens_str: ['USDC:G', 'EURC:G'], pool_type: 'constant_product', fee: '0.0100' },
    { address: 'CEXTRA', tokens_addresses: [USDC, XLM], tokens_str: ['USDC:G', 'native'], pool_type: 'stable', fee: '0.0010' },
  ]);
  const r = await loadAquariusPools({ net: 'mainnet', demo: false, chain: reader(), fetchFn: api });
  const p1 = r.pools.find(p => p.address === 'CPOOL1')!;
  assert.equal(p1.source, 'chain');
  assert.equal(p1.type, 'concentrated');
  assert.ok(r.pools.some(p => p.address === 'CEXTRA'));
  assert.equal(r.primary, 'chain');
});
