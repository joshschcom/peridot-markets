#!/usr/bin/env node
// Create / use an xoxno-vault through the vault-factory (init_args is a Vec<Val>, which the stellar CLI cannot
// encode, so this uses the JS SDK). Run from the repo root:
//   NETWORK=testnet node scripts/xoxno_vault.mjs create  --identity ID --owner G.. --depositor G.. --asset C.. [--hub 1 --spoke 1 --cap 1000 --min 1 --fee 1000 --keeper G..]
//   NETWORK=testnet node scripts/xoxno_vault.mjs deposit --identity ID --vault C.. --amount 10
//   NETWORK=testnet node scripts/xoxno_vault.mjs withdraw --identity ID --vault C.. --shares-pct 100
//   NETWORK=testnet node scripts/xoxno_vault.mjs show --vault C..
// Amounts are in whole tokens (7 decimals). Mainnet needs CONFIRM_MAINNET=yes. Secrets are read via
// `stellar keys secret` and never printed.
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
const require = createRequire(new URL('../app/package.json', import.meta.url));
const sdk = require('@stellar/stellar-sdk');
const { Address, Keypair, TransactionBuilder, Operation, nativeToScVal, scValToNative, rpc, xdr, Contract, BASE_FEE } = sdk;

const net = process.env.NETWORK || 'testnet';
const cfg = net === 'mainnet'
  ? { url: process.env.MAINNET_RPC_URL || 'https://mainnet.sorobanrpc.com', pass: 'Public Global Stellar Network ; September 2015' }
  : { url: process.env.TESTNET_RPC_URL || 'https://soroban-testnet.stellar.org', pass: 'Test SDF Network ; September 2015' };
if (net === 'mainnet' && process.env.CONFIRM_MAINNET !== 'yes') { console.error('refusing mainnet without CONFIRM_MAINNET=yes'); process.exit(1); }
const dep = JSON.parse(readFileSync(new URL(`../deployments/${net}.json`, import.meta.url), 'utf8'));
const server = new rpc.Server(cfg.url);

const args = Object.fromEntries(process.argv.slice(3).reduce((a, v, i, arr) => (v.startsWith('--') ? [...a, [v.slice(2), arr[i + 1]]] : a), []));
const cmd = process.argv[2];
const sc = {
  addr: (a) => new Address(a).toScVal(),
  u32: (n) => nativeToScVal(Number(n), { type: 'u32' }),
  i128: (n) => nativeToScVal(BigInt(n), { type: 'i128' }),
};
const whole = (s) => BigInt(Math.round(Number(s) * 1e7));
function kp(identity) { return Keypair.fromSecret(execFileSync('stellar', ['keys', 'secret', identity]).toString().trim()); }

async function send(signer, contractId, fn, params, { log = true } = {}) {
  const acct = await server.getAccount(signer.publicKey());
  let tx = new TransactionBuilder(acct, { fee: BASE_FEE, networkPassphrase: cfg.pass })
    .addOperation(new Contract(contractId).call(fn, ...params)).setTimeout(120).build();
  const sim = await server.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim)) throw new Error(`${fn} simulation failed: ${sim.error}`);
  tx = rpc.assembleTransaction(tx, sim).build();
  tx.sign(signer);
  const sent = await server.sendTransaction(tx);
  if (sent.status === 'ERROR') throw new Error(`${fn} rejected: ${JSON.stringify(sent.errorResult)}`);
  let r;
  for (let i = 0; i < 60; i++) { r = await server.getTransaction(sent.hash); if (r.status !== 'NOT_FOUND') break; await new Promise(r => setTimeout(r, 1500)); }
  if (r.status !== 'SUCCESS') throw new Error(`${fn} failed: ${r.status} tx ${sent.hash}`);
  if (log) console.log(`${fn} ok tx ${sent.hash} fee ${sim.minResourceFee} stroops (min resource)`);
  return { hash: sent.hash, value: r.returnValue ? scValToNative(r.returnValue) : undefined };
}
async function view(contractId, fn, params = []) {
  const pub = Keypair.random().publicKey();
  const acct = new sdk.Account(pub, '0');
  const tx = new TransactionBuilder(acct, { fee: BASE_FEE, networkPassphrase: cfg.pass })
    .addOperation(new Contract(contractId).call(fn, ...params)).setTimeout(30).build();
  const sim = await server.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim)) throw new Error(`${fn}: ${sim.error}`);
  return scValToNative(sim.result.retval);
}

if (cmd === 'create') {
  const s = kp(args.identity);
  const owner = args.owner || s.publicKey();
  const initArgs = [
    sc.addr(owner), sc.addr(args.depositor || owner), sc.addr(args.asset), sc.u32(args.hub ?? 1), sc.u32(args.spoke ?? 1),
    sc.addr(args.keeper || owner), sc.i128(whole(args.cap ?? 1000)), sc.i128(whole(args.min ?? 1)), sc.u32(args.fee ?? 1000),
  ];
  const salt = Buffer.from(Keypair.random().rawPublicKey());
  const r = await send(s, dep.vault_factory, 'create_vault', [sc.addr(owner), nativeToScVal('xoxno', { type: 'symbol' }), xdr.ScVal.scvBytes(salt), xdr.ScVal.scvVec(initArgs)]);
  console.log('vault', r.value);
} else if (cmd === 'deposit') {
  const s = kp(args.identity);
  const amt = whole(args.amount);
  const r = await send(s, args.vault, 'deposit', [xdr.ScVal.scvVec([sc.i128(amt)]), xdr.ScVal.scvVec([sc.i128(0)]), sc.addr(s.publicKey()), nativeToScVal(true, { type: 'bool' })]);
  console.log('deposited', amt, 'returned', r.value);
} else if (cmd === 'withdraw') {
  const s = kp(args.identity);
  const bal = BigInt(await view(args.vault, 'balance', [sc.addr(s.publicKey())]));
  const shares = (bal * BigInt(args['shares-pct'] ?? 100)) / 100n;
  const r = await send(s, args.vault, 'withdraw', [sc.i128(shares), xdr.ScVal.scvVec([sc.i128(0)]), sc.addr(s.publicKey())]);
  console.log('withdrew shares', shares, 'returned', r.value);
} else if (cmd === 'harvest') {
  const s = kp(args.identity);
  const r = await send(s, args.vault, 'harvest', [sc.addr(s.publicKey()), sc.i128(0)]);
  console.log('fee value', r.value);
} else if (cmd === 'show') {
  console.log(JSON.stringify({
    params: await view(args.vault, 'params'),
    state: await view(args.vault, 'get_state'),
    account_id: await view(args.vault, 'account_id'),
  }, (k, v) => (typeof v === 'bigint' ? v.toString() : v), 2));
} else { console.error('usage: create|deposit|withdraw|harvest|show'); process.exit(1); }
