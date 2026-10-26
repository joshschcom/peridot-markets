import test from 'node:test';
import assert from 'node:assert/strict';
import { registryPools, pairLabel } from './aquarius-pools';
import { FACTORY_SUPPORTS_AQUARIUS_ROUTE, buildVaultPlan, canRunOnChain, defaultRange, demoVaultFromPlan, loadDemoVaults, missingSteps, runDemoPlan, saveDemoVault, type KeyValueStore, type StepEvent } from './vault-plan';

const pools = registryPools('mainnet');
const stable = pools.find(p => pairLabel(p) === 'USDC/EURC' && p.type === 'concentrated')!;
const cp = pools.find(p => pairLabel(p) === 'XLM/USDC')!;
const input = { pool: stable, net: 'mainnet' as const, supplyCap: '10000', idleBufferPct: 30 };

function memory(): KeyValueStore & { data: Record<string, string> } {
  const data: Record<string, string> = {};
  return { data, getItem: k => data[k] ?? null, setItem: (k, v) => { data[k] = v; } };
}

test('stable pairs default to full range, volatile pairs to a centered range', () => {
  assert.deepEqual(defaultRange(stable), { kind: 'FullRange' });
  assert.deepEqual(defaultRange(cp), { kind: 'Centered', halfWidthTicks: 40 });
});

test('a valid plan has six steps and flags the missing contract entrypoints', () => {
  const plan = buildVaultPlan(input);
  assert.equal(plan.ok, true);
  assert.equal(plan.steps.length, 6);
  assert.deepEqual(missingSteps(plan).map(s => s.method), ['deploy_aquarius_vault', 'add_market', 'attach_yield']);
  assert.equal(plan.underlyingSymbol, 'USDC');
  assert.equal(FACTORY_SUPPORTS_AQUARIUS_ROUTE, false);
  assert.equal(canRunOnChain(plan), false, 'the demo must not claim an onchain path');
});

test('validation: non concentrated pool, missing cap, low buffer, bad range', () => {
  assert.match(buildVaultPlan({ ...input, pool: cp }).errors.join(' '), /concentrated/);
  assert.match(buildVaultPlan({ ...input, supplyCap: '' }).errors.join(' '), /supply cap/i);
  assert.match(buildVaultPlan({ ...input, supplyCap: '-3' }).errors.join(' '), /supply cap/i);
  assert.match(buildVaultPlan({ ...input, idleBufferPct: 10 }).errors.join(' '), /30%/);
  assert.match(buildVaultPlan({ ...input, range: { kind: 'Centered', halfWidthTicks: 0 } }).errors.join(' '), /half width/);
  const noUsdc = { ...stable, tokens: [{ symbol: 'FOO', address: 'CF' }, { symbol: 'BAR', address: 'CB' }] as typeof stable.tokens };
  assert.match(buildVaultPlan({ ...input, pool: noUsdc }).errors.join(' '), /contains USDC/);
});

test('runDemoPlan emits the full status sequence per step and never calls the network', async () => {
  const plan = buildVaultPlan(input);
  const events: StepEvent[] = [];
  let n = 0;
  const txs = await runDemoPlan(plan, e => events.push(e), { delayMs: 0, newId: () => `id${n++}` });
  assert.equal(txs.length, 6);
  assert.equal(events.length, 6 * 5);
  assert.deepEqual(events.slice(0, 5).map(e => e.status), ['simulating', 'signing', 'submitting', 'confirming', 'success']);
  assert.ok(events.every(e => e.method.startsWith('demo_')));
  assert.ok(events.filter(e => e.status === 'success').every(e => /No onchain transaction/.test(e.message ?? '')));
  assert.ok(txs.every(t => t.hash.startsWith('demo-')));
});

test('runDemoPlan refuses an invalid plan', async () => {
  await assert.rejects(runDemoPlan(buildVaultPlan({ ...input, supplyCap: '0' }), () => {}, { delayMs: 0 }), /supply cap/i);
});

test('demo vault store round trips, orders newest first and survives bad storage', () => {
  const store = memory();
  const plan = buildVaultPlan(input);
  const a = demoVaultFromPlan(plan, stable, 'mainnet', [], 1000);
  const b = demoVaultFromPlan(plan, stable, 'mainnet', [], 2000);
  saveDemoVault(store, a);
  const list = saveDemoVault(store, b);
  assert.deepEqual(list.map(v => v.id), [b.id, a.id]);
  assert.equal(loadDemoVaults(store, 'mainnet').length, 2);
  assert.equal(loadDemoVaults(store, 'testnet').length, 0);
  store.data['peridot:vault-demo:v1:mainnet'] = '{not json';
  assert.deepEqual(loadDemoVaults(store, 'mainnet'), []);
  assert.deepEqual(loadDemoVaults(null, 'mainnet'), []);
  assert.doesNotThrow(() => saveDemoVault({ getItem: () => null, setItem: () => { throw new Error('blocked'); } }, a));
});
