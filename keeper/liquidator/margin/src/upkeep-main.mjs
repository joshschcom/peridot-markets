import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { hash as sha256, rpc, nativeToScVal } from '@stellar/stellar-sdk';
import { loadConfig } from './config.mjs';
import { assertDedicatedKeeper, readView } from './group-config.mjs';
import { StellarClient } from './stellar.mjs';
import { openJournal } from './journal.mjs';
import { requireSafe } from './safety.mjs';
import { createStatusServer } from './status.mjs';
import { refreshBoostedMarkets, refreshInterestMarkets } from './refresh.mjs';
import {
  upkeepSettings, upkeepPins, discoverGroups, attestGroup, planAdmission, groupSelected,
  UpkeepJobs, AttestationError, publicUpkeepStatus,
} from './upkeep.mjs';

/**
 * One service for every attested group on the network. Signs only `update_interest` and
 * `refresh_boosted_underlying`; margin and lending liquidation are intentionally not part of this mode.
 */
async function main() {
  const settings = upkeepSettings();
  const deploymentsFile = settings.deploymentsFile || fileURLToPath(new URL(`../../../../deployments/${settings.network}.json`, import.meta.url));
  const pins = upkeepPins(JSON.parse(await readFile(deploymentsFile, 'utf8')), settings);
  // loadConfig needs a controller ID and hash; the factory and receipt hash are inert placeholders for the base client,
  // which only reconciles and reads. Every signing client below has its own market ID.
  Object.assign(process.env, {
    DRY_RUN: String(settings.dryRun), NETWORK_PASSPHRASE: settings.networkPassphrase, RPC_URL: settings.rpcUrl,
    HORIZON_URL: settings.horizonUrl, MARGIN_CONTROLLER_ID: pins.factory, EXPECTED_CONTROLLER_WASM_HASH: pins.receiptHash,
  });
  const config = loadConfig();
  assertDedicatedKeeper(config, { admin: pins.admin });
  if (config.maxTransactionFeeStroops > settings.maxJobFeeStroops) config.maxTransactionFeeStroops = settings.maxJobFeeStroops;
  requireSafe(config.maxFee24hStroops >= config.maxTransactionFeeStroops, 'The 24-hour fee cap is below the per-job fee ceiling');

  const jobs = new UpkeepJobs();
  config.allowedControllers = jobs.allowedControllers;
  const status = {
    startedAt: Date.now(), network: settings.network, dryRun: settings.dryRun, liveSigning: !settings.dryRun,
    selection: { all: settings.selection.all, ids: [...settings.selection.ids], deny: [...settings.selection.deny] },
    intervals: { discoveryMs: settings.discoveryIntervalMs, interestMs: settings.interestIntervalMs, boostedMs: settings.boostedIntervalMs },
    discovery: { lastSuccess: null, lastError: null, groupCount: null },
    groups: { active: [], skipped: [], deferred: [], skippedJobs: [], interestMarkets: [], boostedMarkets: [] },
    feeBudget: null, refresh: {}, interest: {}, lastTx: null, lastError: null, lastSuccessfulCycle: null, fatal: false, stopping: false,
  };
  const logger = Object.fromEntries(['info', 'warn', 'error'].map(level => [level, (message, fields = {}) => {
    if (fields.hash) status.lastTx = { hash: fields.hash, ledger: fields.ledger ?? null, time: Date.now(), action: message };
    console[level === 'info' ? 'log' : level](JSON.stringify({ level, time: new Date().toISOString(), message, ...fields }));
  }]));
  const journal = config.dryRun ? null : await openJournal(config);
  const base = new StellarClient({ ...config, role: 'upkeep-reconciler', controllerId: pins.factory }, logger, journal);
  const { server } = base;
  const readOnce = (id, method, args) => readView(server, settings.networkPassphrase, id, method, args);
  const freshContext = () => {
    const memo = new Map();
    return { read: readOnce, wasmHash: async id => {
      if (!memo.has(id)) memo.set(id, sha256(await server.getContractWasmByContractId(id)).toString('hex'));
      return memo.get(id);
    } };
  };

  /** Re-attest the group right before every signature; a bad group loses its jobs but never stops the service. */
  const recheck = async (market, kind) => {
    const groupId = jobs.marketGroup.get(market);
    if (groupId === undefined) throw new Error('market is no longer scheduled');
    let attested;
    try {
      requireSafe(groupSelected(settings.selection, groupId), 'group is no longer selected');
      const raw = await readOnce(pins.factory, 'get_group', [nativeToScVal(groupId, { type: 'u32' })]);
      attested = await attestGroup(raw, freshContext(), pins);
      if (attested.id !== groupId || !attested.markets.includes(market)) throw new AttestationError('market left the group');
    } catch (error) {
      if (error instanceof AttestationError || error.fatal) {
        const removed = jobs.removeGroup(groupId);
        logger.warn('group removed from upkeep after failed re-attestation', { groupId, markets: removed.length, reason: error.message });
        throw new Error(`group ${groupId} failed re-attestation`);
      }
      throw error;
    }
    if (kind === 'boosted' && !attested.boostedAttested.includes(market)) {
      jobs.removeMarket(market, 'boosted');
      throw new Error('boosted vault is no longer attested');
    }
  };
  const clientFor = (market, kind) => new StellarClient({ ...config,
    controllerId: market, expectedControllerHash: pins.receiptHash, receiptHash: pins.receiptHash,
    role: kind === 'interest' ? 'interest-refresh' : 'boosted-refresh',
    interestMarkets: jobs.interestMarkets, boostedMarkets: jobs.boostedMarkets, feeDistributionVaults: [],
    verifyGroup: () => recheck(market, kind),
  }, { ...logger, info: (message, fields) => logger.info(message, { vault: market, ...fields }) }, journal);

  const feeCache = new Map();
  const feeOf = async (market, method) => {
    const key = `${market}:${method}`, cached = feeCache.get(key);
    if (cached && Date.now() - cached.at < settings.feeEstimateTtlMs) return cached.fee;
    // Simulation-only client: scoped to this one market and method, never used for signing.
    const estimator = new StellarClient({ ...config, controllerId: market, expectedControllerHash: pins.receiptHash, receiptHash: pins.receiptHash,
      role: method === 'update_interest' ? 'interest-refresh' : 'boosted-refresh', interestMarkets: [market], boostedMarkets: [market],
      feeDistributionVaults: [] }, logger, null);
    const fee = await estimator.estimateFee(method);
    feeCache.set(key, { fee, at: Date.now() });
    return fee;
  };

  async function discover() {
    const found = await discoverGroups(settings, pins, freshContext());
    const plan = await planAdmission(found.active, { feeOf, config, maxJobFeeStroops: settings.maxJobFeeStroops,
      interestIntervalMs: settings.interestIntervalMs, boostedIntervalMs: settings.boostedIntervalMs });
    jobs.apply(plan.admitted, clientFor);
    for (const key of Object.keys(status.interest)) if (!jobs.interestClients.has(key)) delete status.interest[key];
    for (const key of Object.keys(status.refresh)) if (!jobs.refreshClients.has(key)) delete status.refresh[key];
    Object.assign(status, { feeBudget: plan.budget });
    status.groups = {
      active: plan.admitted.map(group => ({ id: group.id, interestMarkets: group.interestMarkets, boostedMarkets: group.boostedMarkets,
        routerHash: group.routerHash, unattestedBoosted: group.unattestedBoosted })),
      skipped: found.skipped, deferred: plan.deferred, skippedJobs: plan.skippedJobs,
      interestMarkets: [...jobs.interestMarkets], boostedMarkets: [...jobs.boostedMarkets],
    };
    Object.assign(status.discovery, { lastSuccess: Date.now(), lastError: null, groupCount: found.groupCount });
    const level = found.skipped.length || plan.deferred.length || plan.skippedJobs.length ? 'warn' : 'info';
    logger[level]('group discovery complete', { groups: plan.admitted.map(g => g.id), skipped: found.skipped, deferred: plan.deferred,
      skippedJobs: plan.skippedJobs, unattestedBoosted: plan.admitted.flatMap(g => g.unattestedBoosted),
      interestJobs: jobs.interestMarkets.length, boostedJobs: jobs.boostedMarkets.length, feeBudget: plan.budget });
    if (!plan.budget.sufficient) logger.error('fee limits cannot sustain the admitted jobs', plan.budget);
  }

  const health = createStatusServer(status, publicUpkeepStatus);
  let stopping = false, wake;
  const clients = () => [base, ...jobs.interestClients.values(), ...jobs.refreshClients.values()];
  const stop = signal => { stopping = true; status.stopping = true; clients().forEach(c => { c.stopped = true; }); wake?.(); logger.info('shutdown requested', { signal }); };
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => stop(signal));
  let nextDiscoveryAt = 0;
  try {
    requireSafe((await server.getNetwork()).passphrase === settings.networkPassphrase, 'RPC network mismatch');
    await new Promise((resolve, reject) => { health.once('error', reject); health.listen(settings.port, settings.host, resolve); });
    logger.info('upkeep service started', { dryRun: config.dryRun, selection: status.selection, intervals: status.intervals, maxJobFeeStroops: String(config.maxTransactionFeeStroops) });
    while (!stopping) {
      const started = Date.now();
      let cycleFailed = false;
      try {
        requireSafe((await server.getNetwork()).passphrase === settings.networkPassphrase, 'RPC network mismatch');
        // Discovery first: it only reads and simulates, and it fills the journal's allowed-controller list, which a
        // restart needs in order to recognise and reconcile an intent left pending by the previous run.
        if (Date.now() >= nextDiscoveryAt) {
          try { await discover(); nextDiscoveryAt = Date.now() + settings.discoveryIntervalMs; }
          catch (error) {
            if (error.fatal) throw error;
            // Keep the previous attested set; per-signature re-attestation still protects every transaction.
            cycleFailed = true; nextDiscoveryAt = Date.now() + 30_000; status.discovery.lastError = 'Group discovery failed';
            logger.warn('group discovery failed; keeping the previous set', { detail: String(error.message).slice(0, 200) });
          }
        }
        await base.reconcile();
        for (const [run, clientsMap, jobStatus, intervalMs] of [
          [refreshBoostedMarkets, jobs.refreshClients, status.refresh, settings.boostedIntervalMs],
          [refreshInterestMarkets, jobs.interestClients, status.interest, settings.interestIntervalMs],
        ]) {
          try { await run({ clients: clientsMap, status: jobStatus, dryRun: config.dryRun, intervalMs }); }
          catch (error) { if (error.fatal) throw error; cycleFailed = true; logger.warn('some upkeep jobs failed; they back off and retry'); }
        }
        status.lastError = cycleFailed ? 'Discovery or an upkeep job failed' : null;
        if (!cycleFailed) status.lastSuccessfulCycle = Date.now();
        logger.info('upkeep cycle complete', { interestJobs: jobs.interestMarkets.length, boostedJobs: jobs.boostedMarkets.length, failed: cycleFailed });
      } catch (error) {
        status.lastError = error.fatal ? 'Signing stopped; transaction reconciliation or operator review required' : 'Read or simulation failed';
        const hash = /[a-f0-9]{64}/.exec(String(error.message))?.[0];
        logger.error('upkeep cycle failed', { error: status.lastError, detail: String(error.message).slice(0, 200), ...(hash ? { hash } : {}) });
        if (error.fatal) { status.fatal = true; process.exitCode = 1; break; }
        cycleFailed = true;
      }
      if (config.runOnce) {
        const covered = jobs.interestMarkets.length > 0, allRan = [...Object.values(status.interest), ...Object.values(status.refresh)].every(job => job.lastRun && !job.failures);
        if (!covered || cycleFailed || !allRan) process.exitCode = 1;
        break;
      }
      await new Promise(resolve => { const timer = setTimeout(resolve, Math.max(0, config.pollIntervalMs - (Date.now() - started))); wake = () => { clearTimeout(timer); resolve(); }; });
      wake = undefined;
    }
  } finally {
    status.stopping = true;
    await new Promise(resolve => health.close(resolve));
    await journal?.close();
  }
}
main().catch(error => {
  console.error(JSON.stringify({ level: 'error', message: 'Startup failed. Verify deployment manifest, group selection, RPC network, account and journal configuration. Credentials are omitted.',
    detail: String(error?.message ?? error).slice(0, 160) }));
  process.exitCode = 1;
});
