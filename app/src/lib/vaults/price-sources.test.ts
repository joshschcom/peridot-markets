import test from 'node:test';
import assert from 'node:assert/strict';
import { ageText, coverageFrom, feedBadge, feedLabel, formatPriceUsd, freshness, kindForKey, oraclesListing, priceToNumber, type OracleSnapshot } from './price-sources';
import { decidePricing } from './token-intake';
import { mergeAssets } from './assets';

const AQUA = 'CAUIKL3IYGMERDRUN6YSCLWVAKIFG5Q4YJHUKM4S4NJZQIA3BAS6OJPK';
const XLM = 'CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA';
const BLND = 'CD25MNVTZDL4Y3XBCPCJXGXATV5WUHHOWMYFF4YBEGU5FCPGMYTVG5JY';
const dex: OracleSnapshot = { key: 'reflector_stellar', address: 'CALI', kind: 'dex', decimals: 14, resolution: 300, assets: [{ tag: 'Stellar', value: AQUA }, { tag: 'Stellar', value: XLM }] };
const cex: OracleSnapshot = { key: 'reflector_external', address: 'CAFJ', kind: 'external', decimals: 14, resolution: 300, assets: [{ tag: 'Other', value: 'XLM' }, { tag: 'Other', value: 'USDC' }] };

test('oracle kinds and labels', () => {
  assert.equal(kindForKey('reflector_stellar'), 'dex');
  assert.equal(kindForKey('reflector_external'), 'external');
  assert.equal(feedLabel('dex'), 'Reflector DEX oracle');
  assert.equal(feedLabel('external'), 'Reflector CEX/FX oracle');
  assert.equal(feedLabel(null), 'Reflector');
  assert.equal(feedBadge('dex'), 'Reflector DEX feed');
});

test('coverage: DEX by contract id, external by upper-cased symbol', () => {
  const c = coverageFrom([dex, cex]);
  assert.ok(c.dex.has(AQUA) && c.dex.has(XLM) && !c.dex.has(BLND));
  assert.ok(c.cex.has('XLM') && c.cex.has('USDC') && !c.cex.has('AQUA'));
});

test('oraclesListing finds the oracles that list a token', () => {
  assert.deepEqual(oraclesListing([dex, cex], AQUA, 'AQUA').map(s => s.kind), ['dex']);
  assert.deepEqual(oraclesListing([dex, cex], XLM, 'XLM').map(s => s.kind), ['dex', 'external']);
  assert.deepEqual(oraclesListing([dex, cex], BLND, 'BLND'), []);
});

test('freshness follows the router window of two resolutions', () => {
  assert.deepEqual([freshness(1000, 1245, 300).fresh, freshness(1000, 1245, 300).ageSecs], [true, 245]);
  assert.equal(freshness(1000, 1600, 300).fresh, true);
  assert.equal(freshness(1000, 1601, 300).fresh, false);
  assert.equal(freshness(1100, 1000, 300).fresh, false, 'future timestamps are not fresh');
  assert.equal(ageText(45), '45 seconds ago');
  assert.equal(ageText(245), '4 minutes ago');
});

test('price formatting: AQUA live value and big numbers', () => {
  assert.ok(Math.abs(priceToNumber(28616771853n, 14) - 0.00028616771853) < 1e-12);
  assert.equal(formatPriceUsd(0.00028617), '$0.0002862');
  assert.equal(formatPriceUsd(1.1107), '$1.1107');
  assert.equal(formatPriceUsd(0), 'n/a');
});

test('catalog badge is derived from the oracle lists, not a static hint', () => {
  const none = mergeAssets('mainnet', {});
  assert.ok(none.every(a => a.reflector === null), 'unknown until the oracle lists load');
  const list = mergeAssets('mainnet', { feeds: coverageFrom([dex, cex]) });
  const by = (addr: string) => list.find(a => a.address === addr)!;
  assert.equal(by(AQUA).feed, 'dex');
  assert.equal(by(XLM).feed, 'dex', 'DEX wins when both list it');
  assert.equal(by(BLND).reflector, false);
  const usdc = list.find(a => a.symbol === 'USDC')!;
  assert.equal(usdc.feed, 'external');
  // A lookalike token with the same symbol must not inherit the symbol-keyed external listing.
  const fake = mergeAssets('mainnet', { feeds: coverageFrom([cex]), extra: [{ address: 'CADQOBYHA4DQOBYHA4DQOBYHA4DQOBYHA4DQOBYHA4DQOBYHA4DQP5KR', symbol: 'USDC', origin: 'launchpad' }] });
  assert.equal(fake.find(a => a.address.startsWith('CADQOBYH'))!.reflector, false);
});

test('pricing panel: approved DEX mapping shows the live price, age and freshness', () => {
  const d = decidePricing({ reflectorApproved: true, pool: null, symbol: 'AQUA', quote: { kind: 'dex', price: 0.00028617, timestamp: 1000, resolution: 300 }, nowSecs: 1245 });
  assert.equal(d.title, 'Priced by Reflector DEX oracle');
  assert.equal(d.canSubmit, true);
  const text = d.lines.join(' ');
  assert.match(text, /\$0\.0002862 per AQUA, updated 4 minutes ago/);
  assert.match(text, /Fresh/);
  assert.match(text, /Thin markets can be moved/);
  const stale = decidePricing({ reflectorApproved: true, pool: null, symbol: 'AQUA', quote: { kind: 'dex', price: 0.0003, timestamp: 1000, resolution: 300 }, nowSecs: 2000 });
  assert.match(stale.lines.join(' '), /Stale/);
  assert.equal(stale.canSubmit, true);
  const cexD = decidePricing({ reflectorApproved: true, pool: null, symbol: 'EURC', quote: { kind: 'external', price: 1.12, timestamp: 1000, resolution: 300 }, nowSecs: 1100 });
  assert.equal(cexD.title, 'Priced by Reflector CEX/FX oracle');
  assert.equal(decidePricing({ reflectorApproved: true, pool: null, symbol: 'X' }).title, 'Priced by Reflector', 'demo mode keeps the plain title');
});

test('pricing panel: listed but not approved asks Peridot to approve and blocks', () => {
  const d = decidePricing({ reflectorApproved: false, listedOn: 'dex', pool: { address: 'CP', depthUsd: 224954 }, symbol: 'AQUA' });
  assert.equal(d.canSubmit, false);
  assert.equal(d.mode, 'none');
  assert.match(d.title, /waiting for Peridot approval/);
  const text = d.lines.join(' ');
  assert.match(text, /listed on the Reflector DEX oracle/);
  assert.match(text, /Ask Peridot to approve/);
  assert.doesNotMatch(text, /no Reflector feed/i);
});
