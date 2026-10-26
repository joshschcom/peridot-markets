import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyPosition, icoBuyQuote, ICO_MAX, ICO_SCALE as X, validateIco, type IcoParams } from './ico-types';
import { mockCreateIco, mockIcoAction, type MockIco } from './ico-mock';
import type { MockLaunchpadState } from './mock';
import { describeLaunchpadError } from './errors';
const params = (): IcoParams => ({ quote_token: 'mock-xlm', supply: 1000n * X, price: X, soft_cap: 10n * X, hard_cap: 100n * X, start: 100n, end: 700n, buyer_cap: 0n });
const state = () => ({ phase: 0, raised: 0n, allocated: 0n, paused: false, withdrawn: false });
test('ICO validation mirrors duration, supply, overflow, price and cap bounds', () => {
  const p = params(); assert.equal(validateIco(p, 100n), null);
  for (const change of [{ start: 99n }, { end: 699n }, { end: 2592101n }, { supply: 0n }, { supply: ICO_MAX + 1n }, { price: 0n }, { price: ICO_MAX + 1n }, { soft_cap: 101n * X }, { hard_cap: ICO_MAX + 1n }, { buyer_cap: -1n }, { buyer_cap: 101n * X }, { supply: 1n }]) assert.ok(validateIco({ ...p, ...change }, 100n), JSON.stringify(change, (_, v) => typeof v === 'bigint' ? v.toString() : v));
});
test('ICO quote enforces boundaries, exact caps, cumulative buyer cap and dust', () => {
  const p = params(), s = state(), pos = emptyPosition();
  assert.equal(icoBuyQuote(p, s, pos, 100n * X, 100n), 100n * X);
  for (const [amount, now] of [[0n, 100n], [1n, 99n], [1n, 700n], [101n * X, 100n]]) assert.throws(() => icoBuyQuote(p, s, pos, amount, now));
  assert.throws(() => icoBuyQuote(p, { ...s, paused: true }, pos, X, 100n));
  assert.throws(() => icoBuyQuote({ ...p, buyer_cap: 10n * X }, s, { ...pos, paid: 9n * X }, 2n * X, 100n));
  assert.equal(icoBuyQuote({ ...p, price: 3n * X }, s, pos, 10n * X, 100n), 33333333n);
  assert.throws(() => icoBuyQuote({ ...p, price: 3n * X }, s, pos, 1n, 100n));
});
test('mock success and failure settle once with full conservation', () => {
  for (const succeeds of [true, false]) {
    const s: MockLaunchpadState = { version: 1, launches: [], icos: [], xlm: { alice: 100n * X, bob: 100n * X }, aqua: {}, groupOwners: {}, nextGroupId: 1, ledger: 1 };
    const now = BigInt(Math.floor(Date.now() / 1000)); const p = { ...params(), start: now, end: now + 600n, soft_cap: (succeeds ? 10n : 50n) * X };
    mockCreateIco(s, 'creator', { name: 'Test', symbol: 'TST', metadataUri: '', params: p });
    const ico = s.icos![0] as MockIco;
    mockIcoAction(s, ico, 'alice', 'buy', 10n * X); mockIcoAction(s, ico, 'bob', 'buy', 10n * X);
    assert.throws(() => mockIcoAction(s, ico, 'creator', 'withdraw'));
    ico.demoEnd = p.end; ico.state.paused = true;
    mockIcoAction(s, ico, 'creator', 'withdraw');
    for (const user of ['alice', 'bob']) {
      mockIcoAction(s, ico, user, succeeds ? 'claim' : 'refund');
      assert.throws(() => mockIcoAction(s, ico, user, succeeds ? 'claim' : 'refund'));
    }
    assert.equal(Object.values(s.xlm).reduce((a, b) => a + b, 0n), 200n * X);
    assert.equal(Object.values(ico.holdings).reduce((a, b) => a + b, 0n), 1000n * X);
    assert.throws(() => mockIcoAction(s, ico, 'creator', 'withdraw'));
  }
});
test('ICO errors do not collide with token allowance errors', () => {
  assert.match(describeLaunchpadError('Error(Contract, #101)', {}, { fallbackRole: 'ico' }), /duration|Duration/);
  assert.match(describeLaunchpadError('Error(Contract, #101)', {}, { fallbackRole: 'token' }), /allowance/);
  assert.match(describeLaunchpadError('Error(Contract, #108)', {}, { fallbackRole: 'ico' }), /hard cap/);
});
