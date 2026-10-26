import test from 'node:test';
import assert from 'node:assert/strict';
import { Keypair, scValToNative } from '@stellar/stellar-sdk';
import { defaultValues, validateKind, isValid, getKind } from './index';
import { ZENEX_ADDRESSES } from './zenex';

const owner = Keypair.random().publicKey();
const ctx = { owner, net: 'testnet' as const, decimals: 7 };
const zx = getKind('zenex')!;
const good = () => defaultValues(zx, ctx);

test('zenex kind is registered live, owner first, defaults valid', () => {
  assert.equal(zx.status, 'live');
  assert.equal(zx.fields[0].locked, 'owner');
  const v = validateKind(zx, good(), ctx);
  assert.deepEqual(v.errors, {}); assert.ok(isValid(v));
  assert.ok(v.warnings.some(w => /MOCK Zenex/.test(w)), 'testnet warns about the mock');
});

test('mainnet defaults are the real Zenex XLM-USD market and vault', () => {
  const m = defaultValues(zx, { ...ctx, net: 'mainnet' });
  assert.equal(m.zenexMarket, ZENEX_ADDRESSES.mainnet.market);
  assert.equal(m.zenexVault, ZENEX_ADDRESSES.mainnet.vault);
  assert.equal(m.underlying, ZENEX_ADDRESSES.mainnet.usdc);
  assert.ok(!validateKind(zx, m, { ...ctx, net: 'mainnet' }).warnings.some(w => /MOCK/.test(w)));
});

test('bounds mirror the contract constructor', () => {
  const bad = validateKind(zx, { ...good(), targetBuffer: '19', slippage: '0.2', haircut: '25', cap: '5' }, ctx);
  for (const k of ['targetBuffer', 'slippage', 'haircut', 'cap']) assert.ok(bad.errors[k], k);
  assert.ok(validateKind(zx, { ...good(), cap: '100001' }, ctx).errors.cap);
  assert.ok(validateKind(zx, { ...good(), minBuffer: '30' }, ctx).errors.minBuffer, 'refill threshold must be below the target');
  assert.ok(validateKind(zx, { ...good(), minBuffer: '4' }, ctx).errors.minBuffer);
  assert.ok(validateKind(zx, { ...good(), zenexVault: 'nope' }, ctx).errors.zenexVault);
});

test('encoding gives (owner, market, underlying, cfg struct) with raw units and a sorted map', () => {
  const v = { ...good(), targetBuffer: '35', minBuffer: '12.5', slippage: '1.5', haircut: '3', cap: '2500.5' };
  const args = zx.encode!(v, ctx);
  assert.equal(args.length, 4);
  const n = args.map(a => scValToNative(a));
  assert.equal(n[0], owner); assert.equal(n[1], owner); assert.equal(n[2], ZENEX_ADDRESSES.testnet.usdc);
  const cfg = n[3] as Record<string, unknown>;
  assert.deepEqual(Object.keys(cfg), ['cap', 'haircut_bps', 'keeper', 'min_buffer_bps', 'slippage_bps', 'target_buffer_bps', 'zenex_market', 'zenex_vault']);
  assert.equal(cfg.cap, 25_005_000_000n);
  assert.equal(cfg.target_buffer_bps, 3500); assert.equal(cfg.min_buffer_bps, 1250);
  assert.equal(cfg.slippage_bps, 150); assert.equal(cfg.haircut_bps, 300);
  assert.equal(cfg.zenex_market, ZENEX_ADDRESSES.testnet.market);
});

test('preview and summary describe the split and never promise yield', () => {
  const p = zx.preview!(good(), ctx)!;
  assert.equal(p.type, 'rows');
  if (p.type === 'rows') assert.ok(p.rows.some(([k]) => /liquid/i.test(k)));
  const text = [...zx.summary!(good(), ctx), ...zx.risks].join(' ');
  assert.match(text, /lose value/); assert.match(text, /1 hour/); assert.ok(!/guarantee/i.test(text));
  assert.ok(!text.includes(String.fromCharCode(0x2014)));
});
