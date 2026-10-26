import test from 'node:test';
import assert from 'node:assert/strict';
import { DISCLAIMER_KEY, DISCLAIMER_VERSION, acknowledge, disclaimerPreAcceptScript, hasAcknowledged } from './risk-disclaimer';

function memoryStorage(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial));
  return { getItem: (k: string) => map.get(k) ?? null, setItem: (k: string, v: string) => { map.set(k, v); }, map };
}

test('disclaimer is shown until the current version is acknowledged', () => {
  const storage = memoryStorage();
  assert.equal(hasAcknowledged(storage), false);
  assert.equal(acknowledge(storage), true);
  assert.equal(storage.map.get(DISCLAIMER_KEY), DISCLAIMER_VERSION);
  assert.equal(hasAcknowledged(storage), true);
});

test('a new disclaimer version re-shows the dialog and the legacy EVM flag does not count', () => {
  assert.equal(hasAcknowledged(memoryStorage({ [DISCLAIMER_KEY]: '2020-01-01' })), false);
  assert.equal(hasAcknowledged(memoryStorage({ 'peridot-risk-disclaimer-acknowledged': 'true' })), false);
  assert.equal(hasAcknowledged(memoryStorage({ [DISCLAIMER_KEY]: DISCLAIMER_VERSION }), 'next-version'), false);
});

test('storage failures never throw: unreadable storage shows the dialog, unwritable storage reports false', () => {
  const broken = { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('denied'); } };
  assert.equal(hasAcknowledged(broken), false);
  assert.equal(acknowledge(broken), false);
  assert.equal(hasAcknowledged(null), false);
  assert.equal(acknowledge(undefined), false);
});

test('the pre-accept script writes the same key and version the dialog checks', () => {
  const storage = memoryStorage();
  const localStorage = { setItem: storage.setItem };
  new Function('localStorage', disclaimerPreAcceptScript)(localStorage);
  assert.equal(hasAcknowledged(storage), true);
});
