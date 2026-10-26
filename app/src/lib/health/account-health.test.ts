import test from 'node:test';
import assert from 'node:assert/strict';
import { U128_MAX, commonDecimals, fmtUsd, healthState, isIndeterminate, mixedDecimals, scaledUsd, summarizeHealth, usdValue, type HealthPosition } from './account-health';

const SCALE = 10n ** 14n; // Reflector-style 14 decimal price
const price = (usd: number) => BigInt(Math.round(usd * 1e14));
const units = (amount: number, decimals = 7) => BigInt(Math.round(amount * 10 ** decimals));
const position = (over: Partial<HealthPosition>): HealthPosition => ({ symbol: 'XLM', decimals: 7, underlying: 0n, debt: 0n, collateralFactor: 700_000n, entered: true, price: price(0.1), priceScale: SCALE, ...over });
const close = (actual: number, expected: number, message?: string) => assert.ok(Math.abs(actual - expected) < 1e-6, `${message ?? ''} expected ${expected}, got ${actual}`);

test('the controller indeterminate sentinel (0, u128::MAX) is health unavailable, not a huge shortfall', () => {
  assert.equal(isIndeterminate({ liquidity: 0n, shortfall: U128_MAX }), true);
  assert.equal(isIndeterminate({ liquidity: 0n, shortfall: 5n }), false);
  assert.equal(isIndeterminate(null), false);
  const s = summarizeHealth([position({ underlying: units(1000), debt: units(100) })], { liquidity: 0n, shortfall: U128_MAX });
  assert.equal(s.state, 'unavailable');
  assert.equal(s.shortfallUsd, 0);
  assert.equal(s.availableUsd, 0);
  close(s.debtUsd, 10, 'debt is still priced from the markets');
});

test('usd conversion applies price/scale and the token decimals', () => {
  close(usdValue(units(1000), 7, price(0.1), SCALE), 100);
  close(usdValue(units(2.5, 6), 6, price(1), SCALE), 2.5);
  assert.equal(usdValue(0n, 7, price(1), SCALE), 0);
  assert.equal(usdValue(units(1), 7, 0n, SCALE), 0);
  close(scaledUsd(1_234_567_890n, 7), 123.456789);
  assert.equal(scaledUsd(0n, 7), 0);
});

test('contract liquidity drives available power and the limit is reconstructed from it', () => {
  // 1000 XLM at $0.10 = $100 collateral, CF 70% -> limit $70, debt $10 -> liquidity $60.
  const positions = [position({ underlying: units(1000), debt: units(100) })];
  const s = summarizeHealth(positions, { liquidity: units(60), shortfall: 0n });
  close(s.collateralUsd, 100);
  close(s.debtUsd, 10);
  close(s.availableUsd, 60);
  close(s.borrowLimitUsd, 70);
  close(s.utilization!, 10 / 70);
  assert.equal(s.state, 'safe');
  assert.equal(s.source, 'contract');
  // Shortfall case: debt $80 against limit $70.
  const risk = summarizeHealth([position({ underlying: units(1000), debt: units(800) })], { liquidity: 0n, shortfall: units(10) });
  assert.equal(risk.state, 'risk');
  close(risk.shortfallUsd, 10);
  close(risk.borrowLimitUsd, 70);
  assert.equal(risk.availableUsd, 0);
});

test('without a contract reading the limit is derived from entered markets only', () => {
  const positions = [
    position({ symbol: 'XLM', underlying: units(1000), entered: true }),
    position({ symbol: 'USDC', underlying: units(50), debt: units(20), entered: false, price: price(1), collateralFactor: 800_000n }),
  ];
  const s = summarizeHealth(positions, null);
  assert.equal(s.source, 'derived');
  close(s.suppliedUsd, 150);
  close(s.collateralUsd, 100, 'unentered supply is not collateral');
  close(s.borrowLimitUsd, 70);
  close(s.debtUsd, 20);
  close(s.availableUsd, 50);
  assert.equal(s.state, 'safe');
});

test('state thresholds: empty, safe, watch above 75%, risk on shortfall or debt without limit', () => {
  assert.equal(healthState(0, 0, 0), 'empty');
  assert.equal(healthState(0, 70, 0), 'safe');
  assert.equal(healthState(10, 70, 0), 'safe');
  assert.equal(healthState(52.5, 70, 0), 'watch');
  assert.equal(healthState(69, 70, 0), 'watch');
  assert.equal(healthState(80, 70, 10), 'risk');
  assert.equal(healthState(5, 0, 0), 'risk');
  const watch = summarizeHealth([position({ underlying: units(1000), debt: units(600) })], { liquidity: units(10), shortfall: 0n });
  assert.equal(watch.state, 'watch');
  const empty = summarizeHealth([position({})], { liquidity: 0n, shortfall: 0n });
  assert.equal(empty.state, 'empty');
  assert.equal(empty.utilization, null);
});

test('missing prices are reported and counted as zero instead of throwing', () => {
  const s = summarizeHealth([position({ underlying: units(10), price: undefined, priceScale: undefined }), position({ symbol: 'USDC', underlying: units(5), price: price(1) })], null);
  assert.deepEqual(s.priceMissing, ['XLM']);
  close(s.collateralUsd, 5);
});

test('decimals helpers and currency formatting', () => {
  assert.equal(commonDecimals([]), 7);
  assert.equal(commonDecimals([position({ underlying: 1n, decimals: 6 })]), 6);
  assert.equal(commonDecimals([position({ underlying: 1n, decimals: 6 }), position({ debt: 1n, decimals: 7 })]), 7);
  assert.equal(mixedDecimals([position({ underlying: 1n, decimals: 6 }), position({ debt: 1n, decimals: 7 })]), true);
  assert.equal(mixedDecimals([position({ underlying: 1n, decimals: 6 }), position({ decimals: 7 })]), false, 'empty positions do not count');
  assert.equal(fmtUsd(1234.5), '$1,234.50');
  assert.equal(fmtUsd(0), '$0.00');
  assert.equal(fmtUsd(0.001), '<$0.01');
  assert.equal(fmtUsd(Infinity), 'n/a');
});
