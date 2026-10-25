import { loadConfig } from './config.mjs';
import { estimateRefreshBudget, assertSustainableBudget } from './budget.mjs';
import { groupSettings, resolveGroup, assertGroupUnchanged, assertDedicatedKeeper, readView } from './group-config.mjs';
import { MarginLiquidationKeeper } from './keeper.mjs';
import { loadState, saveState } from './state.mjs';
import { StellarClient } from './stellar.mjs';
import { openJournal } from './journal.mjs';
import { requireSafe, verifyController } from './safety.mjs';
import { createStatusState, createStatusServer } from './status.mjs';
import { refreshBoostedMarkets, refreshInterestMarkets, interestReady } from './refresh.mjs';
import { lendingSettings, loadLendingState, saveLendingState, LendingLiquidationKeeper, assertLendingEconomics } from './lending.mjs';

async function main() {
const settings = groupSettings();
const group = await resolveGroup(settings);
// Canonical network and factory-resolved addresses replace old reference defaults.
Object.assign(process.env, {
  DRY_RUN: String(settings.dryRun), NETWORK_PASSPHRASE: settings.networkPassphrase,
  RPC_URL: settings.rpcUrl, HORIZON_URL: settings.horizonUrl,
  MARGIN_CONTROLLER_ID: group.controllerId, EXPECTED_CONTROLLER_WASM_HASH: group.marginHash,
});
const config = loadConfig();
assertDedicatedKeeper(config, group);
config.verifyGroup = () => assertGroupUnchanged(settings, group);
config.stateFile = process.env.STATE_FILE || `./data/${settings.network}-group-${settings.groupId}.json`;
config.allowedControllers = [group.controllerId, group.lendingController, ...group.markets];
const lendingConfig = lendingSettings(process.env, group, settings);
const lendingState = await loadLendingState(lendingConfig);
if (config.feeDistributionVaults.some(vault => !group.markets.includes(vault))) throw new Error('Fee distribution vault is outside the selected group');
const status = createStatusState(settings, group);
status.lending = { ready: false, discoveryLag: null, borrowers: lendingState.borrowers.length, capitalConfigured: Object.keys(lendingConfig.repayCaps).length > 0 };
let cycleReadFailure = false;
const logger = Object.fromEntries(['info','warn','error'].map(level => [level, (message, fields = {}) => {
  if (level === 'error') cycleReadFailure = true;
  if (fields.hash) status.lastTx = { hash: fields.hash, ledger: fields.ledger ?? null, time: Date.now(), action: message };
  console[level === 'info' ? 'log' : level](JSON.stringify({ level, time: new Date().toISOString(), groupId: settings.groupId, message, ...fields }));
}]));
const state = await loadState(config.stateFile);
state.initialized = false;
const journal = config.dryRun ? null : await openJournal(config);
const client = new StellarClient(config, logger, journal);
const refreshClients = new Map(group.boostedMarkets.map(market => [market, new StellarClient({ ...config,
  controllerId: market, expectedControllerHash: group.receiptHash, role: 'boosted-refresh', feeDistributionVaults: [],
}, { ...logger, info: (message, fields) => logger.info(message, { vault: market, ...fields }) }, journal)]));
const interestClients = new Map(group.markets.map(market => [market, new StellarClient({ ...config,
  controllerId:market, expectedControllerHash:group.receiptHash, receiptHash:group.receiptHash,
  role:'interest-refresh', interestMarkets:group.markets, feeDistributionVaults:[],
}, { ...logger, info:(message,fields)=>logger.info(message,{vault:market,...fields}) }, journal)]));
const lendingClient = new StellarClient({ ...config, controllerId: group.lendingController, expectedControllerHash: group.lendingHash,
  role: 'lending-liquidation', lendingMarkets: group.markets, lendingRepayCaps: lendingConfig.repayCaps, receiptHash: group.receiptHash,
}, logger, journal);
const lending = new LendingLiquidationKeeper(lendingConfig, group, lendingClient,
  (id, method, args) => readView(lendingClient.server, config.networkPassphrase, id || group.lendingController, method, args),
  lendingState, () => saveLendingState(lendingConfig.stateFile, lendingState), logger, status.lending);
lendingClient.config.validateLendingCall = async args => {
  const { scValToNative } = await import('@stellar/stellar-sdk');
  await verifyController(lendingClient.server, { ...config, controllerId:group.priceRouter, expectedControllerHash:group.priceRouterHash });
  return assertLendingEconomics({ repayMarket:scValToNative(args[1]), collateralMarket:scValToNative(args[2]), repayAmount:scValToNative(args[3]),
    read:lending.read, priceRouter:group.priceRouter, settings:lendingConfig });
};
const keeper = new MarginLiquidationKeeper(config, client, state, () => saveState(config.stateFile, state), logger);
const health = createStatusServer(status);
let stopping = false;
let wake;
function stop(signal) {
  stopping = true; status.stopping = true; client.stopped = true; lendingClient.stopped = true;
  for (const c of [...refreshClients.values(),...interestClients.values()]) c.stopped = true;
  wake?.(); logger.info('shutdown requested', { signal });
}
for (const signal of ['SIGINT','SIGTERM']) process.once(signal, () => stop(signal));
try {
  // Startup attestation also applies to dry runs, before any worker action.
  await verifyController(client.server, config);
  await verifyController(lendingClient.server, lendingClient.config);
  await verifyController(client.server, { ...config, controllerId:group.priceRouter, expectedControllerHash:group.priceRouterHash });
  for (const market of group.markets) await verifyController(client.server, { ...config, controllerId: market, expectedControllerHash: group.receiptHash });
  status.feeBudget = await estimateRefreshBudget({refreshClients,interestClients,settings,config});
  logger[status.feeBudget.sufficient?'info':'warn']('scheduled fee budget estimate', status.feeBudget);
  assertSustainableBudget(status.feeBudget,config.dryRun);
  await new Promise((resolve,reject) => { health.once('error', reject); health.listen(settings.port, settings.host, resolve); });
  logger.info('group liquidator started', { controllerId: config.controllerId, dryRun: config.dryRun, boostedMarkets: group.boostedMarkets });
  while (!stopping) {
    const started = Date.now();
    cycleReadFailure = false;
    try {
      requireSafe((await client.server.getNetwork()).passphrase === config.networkPassphrase, 'RPC network mismatch');
      await config.verifyGroup();
      await client.reconcile();
      let refreshFailed = false;
      try { await refreshBoostedMarkets({ clients: refreshClients, status: status.refresh, dryRun: config.dryRun, intervalMs: settings.refreshIntervalMs }); }
      catch (error) { if (error.fatal) throw error; refreshFailed = true; logger.warn('boosted refresh failed; liquidation reads will still be attempted'); }
      await refreshInterestMarkets({clients:interestClients,status:status.interest,dryRun:config.dryRun,intervalMs:settings.interestIntervalMs});
      if (!interestReady(group.markets,status.interest,config.dryRun)) throw new Error('Interest accrual coverage is not current');
      await keeper.runCycle();
      await lending.runCycle();
      status.activePositions = state.activePositionIds.length;
      if (!refreshFailed && !cycleReadFailure && status.lending.ready) { status.lastSuccessfulCycle = Date.now(); status.lastError = null; }
      else status.lastError = refreshFailed ? 'Boosted value refresh failed' : !status.lending.ready ? 'Lending discovery or capital configuration is incomplete' : 'Position or fee read/simulation failed';
      logger.info('group cycle complete', { activePositions: status.activePositions, dryRun: config.dryRun });
    } catch (error) {
      status.lastError = error.fatal ? 'Signing stopped; transaction reconciliation or operator review required' : 'Read or simulation failed';
      const hash = /[a-f0-9]{64}/.exec(String(error.message))?.[0];
      logger.error('group cycle failed', { error: status.lastError, ...(hash ? { hash } : {}) });
      if (error.fatal) { status.fatal = true; process.exitCode = 1; break; }
    }
    if (config.runOnce) { if (status.lastSuccessfulCycle === null) process.exitCode = 1; break; }
    await new Promise(resolve => { const timer = setTimeout(resolve, Math.max(0, config.pollIntervalMs - (Date.now() - started))); wake = () => { clearTimeout(timer); resolve(); }; });
    wake = undefined;
  }
} finally {
  status.stopping = true;
  await new Promise(resolve => health.close(resolve));
  try { await saveState(config.stateFile, state); await saveLendingState(lendingConfig.stateFile, lendingState); } finally { await journal?.close(); }
}

}
main().catch(() => {
  console.error(JSON.stringify({ level: "error", message: "Startup failed. Verify deployment manifest, group, RPC network, account and journal configuration. Credentials are omitted." }));
  process.exitCode = 1;
});
