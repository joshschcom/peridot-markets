import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shareUrl } from './share-url';

test('share links carry the network on live chains and stay plain in demo mode', () => {
  assert.equal(shareUrl('https://markets.peridot.finance', '/groups/1', 'mainnet', false), 'https://markets.peridot.finance/groups/1?network=mainnet');
  assert.equal(shareUrl('https://markets.peridot.finance', '/groups/1', 'testnet', false), 'https://markets.peridot.finance/groups/1?network=testnet');
  assert.equal(shareUrl('http://localhost:3020', '/groups/1', 'mainnet', true), 'http://localhost:3020/groups/1');
});
