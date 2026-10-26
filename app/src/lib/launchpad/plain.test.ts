import test from 'node:test';
import assert from 'node:assert/strict';
import { describeLaunchpadError } from './errors';
import { MAX_PLAIN_SUPPLY, parsePlainSupply, validatePlainSupply } from './math';
import { findMockPlain, mockCreatePlainToken, type MockLaunchpadState } from './mock';

const FACTORY = 'CBYQC54BS5HIWEO6KQNVGZ6XRNOTG3OMT6UZYBUD2NESGHBQMALGSBWC';
const USER = 'GAXGGPKR2K3PXRVHSVN654AIRQDPETWDSRPDTGV4Q7ZUFY66VRM7TNYT';
const emptyState = (): MockLaunchpadState => ({ version: 1, launches: [], xlm: {}, aqua: {}, groupOwners: {}, nextGroupId: 1, ledger: 1 });

test('plain supply parsing accepts whole tokens in range and rejects the rest', () => {
  assert.equal(parsePlainSupply('1000000'), 1_000_000n);
  assert.equal(parsePlainSupply(' 1,000,000 '), 1_000_000n);
  assert.equal(parsePlainSupply('1_000'), 1000n);
  assert.equal(parsePlainSupply(String(MAX_PLAIN_SUPPLY)), MAX_PLAIN_SUPPLY);
  for (const bad of ['', '0', '-5', '1.5', 'abc', String(MAX_PLAIN_SUPPLY + 1n), '1e6']) assert.equal(parsePlainSupply(bad), null, bad);
  assert.equal(validatePlainSupply('10'), null);
  assert.match(validatePlainSupply('0') ?? '', /between 1 and/);
  assert.match(validatePlainSupply('') ?? '', /Enter a supply/);
});

test('demo plain token mints the whole supply to the creator and rejects duplicates', () => {
  const state = emptyState();
  const r = mockCreatePlainToken(state, USER, 'Plain Coin', 'PLN', 1_000n);
  assert.equal(r.token, 'mock-plain-pln');
  assert.equal(state.plainHoldings?.[r.token][USER], 1_000n * 10_000_000n);
  assert.equal(findMockPlain(state, r.token)?.supply, 1_000n * 10_000_000n);
  assert.equal(findMockPlain(state, 'mock-plain-nope'), null);
  assert.throws(() => mockCreatePlainToken(state, USER, 'Other', 'pln', 5n), /already exists/);
  assert.throws(() => mockCreatePlainToken(state, USER, 'Big', 'BIG', MAX_PLAIN_SUPPLY + 1n), /between 1 and/);
});

test('factory error 17 reads as a supply message', () => {
  const err = new Error(`HostError: Error(Contract, #17)\n\nEvent log (newest first):\n   0: [Diagnostic Event] contract:${FACTORY}, topics:[error, Error(Contract, #17)], data:"x"`);
  assert.match(describeLaunchpadError(err, { [FACTORY]: 'factory' }, { fallbackRole: 'factory' }), /Supply must be a whole number/);
});
