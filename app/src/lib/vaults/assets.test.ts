import test from 'node:test';
import assert from 'node:assert/strict';
import { assetColor, assetInitials, KNOWN_ASSETS, mergeAssets, searchAssets } from './assets';
import { demoPools, type AquariusPool } from './aquarius-pools';

const USDC = 'CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75';
const OTHER_USDC = 'CDTSZ2VWVPLNCTHVFK7Y2KKOYDH32NAZ5KMPZIMP3BJ2WBAVPH6SWECE';
const BLND = 'CD25MNVTZDL4Y3XBCPCJXGXATV5WUHHOWMYFF4YBEGU5FCPGMYTVG5JY';
const XLM = 'CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA';

const pool = (address: string, a: [string, string], b: [string, string]): AquariusPool =>
  ({ address, tokens: [{ address: a[0], symbol: a[1] }, { address: b[0], symbol: b[1] }], type: 'constant_product', feeBps: 30, tvlUsd: null, volumeUsd: null, source: 'api' });

test('USDC appears once even when many pools and a second USDC contract report it', () => {
  const pools = [
    ...demoPools('mainnet'),
    pool('CBBMQBNHB2FYVZYV7VNHOJHUMTFJLR4PUMRVQYNW6RHIKZO2NQMIBUCV', [XLM, 'XLM'], [USDC, 'USDC']),
    pool('CA6GAFOJCW4MGQQBUCQUSA3CLIH25G4SNKB2JHYKZCVWZTNW5VXMSC4O', ['CAUIKL3IYGMERDRUN6YSCLWVAKIFG5Q4YJHUKM4S4NJZQIA3BAS6OJPK', 'AQUA'], [USDC, 'USDC']),
    pool('CDTSE6RLRI7ZO25JSER6E4SQR4PHJJNONEGS5HDJ3Y6LAKECRZKYN5CA', [USDC, 'USDC'], ['CDTKPWPLOURQA2SGTKTUQOWRCBZEORB4BWBOMJ3D3ZTQQSGE5F6JBQLV', 'EURC']),
    pool('CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', [OTHER_USDC, 'USDC'], [XLM, 'XLM']),
  ];
  const list = mergeAssets('mainnet', { pools });
  const verifiedUsdc = list.filter(a => a.symbol === 'USDC' && !a.collision);
  assert.equal(verifiedUsdc.length, 1);
  assert.equal(verifiedUsdc[0].address, USDC);
  assert.equal(list[0].address, USDC, 'canonical USDC is first');
  // Pools attach to the asset instead of repeating it.
  assert.ok(verifiedUsdc[0].pools.length >= 4);
  assert.equal(new Set(verifiedUsdc[0].pools.map(p => p.address)).size, verifiedUsdc[0].pools.length);
  // The other "USDC" contract is kept, flagged and sorted last.
  const other = list.find(a => a.address === OTHER_USDC);
  assert.ok(other && other.collision && !other.verified);
  assert.equal(list[list.length - 1].address, OTHER_USDC);
  // Every address once.
  assert.equal(new Set(list.map(a => a.address)).size, list.length);
});

test('BLND and the other known assets are listed even when no pool mentions them', () => {
  const list = mergeAssets('mainnet', { pools: demoPools('mainnet') });
  const blnd = list.find(a => a.address === BLND);
  assert.ok(blnd, 'BLND present');
  assert.equal(blnd.symbol, 'BLND');
  assert.equal(blnd.name, 'Blend');
  assert.equal(blnd.pools.length, 0);
  for (const k of KNOWN_ASSETS.mainnet) assert.ok(list.some(a => a.address === k.address), `${k.symbol} present`);
  assert.deepEqual(list.slice(0, 3).map(a => a.symbol), ['USDC', 'XLM', 'EURC']);
});

test('launchpad tokens, vault flags, the demo allow list and search by symbol, name or address', () => {
  const LAUNCH = 'CADQOBYHA4DQOBYHA4DQOBYHA4DQOBYHA4DQOBYHA4DQOBYHA4DQP5KR';
  const list = mergeAssets('mainnet', { extra: [{ address: LAUNCH, symbol: 'PDEMO', name: 'Peridot Demo Token', decimals: 7, origin: 'launchpad' }, { address: 'not-a-contract', symbol: 'BAD', origin: 'launchpad' }], vaultKeys: ['XLM'] });
  const launch = list.find(a => a.address === LAUNCH);
  assert.ok(launch && launch.origins.includes('launchpad') && !launch.verified && !launch.collision);
  assert.ok(!list.some(a => a.symbol === 'BAD'));
  assert.equal(list.find(a => a.symbol === 'XLM')?.vault, true);
  assert.equal(list.find(a => a.symbol === 'USDC')?.vault, false);
  // Launchpad tokens sit right after the verified assets.
  assert.equal(list.indexOf(launch), KNOWN_ASSETS.mainnet.length);
  assert.deepEqual(searchAssets(list, 'bl').map(a => a.symbol), ['BLND']);
  assert.deepEqual(searchAssets(list, 'blend').map(a => a.symbol), ['BLND']);
  assert.deepEqual(searchAssets(list, 'cd25mn').map(a => a.symbol), ['BLND']);
  assert.deepEqual(searchAssets(list, 'usd').map(a => a.symbol), ['USDC', 'PYUSD']);
  assert.equal(searchAssets(list, 'zzz').length, 0);
  const allowed = mergeAssets('mainnet', { allow: new Set([USDC, XLM]) });
  assert.deepEqual(allowed.map(a => a.symbol), ['USDC', 'XLM']);
});

test('icon helpers are deterministic', () => {
  assert.equal(assetColor('USDC'), '#2775ca');
  assert.equal(assetColor('zork'), assetColor('ZORK'));
  assert.match(assetColor('ZORK'), /^hsl\(/);
  assert.equal(assetInitials('BLND'), 'BL');
  assert.equal(assetInitials('XLM'), 'XLM');
  assert.equal(assetInitials(''), '?');
});
