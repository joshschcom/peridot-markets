import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { Account, BASE_FEE, Contract, Networks, StrKey, TransactionBuilder, rpc, scValToNative } from '@stellar/stellar-sdk';

const selected = process.argv[2];
if (!['mainnet', 'testnet'].includes(selected)) throw new Error('Usage: node scripts/sync-deployments.mjs mainnet|testnet');
const root = new URL('../../', import.meta.url);
const board = await readFile(new URL('docs/COORDINATION.md', root), 'utf8');
if (!new RegExp(`\\[A\\][^\\n]*READY: ${selected} phase-1`).test(board)) throw new Error(`Lead A has not announced ${selected} phase-1 readiness.`);
const source = JSON.parse(await readFile(new URL(`deployments/${selected}.json`, root), 'utf8'));
if (source.network !== selected) throw new Error('Manifest network mismatch.');
for (const key of ['factory', 'margin_factory']) if (!StrKey.isValidContract(source[key] || '')) throw new Error(`Invalid ${key}.`);
if (!/^[a-f0-9]{40}$/i.test(source.core_commit || '')) throw new Error('Missing pinned core commit.');
if (!source.external || typeof source.external !== 'object') throw new Error('Manifest needs verified external integration addresses.');
for (const key of ['controller', 'receipt_vault', 'jump_rate', 'price_router', 'reward_distributor', 'margin', 'swap_adapter']) {
  if (!/^[a-f0-9]{64}$/i.test(source.wasm?.[key] || '')) throw new Error(`Invalid Wasm pin: ${key}.`);
}
const rpcUrl = selected === 'mainnet' ? process.env.NEXT_PUBLIC_MAINNET_RPC_URL : process.env.NEXT_PUBLIC_TESTNET_RPC_URL || 'https://soroban-testnet.stellar.org';
if (!rpcUrl) throw new Error('Set NEXT_PUBLIC_MAINNET_RPC_URL to a browser-safe endpoint.');
const client = new rpc.Server(rpcUrl);
const passphrase = selected === 'mainnet' ? Networks.PUBLIC : Networks.TESTNET;
if ((await client.getNetwork()).passphrase !== passphrase) throw new Error('RPC network mismatch.');
async function read(contractId, method) {
  const tx = new TransactionBuilder(new Account('GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF', '0'), { fee: BASE_FEE, networkPassphrase: passphrase })
    .addOperation(new Contract(contractId).call(method)).setTimeout(120).build();
  const result = await client.simulateTransaction(tx);
  if (!rpc.Api.isSimulationSuccess(result) || !result.result) throw new Error(`Read-only ${method} verification failed.`);
  return scValToNative(result.result.retval);
}
const [factoryWasm, marginWasm] = await Promise.all([read(source.factory, 'get_wasm'), read(source.margin_factory, 'get_wasm')]);
for (const key of ['controller', 'receipt_vault', 'jump_rate', 'price_router', 'reward_distributor']) {
  if (!(factoryWasm[key] instanceof Uint8Array) || Buffer.from(factoryWasm[key]).toString('hex') !== source.wasm[key].toLowerCase()) throw new Error(`Onchain ${key} differs from manifest.`);
}
for (const [key, field] of [['margin', 'audited'], ['swap_adapter', 'swap_adapter']]) {
  if (!(marginWasm[field] instanceof Uint8Array) || Buffer.from(marginWasm[field]).toString('hex') !== source.wasm[key].toLowerCase()) throw new Error(`Onchain ${key} differs from manifest.`);
}
// Copy only public deployment fields; never carry arbitrary deployment-runner metadata.
const publicManifest = Object.fromEntries(['network', 'core_commit', 'factory', 'margin_factory', 'wasm', 'external', 'swap_adapter', 'demo'].filter(key => source[key] !== undefined).map(key => [key, source[key]]));
const output = new URL(`app/src/lib/peridot/deployments/${selected}.json`, root);
await writeFile(output, JSON.stringify(publicManifest, null, 2) + '\n');
console.log(`Verified network and registered Wasm pins; updated ${fileURLToPath(output)}. No transaction was submitted.`);
