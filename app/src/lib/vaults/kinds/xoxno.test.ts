import test from 'node:test';
import assert from 'node:assert/strict';
import { Keypair, scValToNative } from '@stellar/stellar-sdk';
import { defaultXoxnoConfig, encodeXoxnoInitArgs, previewXoxno, toBaseUnits, validateXoxno, XOXNO_MAX_FEE_BPS } from './xoxno';

const owner = Keypair.random().publicKey();
const XLM = 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC';
const cfg = () => defaultXoxnoConfig(owner, XLM);

test('default config is valid and encodes nine args in constructor order', () => {
  assert.deepEqual(validateXoxno(cfg()), {});
  const args = encodeXoxnoInitArgs(cfg());
  assert.equal(args.length, 9);
  const n = args.map(a => scValToNative(a));
  assert.equal(n[0], owner);
  assert.equal(n[2], XLM);
  assert.deepEqual([n[3], n[4]], [1, 1]);
  assert.equal(n[6], 10000000000n);
  assert.equal(n[7], 10000000n);
  assert.equal(n[8], 1000);
});

test('bounds are enforced client side', () => {
  assert.ok(validateXoxno({ ...cfg(), feeBps: XOXNO_MAX_FEE_BPS + 1 }).feeBps);
  assert.ok(validateXoxno({ ...cfg(), feeBps: -1 }).feeBps);
  assert.ok(validateXoxno({ ...cfg(), depositCap: '0' }).depositCap);
  assert.ok(validateXoxno({ ...cfg(), minDeposit: '2000' }).minDeposit);
  assert.ok(validateXoxno({ ...cfg(), underlying: owner }).underlying);
  assert.ok(validateXoxno({ ...cfg(), hubId: 0 }).hubId);
  assert.ok(validateXoxno({ ...cfg(), owner: '' }).owner);
  assert.throws(() => encodeXoxnoInitArgs({ ...cfg(), feeBps: 5000 }));
});

test('toBaseUnits', () => {
  assert.equal(toBaseUnits('1'), 10000000n);
  assert.equal(toBaseUnits('0.0000001'), 1n);
  assert.equal(toBaseUnits('0.00000001'), null);
  assert.equal(toBaseUnits('1e3'), null);
  assert.equal(toBaseUnits('0'), null);
});

test('preview mentions fee and trust model', () => {
  const rows = previewXoxno(cfg());
  assert.match(rows.find(r => r.label === 'Performance fee')!.value, /10\.00%/);
  assert.match(rows.find(r => r.label === 'Trust')!.value, /upgrade/);
});
