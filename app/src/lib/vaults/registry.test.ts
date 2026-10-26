import test from 'node:test';
import assert from 'node:assert/strict';
import { COMING_SOON_COPY, VAULT_OPTIONS, getVaultOption, groupByStatus, isSubmittable, statusLabel, statusOn, unavailableOptions } from './registry';

test('registry ids are unique and cover every venue', () => {
  const ids = VAULT_OPTIONS.map(o => o.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const id of ['idle', 'blend', 'defindex', 'aquarius', 'xoxno', 'zenex']) assert.ok(ids.includes(id as never), id);
});

test('Zenex is listed but never submittable', () => {
  for (const id of ['zenex'] as const) {
    const o = getVaultOption(id);
    assert.equal(o.status, 'coming-soon');
    assert.equal(o.factoryRoute, null);
    assert.equal(isSubmittable(o), false);
  }
  assert.match(COMING_SOON_COPY, /not active in this demo/);
});

test('only routes the factory accepts are submittable', () => {
  const submittable = VAULT_OPTIONS.filter(isSubmittable).map(o => o.factoryRoute).sort();
  assert.deepEqual(submittable, ['Blend', 'Defindex', 'None']);
  assert.equal(isSubmittable(getVaultOption('aquarius')), false, 'the factory has no Aquarius route yet');
  assert.deepEqual(unavailableOptions().map(o => o.id).sort(), ['aquarius', 'xoxno', 'zenex']);
});

test('status labels follow the network', () => {
  const blend = getVaultOption('blend');
  assert.equal(statusOn(blend, 'mainnet'), 'live-mainnet');
  assert.equal(statusOn(blend, 'testnet'), 'testnet');
  assert.equal(statusLabel(blend, 'mainnet'), 'Live on mainnet');
  assert.equal(statusLabel(blend, 'testnet'), 'Testnet');
  assert.equal(statusLabel(getVaultOption('zenex'), 'mainnet'), 'Coming soon');
  assert.equal(statusLabel(getVaultOption('aquarius'), 'testnet'), 'Demo flow');
});

test('groupByStatus partitions the registry', () => {
  const g = groupByStatus();
  assert.equal(Object.values(g).flat().length, VAULT_OPTIONS.length);
  assert.deepEqual(g['coming-soon'].map(o => o.id).sort(), ['zenex']);
});

test('copy has no em dashes', () => {
  for (const o of VAULT_OPTIONS) for (const s of [o.name, o.tagline, o.detail]) assert.ok(!s.includes(String.fromCharCode(0x2014)), s);
});

test('XOXNO is a testnet, customizable vault that the market wizard cannot route to yet', () => {
  const x = getVaultOption('xoxno');
  assert.equal(x.status, 'testnet');
  assert.equal(statusLabel(x, 'testnet'), 'Testnet, customizable');
  assert.equal(x.factoryRoute, null);
  assert.equal(isSubmittable(x), false);
});
