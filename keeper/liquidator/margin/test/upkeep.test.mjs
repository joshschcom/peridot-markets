import assert from 'node:assert/strict';
import test from 'node:test';
import { Keypair, Networks, StrKey, hash as sha256 } from '@stellar/stellar-sdk';
import { validateManifest, groupSettings } from '../src/group-config.mjs';
import { assertKeeperCall, verifyContractHashIn } from '../src/safety.mjs';
import { createStatusServer } from '../src/status.mjs';
import {
  upkeepSettings, upkeepPins, groupSelected, attestGroup, discoverGroups, planAdmission, UpkeepJobs, AttestationError, publicUpkeepStatus,
} from '../src/upkeep.mjs';

const id = n => StrKey.encodeContract(Buffer.alloc(32, n));
const H = c => c.repeat(64);
const RECEIPT = H('a'), CONTROLLER = H('b'), ROUTER_NEW = H('c'), ROUTER_OLD = H('d'), ADAPTER = H('e');
const FACTORY = id(1), DEFINDEX = id(2), BLEND_ADAPTER = id(3);
const manifest = {
  network: 'mainnet', admin: Keypair.random().publicKey(), factory: FACTORY, margin_factory: id(9),
  wasm: { receipt_vault: RECEIPT, controller: CONTROLLER, price_router: ROUTER_NEW, price_router_ext: ROUTER_NEW, price_router_legacy: ROUTER_OLD, blend_adapter: ADAPTER, margin: H('f') },
  external: { defindex_vaults: { XLM: DEFINDEX } }, demo: { blend_adapter: BLEND_ADAPTER },
};
const env = { GROUP_IDS: 'all', RPC_URL: 'https://rpc.example.com' };
const settings = upkeepSettings(env);
const pins = upkeepPins(manifest, settings);

// A tiny fake chain: wasm hash by contract, boosted vault by market, group records.
function chain({ hashes = {}, boosted = {}, groups = [] } = {}) {
  const reads = [];
  return { reads,
    wasmHash: async contract => { if (!(contract in hashes)) throw new Error('RPC down'); return hashes[contract]; },
    read: async (target, method, args) => {
      reads.push([target, method]);
      if (method === 'group_count') return groups.length;
      if (method === 'list_groups') { const start = Number(args[0].u32()); return groups.filter(g => g.id >= start).slice(0, Math.min(Number(args[1].u32()), 50)); }
      if (method === 'get_boosted_vault') { if (target in boosted) return boosted[target]; return null; }
      throw new Error(`unexpected read ${method}`);
    } };
}
const group = (n, overrides = {}) => ({ id: n, controller: id(10 + n), price_router: id(20 + n), margin_controller: null, markets: [id(30 + n)], ...overrides });
const goodHashes = (...ns) => Object.fromEntries(ns.flatMap(n => [[id(10 + n), CONTROLLER], [id(20 + n), ROUTER_OLD], [id(30 + n), RECEIPT]]));

test('settings require an explicit group selection and bounded intervals', () => {
  assert.throws(() => upkeepSettings({ RPC_URL: env.RPC_URL }), /GROUP_IDS/);
  assert.throws(() => upkeepSettings({ ...env, GROUP_IDS: 'x' }), /invalid group ID/);
  assert.throws(() => upkeepSettings({ ...env, GROUP_IDS: '0' }), /invalid group ID/);
  assert.throws(() => upkeepSettings({ ...env, RPC_URL: 'http://rpc.example.com' }), /HTTPS/);
  assert.throws(() => upkeepSettings({ ...env, BOOSTED_REFRESH_INTERVAL_MS: '300000' }), /BOOSTED_REFRESH_INTERVAL_MS/);
  assert.throws(() => upkeepSettings({ ...env, NETWORK: 'testnet', NETWORK_PASSPHRASE: Networks.PUBLIC }), /conflicts/);
  assert.equal(settings.dryRun, true);
  assert.equal(settings.interestIntervalMs, 600_000);
  assert.equal(settings.boostedIntervalMs, 120_000);
  const chosen = upkeepSettings({ ...env, GROUP_IDS: '1, 3', GROUP_DENY: '3' });
  assert.deepEqual([groupSelected(chosen.selection, 1), groupSelected(chosen.selection, 2), groupSelected(chosen.selection, 3)], [true, false, false]);
  assert.equal(groupSelected(upkeepSettings({ ...env, GROUP_DENY: '2' }).selection, 2), false);
  assert.equal(groupSelected(settings.selection, 7), true);
});

test('pins accept the live, extension and legacy routers and need no margin pins', () => {
  assert.deepEqual([...pins.routerHashes].sort(), [ROUTER_NEW, ROUTER_OLD].sort());
  assert.equal(upkeepPins({ ...manifest, margin_factory: undefined, wasm: { ...manifest.wasm, margin: undefined } }, settings).receiptHash, RECEIPT);
  assert.ok(pins.boostedAddresses.has(DEFINDEX) && pins.boostedAddresses.has(BLEND_ADAPTER) && pins.boostedHashes.has(ADAPTER));
  assert.throws(() => upkeepPins({ ...manifest, network: 'testnet' }, settings), /network/);
  assert.throws(() => upkeepPins({ ...manifest, wasm: { ...manifest.wasm, receipt_vault: undefined } }, settings), /receipt_vault/);
  assert.throws(() => upkeepPins({ ...manifest, wasm: { ...manifest.wasm, price_router: undefined, price_router_ext: undefined, price_router_legacy: undefined } }, settings), /price_router/);
});

test('group-main manifest validation also carries the allowed router list (stale-pin fix)', () => {
  const pinned = validateManifest(manifest, groupSettings({ GROUP_ID: '1', RPC_URL: 'https://rpc.example.com' }));
  assert.equal(pinned.priceRouterHash, ROUTER_NEW);
  assert.deepEqual([...pinned.priceRouterHashes].sort(), [ROUTER_NEW, ROUTER_OLD].sort());
});

test('verifyContractHashIn passes only allow-listed code on the right network', async () => {
  const code = label => Buffer.from(`wasm-${label}`);
  const digest = label => sha256(code(label)).toString('hex');
  const server = label => ({ getNetwork: async () => ({ passphrase: Networks.PUBLIC }), getContractWasmByContractId: async () => code(label) });
  const args = { networkPassphrase: Networks.PUBLIC, controllerId: id(5), allowedHashes: [digest('new'), digest('old')] };
  assert.equal(await verifyContractHashIn(server('old'), args), digest('old'));
  assert.equal(await verifyContractHashIn(server('new'), args), digest('new'));
  await assert.rejects(verifyContractHashIn(server('other'), args), /not in the allowed list/);
  await assert.rejects(verifyContractHashIn(server('new'), { ...args, networkPassphrase: Networks.TESTNET }), /network/);
  await assert.rejects(verifyContractHashIn(server('new'), { ...args, allowedHashes: [] }), /no allowed/);
});

test('attestation: a legacy-router group with no margin controller passes; unknown router or code skips the group', async () => {
  const ok = await attestGroup(group(2), chain({ hashes: goodHashes(2) }), pins);
  assert.equal(ok.routerHash, ROUTER_OLD); assert.equal(ok.marginController, null); assert.deepEqual(ok.markets, [id(32)]);
  const swap = (target, hash) => ({ ...goodHashes(2), [target]: hash });
  await assert.rejects(attestGroup(group(2), chain({ hashes: swap(id(22), H('9')) }), pins), /router/);
  await assert.rejects(attestGroup(group(2), chain({ hashes: swap(id(12), H('9')) }), pins), /lending controller/);
  await assert.rejects(attestGroup(group(2), chain({ hashes: swap(id(32), H('9')) }), pins), AttestationError);
  await assert.rejects(attestGroup(group(2, { markets: [id(32), id(99)] }), chain({ hashes: { ...goodHashes(2), [id(99)]: H('9') } }), pins), /pinned receipt vault/);
  await assert.rejects(attestGroup(group(2, { price_router: 'nope' }), chain({ hashes: goodHashes(2) }), pins), /price router/);
  // An unreadable chain is not an attestation verdict: it must stay a plain error so callers keep the old state.
  await assert.rejects(attestGroup(group(2), chain({ hashes: {} }), pins), error => error.message === 'RPC down' && !(error instanceof AttestationError));
});

test('boosted vaults are refreshed only when the address or code is known; unknown routes are reported', async () => {
  const hashes = { ...goodHashes(1, 2, 3), [id(77)]: ADAPTER, [id(78)]: H('9') };
  const view = (n, vault) => attestGroup(group(n), chain({ hashes, boosted: { [id(30 + n)]: vault } }), pins);
  assert.deepEqual((await view(1, DEFINDEX)).boostedAttested, [id(31)]);
  assert.deepEqual((await view(2, id(77))).boostedAttested, [id(32)]);
  const unknown = await view(3, id(78));
  assert.deepEqual(unknown.boostedAttested, []); assert.deepEqual(unknown.unattestedBoosted, [{ market: id(33), vault: id(78) }]);
  assert.deepEqual((await attestGroup(group(1), chain({ hashes: goodHashes(1) }), pins)).boosted, {});
});

test('discovery pages the factory, honours selection and skips only the bad group', async () => {
  const groups = [group(1), group(2), group(3, { price_router: id(99) }), group(4)];
  const hashes = { ...goodHashes(1, 2, 3, 4), [id(99)]: H('9') };
  const found = await discoverGroups(settings, pins, chain({ hashes, groups }));
  assert.deepEqual(found.active.map(g => g.id), [1, 2, 4]);
  assert.deepEqual(found.skipped.map(g => g.id), [3]); assert.equal(found.groupCount, 4);
  const narrowed = await discoverGroups(upkeepSettings({ ...env, GROUP_IDS: 'all', GROUP_DENY: '1,2' }), pins, chain({ hashes, groups }));
  assert.deepEqual(narrowed.active.map(g => g.id), [4]);
  const listed = await discoverGroups(upkeepSettings({ ...env, GROUP_IDS: '2' }), pins, chain({ hashes, groups }));
  assert.deepEqual(listed.active.map(g => g.id), [2]);
  // More than one factory page (50 groups per call).
  const many = Array.from({ length: 120 }, (_, i) => group(i + 1, { controller: id(1), price_router: id(2), markets: [] }));
  const big = chain({ hashes: { [id(1)]: CONTROLLER, [id(2)]: ROUTER_NEW }, groups: many });
  assert.equal((await discoverGroups(settings, pins, big)).active.length, 120);
  assert.equal(big.reads.filter(([, method]) => method === 'list_groups').length, 3);
  await assert.rejects(discoverGroups(settings, pins, chain({ hashes: {}, groups: [group(1)] })), /RPC down/);
});

const budgetConfig = { maxFee24hStroops: 100_000_000n, maxTransactionFeeStroops: 200_000n };
const plan = (groups, feeOf, config = budgetConfig) => planAdmission(groups, { feeOf, config, maxJobFeeStroops: 200_000n, interestIntervalMs: 600_000, boostedIntervalMs: 120_000 });
const attested = (n, boosted = false) => ({ id: n, controller: id(10 + n), marginController: null, markets: [id(30 + n)], boostedAttested: boosted ? [id(30 + n)] : [] });

test('budget gate admits groups in ID order and defers the first one that no longer fits, and everything after it', async () => {
  const groups = [attested(3, true), attested(1, true), attested(2)];
  const all = await plan(groups, async () => 30_000n);
  assert.deepEqual(all.admitted.map(g => g.id), [1, 2, 3]); assert.equal(all.budget.sufficient, true); assert.deepEqual(all.deferred, []);
  assert.deepEqual(all.admitted[0].boostedMarkets, [id(31)]);
  // Group 1 (interest + 2-minute boosted) reserves about 3.3 XLM/day with headroom, group 2 adds about 0.5; cap it to fit group 1 only.
  const tight = await plan(groups, async () => 30_000n, { ...budgetConfig, maxFee24hStroops: 35_000_000n });
  assert.deepEqual(tight.admitted.map(g => g.id), [1]); assert.deepEqual(tight.deferred, [2, 3]);
  const none = await plan(groups, async () => 30_000n, { ...budgetConfig, maxFee24hStroops: 200_000n });
  assert.deepEqual(none.admitted, []); assert.deepEqual(none.deferred, [1, 2, 3]);
});

test('a job that cannot be simulated or exceeds the per-job ceiling is left out without dropping the group', async () => {
  const feeOf = async (market, method) => {
    if (method === 'refresh_boosted_underlying') throw new Error('simulation failed');
    return market === id(32) ? 300_000n : 30_000n;
  };
  const result = await plan([attested(1, true), attested(2)], feeOf);
  assert.deepEqual(result.admitted.map(g => [g.id, g.interestMarkets.length, g.boostedMarkets.length]), [[1, 1, 0]]);
  assert.deepEqual(result.skippedJobs.map(job => [job.group, job.method]), [[1, 'refresh_boosted_underlying'], [2, 'update_interest']]);
});

test('live registry shares membership arrays with signer configs so removal blocks signing at once', () => {
  const jobs = new UpkeepJobs(), made = [];
  const make = (market, kind) => { const client = { market, kind, config: { role: kind === 'interest' ? 'interest-refresh' : 'boosted-refresh', controllerId: market,
    interestMarkets: jobs.interestMarkets, boostedMarkets: jobs.boostedMarkets, expectedControllerHash: RECEIPT, receiptHash: RECEIPT } }; made.push(client); return client; };
  const groups = [{ ...attested(1, true), interestMarkets: [id(31)], boostedMarkets: [id(31)] }, { ...attested(2), interestMarkets: [id(32)], boostedMarkets: [] }];
  jobs.apply(groups, make);
  assert.equal(jobs.interestClients.size, 2); assert.equal(jobs.refreshClients.size, 1); assert.equal(made.length, 3);
  const interest = jobs.interestClients.get(id(31)), boosted = jobs.refreshClients.get(id(31));
  assert.doesNotThrow(() => assertKeeperCall(interest.config, 'update_interest', []));
  assert.doesNotThrow(() => assertKeeperCall(boosted.config, 'refresh_boosted_underlying', []));
  assert.ok(jobs.allowedControllers.includes(id(11)) && jobs.allowedControllers.includes(id(32)));
  jobs.apply(groups, make); assert.equal(made.length, 3, 'unchanged clients are reused');
  assert.deepEqual(jobs.removeGroup(1), [id(31)]);
  assert.throws(() => assertKeeperCall(interest.config, 'update_interest', []), /whitelist/);
  assert.throws(() => assertKeeperCall(boosted.config, 'refresh_boosted_underlying', []), /attested boosted/);
  assert.doesNotThrow(() => assertKeeperCall(jobs.interestClients.get(id(32)).config, 'update_interest', []));
  jobs.removeMarket(id(32), 'boosted'); assert.equal(jobs.interestClients.size, 1);
  // Allowed controllers only grow, so an old pending intent can still be reconciled.
  assert.ok(jobs.allowedControllers.includes(id(31)));
});

test('the lowest-ID group owns a market that two groups list', () => {
  const jobs = new UpkeepJobs();
  const dup = (n) => ({ ...attested(n), markets: [id(40)], interestMarkets: [id(40)], boostedMarkets: [] });
  jobs.apply([dup(5), dup(2)], market => ({ market }));
  assert.equal(jobs.marketGroup.get(id(40)), 2); assert.equal(jobs.interestClients.size, 1);
});

test('signers cannot be repurposed: only the two upkeep methods, no arguments, only attested markets', () => {
  const config = { role: 'interest-refresh', controllerId: id(31), interestMarkets: [id(31)], expectedControllerHash: RECEIPT, receiptHash: RECEIPT };
  for (const method of ['rebalance_idle_cash', 'harvest', 'fund', 'liquidate', 'transfer']) {
    assert.throws(() => assertKeeperCall(config, method, []), /only permits/);
    assert.throws(() => assertKeeperCall({ ...config, role: 'boosted-refresh', boostedMarkets: [id(31)] }, method, []), /only permits/);
  }
  assert.throws(() => assertKeeperCall({ ...config, controllerId: id(50) }, 'update_interest', []), /whitelist/);
  assert.throws(() => assertKeeperCall({ role: 'upkeep-reconciler' }, 'update_interest', []), /not allowed/);
});

test('upkeep health tolerates slow cadences but fails when a job, discovery or coverage is stale', () => {
  const base = () => ({ dryRun: false, startedAt: 0, fatal: false, stopping: false,
    intervals: { discoveryMs: 300_000, interestMs: 600_000, boostedMs: 120_000 }, discovery: { lastSuccess: 1_000_000 },
    groups: { interestMarkets: [id(31)], boostedMarkets: [id(31)] },
    interest: { [id(31)]: { lastRun: 1_000_000, lastSuccess: 1_000_000, failures: 0 } }, refresh: { [id(31)]: { lastRun: 1_000_000, lastSuccess: 1_000_000, failures: 0 } } });
  const now = 1_000_000 + 100_000;
  assert.equal(publicUpkeepStatus(base(), now).healthy, true);
  // A 10 minute interest job is still healthy 15 minutes after its last success; the group-main 4 minute rule would fail here.
  assert.equal(publicUpkeepStatus(base(), 1_000_000 + 900_000).healthy, false, 'but the 2 minute boosted job is stale by then');
  const slow = base(); slow.refresh[id(31)].lastSuccess = 1_000_000 + 880_000; slow.discovery.lastSuccess = 1_000_000 + 880_000;
  assert.equal(publicUpkeepStatus(slow, 1_000_000 + 900_000).healthy, true);
  const failing = base(); failing.interest[id(31)].failures = 1; assert.equal(publicUpkeepStatus(failing, now).healthy, false);
  const noCoverage = base(); noCoverage.groups.interestMarkets = []; assert.equal(publicUpkeepStatus(noCoverage, now).healthy, false);
  const dry = base(); dry.dryRun = true; dry.interest[id(31)].lastSuccess = null; dry.refresh[id(31)].lastSuccess = null;
  assert.equal(publicUpkeepStatus(dry, now).healthy, true); assert.equal(publicUpkeepStatus(dry, now).mode, 'simulation-only');
  assert.equal(publicUpkeepStatus({ ...base(), fatal: true }, now).healthy, false);
  assert.equal(typeof createStatusServer, 'function');
});
