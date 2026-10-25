import test from 'node:test';
import assert from 'node:assert/strict';
import { isDefinitivelyExpired, withWalletLock } from './rpc';
const pending = { hash: 'hash', method: 'supply', contractId: 'contract', maxTime: 1000, submissionLedger: 100 };
const result = { status: 'NOT_FOUND', latestLedger: 150, latestLedgerCloseTime: 1001, oldestLedger: 90 };
test('unseen transaction expires only with complete RPC history beyond its time bound', () => {
  assert.equal(isDefinitivelyExpired(pending, result), true);
  assert.equal(isDefinitivelyExpired(pending, { ...result, oldestLedger: 101 }), false);
  assert.equal(isDefinitivelyExpired(pending, { ...result, latestLedgerCloseTime: 1000 }), false);
  assert.equal(isDefinitivelyExpired(pending, { ...result, latestLedger: 99 }), false);
  assert.equal(isDefinitivelyExpired(pending, { ...result, status: 'SUCCESS' }), false);
  assert.equal(isDefinitivelyExpired({ ...pending, maxTime: undefined }, result), false);
  assert.equal(isDefinitivelyExpired({ ...pending, submissionLedger: undefined }, result), false);
});

test('wallet lock rejects competing tabs and releases after a rejected signature', async () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  let held = false;
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { locks: { request: async (_name: string, _options: unknown, callback: (lock: unknown) => Promise<unknown>) => {
    if (held) return callback(null);
    held = true;
    try { return await callback({}); } finally { held = false; }
  } } } });
  try {
    let release!: () => void;
    const first = withWalletLock('owner', () => new Promise<void>(resolve => { release = resolve; }));
    await assert.rejects(withWalletLock('owner', async () => undefined), /Another tab/);
    release(); await first;
    await assert.rejects(withWalletLock('owner', async () => { throw new Error('Signature rejected'); }), /Signature rejected/);
    assert.equal(await withWalletLock('owner', async () => 'available'), 'available');
  } finally {
    if (original) Object.defineProperty(globalThis, 'navigator', original);
    else Reflect.deleteProperty(globalThis, 'navigator');
  }
});
