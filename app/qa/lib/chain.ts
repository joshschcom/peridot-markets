/** Harness SETUP helpers (not app code): friendbot, mint, direct invokes used only to prepare balances. */
import { Keypair, TransactionBuilder, Contract, Address, rpc, nativeToScVal, scValToNative, xdr, Account, BASE_FEE } from '@stellar/stellar-sdk';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { QA } from './bootstrap';
import { network } from '../../src/lib/peridot/network';
import { getRpc } from '../../src/lib/peridot/rpc';

const SECRETS = resolve(QA, '.secrets/accounts.json');
export function loadAccounts(): Record<string, string> { return existsSync(SECRETS) ? JSON.parse(readFileSync(SECRETS, 'utf8')) : {}; }
export function saveAccounts(a: Record<string, string>) { mkdirSync(resolve(QA, '.secrets'), { recursive: true }); writeFileSync(SECRETS, JSON.stringify(a, null, 2), { mode: 0o600 }); }
export const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
/** Friendbot budget is 5 accounts for the whole QA run; the count is persisted in the secrets file. */
export async function getOrCreateAccount(label: string): Promise<Keypair> {
  if (network.name !== 'testnet') throw new Error('QA: friendbot is testnet only');
  const all = loadAccounts();
  if (all[label]) return Keypair.fromSecret(all[label]);
  const used = Object.keys(all).length;
  if (used >= 5) throw new Error('friendbot budget (5 accounts) exhausted');
  const kp = Keypair.random();
  all[label] = kp.secret(); saveAccounts(all);
  for (let i = 0; i < 4; i++) {
    const r = await fetch(`https://friendbot.stellar.org/?addr=${kp.publicKey()}`);
    if (r.ok) break;
    if (i === 3) throw new Error(`friendbot failed: ${r.status} ${(await r.text()).slice(0, 200)}`);
    await sleep(3000);
  }
  return kp;
}
export async function xlmBalance(addr: string): Promise<bigint> {
  const sac = (await import('./bootstrap')).TESTNET_EXTERNAL.xlm;
  return invokeRead<bigint>(sac, 'balance', [new Address(addr).toScVal()]);
}
export async function invokeRead<T>(contract: string, method: string, args: xdr.ScVal[] = []): Promise<T> {
  const tx = new TransactionBuilder(new Account('GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF', '0'), { fee: BASE_FEE, networkPassphrase: network.passphrase })
    .addOperation(new Contract(contract).call(method, ...args)).setTimeout(60).build();
  const sim = await getRpc().simulateTransaction(tx);
  if (!rpc.Api.isSimulationSuccess(sim) || !sim.result) throw new Error(`read ${method}: ${(sim as any).error ?? 'no result'}`);
  return scValToNative(sim.result.retval) as T;
}
/** Direct (non-app) invoke for balance setup. */
export async function setupInvoke(kp: Keypair, contract: string, method: string, args: xdr.ScVal[]): Promise<string> {
  if (network.name !== 'testnet') throw new Error('QA: setupInvoke is testnet only');
  const server = getRpc();
  const account = await server.getAccount(kp.publicKey());
  const tx = new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase: network.passphrase }).addOperation(new Contract(contract).call(method, ...args)).setTimeout(120).build();
  const sim = await server.simulateTransaction(tx);
  if (!rpc.Api.isSimulationSuccess(sim)) throw new Error(`setup ${method}: ${(sim as any).error}`);
  const prepared = rpc.assembleTransaction(tx, sim).build();
  prepared.sign(kp);
  const sent = await server.sendTransaction(prepared);
  if (sent.status === 'ERROR') throw new Error(`setup ${method} rejected: ${sent.errorResult?.toXDR('base64')}`);
  for (let i = 0; i < 60; i++) {
    const r = await server.getTransaction(sent.hash);
    if (r.status === 'SUCCESS') return sent.hash;
    if (r.status === 'FAILED') throw new Error(`setup ${method} failed on chain`);
    await sleep(1500);
  }
  throw new Error('setup timeout');
}
export const i128 = (v: bigint) => nativeToScVal(v, { type: 'i128' });
export const u128 = (v: bigint) => nativeToScVal(v, { type: 'u128' });
export const addrV = (a: string) => new Address(a).toScVal();
