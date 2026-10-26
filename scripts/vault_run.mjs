#!/usr/bin/env node
// Drive the vault factory and an Aquarius ladder vault from the command line (testnet or mainnet).
//   NETWORK=testnet IDENTITY=peridot-testnet-admin node scripts/vault_run.mjs create <pool> <underlying> [key=value ...]
//   ... deposit <vault> <amount_whole> | rebalance <vault> | withdraw <vault> <shares_raw|all> | state <vault> | harvest <vault>
// Reads the factory id from deployments/<network>.json. The secret key is read from the stellar-cli identity at
// run time and never printed. Mainnet needs CONFIRM_MAINNET=yes.
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
const require = createRequire(new URL('../app/package.json', import.meta.url));
const sdk = require('@stellar/stellar-sdk');
const { Keypair, Networks, TransactionBuilder, BASE_FEE, Contract, rpc, nativeToScVal, scValToNative, Address, xdr } = sdk;

const NETWORK = process.env.NETWORK ?? 'testnet';
const IDENTITY = process.env.IDENTITY ?? (() => { throw new Error('set IDENTITY'); })();
if (NETWORK === 'mainnet' && process.env.CONFIRM_MAINNET !== 'yes') throw new Error('refusing mainnet without CONFIRM_MAINNET=yes');
const RPC = process.env.RPC_URL ?? (NETWORK === 'mainnet' ? 'https://soroban-rpc.mainnet.stellar.gateway.fm' : 'https://soroban-testnet.stellar.org');
const PASS = NETWORK === 'mainnet' ? Networks.PUBLIC : Networks.TESTNET;
const dep = JSON.parse(readFileSync(new URL(`../deployments/${NETWORK}.json`, import.meta.url), 'utf8'));
const kp = Keypair.fromSecret(execFileSync('stellar', ['keys', 'secret', IDENTITY], { encoding: 'utf8' }).trim());
const server = new rpc.Server(RPC);
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function call(contractId, method, args, { send = true } = {}) {
  const account = await server.getAccount(kp.publicKey());
  const tx = new TransactionBuilder(account, { fee: '2000000', networkPassphrase: PASS }).addOperation(new Contract(contractId).call(method, ...args)).setTimeout(180).build();
  const sim = await server.simulateTransaction(tx);
  if (!rpc.Api.isSimulationSuccess(sim)) throw new Error(`simulation failed: ${sim.error ?? JSON.stringify(sim)}`);
  const ret = sim.result?.retval ? scValToNative(sim.result.retval) : undefined;
  if (!send) return { value: ret, sim };
  const prepared = rpc.assembleTransaction(tx, sim).build();
  prepared.sign(kp);
  const r = await server.sendTransaction(prepared);
  if (r.status === 'ERROR') throw new Error(`send error ${r.errorResult?.toXDR('base64')}`);
  let res;
  for (let i = 0; i < 60; i++) { res = await server.getTransaction(r.hash); if (res.status !== 'NOT_FOUND') break; await sleep(1500); }
  if (res.status !== 'SUCCESS') throw new Error(`tx ${r.hash} ${res.status}`);
  const cost = sim.cost ? { cpu: sim.cost.cpuInsns, mem: sim.cost.memBytes } : {};
  console.log(JSON.stringify({ method, hash: r.hash, ledger: res.ledger, ...cost, minResourceFee: sim.minResourceFee }));
  return { value: res.returnValue ? scValToNative(res.returnValue) : undefined, hash: r.hash };
}
const addr = a => new Address(a).toScVal();
const u32 = n => nativeToScVal(n, { type: 'u32' });
const i128 = n => nativeToScVal(BigInt(n), { type: 'i128' });
const raw = (whole, dec = 7) => { const [w, f = ''] = String(whole).split('.'); return BigInt(w + f.padEnd(dec, '0').slice(0, dec)); };

const [cmd, ...rest] = process.argv.slice(2);
const me = kp.publicKey();
const defaults = { rungs: 5, width: 2, step: 2, shape: 1, recenter: 3, cooldown: 300, fee: 1000, cap: '1000000', slippage: 100 };
if (cmd === 'create') {
  const [pool, underlying, ...kv] = rest;
  const o = { ...defaults, ...Object.fromEntries(kv.map(s => s.split('='))) };
  const init = [addr(me), addr(pool), addr(underlying), addr(o.keeper ?? me), u32(+o.rungs), u32(+o.width), u32(+o.step), u32(+o.shape), u32(+o.recenter), u32(+o.cooldown), u32(+o.fee), i128(raw(o.cap)), u32(+o.slippage)];
  const r = await call(dep.vault_factory, 'create_vault', [addr(me), nativeToScVal('aquarius', { type: 'symbol' }), nativeToScVal(randomBytes(32), { type: 'bytes' }), xdr.ScVal.scvVec(init)]);
  console.log('VAULT', r.value);
} else if (cmd === 'deposit') {
  const r = await call(rest[0], 'deposit_underlying', [addr(me), i128(raw(rest[1])), i128(0)]);
  console.log('SHARES', r.value);
} else if (cmd === 'rebalance') {
  // Ladder maintenance is staged over several transactions (pool operations are expensive): repeat until nothing is left.
  for (let i = 0; i < 12; i++) {
    const r = await call(rest[0], 'rebalance', [addr(me)]); console.log('STEP', i + 1, r.value);
    await sleep(2500);
    if (!(await call(rest[0], 'needs_rebalance', [], { send: false })).value) break;
  }
} else if (cmd === 'harvest') {
  const r = await call(rest[0], 'harvest', [addr(me), i128(0)]); console.log('AQUA', r.value);
} else if (cmd === 'withdraw') {
  const sh = rest[1] === 'all' ? (await call(rest[0], 'balance', [addr(me)], { send: false })).value : BigInt(rest[1]);
  const r = await call(rest[0], 'redeem', [addr(me), i128(sh), i128(0)]); console.log('OUT', r.value);
} else if (cmd === 'state') {
  for (const m of ['get_state', 'get_rungs', 'get_idle', 'total_supply']) console.log(m, JSON.stringify((await call(rest[0], m, [], { send: false })).value, (k, v) => typeof v === 'bigint' ? v.toString() : v));
  console.log('my_shares', (await call(rest[0], 'balance', [addr(me)], { send: false })).value);
} else throw new Error('unknown command');
