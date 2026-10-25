import { Account, Address, BASE_FEE, Contract, rpc, scValToNative, TransactionBuilder, xdr } from '@stellar/stellar-sdk';
import { network } from './network';
import { ReadScheduler, isRateLimited } from './read-scheduler';

export interface TxProgress {
  status: 'simulating' | 'signing' | 'submitting' | 'confirming' | 'success' | 'unknown' | 'error';
  hash?: string;
  message?: string;
}
export interface Signer { address: string; signTransaction: (xdr: string) => Promise<string> }
export interface TxResult<T> { hash: string; value: T; ledger: number }
export class UnknownTransactionError extends Error {
  constructor(public readonly hash: string) {
    super(`Confirmation is unavailable. Transaction ${hash} may still succeed. Check its status before trying again.`);
    this.name = 'UnknownTransactionError';
  }
}
export class TransactionRejectedError extends Error {
  constructor(public readonly hash: string, message: string) { super(message); this.name = 'TransactionRejectedError'; }
}
let server: rpc.Server | undefined;
let verifiedNetwork: Promise<void> | undefined;
export async function assertRpcNetwork(): Promise<void> {
  if (!verifiedNetwork) verifiedNetwork = getRpc().getNetwork().then(result => {
    if (result.passphrase !== network.passphrase) throw new Error('RPC network does not match the selected app network.');
  }).catch(error => { verifiedNetwork = undefined; throw error; });
  return verifiedNetwork;
}
export interface PendingTransaction { hash: string; method: string; contractId: string; maxTime?: number; submissionLedger?: number }
export function isDefinitivelyExpired(pending: PendingTransaction, result: { status: string; latestLedger: number; latestLedgerCloseTime: number; oldestLedger: number }): boolean {
  return result.status === 'NOT_FOUND' && Number.isSafeInteger(pending.maxTime) && pending.maxTime! > 0
    && Number.isSafeInteger(pending.submissionLedger) && pending.submissionLedger! > 0
    && result.oldestLedger <= pending.submissionLedger! && result.latestLedger >= pending.submissionLedger!
    && result.latestLedgerCloseTime > pending.maxTime!;
}
const locks = new Set<string>();
export async function withWalletLock<T>(address: string, action: () => Promise<T>): Promise<T> {
  if (typeof navigator === 'undefined' || !navigator.locks) throw new Error('This browser cannot coordinate wallet transactions safely. Use a current browser over HTTPS or localhost.');
  return navigator.locks.request(`peridot:wallet:${network.name}:${address}`, { mode: 'exclusive', ifAvailable: true }, async lock => {
    if (!lock) throw new Error('Another tab is handling this wallet. Finish or close that operation before continuing.');
    return action();
  });
}
function clearPending(address: string, hash: string) {
  if (getPendingTransaction(address)?.hash === hash) persistPending(address, null);
}
export function getRpc(): rpc.Server {
  if (!network.rpcUrl) throw new Error('Mainnet RPC is not configured. Set NEXT_PUBLIC_MAINNET_RPC_URL.');
  if (!server) server = new rpc.Server(network.rpcUrl, { timeout: 30_000, allowHttp: network.rpcUrl.startsWith('http://localhost') || network.rpcUrl.startsWith('http://127.0.0.1') });
  return server;
}
const pendingKey = (address: string) => `peridot:pending:${network.name}:${address}`;
export function getPendingTransaction(address: string): PendingTransaction | null {
  if (typeof window === 'undefined') return null;
  try { return JSON.parse(window.localStorage.getItem(pendingKey(address)) || 'null'); }
  catch { throw new Error('Pending transaction storage cannot be read. Enable browser storage before signing.'); }
}
function persistPending(address: string, data: PendingTransaction | null) {
  if (typeof window === 'undefined') throw new Error('Wallet transactions require a browser.');
  try {
    if (data) window.localStorage.setItem(pendingKey(address), JSON.stringify(data));
    else window.localStorage.removeItem(pendingKey(address));
  } catch { throw new Error('Pending transaction storage is unavailable. Enable browser storage before signing.'); }
}
async function reconcilePendingTransactionLocked(address: string): Promise<'none' | 'success' | 'failed' | 'unknown'> {
  const pending = getPendingTransaction(address);
  if (!pending) return 'none';
  await assertRpcNetwork();
  const result = await getRpc().getTransaction(pending.hash);
  if (result.status === 'NOT_FOUND' && !isDefinitivelyExpired(pending, result)) return 'unknown';
  clearPending(address, pending.hash);
  invalidateContractReads();
  return result.status === 'SUCCESS' ? 'success' : 'failed';
}
export async function reconcilePendingTransaction(address: string): Promise<'none' | 'success' | 'failed' | 'unknown'> {
  return withWalletLock(address, () => reconcilePendingTransactionLocked(address));
}
// Coalesce only simultaneous identical reads. Never cache settled financial state.
const readScheduler = new ReadScheduler();
const reading = new Map<string, Promise<xdr.ScVal>>();
/** A new read after a mutation must not join a simulation started before that mutation. */
export function invalidateContractReads(): void { reading.clear(); }
export function readContractRaw(contractId: string, method: string, args: xdr.ScVal[] = []): Promise<xdr.ScVal> {
  const key = JSON.stringify([network.name, contractId, method, args.map(arg => arg.toXDR('base64'))]);
  const existing = reading.get(key);
  if (existing) return existing;
  const request = performRead(contractId, method, args).finally(() => { if (reading.get(key) === request) reading.delete(key); });
  reading.set(key, request);
  return request;
}
async function performRead(contractId: string, method: string, args: xdr.ScVal[] = []): Promise<xdr.ScVal> {
  await assertRpcNetwork();
  const tx = new TransactionBuilder(new Account('GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF', '0'), {
    fee: BASE_FEE, networkPassphrase: network.passphrase,
  }).addOperation(new Contract(contractId).call(method, ...args)).setTimeout(120).build();
  let result:Awaited<ReturnType<rpc.Server['simulateTransaction']>>;
  for(let attempt=0;;attempt++){
    try{result=await readScheduler.run(()=>getRpc().simulateTransaction(tx));break;}
    catch(error){
      if(!isRateLimited(error)||attempt>=2)throw error;
      await new Promise(resolve=>setTimeout(resolve,1000*(attempt+1)));
    }
  }
  if (!rpc.Api.isSimulationSuccess(result) || !result.result) {
    throw new Error(`Unable to read ${method}: ${'error' in result ? result.error : 'No result returned.'}`);
  }
  return result.result.retval;
}
export async function readContract<T>(contractId: string, method: string, args: xdr.ScVal[] = []): Promise<T> {
  return scValToNative(await readContractRaw(contractId, method, args)) as T;
}
interface ContractInput {
  contractId: string; method: string; args?: xdr.ScVal[]; signer: Signer;
  onProgress?: (progress: TxProgress) => void;
}
export async function submitContract<T>(input: ContractInput): Promise<TxResult<T>> {
  if (network.readOnly) throw new Error('This preview is read-only. Transactions are not enabled.');
  try { return await withWalletLock(input.signer.address, () => submitContractLocked<T>(input)); }
  finally { invalidateContractReads(); }
}
async function submitContractLocked<T>(input: ContractInput): Promise<TxResult<T>> {
  const { contractId, method, signer, onProgress } = input;
  if (network.useMocks) throw new Error('Live transactions are disabled in mock mode.');
  Address.fromString(signer.address);
  const lock = `${network.name}:${signer.address}`;
  if (locks.has(lock)) throw new Error('Another wallet transaction is already in progress.');
  locks.add(lock);
  let submittedHash: string | undefined;
  try {
    const pending = getPendingTransaction(signer.address);
    if (pending) {
      const status = await reconcilePendingTransactionLocked(signer.address);
      if (status === 'unknown') throw new UnknownTransactionError(pending.hash);
      throw new Error(`The previous transaction ${status === 'success' ? 'succeeded' : 'failed'}. Refresh balances and review this action before trying again.`);
    }
    const client = getRpc();
    await assertRpcNetwork();
    onProgress?.({ status: 'simulating' });
    const account = await client.getAccount(signer.address);
    const tx = new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase: network.passphrase })
      .addOperation(new Contract(contractId).call(method, ...(input.args || []))).setTimeout(180).build();
    const simulation = await client.simulateTransaction(tx);
    if (!rpc.Api.isSimulationSuccess(simulation)) {
      throw new Error(`Simulation failed: ${'error' in simulation ? simulation.error : 'Archived contract data must be restored before this transaction.'}`);
    }
    const prepared = rpc.assembleTransaction(tx, simulation).build();
    const submissionLedger = (await client.getLatestLedger()).sequence;
    onProgress?.({ status: 'signing' });
    const signedXdr = await signer.signTransaction(prepared.toXDR());
    const signed = TransactionBuilder.fromXDR(signedXdr, network.passphrase);
    if (signed.hash().length !== prepared.hash().length || signed.hash().some((value, index) => value !== prepared.hash()[index])) throw new Error('Wallet returned a different transaction.');
    submittedHash = Array.from(signed.hash(), value => value.toString(16).padStart(2, '0')).join('');
    persistPending(signer.address, { hash: submittedHash, contractId, method, maxTime: Number(prepared.timeBounds?.maxTime), submissionLedger });
    onProgress?.({ status: 'submitting', hash: submittedHash });
    let submission: Awaited<ReturnType<rpc.Server['sendTransaction']>>;
    try { submission = await client.sendTransaction(signed); }
    catch { throw new UnknownTransactionError(submittedHash); }
    if (submission.status === 'ERROR') {
      clearPending(signer.address, submittedHash);
      throw new TransactionRejectedError(submittedHash, `Transaction rejected: ${submission.errorResult?.toXDR('base64') || 'Check balances, limits and permissions.'}`);
    }
    if (submission.status === 'TRY_AGAIN_LATER') throw new UnknownTransactionError(submittedHash);
    if (submission.hash !== submittedHash) throw new UnknownTransactionError(submittedHash);
    onProgress?.({ status: 'confirming', hash: submittedHash });
    const deadline = Date.now() + 90_000;
    while (Date.now() < deadline) {
      let result: Awaited<ReturnType<rpc.Server['getTransaction']>>;
      try { result = await client.getTransaction(submittedHash); }
      catch { await new Promise(resolve => setTimeout(resolve, 1500)); continue; }
      if (result.status === 'SUCCESS') {
        clearPending(signer.address, submittedHash);
        onProgress?.({ status: 'success', hash: submittedHash });
        return { hash: submittedHash, ledger: result.ledger, value: (result.returnValue ? scValToNative(result.returnValue) : undefined) as T };
      }
      if (result.status === 'FAILED') {
        clearPending(signer.address, submittedHash);
        onProgress?.({ status: 'error', hash: submittedHash, message: 'The transaction failed on chain.' });
        throw new Error('The transaction failed on chain. Refresh state before trying again.');
      }
      await new Promise(resolve => setTimeout(resolve, 1500));
    }
    throw new UnknownTransactionError(submittedHash);
  } catch (error) {
    onProgress?.({ status: error instanceof UnknownTransactionError ? 'unknown' : 'error', hash: error instanceof UnknownTransactionError ? error.hash : submittedHash, message: error instanceof Error ? error.message : 'Transaction failed.' });
    throw error;
  } finally { locks.delete(lock); }
}

export async function waitForLedgerBeyond(ledger: number): Promise<void> {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if ((await getRpc().getLatestLedger()).sequence > ledger) return;
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  throw new Error('The next ledger is not available yet. Refresh chain state before the next stage.');
}
