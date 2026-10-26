import test from 'node:test';
import assert from 'node:assert/strict';
import { Keypair, scValToNative } from '@stellar/stellar-sdk';
import { VAULT_KINDS, defaultValues, validateKind, isValid, getKind, parseScaled, formatScaled } from './index';
import { ladder, maxRecenterSpacings, tickToPct, tickSpacingForFee } from './aquarius';

const owner = Keypair.random().publicKey();
const POOL = 'CA6DAGOMK5D7GKBNWVCIEAYSTPJXLQUFWFKSZOMNEM6BVOTUBDCTIT5I';
const TOKEN = 'CBL6KD2LFMLAUKFFWNNXWOXFN73GAXLEA4WMJRLQ5L76DMYTM3KWQVJN';
const ctx = { owner, net: 'testnet' as const, decimals: 7, facts: { feeBps: 30, tickSpacing: 60 } };
const aq = getKind('aquarius')!;
const good = () => ({ ...defaultValues(aq, ctx), pool: POOL, underlying: TOKEN });

test('every kind has unique ids, a default for every field and the owner first', () => {
  assert.equal(new Set(VAULT_KINDS.map(k => k.id)).size, VAULT_KINDS.length);
  for (const k of VAULT_KINDS) {
    assert.ok(k.id.length <= 32 && /^[a-z0-9_]+$/.test(k.id));
    const d = defaultValues(k, ctx);
    for (const f of k.fields) assert.ok(f.key in d);
    assert.equal(k.fields[0].locked, 'owner');
  }
});

test('ladder vectors match the contract (5 rungs, width 2, step 2, spacing 60)', () => {
  const flat = ladder(5, 2, 2, 0, 60);
  assert.deepEqual(flat.map(r => [r.lowerTick, r.upperTick]), [[-300, -180], [-180, -60], [-60, 60], [60, 180], [180, 300]]);
  assert.deepEqual(flat.map(r => r.weightBps), [2000, 2000, 2000, 2000, 2000]);
  const pyr = ladder(5, 2, 2, 1, 60);
  assert.deepEqual(pyr.map(r => r.weightBps), [1111, 2222, 3334, 2222, 1111]);
  const wings = ladder(5, 2, 2, 2, 60);
  assert.equal(wings.reduce((a, r) => a + r.weightBps, 0), 10_000);
  assert.ok(wings[0].weightBps > wings[2].weightBps);
  // single rung, odd spacing
  assert.deepEqual(ladder(1, 3, 1, 0, 20).map(r => [r.lowerTick, r.upperTick, r.weightBps]), [[-40, 20, 10000]]);
  assert.deepEqual(ladder(2, 1, 1, 0, 60).map(r => [r.lowerTick, r.upperTick]), [[-60, 0], [0, 60]]);
});

test('weights always sum to 10000 and rungs are ordered', () => {
  for (let n = 1; n <= 7; n++) for (const shape of [0, 1, 2]) for (const [w, s] of [[1, 1], [2, 3], [5, 2]]) {
    const r = ladder(n, w, s, shape, 60);
    assert.equal(r.reduce((a, x) => a + x.weightBps, 0), 10_000);
    for (let i = 1; i < r.length; i++) assert.ok(r[i].lowerTick > r[i - 1].lowerTick);
  }
});

test('helpers', () => {
  assert.equal(tickSpacingForFee(10), 20); assert.equal(tickSpacingForFee(30), 60); assert.equal(tickSpacingForFee(100), 200);
  assert.equal(maxRecenterSpacings(5, 2, 2), 5);
  assert.ok(Math.abs(tickToPct(100) - 1.005) < 0.001);
  assert.equal(parseScaled('1.5', 7), 15_000_000n); assert.equal(parseScaled('1.12345678', 7), null); assert.equal(formatScaled(15_000_000n, 7), '1.5');
});

test('defaults with a pool and token are valid; bad input is rejected with field errors', () => {
  const v = validateKind(aq, good(), ctx);
  assert.deepEqual(v.errors, {}); assert.ok(isValid(v));
  const bad = validateKind(aq, { ...good(), rungs: '9', width: '0', fee: '25', slippage: '9', cap: '0', cooldown: '1', pool: 'nope', keeper: 'x' }, ctx);
  for (const k of ['rungs', 'width', 'fee', 'slippage', 'cap', 'cooldown', 'pool', 'keeper']) assert.ok(bad.errors[k], k);
  assert.ok(validateKind(aq, { ...good(), rungs: '2.5' }, ctx).errors.rungs);
  assert.ok(validateKind(aq, { ...good(), recenter: '99' }, ctx).errors.recenter);
});

test('encoding produces the constructor arguments in order, owner first', () => {
  const v = { ...good(), rungs: '4', width: '3', step: '2', shape: '2', recenter: '2', cooldown: '90', fee: '7.5', cap: '12.5', slippage: '0.5' };
  const args = aq.encode!(v, ctx).map(a => scValToNative(a));
  assert.equal(args.length, 13);
  assert.deepEqual(args.slice(0, 4), [owner, POOL, TOKEN, owner]);
  assert.deepEqual(args.slice(4, 9), [4, 3, 2, 2, 2]);
  assert.deepEqual(args.slice(9), [5400, 750, 125_000_000n, 50]);
});

test('preview describes the ladder', () => {
  const p = aq.preview!(good(), ctx)!;
  assert.equal(p.type, 'ladder');
  if (p.type === 'ladder') { assert.equal(p.rungs.length, 5); assert.ok(p.rungs[0].lowerPct < 0 && p.rungs[4].upperPct > 0); }
});
