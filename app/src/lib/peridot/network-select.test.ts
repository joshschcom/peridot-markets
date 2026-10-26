import test from 'node:test';
import assert from 'node:assert/strict';
import { parseBuildDefault, parseNetworkName, selectNetwork } from './network-select';

test('URL param wins over storage and build default', () => {
  assert.deepEqual(selectNetwork({ search: '?network=testnet', stored: 'mainnet', buildDefault: 'mainnet' }), { name: 'testnet', source: 'url' });
  assert.deepEqual(selectNetwork({ search: '?x=1&network=MAINNET', stored: 'testnet', buildDefault: 'testnet' }), { name: 'mainnet', source: 'url' });
});
test('storage wins over build default when there is no valid URL param', () => {
  assert.deepEqual(selectNetwork({ search: '', stored: 'testnet', buildDefault: 'mainnet' }), { name: 'testnet', source: 'storage' });
  assert.deepEqual(selectNetwork({ search: '?network=bogus', stored: 'testnet', buildDefault: 'mainnet' }), { name: 'testnet', source: 'storage' });
});
test('build default applies when nothing valid is set', () => {
  assert.deepEqual(selectNetwork({ buildDefault: 'mainnet' }), { name: 'mainnet', source: 'build' });
  assert.deepEqual(selectNetwork({ search: '?network=', stored: 'devnet', buildDefault: 'testnet' }), { name: 'testnet', source: 'build' });
  assert.deepEqual(selectNetwork({ search: null, stored: null, buildDefault: 'testnet' }), { name: 'testnet', source: 'build' });
});
test('invalid values are rejected', () => {
  assert.equal(parseNetworkName('futurenet'), null);
  assert.equal(parseNetworkName(undefined), null);
  assert.equal(parseNetworkName(' Testnet '), 'testnet');
});
test('build default parsing', () => {
  assert.equal(parseBuildDefault(undefined), 'mainnet');
  assert.equal(parseBuildDefault('testnet'), 'testnet');
  assert.throws(() => parseBuildDefault('devnet'));
});
