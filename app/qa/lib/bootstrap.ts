/**
 * MUST be the first import of every QA script.
 * - Selects the network for the app's lib modules (they read process.env at import time).
 * - Polyfills the few browser APIs the lib assumes (window.localStorage, navigator.locks).
 * - For testnet, overlays the app's placeholder testnet manifest (the app ships
 *   {"status":"Awaiting Lead A deployment manifest"}) with deployments/testnet.json + external ids,
 *   in memory only. The app source is never edited.
 */
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
export const REPO = resolve(here, '../../..');
export const QA = resolve(here, '..');
const net = (process.env.QA_NETWORK || 'testnet') as 'testnet' | 'mainnet';
process.env.NEXT_PUBLIC_NETWORK = net;
process.env.NEXT_PUBLIC_USE_MOCKS = 'false';
process.env.NEXT_PUBLIC_READ_ONLY = 'false';
if (net === 'mainnet') process.env.NEXT_PUBLIC_MAINNET_RPC_URL = process.env.QA_MAINNET_RPC || 'https://soroban-rpc.mainnet.stellar.gateway.fm';
else process.env.NEXT_PUBLIC_TESTNET_RPC_URL = process.env.QA_TESTNET_RPC || 'https://soroban-testnet.stellar.org';

import { writeFileSync, existsSync, mkdirSync } from 'node:fs';
const LS_FILE = resolve(QA, `.secrets/localstorage-${net}.json`);
class MemStorage {
  private m = new Map<string, string>();
  constructor() { try { if (net === 'testnet' && existsSync(LS_FILE)) for (const [k, v] of Object.entries(JSON.parse(readFileSync(LS_FILE, 'utf8')))) this.m.set(k, v as string); } catch { /* ignore */ } }
  private persist() { if (net !== 'testnet') return; try { mkdirSync(resolve(QA, '.secrets'), { recursive: true }); writeFileSync(LS_FILE, JSON.stringify(Object.fromEntries(this.m))); } catch { /* ignore */ } }
  getItem(k: string) { return this.m.has(k) ? this.m.get(k)! : null; }
  setItem(k: string, v: string) { this.m.set(k, String(v)); this.persist(); }
  removeItem(k: string) { this.m.delete(k); this.persist(); }
  clear() { this.m.clear(); this.persist(); }
  key(i: number) { return [...this.m.keys()][i] ?? null; }
  get length() { return this.m.size; }
}
export const storage = new MemStorage();
const g = globalThis as any;
g.window = g; // rpc.ts only checks typeof window !== 'undefined'
Object.defineProperty(g, 'localStorage', { value: storage, configurable: true, writable: true });
// Exclusive, ifAvailable lock semantics like the browser Web Locks API.
const held = new Set<string>();
const locks = {
  async request(name: string, opts: any, cb?: any): Promise<any> {
    const fn = cb ?? opts; const o = cb ? opts : {};
    if (held.has(name)) { if (o.ifAvailable) return fn(null); await new Promise(r => setTimeout(r, 50)); return locks.request(name, opts, cb); }
    held.add(name);
    try { return await fn({ name }); } finally { held.delete(name); }
  },
};
Object.defineProperty(g, 'navigator', { value: { locks, userAgent: 'peridot-qa-harness' }, configurable: true, writable: true });

export const deployFile = (n: string) => JSON.parse(readFileSync(resolve(REPO, `deployments/${n}.json`), 'utf8'));

/** External testnet ids from deployments/testnet.json + scripts/demo_testnet.sh (verified on chain by the harness). */
export const TESTNET_EXTERNAL = {
  reflector_stellar: 'CAVLP5DH2GJPZMVO7IJY4CVOD5MWEFTJFVPD2YY2FQXOQHRGHK4D6HLP',
  reflector_external: 'CCYOZJCOPG34LLQQ7N24YXBM7LL62R7ONMZ3G6WZAAYPB5OYKOMJRN63',
  xlm: 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC',
  usdt_mock: 'CDPXNHHVSLX3HFAHV7XOISM23MZH36WSXTO45RNDOBIDFZBGTSOVD4OY',
  usdc: 'CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA',
  aquarius_router: 'CBCFTQSPDBAIZ6R6PJQKSQWKNKWH2QIV3I4J72SHWBIK3ADRRAM5A6GD',
  xlm_usdt_pool: 'CCMNSENXDBNJSY72BDIPH5CCXLLHBKZ4LXTRKDLKZN4UI2NJFQLWTLD6',
  xlm_usdt_pool_id: '9ac7a9cde23ac2ada11105eeaa42e43c2ea8332ca0aa8f41f58d7160274d718e',
};

if (net === 'testnet') {
  const req = createRequire(import.meta.url);
  const target = req(resolve(REPO, 'app/src/lib/peridot/deployments/testnet.json'));
  const src = deployFile('testnet');
  for (const k of Object.keys(target)) delete target[k];
  const { network, core_commit, factory, margin_factory, wasm, demo } = src;
  Object.assign(target, { network, core_commit, factory, margin_factory, wasm, demo, external: { ...TESTNET_EXTERNAL } });
}

// Hard guard: no code path (app or harness) may submit a transaction to mainnet from this harness.
if (net === 'mainnet') {
  const req2 = createRequire(import.meta.url);
  const sdk = req2('@stellar/stellar-sdk');
  const proto = sdk.rpc.Server.prototype;
  proto.sendTransaction = async function () { throw new Error('QA: mainnet submission blocked by harness guard'); };
  proto.sendTransaction.__qaGuard = true;
}
