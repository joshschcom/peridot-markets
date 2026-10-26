import test from 'node:test';
import assert from 'node:assert/strict';
import { Keypair, scValToNative } from '@stellar/stellar-sdk';
import { xoxnoKind, XOXNO_TESTNET_XLM } from './xoxno';
import { defaultValues, validateKind, isValid, encodeFields } from './schema';
import { getKind, VAULT_KINDS } from './index';
import type { VaultCtx } from './types';

const owner = Keypair.random().publicKey();
const ctx: VaultCtx = { owner, net: 'testnet', decimals: 7 };
const vals = () => defaultValues(xoxnoKind, ctx);

test('the xoxno kind is registered and live', () => {
  assert.equal(getKind('xoxno'), xoxnoKind);
  assert.equal(VAULT_KINDS.filter(k => k.id === 'xoxno').length, 1);
  assert.equal(xoxnoKind.status, 'live');
});

test('defaults are valid and encode nine args in constructor order', () => {
  const v = vals();
  assert.equal(v.underlying, XOXNO_TESTNET_XLM);
  assert.ok(isValid(validateKind(xoxnoKind, v, ctx)));
  const args = encodeFields(xoxnoKind, v, ctx).map(a => scValToNative(a));
  assert.equal(args.length, 9);
  assert.equal(args[0], owner);
  assert.equal(args[1], owner);
  assert.equal(args[2], XOXNO_TESTNET_XLM);
  assert.deepEqual([args[3], args[4]], [1, 1]);
  assert.equal(args[5], owner);
  assert.equal(args[6], 10_000_000_000n);
  assert.equal(args[7], 10_000_000n);
  assert.equal(args[8], 1000);
});

test('bounds mirror the contract', () => {
  const bad = (patch: Record<string, string>) => validateKind(xoxnoKind, { ...vals(), ...patch }, ctx).errors;
  assert.ok(bad({ fee: '25' }).fee);
  assert.ok(bad({ fee: '-1' }).fee);
  assert.equal(bad({ fee: '20' }).fee, undefined);
  assert.ok(bad({ cap: '0' }).cap);
  assert.ok(bad({ minDeposit: '5000' }).minDeposit);
  assert.ok(bad({ underlying: '' }).underlying);
  assert.ok(bad({ hubId: '0' }).hubId);
  assert.ok(bad({ cap: '1.00000001' }).cap);
});

test('fee scales to basis points', () => {
  const args = encodeFields(xoxnoKind, { ...vals(), fee: '5' }, ctx).map(a => scValToNative(a));
  assert.equal(args[8], 500);
});

test('summary and preview state the fee and the trust model', () => {
  const s = xoxnoKind.summary!(vals(), ctx).join(' ');
  assert.match(s, /upgrade/);
  assert.match(s, /10% of the yield/);
  const p = xoxnoKind.preview!(vals(), ctx)!;
  assert.equal(p.type, 'rows');
  assert.ok(!/—/.test(JSON.stringify([s, p, xoxnoKind.description, xoxnoKind.risks])));
});
