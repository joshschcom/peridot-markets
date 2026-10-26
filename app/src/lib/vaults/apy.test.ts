import test from 'node:test';
import assert from 'node:assert/strict';
import { aquariusRewardApr, blendRates, continuousApy, fmtRate, rayToFraction, sharePrice, sharePriceDriftApy, spotPrice } from './apy';

const close = (a: number, b: number, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} vs ${b}`);

test('continuous compounding APY from APR', () => {
  close(continuousApy(0), 0);
  close(continuousApy(0.05), Math.exp(0.05) - 1);
  assert.ok(Number.isNaN(continuousApy(NaN)));
});

test('share price drift annualizes and refuses short windows', () => {
  const day = 86_400_000;
  // 0.1% in one day compounds to about 44% a year.
  close(sharePriceDriftApy(1, 0, 1.001, day)!, Math.pow(1.001, 365) - 1, 1e-9);
  assert.equal(sharePriceDriftApy(1, 0, 1.001, 3600 * 1000), null, 'under six hours');
  assert.equal(sharePriceDriftApy(0, 0, 1, day), null);
  assert.equal(sharePriceDriftApy(1, day, 1.1, 0), null, 'negative window');
});

test('Blend v2 supply APR from the mainnet USDC reserve read on 2026-10-26', () => {
  // Pool CAJJZSGM... reserve USDC: r_base 3%, r_one 4%, r_two 12%, r_three 500%, target util 80%, ir_mod 1.4375946; bstop_rate 20%.
  const r = blendRates({ rBase: 300000, rOne: 400000, rTwo: 1200000, rThree: 50000000, targetUtil: 8000000, irMod: 14375946n, bRate: 1155295488231n, bSupply: 460189118557634n, dRate: 1248514147521n, dSupply: 314918403151511n, bstopRate: 2000000 });
  close(r.utilization, 0.7395, 1e-3);
  close(r.borrowApr, 1.4375946 * (0.03 + 0.04 * r.utilization / 0.8), 1e-9);
  close(r.supplyApr, r.borrowApr * r.utilization * 0.8, 1e-12);
  assert.ok(r.supplyApr > 0.05 && r.supplyApr < 0.06, `${r.supplyApr}`);
});

test('Blend curve slopes above target and above 95%', () => {
  const base = { rBase: 100000, rOne: 300000, rTwo: 3000000, rThree: 50000000, targetUtil: 4000000, irMod: 10000000n, bRate: 1000000000000n, dRate: 1000000000000n, bstopRate: 0 };
  const mid = blendRates({ ...base, bSupply: 1000n, dSupply: 600n });
  close(mid.utilization, 0.6);
  close(mid.borrowApr, 0.01 + 0.03 + 0.3 * (0.6 - 0.4) / 0.55, 1e-9);
  const top = blendRates({ ...base, bSupply: 1000n, dSupply: 980n });
  close(top.borrowApr, 0.01 + 0.03 + 0.3 + 5 * (0.98 - 0.95) / 0.05, 1e-9);
  const empty = blendRates({ ...base, bSupply: 0n, dSupply: 0n });
  assert.equal(empty.supplyApr, 0);
});

test('XOXNO RAY rates become fractions', () => {
  close(rayToFraction(2593338209551418568n), 2.593338e-9, 1e-15);
  close(rayToFraction(50_000_000_000_000_000_000_000_000n), 0.05);
});

test('Aquarius reward APR estimate and spot price', () => {
  // 0.5245768 AQUA/s, AQUA at 0.0002855 USD (AQUA/USDC pool reserves on 2026-10-26), TVL 641,686 USD -> about 0.74%.
  const apr = aquariusRewardApr(5245768n, 0.0002855, 641_686)!;
  assert.ok(apr > 0.007 && apr < 0.008, `${apr}`);
  assert.equal(aquariusRewardApr(5245768n, 0, 1), null);
  close(spotPrice(7880528341693915n, 2249541482887n)!, 0.00028546, 1e-7);
  assert.equal(spotPrice(0n, 1n), null);
});

test('share price and formatting', () => {
  close(sharePrice(10355967n, 7), 1.0355967);
  assert.equal(fmtRate({ kind: 'apy', value: 0.0570123, label: 'APY', formula: '', facts: [], asOf: 0 }), '5.70%');
  assert.equal(fmtRate({ kind: 'apr-est', value: 0.1234, label: 'APR est.', formula: '', facts: [], asOf: 0 }), '12.3%');
  assert.equal(fmtRate({ kind: 'na', label: 'n/a', formula: '', facts: [], asOf: 0 }), 'n/a');
});
