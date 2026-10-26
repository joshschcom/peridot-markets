import test from 'node:test';
import assert from 'node:assert/strict';
import { RECENT_TX_LIMIT, loadRecent, methodLabel, recentTxKey, relativeTime, saveRecent, statusFromTx, upsertRecent, type RecentTx } from './recent-transactions';

function memoryStorage(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial));
  return { getItem: (k: string) => map.get(k) ?? null, setItem: (k: string, v: string) => { map.set(k, v); }, removeItem: (k: string) => { map.delete(k); }, map };
}
const tx = (hash: string, status: RecentTx['status'] = 'pending', at = 1000): RecentTx => ({ hash, status, at, method: 'supply' });

test('upsert keeps one entry per hash, newest first, latest status wins, capped at the limit', () => {
  let list: RecentTx[] = [];
  for (let i = 0; i < RECENT_TX_LIMIT + 3; i++) list = upsertRecent(list, tx(`h${i}`, 'pending', i));
  assert.equal(list.length, RECENT_TX_LIMIT);
  assert.equal(list[0].hash, `h${RECENT_TX_LIMIT + 2}`);
  assert.equal(list.some(item => item.hash === 'h0'), false);
  const updated = upsertRecent(list, { hash: 'h5', status: 'success', at: 9999 });
  assert.equal(updated.filter(item => item.hash === 'h5').length, 1);
  assert.equal(updated[0].hash, 'h5');
  assert.equal(updated[0].status, 'success');
  assert.equal(updated[0].at, 5, 'first-seen time is kept');
  assert.equal(updated[0].method, 'supply', 'method survives a status-only update');
});

test('storage round trip is per network and ignores malformed entries', () => {
  const storage = memoryStorage();
  assert.equal(saveRecent(storage, 'mainnet', [tx('a', 'success'), tx('b')]), true);
  assert.deepEqual(loadRecent(storage, 'mainnet').map(item => item.hash), ['a', 'b']);
  assert.deepEqual(loadRecent(storage, 'testnet'), []);
  storage.map.set(recentTxKey('testnet'), JSON.stringify([{ hash: '', status: 'pending', at: 1 }, { hash: 'ok', status: 'weird', at: 1 }, { hash: 'good', status: 'failed', at: 2 }, 'junk']));
  assert.deepEqual(loadRecent(storage, 'testnet').map(item => item.hash), ['good']);
  storage.map.set(recentTxKey('mainnet'), '{not json');
  assert.deepEqual(loadRecent(storage, 'mainnet'), []);
  assert.equal(saveRecent(storage, 'mainnet', []), true);
  assert.equal(storage.map.has(recentTxKey('mainnet')), false, 'clearing removes the key');
});

test('storage failures return empty or false instead of throwing', () => {
  const broken = { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('denied'); }, removeItem: () => { throw new Error('denied'); } };
  assert.deepEqual(loadRecent(broken, 'mainnet'), []);
  assert.equal(saveRecent(broken, 'mainnet', [tx('a')]), false);
  assert.deepEqual(loadRecent(null, 'mainnet'), []);
});

test('progress statuses map to list statuses only once a hash exists', () => {
  assert.equal(statusFromTx('simulating'), null);
  assert.equal(statusFromTx('signing'), null);
  assert.equal(statusFromTx('submitting'), 'pending');
  assert.equal(statusFromTx('confirming'), 'pending');
  assert.equal(statusFromTx('success'), 'success');
  assert.equal(statusFromTx('error'), 'failed');
  assert.equal(statusFromTx('unknown'), 'unknown');
});

test('labels and relative times read naturally', () => {
  assert.equal(methodLabel('open_position'), 'Open position');
  assert.equal(methodLabel('supply'), 'Supply');
  assert.equal(methodLabel(undefined), 'Transaction');
  const now = 10_000_000;
  assert.equal(relativeTime(now - 10_000, now), 'just now');
  assert.equal(relativeTime(now - 4 * 60_000, now), '4 min ago');
  assert.equal(relativeTime(now - 3 * 3_600_000, now), '3 h ago');
  assert.equal(relativeTime(now - 2 * 86_400_000, now), '2 d ago');
});
