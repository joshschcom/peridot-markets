import test from 'node:test';
import assert from 'node:assert/strict';
import { ceilDiv, creatorCap, curveChartPoints, feeOf, finePrice, finePriceAtSold, fmtPrice, fullyDilutedValue, grossForNet, marginalPrice, marketCap, minOut, parsePositiveAmount, parseSlippage, priceAtSold, quoteBuy, quoteRaisedAt, quoteSell, reserves, reservesFromState, soldAtTarget, validateMetadataUri, validateName, validateSymbol } from './math';
import type { CurveParams } from './types';

// Live testnet presets read from the launchpad factory on 2026-10-25 (get_preset(XLM, *)).
const X7 = 10_000_000n;
const base = { virtual_token: 1_073_000_000n * X7, curve_supply: 800_000_000n * X7, lp_supply: 200_000_000n * X7, trade_fee_bps: 100, creator_fee_share_bps: 0, creator_cap_bps: 500 };
const fast: CurveParams = { ...base, virtual_quote: 1_764_705_882n, graduation_target: 500n * X7 };
const pdemo: CurveParams = { ...base, virtual_quote: 88_235_294_117n, graduation_target: 25_000n * X7 };

test('ceilDiv, feeOf and grossForNet round in favour of the curve', () => {
  assert.equal(ceilDiv(10n, 5n), 2n);
  assert.equal(ceilDiv(11n, 5n), 3n);
  assert.equal(feeOf(1_000n * X7, 100), 10n * X7);
  assert.equal(feeOf(1n, 100), 1n, 'one stroop still pays a one-stroop fee');
  // The smallest gross whose net is at least `needed`.
  const needed = 1_000n * X7;
  const gross = grossForNet(needed, 100);
  assert.ok(gross - feeOf(gross, 100) >= needed);
  assert.ok(gross - 1n - feeOf(gross - 1n, 100) < needed);
});

test('a 100 XLM buy on the untouched PDEMO curve matches the on-chain quote_buy', () => {
  const r = reserves(pdemo, 0n, 0n);
  assert.equal(r.k, 946_764_705_875_410_000_000_000_000n, 'k matches get_config().k');
  const q = quoteBuy(r, pdemo.graduation_target, 100n * X7, pdemo.trade_fee_bps);
  assert.ok(q);
  assert.equal(q.gross, 100n * X7);
  assert.equal(q.fee, 1n * X7);
  assert.equal(q.net, 99n * X7);
  assert.equal(q.tokensOut, 119_054_805_087_788n);
  assert.equal(q.clamped, false);
  assert.equal(marginalPrice(r), 82n, 'price 82 matches get_state().price');
  assert.equal(priceAtSold(pdemo, 0n), 82n);
  assert.equal(fullyDilutedValue(82n, pdemo), 82_000_000_000n, 'matches get_state().fully_diluted_value');
});

test('a buy that crosses the target is clamped so net lands exactly on the target', () => {
  const sold = 5_673_449_576_406_545n, real = 1_980_000_000n; // state after the first 200 XLM demo buy on PGRAD
  const r = reserves(fast, real, sold);
  const needed = fast.graduation_target - real;
  const q = quoteBuy(r, needed, 1_000_000n * X7, fast.trade_fee_bps);
  assert.ok(q);
  assert.equal(q.clamped, true);
  assert.equal(q.net, needed);
  assert.equal(q.gross, grossForNet(needed, 100));
  assert.ok(q.gross < 1_000_000n * X7);
  assert.equal(sold + q.tokensOut, soldAtTarget(fast), 'landing on the target sells exactly soldAtTarget tokens');
});

test('soldAtTarget matches the graduated PGRAD curve and stays within the curve supply', () => {
  assert.equal(soldAtTarget(fast), 7_930_869_565_631_175n, 'equals get_state().sold of the graduated curve');
  for (const p of [fast, pdemo]) assert.ok(soldAtTarget(p) <= p.curve_supply);
  assert.equal(quoteRaisedAt(fast, soldAtTarget(fast)), fast.graduation_target);
});

test('selling what was just bought never returns more quote than was paid in', () => {
  for (const quoteIn of [1n * X7, 37n * X7, 1_000n * X7, 12_345_678_912n]) {
    const r0 = reserves(pdemo, 0n, 0n);
    const buy = quoteBuy(r0, pdemo.graduation_target, quoteIn, 100);
    assert.ok(buy);
    const r1 = reserves(pdemo, buy.net, buy.tokensOut);
    const sell = quoteSell(r1, buy.tokensOut, 100);
    assert.ok(sell);
    assert.ok(sell.gross <= buy.net, 'rounding favours the curve');
    assert.ok(sell.quoteOut < buy.gross, 'fees are paid both ways');
  }
  assert.equal(quoteSell(reserves(pdemo, 0n, 0n), 0n, 100), null);
  assert.equal(quoteBuy(reserves(pdemo, 0n, 0n), pdemo.graduation_target, 0n, 100), null, 'zero input is dust');
});

test('minOut floors and never produces the zero bound the contract rejects', () => {
  assert.equal(minOut(1_000n, 100), 990n);
  assert.equal(minOut(1n, 100), 1n);
  assert.equal(minOut(0n, 100), 1n);
  assert.equal(minOut(119_054_805_087_788n, 50), 118_459_531_062_349n);
  assert.throws(() => minOut(10n, 6_000));
  assert.equal(parseSlippage('1'), 100);
  assert.equal(parseSlippage('0.5'), 50);
  assert.throws(() => parseSlippage('abc'));
  assert.throws(() => parseSlippage('51'));
});

test('amount parsing and factory text rules mirror the contract', () => {
  assert.equal(parsePositiveAmount('1.5'), 15_000_000n);
  assert.throws(() => parsePositiveAmount('0'));
  assert.throws(() => parsePositiveAmount('1.12345678'));
  assert.equal(validateName('Peridot Demo'), null);
  assert.equal(validateName('a_b-c.d'), null);
  assert.ok(validateName(''));
  assert.ok(validateName(' lead'));
  assert.ok(validateName('x'.repeat(33)));
  assert.ok(validateName('émoji'));
  assert.equal(validateSymbol('PGRAD'), null);
  assert.ok(validateSymbol('P'));
  assert.ok(validateSymbol('P-X'));
  assert.ok(validateSymbol('A'.repeat(13)));
  assert.equal(validateMetadataUri(''), null);
  assert.equal(validateMetadataUri('ipfs://bafy'), null);
  assert.ok(validateMetadataUri('x'.repeat(257)));
  assert.ok(validateMetadataUri('has space'));
});

test('creator cap and market cap derive from the preset', () => {
  assert.equal(creatorCap(fast), 40_000_000n * X7, '5% of the 800M curve supply');
  assert.equal(marketCap(82n, 119_054_805_087_788n), 82n * 119_054_805_087_788n / X7);
});

test('fine prices agree with the contract scale and format with significant digits', () => {
  const r = reserves(fast, 0n, 0n);
  assert.equal(marginalPrice(r), 1n, 'the contract scale truncates the Fast launch price to one stroop');
  assert.equal(finePrice(r) / 10n ** 7n, marginalPrice(r), 'the fine scale truncates back to the contract value');
  assert.equal(finePrice(r), finePriceAtSold(fast, 0n));
  assert.deepEqual(reservesFromState({ virtual_quote: fast.virtual_quote, virtual_token: fast.virtual_token, real_quote: 1_980_000_000n, sold: 5_673_449_576_406_545n }), reserves(fast, 1_980_000_000n, 5_673_449_576_406_545n));
  assert.equal(fmtPrice(finePrice(r)), '0.0000001644');
  assert.equal(fmtPrice(finePrice(reserves(pdemo, 0n, 0n))), '0.000008223');
  assert.equal(fmtPrice(finePrice(r), 6), '0.000000164464');
  assert.equal(fmtPrice(123_456_000_000_000_000n), '1234');
  assert.equal(fmtPrice(1_234_500_000_000_000n), '12.34');
  assert.equal(fmtPrice(0n), '0');
});

test('chart points start at the initial price and end at the graduation point', () => {
  const points = curveChartPoints(fast, 10);
  assert.equal(points.length, 11);
  assert.equal(points[0].sold, 0);
  assert.equal(points[0].raised, 0);
  assert.ok(Math.abs(points[10].raised - 500) < 1e-6);
  assert.ok(Math.abs(points[10].sold - Number(soldAtTarget(fast)) / 1e7) < 1e-6);
  for (let i = 1; i < points.length; i++) assert.ok(points[i].price > points[i - 1].price, 'price is increasing');
});
