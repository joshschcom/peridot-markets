import test from 'node:test';
import assert from 'node:assert/strict';
import { APPROVAL_COPY, VAULT_OPTIONS, getVaultOption, groupByStatus, isSubmittable, statusLabel, statusOn, unavailableOptions, venueAvailability, venueForRoute } from './registry';

test('registry ids are unique and cover every venue', () => {
  const ids = VAULT_OPTIONS.map(o => o.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const id of ['idle', 'blend', 'defindex', 'aquarius', 'xoxno', 'zenex']) assert.ok(ids.includes(id as never), id);
});

test('every venue is submittable through a factory route; created vaults go through the DeFindex-shaped route', () => {
  assert.deepEqual(unavailableOptions(), []);
  for (const id of ['aquarius', 'xoxno', 'zenex'] as const) {
    const o = getVaultOption(id);
    assert.equal(o.factoryRoute, 'Defindex');
    assert.equal(o.kind, id);
    assert.equal(o.status, 'live-mainnet');
    assert.ok(isSubmittable(o));
    assert.match(o.detail, /Vaults page/);
  }
  assert.equal(getVaultOption('zenex').underlying, 'USDC');
  assert.match(getVaultOption('zenex').tagline, /async withdrawals/);
  assert.match(APPROVAL_COPY, /set_yield_vault_allowed/);
});

test('availability follows the manifest: unregistered kinds read as registering, registered kinds are selectable', () => {
  const zenex = getVaultOption('zenex'), aquarius = getVaultOption('aquarius');
  const mainnetKinds = ['zenex', 'xoxno'];
  assert.deepEqual(venueAvailability(zenex, 'mainnet', mainnetKinds), { selectable: true, label: 'Live on mainnet, customizable', tone: 'success' });
  const aq = venueAvailability(aquarius, 'mainnet', mainnetKinds);
  assert.equal(aq.selectable, false);
  assert.equal(aq.label, 'Registering on mainnet');
  assert.match(aq.reason ?? '', /not registered with the vault factory on mainnet/);
  assert.equal(venueAvailability(aquarius, 'testnet', ['aquarius', 'zenex', 'xoxno']).label, 'Testnet, customizable');
  assert.deepEqual(venueAvailability(getVaultOption('idle'), 'mainnet', []), { selectable: true, label: 'Live on mainnet', tone: 'success' });
  assert.equal(venueAvailability(getVaultOption('defindex'), 'mainnet', []).selectable, true, 'plain venues do not depend on vault kinds');
});

test('status labels follow the network', () => {
  const blend = getVaultOption('blend');
  assert.equal(statusOn(blend, 'mainnet'), 'live-mainnet');
  assert.equal(statusOn(blend, 'testnet'), 'testnet');
  assert.equal(statusLabel(blend, 'mainnet'), 'Live on mainnet');
  assert.equal(statusLabel(blend, 'testnet'), 'Testnet');
  assert.equal(statusLabel(getVaultOption('xoxno'), 'mainnet'), 'Live on mainnet, customizable');
  assert.equal(statusLabel(getVaultOption('aquarius'), 'testnet'), 'Testnet, customizable');
});

test('groupByStatus partitions the registry', () => {
  const g = groupByStatus();
  assert.equal(Object.values(g).flat().length, VAULT_OPTIONS.length);
  assert.deepEqual(g['coming-soon'].map(o => o.id), []);
  assert.deepEqual(g.testnet, []);
});

test('copy has no em dashes and no stale testnet or coming soon wording', () => {
  for (const o of VAULT_OPTIONS) for (const s of [o.name, o.tagline, o.detail]) {
    assert.ok(!s.includes(String.fromCharCode(0x2014)), s);
    assert.ok(!/coming soon|not active|testnet only/i.test(s), s);
  }
});

test('venueForRoute maps a draft back to its venue', () => {
  assert.equal(venueForRoute('None'), 'idle');
  assert.equal(venueForRoute('Blend'), 'blend');
  assert.equal(venueForRoute('Defindex'), 'defindex');
  assert.equal(venueForRoute('Defindex', 'zenex'), 'zenex');
  assert.equal(venueForRoute('Defindex', 'other'), 'defindex');
});
