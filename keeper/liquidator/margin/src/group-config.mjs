import { requireSafe } from './safety.mjs';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { Account, Contract, Networks, StrKey, TransactionBuilder, nativeToScVal, rpc, scValToNative } from '@stellar/stellar-sdk';

function contract(value, label) {
  if (typeof value !== 'string' || !StrKey.isValidContract(value)) throw new Error(`${label} must be a verified contract address`);
  return value;
}
function hash(value, label) {
  if (!/^[a-f0-9]{64}$/.test(value ?? '')) throw new Error(`${label} must be a 64-character lowercase Wasm hash`);
  return value;
}
export function groupSettings(env = process.env) {
  const network = env.NETWORK || 'mainnet';
  if (!['mainnet', 'testnet'].includes(network)) throw new Error('NETWORK must be mainnet or testnet');
  if (!/^\d+$/.test(env.GROUP_ID ?? '') || !Number.isSafeInteger(Number(env.GROUP_ID)) || Number(env.GROUP_ID) > 4294967295) {
    throw new Error('GROUP_ID must be an explicit u32 group ID');
  }
  const dryRun = env.DRY_RUN === undefined || env.DRY_RUN === '' ? true : env.DRY_RUN === 'true' || env.DRY_RUN === '1';
  if (env.DRY_RUN && !['true','false','1','0'].includes(env.DRY_RUN)) throw new Error('DRY_RUN must be true or false');
  const rpcUrl = env.RPC_URL || (network === 'testnet' ? 'https://soroban-testnet.stellar.org' : '');
  if (!rpcUrl) throw new Error('RPC_URL is required for mainnet');
  const parsed = new URL(rpcUrl);
  if (parsed.protocol !== 'https:') throw new Error('RPC_URL must use HTTPS');
  const networkPassphrase = network === 'mainnet' ? Networks.PUBLIC : Networks.TESTNET;
  if (env.NETWORK_PASSPHRASE && env.NETWORK_PASSPHRASE !== networkPassphrase) throw new Error('NETWORK_PASSPHRASE conflicts with NETWORK');
  const interval = Number(env.BOOSTED_REFRESH_INTERVAL_MS || '120000');
  if (!Number.isSafeInteger(interval) || interval < 30000 || interval > 180000) throw new Error('BOOSTED_REFRESH_INTERVAL_MS must be 30000..180000');
  const interestInterval = Number(env.INTEREST_REFRESH_INTERVAL_MS || '120000');
  if (!Number.isSafeInteger(interestInterval) || interestInterval < 30000 || interestInterval > 180000) throw new Error('INTEREST_REFRESH_INTERVAL_MS must be 30000..180000');
  const port = Number(env.PORT || '8787');
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be 1..65535');
  return {
    network, groupId: Number(env.GROUP_ID), dryRun, rpcUrl, networkPassphrase, refreshIntervalMs: interval, interestIntervalMs: interestInterval,
    host: env.HOST || '127.0.0.1', port,
    horizonUrl: env.HORIZON_URL || (network === 'mainnet' ? 'https://horizon.stellar.org' : 'https://horizon-testnet.stellar.org'),
    deploymentsFile: env.DEPLOYMENTS_FILE || fileURLToPath(new URL(`../../../../deployments/${network}.json`, import.meta.url)),
  };
}
export function validateManifest(manifest, settings) {
  if (manifest.network !== settings.network) throw new Error('Deployment manifest network mismatch');
  const admin = manifest.admin;
  if (admin !== undefined && (typeof admin !== 'string' || !(StrKey.isValidEd25519PublicKey(admin) || StrKey.isValidContract(admin)))) throw new Error('manifest.admin must be a valid public address');
  return {
    admin,
    factory: contract(manifest.factory, 'manifest.factory'),
    marginFactory: contract(manifest.margin_factory, 'manifest.margin_factory'),
    marginHash: hash(manifest.wasm?.margin || manifest.wasm?.margin_audited, 'manifest.wasm.margin'),
    receiptHash: hash(manifest.wasm?.receipt_vault, 'manifest.wasm.receipt_vault'),
    lendingHash: hash(manifest.wasm?.controller, 'manifest.wasm.controller'),
    priceRouterHash: hash(manifest.wasm?.price_router, 'manifest.wasm.price_router'),
  };
}
/** The deployment account may supply a public address for simulation, never the live keeper key. */
export function assertDedicatedKeeper(config, group) {
  if (config.dryRun) return;
  requireSafe(typeof group.admin === 'string' && (StrKey.isValidEd25519PublicKey(group.admin) || StrKey.isValidContract(group.admin)), 'Live signing requires a valid deployment manifest admin');
  requireSafe(config.publicKey !== group.admin, 'Use a dedicated keeper key, not the deployment manifest admin');
}
export async function readView(server, passphrase, contractId, method, args = []) {
  const tx = new TransactionBuilder(new Account('GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF', '0'), {
    fee: '100', networkPassphrase: passphrase,
  }).addOperation(new Contract(contractId).call(method, ...args)).setTimeout(60).build();
  const result = await server.simulateTransaction(tx);
  if (!rpc.Api.isSimulationSuccess(result) || !result.result) throw new Error(`Cannot read ${method}; RPC simulation did not succeed`);
  return scValToNative(result.result.retval);
}
export function validateGroup(group, margin, groupId) {
  if (Number(group?.id) !== groupId) throw new Error('Factory returned a different group ID');
  const controllerId = contract(group.margin_controller, 'group.margin_controller');
  if (margin?.controller !== controllerId) throw new Error('Margin factory and market factory disagree on controller');
  const variant = Array.isArray(margin.variant) ? margin.variant[0] : margin.variant?.tag;
  if (variant !== 'Audited') throw new Error('Phase 1 worker only supports the pinned Audited margin variant');
  if (!Array.isArray(group.markets) || group.markets.length > 100) throw new Error('Invalid group markets');
  const markets = [...new Set(group.markets.map(value => contract(value, 'group market')))];
  return { controllerId, markets, lendingController: contract(group.controller, 'group.controller') };
}
export async function resolveGroup(settings, env = process.env, dependencies = {}) {
  const manifest = JSON.parse(await (dependencies.readFile || readFile)(settings.deploymentsFile, 'utf8'));
  const pins = validateManifest(manifest, settings);
  if (env.FACTORY_ID && env.FACTORY_ID !== pins.factory) throw new Error('FACTORY_ID conflicts with deployment manifest');
  if (env.EXPECTED_CONTROLLER_WASM_HASH && env.EXPECTED_CONTROLLER_WASM_HASH !== pins.marginHash) throw new Error('Controller Wasm hash conflicts with deployment manifest');
  const server = dependencies.server || new rpc.Server(settings.rpcUrl, { timeout: 15000 });
  if ((await server.getNetwork()).passphrase !== settings.networkPassphrase) throw new Error('RPC network mismatch');
  const read = dependencies.readView || ((id, method, args) => readView(server, settings.networkPassphrase, id, method, args));
  const args = [nativeToScVal(settings.groupId, { type: 'u32' })];
  const group = await read(pins.factory, 'get_group', args);
  const margin = await read(pins.marginFactory, 'get_margin', args);
  const resolved = validateGroup(group, margin, settings.groupId);
  if (env.MARGIN_CONTROLLER_ID && env.MARGIN_CONTROLLER_ID !== resolved.controllerId) throw new Error('MARGIN_CONTROLLER_ID does not belong to selected group');
  const boostedMarkets = [];
  const boostedVaults = {};
  for (const market of resolved.markets) {
    const boosted = await read(market, 'get_boosted_vault', []);
    if (boosted !== undefined && boosted !== null) {
      contract(boosted, 'boosted vault');
      boostedMarkets.push(market);
      boostedVaults[market] = boosted;
    }
  }
  return { ...resolved, boostedMarkets, boostedVaults, priceRouter:contract(group.price_router,'group.price_router'), swapAdapter:contract(margin.swap_adapter,'margin.swap_adapter'), ...pins };
}

/** A topology change invalidates discovery coverage and the approved signing scope. */
export async function assertGroupUnchanged(settings, expected, dependencies = {}) {
  const current = await resolveGroup(settings, {}, dependencies);
  const fingerprint = group => JSON.stringify({
    factory:group.factory,marginFactory:group.marginFactory,admin:group.admin,controller:group.controllerId,
    lending:group.lendingController,router:group.priceRouter,swapAdapter:group.swapAdapter,
    marginHash:group.marginHash,lendingHash:group.lendingHash,receiptHash:group.receiptHash,priceRouterHash:group.priceRouterHash,
    markets:[...group.markets].sort(),boosted:Object.entries(group.boostedVaults).sort(([a],[b])=>a.localeCompare(b)),
  });
  requireSafe(fingerprint(current) === fingerprint(expected), 'Group markets, controllers or yield routes changed; restart to rediscover coverage');
}
