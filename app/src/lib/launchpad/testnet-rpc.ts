/** A read-only Soroban RPC client pinned to TESTNET. A mainnet build of the app uses it to show launchpad data
 * without touching the mainnet client in lib/peridot/rpc.ts; nothing here can sign or submit. The curve event
 * scan is shared by both testnet modes (it takes the server to use). */
import { Account, BASE_FEE, Contract, TransactionBuilder, rpc, scValToNative, xdr } from '@stellar/stellar-sdk';
import { ReadScheduler, isRateLimited } from '@/lib/peridot/read-scheduler';
import { TESTNET_PASSPHRASE, TESTNET_RPC_URL } from './config';
import type { CurveActivity, HistoryEvent, Trade } from './types';

const SIMULATION_SOURCE = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF';
let server: rpc.Server | undefined;
let verified: Promise<void> | undefined;
/** Lazily created so importing this module never performs network setup during prerendering. */
export function testnetRpc(): rpc.Server {
  server ??= new rpc.Server(TESTNET_RPC_URL, { timeout: 30_000, allowHttp: TESTNET_RPC_URL.startsWith('http://localhost') || TESTNET_RPC_URL.startsWith('http://127.0.0.1') });
  return server;
}
async function assertTestnet(): Promise<void> {
  verified ??= testnetRpc().getNetwork().then(result => {
    if (result.passphrase !== TESTNET_PASSPHRASE) throw new Error('The configured testnet RPC does not serve the Stellar testnet.');
  }).catch(error => { verified = undefined; throw error; });
  return verified;
}
const scheduler = new ReadScheduler();
const inflight = new Map<string, Promise<xdr.ScVal>>();
/** Coalesces only simultaneous identical reads, like lib/peridot/rpc.ts. */
export function readTestnetRaw(contractId: string, method: string, args: xdr.ScVal[] = []): Promise<xdr.ScVal> {
  const key = JSON.stringify([contractId, method, args.map(arg => arg.toXDR('base64'))]);
  const existing = inflight.get(key);
  if (existing) return existing;
  const request = perform(contractId, method, args).finally(() => { if (inflight.get(key) === request) inflight.delete(key); });
  inflight.set(key, request);
  return request;
}
async function perform(contractId: string, method: string, args: xdr.ScVal[]): Promise<xdr.ScVal> {
  await assertTestnet();
  const tx = new TransactionBuilder(new Account(SIMULATION_SOURCE, '0'), { fee: BASE_FEE, networkPassphrase: TESTNET_PASSPHRASE })
    .addOperation(new Contract(contractId).call(method, ...args)).setTimeout(120).build();
  let result: Awaited<ReturnType<rpc.Server['simulateTransaction']>>;
  for (let attempt = 0; ; attempt++) {
    try { result = await scheduler.run(() => testnetRpc().simulateTransaction(tx)); break; }
    catch (error) {
      if (!isRateLimited(error) || attempt >= 2) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
    }
  }
  if (!rpc.Api.isSimulationSuccess(result) || !result.result) {
    // Keep the host diagnostic verbatim: the error mappers parse `contract:..., topics:[error, Error(Contract, #N)]`.
    throw new Error(`Unable to read ${method}: ${'error' in result ? result.error : 'No result returned.'}`);
  }
  return result.result.retval;
}
export async function readTestnet<T>(contractId: string, method: string, args: xdr.ScVal[] = []): Promise<T> {
  return scValToNative(await readTestnetRaw(contractId, method, args)) as T;
}

/** Testnet closes a ledger about every five seconds; used only to pick a conservative scan start. */
const LEDGER_SECONDS = 5;
const SCAN_MARGIN_LEDGERS = 300;
const MAX_EVENT_PAGES = 8;
const PAGE_LIMIT = 200;
export function cursorLedger(cursor: string): number {
  // Event cursors are TOIDs: the ledger sequence sits in the top 32 bits of the first number.
  const head = cursor.split('-')[0];
  return /^\d+$/.test(head) ? Number(BigInt(head) >> 32n) : 0;
}
/** Estimate the ledger at which a launch happened from its creation timestamp, clamped to the RPC window. */
export function estimateStartLedger(createdAt: number, latestLedger: number, latestCloseTime: number, oldestLedger: number): number {
  const elapsed = Math.max(0, latestCloseTime - createdAt);
  const estimate = latestLedger - Math.ceil(elapsed / LEDGER_SECONDS) - SCAN_MARGIN_LEDGERS;
  return Math.min(latestLedger, Math.max(oldestLedger, estimate, 1));
}
function native(value: xdr.ScVal): unknown { try { return scValToNative(value); } catch { return undefined; } }
function asBigint(value: unknown): bigint { return typeof value === 'bigint' ? value : typeof value === 'number' ? BigInt(value) : 0n; }
/** Decodes one contract event of the curve into a trade or a history entry. Exported for tests. */
export function decodeCurveEvent(event: { topic: xdr.ScVal[]; value: xdr.ScVal; txHash: string; ledger: number; ledgerClosedAt: string }): { trade?: Trade; history?: HistoryEvent } {
  const name = String(native(event.topic[0]) ?? '');
  const data = (native(event.value) ?? {}) as Record<string, unknown>;
  const base = { hash: event.txHash, ledger: event.ledger, at: event.ledgerClosedAt };
  if ((name === 'buy' || name === 'sell') && data && typeof data === 'object') {
    const user = String(native(event.topic[1]) ?? '');
    return { trade: {
      kind: name,
      user,
      quote: asBigint(name === 'buy' ? data.quote_in : data.quote_out),
      tokens: asBigint(name === 'buy' ? data.tokens_out : data.tokens_in),
      fee: asBigint(data.fee),
      clamped: name === 'buy' && data.clamped === true,
      ...base,
    } };
  }
  return { history: { name, data: data && typeof data === 'object' ? data : {}, ...base } };
}
/** Scans the curve's contract events forward from the launch, paging with the RPC cursor. The RPC scans about
 * 10,000 ledgers per request, so a token launched days ago needs several pages; the scan stops after
 * `MAX_EVENT_PAGES` and reports `partial`. */
export async function fetchCurveActivity(server: rpc.Server, curve: string, createdAt: number): Promise<CurveActivity> {
  const health = await server.getHealth();
  // The RPC reports the latest close time, but the SDK type omits it; the wall clock is within seconds of it.
  const closeTime = Number((health as { latestLedgerCloseTime?: string | number }).latestLedgerCloseTime ?? Math.floor(Date.now() / 1000));
  const startLedger = estimateStartLedger(createdAt, health.latestLedger, closeTime, health.oldestLedger);
  const filters = [{ type: 'contract' as const, contractIds: [curve] }];
  const trades: Trade[] = [];
  const history: HistoryEvent[] = [];
  let cursor: string | undefined;
  let partial = true;
  for (let page = 0; page < MAX_EVENT_PAGES; page++) {
    const response = await server.getEvents(cursor ? { cursor, filters, limit: PAGE_LIMIT } : { startLedger, filters, limit: PAGE_LIMIT });
    for (const event of response.events) {
      const decoded = decodeCurveEvent(event);
      if (decoded.trade) trades.push(decoded.trade);
      else if (decoded.history) history.push(decoded.history);
    }
    if (!response.cursor || cursorLedger(response.cursor) >= response.latestLedger) { partial = false; break; }
    cursor = response.cursor;
  }
  trades.sort((a, b) => b.ledger - a.ledger);
  history.sort((a, b) => b.ledger - a.ledger);
  return { trades, history, partial };
}
