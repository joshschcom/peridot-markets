import { Networks, StrKey, nativeToScVal } from '@stellar/stellar-sdk';
import { contract, hash, routerHashes } from './group-config.mjs';
import { requireSafe } from './safety.mjs';
import { scheduledBudget } from './budget.mjs';

/**
 * Permissionless upkeep for every attested group: `update_interest` on each receipt vault and
 * `refresh_boosted_underlying` on each attested boosted vault. No margin, lending liquidation,
 * rebalance, harvest or fund call is ever signed in this mode.
 */

/** A group failed attestation. Non-fatal: the group is skipped, other groups keep running. */
export class AttestationError extends Error {
  constructor(message) { super(message); this.name = 'AttestationError'; }
}
const reject = message => { throw new AttestationError(message); };
const u32 = value => nativeToScVal(value, { type: 'u32' });

function integerEnv(env, name, fallback, min, max) {
  const raw = env[name];
  const value = raw === undefined || raw === '' ? fallback : Number(raw);
  if (!Number.isSafeInteger(value) || value < min || value > max) throw new Error(`${name} must be ${min}..${max}`);
  return value;
}
function groupIds(raw, name) {
  return (raw ?? '').split(',').map(value => value.trim()).filter(Boolean).map(value => {
    if (!/^\d+$/.test(value) || Number(value) < 1 || Number(value) > 4294967295) throw new Error(`${name} contains an invalid group ID`);
    return Number(value);
  });
}

export function upkeepSettings(env = process.env) {
  const network = env.NETWORK || 'mainnet';
  if (!['mainnet', 'testnet'].includes(network)) throw new Error('NETWORK must be mainnet or testnet');
  const rawIds = (env.GROUP_IDS ?? '').trim();
  if (!rawIds) throw new Error('GROUP_IDS is required: use "all" or a comma-separated list of group IDs');
  const all = rawIds === 'all';
  const ids = all ? [] : groupIds(rawIds, 'GROUP_IDS');
  if (!all && ids.length === 0) throw new Error('GROUP_IDS must be "all" or at least one group ID');
  const deny = groupIds(env.GROUP_DENY, 'GROUP_DENY');
  const dryRun = env.DRY_RUN === undefined || env.DRY_RUN === '' ? true : env.DRY_RUN === 'true' || env.DRY_RUN === '1';
  if (env.DRY_RUN && !['true', 'false', '1', '0'].includes(env.DRY_RUN)) throw new Error('DRY_RUN must be true or false');
  const rpcUrl = env.RPC_URL || (network === 'testnet' ? 'https://soroban-testnet.stellar.org' : '');
  if (!rpcUrl) throw new Error('RPC_URL is required for mainnet');
  if (new URL(rpcUrl).protocol !== 'https:') throw new Error('RPC_URL must use HTTPS');
  const networkPassphrase = network === 'mainnet' ? Networks.PUBLIC : Networks.TESTNET;
  if (env.NETWORK_PASSPHRASE && env.NETWORK_PASSPHRASE !== networkPassphrase) throw new Error('NETWORK_PASSPHRASE conflicts with NETWORK');
  const port = integerEnv(env, 'PORT', 8787, 1, 65535);
  const extraBoosted = (env.UPKEEP_EXTRA_BOOSTED_VAULTS ?? '').split(',').map(value => value.trim()).filter(Boolean);
  for (const vault of extraBoosted) contract(vault, 'UPKEEP_EXTRA_BOOSTED_VAULTS entry');
  return {
    network, dryRun, rpcUrl, networkPassphrase, port, host: env.HOST || '127.0.0.1',
    horizonUrl: env.HORIZON_URL || (network === 'mainnet' ? 'https://horizon.stellar.org' : 'https://horizon-testnet.stellar.org'),
    selection: { all, ids: new Set(ids), deny: new Set(deny) },
    discoveryIntervalMs: integerEnv(env, 'DISCOVERY_INTERVAL_MS', 300_000, 60_000, 3_600_000),
    // Interest also accrues inside every user action, so it is housekeeping and can be slow.
    interestIntervalMs: integerEnv(env, 'INTEREST_REFRESH_INTERVAL_MS', 600_000, 60_000, 3_600_000),
    // The boosted health cache expires after 5 minutes, so this must stay well under that.
    boostedIntervalMs: integerEnv(env, 'BOOSTED_REFRESH_INTERVAL_MS', 120_000, 30_000, 180_000),
    maxJobFeeStroops: BigInt(integerEnv(env, 'UPKEEP_MAX_TX_FEE_STROOPS', 200_000, 20_000, 10_000_000)),
    feeEstimateTtlMs: 3_600_000,
    extraBoostedVaults: extraBoosted,
    deploymentsFile: env.DEPLOYMENTS_FILE || null,
  };
}

export function groupSelected(selection, id) {
  return !selection.deny.has(id) && (selection.all || selection.ids.has(id));
}

/** Pins needed for upkeep only. Margin pins are deliberately not required. */
export function upkeepPins(manifest, settings) {
  if (manifest.network !== settings.network) throw new Error('Deployment manifest network mismatch');
  const admin = manifest.admin;
  if (admin !== undefined && (typeof admin !== 'string' || !(StrKey.isValidEd25519PublicKey(admin) || StrKey.isValidContract(admin)))) throw new Error('manifest.admin must be a valid public address');
  const wasm = manifest.wasm ?? {};
  const routers = routerHashes(wasm);
  if (routers.length === 0) throw new Error('manifest.wasm.price_router must be a 64-character lowercase Wasm hash');
  const boostedAddresses = new Set([...Object.values(manifest.external?.defindex_vaults ?? {}), manifest.demo?.blend_adapter, ...settings.extraBoostedVaults]
    .filter(value => value !== undefined && value !== null).map(value => contract(value, 'known boosted vault')));
  const boostedHashes = new Set([wasm.blend_adapter].filter(Boolean).map(value => hash(value, 'manifest.wasm.blend_adapter')));
  return {
    admin, factory: contract(manifest.factory, 'manifest.factory'),
    receiptHash: hash(wasm.receipt_vault, 'manifest.wasm.receipt_vault'),
    lendingHash: hash(wasm.controller, 'manifest.wasm.controller'),
    routerHashes: routers, boostedAddresses, boostedHashes,
  };
}

/**
 * Check one factory group against the pins. `ctx` supplies `read(id, method, args)` and `wasmHash(id)`.
 * A bad pin throws AttestationError; an unreadable chain throws a plain Error (transient, caller keeps old state).
 */
export async function attestGroup(group, ctx, pins) {
  const id = Number(group?.id);
  if (!Number.isSafeInteger(id) || id < 1) reject('group has no valid ID');
  const check = (condition, message) => { if (!condition) reject(message); };
  const valid = (value, label) => { check(typeof value === 'string' && StrKey.isValidContract(value), `${label} is not a contract address`); return value; };
  const controller = valid(group.controller, 'lending controller');
  check(await ctx.wasmHash(controller) === pins.lendingHash, 'lending controller code hash is not the pinned controller');
  const priceRouter = valid(group.price_router, 'price router');
  const routerHash = await ctx.wasmHash(priceRouter);
  check(pins.routerHashes.includes(routerHash), 'price router code hash is not in the allowed router list');
  check(Array.isArray(group.markets) && group.markets.length <= 100, 'invalid market list');
  const markets = [...new Set(group.markets.map(market => valid(market, 'market')))];
  for (const market of markets) check(await ctx.wasmHash(market) === pins.receiptHash, 'a market is not the pinned receipt vault');
  const boosted = {}, boostedAttested = [], unattestedBoosted = [];
  for (const market of markets) {
    const vault = await ctx.read(market, 'get_boosted_vault', []);
    if (vault === undefined || vault === null) continue;
    boosted[market] = valid(vault, 'boosted vault');
    // Unknown yield routes are not refreshed: the receipt vault would call out to an unreviewed contract.
    const known = pins.boostedAddresses.has(vault) || pins.boostedHashes.has(await ctx.wasmHash(vault));
    (known ? boostedAttested : unattestedBoosted).push(known ? market : { market, vault });
  }
  const marginController = typeof group.margin_controller === 'string' && StrKey.isValidContract(group.margin_controller) ? group.margin_controller : null;
  return { id, controller, marginController, priceRouter, routerHash, markets, boosted, boostedAttested, unattestedBoosted };
}

/** Walk the factory's groups, honouring GROUP_IDS / GROUP_DENY, and attest each selected group independently. */
export async function discoverGroups(settings, pins, ctx) {
  const count = Number(await ctx.read(pins.factory, 'group_count', []));
  if (!Number.isSafeInteger(count) || count < 0) throw new Error('Factory returned an invalid group count');
  const raw = [];
  for (let start = 1, pages = 0; start <= count && pages < 100; pages += 1) {
    const page = await ctx.read(pins.factory, 'list_groups', [u32(start), u32(50)]);
    if (!Array.isArray(page) || page.length === 0) break;
    raw.push(...page);
    start = Math.max(...page.map(group => Number(group.id))) + 1;
  }
  const active = [], skipped = [];
  for (const group of raw) {
    const id = Number(group.id);
    if (!groupSelected(settings.selection, id)) continue;
    try { active.push(await attestGroup(group, ctx, pins)); }
    catch (error) {
      if (!(error instanceof AttestationError)) throw error;
      skipped.push({ id, reason: error.message });
    }
  }
  return { active: active.sort((a, b) => a.id - b.id), skipped, groupCount: count };
}

/**
 * Admit groups in ID order while the padded 24 h fee reservation fits the configured caps. The first group that
 * does not fit and everything after it is deferred; nothing is signed for deferred groups. Markets whose job cannot
 * be simulated, or whose fee is above the per-job ceiling, are left out individually.
 */
export async function planAdmission(groups, { feeOf, config, interestIntervalMs, boostedIntervalMs, maxJobFeeStroops }) {
  const admitted = [], deferred = [], skippedJobs = [], jobs = [];
  let budget = scheduledBudget([], config), blocked = false;
  for (const group of [...groups].sort((a, b) => a.id - b.id)) {
    if (blocked) { deferred.push(group.id); continue; }
    const interestMarkets = [], boostedMarkets = [], groupJobs = [];
    const consider = async (market, method, intervalMs, into) => {
      try {
        const fee = await feeOf(market, method);
        if (fee > maxJobFeeStroops) { skippedJobs.push({ group: group.id, market, method, reason: 'fee estimate is above the per-job ceiling' }); return; }
        into.push(market); groupJobs.push({ fee, intervalMs });
      } catch { skippedJobs.push({ group: group.id, market, method, reason: 'fee estimation or simulation failed' }); }
    };
    for (const market of group.markets) {
      await consider(market, 'update_interest', interestIntervalMs, interestMarkets);
      if (group.boostedAttested.includes(market)) await consider(market, 'refresh_boosted_underlying', boostedIntervalMs, boostedMarkets);
    }
    if (groupJobs.length === 0) continue;
    const trial = scheduledBudget([...jobs, ...groupJobs], config);
    if (!trial.sufficient) { deferred.push(group.id); blocked = true; continue; }
    jobs.push(...groupJobs); budget = trial;
    admitted.push({ ...group, interestMarkets, boostedMarkets });
  }
  return { admitted, deferred, skippedJobs, budget };
}

/**
 * Live job registry. The arrays are shared by reference with every client config, so removing a market here
 * immediately makes `assertKeeperCall` and the journal refuse it. `allowedControllers` only grows (it also lets
 * the journal reconcile an old pending intent); signing authority comes from interestMarkets / boostedMarkets.
 */
export class UpkeepJobs {
  constructor() {
    this.interestMarkets = []; this.boostedMarkets = []; this.allowedControllers = [];
    this.interestClients = new Map(); this.refreshClients = new Map(); this.marketGroup = new Map();
  }
  apply(admitted, makeClient) {
    // A market belongs to the lowest-ID group that lists it, so a later group cannot hijack another group's vault.
    const owner = new Map(), wantInterest = new Set(), wantBoosted = new Set();
    for (const group of [...admitted].sort((x, y) => x.id - y.id)) {
      for (const market of [...group.interestMarkets, ...group.boostedMarkets]) if (!owner.has(market)) owner.set(market, group.id);
      for (const market of group.interestMarkets) if (owner.get(market) === group.id) wantInterest.add(market);
      for (const market of group.boostedMarkets) if (owner.get(market) === group.id) wantBoosted.add(market);
      for (const id of [group.controller, group.marginController, ...group.markets]) if (id && !this.allowedControllers.includes(id)) this.allowedControllers.push(id);
    }
    for (const market of [...this.interestClients.keys()]) if (!wantInterest.has(market)) this.interestClients.delete(market);
    for (const market of [...this.refreshClients.keys()]) if (!wantBoosted.has(market)) this.refreshClients.delete(market);
    const replace = (list, values) => { list.length = 0; list.push(...values); };
    replace(this.interestMarkets, wantInterest);
    replace(this.boostedMarkets, wantBoosted);
    this.marketGroup = owner;
    for (const market of wantInterest) if (!this.interestClients.has(market)) this.interestClients.set(market, makeClient(market, 'interest'));
    for (const market of wantBoosted) if (!this.refreshClients.has(market)) this.refreshClients.set(market, makeClient(market, 'boosted'));
  }
  removeGroup(groupId) {
    const markets = [...this.marketGroup].filter(([, id]) => id === groupId).map(([market]) => market);
    for (const market of markets) this.removeMarket(market, 'interest');
    return markets;
  }
  removeMarket(market, kind) {
    const drop = (list, map) => { const i = list.indexOf(market); if (i >= 0) list.splice(i, 1); map.delete(market); };
    drop(this.boostedMarkets, this.refreshClients);
    if (kind === 'interest') { drop(this.interestMarkets, this.interestClients); this.marketGroup.delete(market); }
  }
}

/** Health for slower cadences: every scheduled job must have succeeded within two of its own intervals. */
export function publicUpkeepStatus(state, now = Date.now()) {
  const fresh = (job, intervalMs) => job && !job.failures && (state.dryRun ? job.lastRun : job.lastSuccess) && now - (state.dryRun ? job.lastRun : job.lastSuccess) <= 2 * intervalMs + 30_000;
  const interestOk = state.groups.interestMarkets.every(market => fresh(state.interest[market], state.intervals.interestMs));
  const boostedOk = state.groups.boostedMarkets.every(market => fresh(state.refresh[market], state.intervals.boostedMs));
  const discovered = state.discovery.lastSuccess !== null && now - state.discovery.lastSuccess <= 3 * state.intervals.discoveryMs;
  const covered = state.groups.interestMarkets.length > 0;
  const healthy = discovered && covered && interestOk && boostedOk && !state.fatal && !state.stopping;
  return { ...state, healthy, mode: state.dryRun ? 'simulation-only' : 'live', uptimeSeconds: Math.floor((now - state.startedAt) / 1000) };
}
