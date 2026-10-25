import test from 'node:test';
import assert from 'node:assert/strict';
import { Address, nativeToScVal, xdr } from '@stellar/stellar-sdk';
import { describeLaunchpadError } from './errors';
import { cursorLedger, decodeCurveEvent, estimateStartLedger } from './testnet-rpc';

const CURVE = 'CAIA6FUZGSY4454KNTOYQ3MT7CGTQMUZBOWUP2C3JNXXH44QPT3B5EFT';
const FACTORY = 'CBYQC54BS5HIWEO6KQNVGZ6XRNOTG3OMT6UZYBUD2NESGHBQMALGSBWC';
const USER = 'GAXGGPKR2K3PXRVHSVN654AIRQDPETWDSRPDTGV4Q7ZUFY66VRM7TNYT';
const diagnostic = (contract: string, code: number, fn: string) => new Error(`Unable to read ${fn}: HostError: Error(Contract, #${code})\n\nEvent log (newest first):\n   0: [Diagnostic Event] contract:${contract}, topics:[error, Error(Contract, #${code})], data:"escalating Ok(ScErrorType::Contract) frame-exit to Err"\n   1: [Diagnostic Event] topics:[fn_call, ${contract}, ${fn}], data:1000000000\n`);

test('contract errors are mapped by the failing contract, not by the code alone', () => {
  const roles = { [FACTORY]: 'factory' as const, [CURVE]: 'curve' as const };
  assert.match(describeLaunchpadError(diagnostic(CURVE, 13, 'quote_buy'), roles), /Trading is closed/);
  assert.match(describeLaunchpadError(diagnostic(FACTORY, 10, 'get_launch'), roles), /not launched through/);
  assert.match(describeLaunchpadError(diagnostic(CURVE, 10, 'buy'), roles), /amount above zero/);
  assert.match(describeLaunchpadError(diagnostic(CURVE, 12, 'buy'), roles), /slippage/);
  assert.match(describeLaunchpadError(diagnostic(CURVE, 15, 'buy'), roles), /creator cap/);
  // A creator buy inside launch_curve fails in the curve: the newest diagnostic entry names the curve.
  const nested = new Error(`Simulation failed: HostError: Error(Contract, #15)\n\nEvent log (newest first):\n   0: [Diagnostic Event] contract:${CURVE}, topics:[error, Error(Contract, #15)], data:"x"\n   1: [Diagnostic Event] contract:${FACTORY}, topics:[error, Error(Contract, #15)], data:"x"`);
  assert.match(describeLaunchpadError(nested, roles), /creator cap/);
  // Without a contract id the fallback role decides.
  assert.match(describeLaunchpadError(new Error('HostError: Error(Contract, #19)'), roles, 'curve'), /target has not been reached/);
  assert.equal(describeLaunchpadError(new Error('RPC unavailable'), roles), 'RPC unavailable');
  assert.match(describeLaunchpadError(new Error(`contract:${CURVE}, topics:[error, Error(Contract, #13)], data:["trustline entry is missing for account", ${USER}]`), roles), /trustline/);
});

test('curve events decode into trades and history entries', () => {
  const sym = (s: string) => xdr.ScVal.scvSymbol(s);
  const map = (entries: Record<string, xdr.ScVal>) => xdr.ScVal.scvMap(Object.entries(entries).sort(([a], [b]) => a < b ? -1 : 1).map(([key, val]) => new xdr.ScMapEntry({ key: sym(key), val })));
  const i128 = (v: bigint) => nativeToScVal(v, { type: 'i128' });
  const buy = decodeCurveEvent({ topic: [sym('buy'), new Address(USER).toScVal()], value: map({ quote_in: i128(2_000_000_000n), fee: i128(20_000_000n), tokens_out: i128(5_673_449_576_406_545n), clamped: xdr.ScVal.scvBool(true), real_quote: i128(1_980_000_000n), sold: i128(5_673_449_576_406_545n) }), txHash: 'abc', ledger: 5386848, ledgerClosedAt: '2026-10-25T19:50:27Z' });
  assert.deepEqual(buy.trade, { kind: 'buy', user: USER, quote: 2_000_000_000n, tokens: 5_673_449_576_406_545n, fee: 20_000_000n, clamped: true, hash: 'abc', ledger: 5386848, at: '2026-10-25T19:50:27Z' });
  const sell = decodeCurveEvent({ topic: [sym('sell'), new Address(USER).toScVal()], value: map({ tokens_in: i128(10n), quote_out: i128(5n), fee: i128(1n), real_quote: i128(0n), sold: i128(0n) }), txHash: 'def', ledger: 2, ledgerClosedAt: 't' });
  assert.equal(sell.trade?.kind, 'sell');
  assert.equal(sell.trade?.quote, 5n);
  assert.equal(sell.trade?.tokens, 10n);
  assert.equal(sell.trade?.clamped, false);
  const grad = decodeCurveEvent({ topic: [sym('graduated'), new Address(CURVE).toScVal()], value: map({ pool: new Address(CURVE).toScVal(), group_id: nativeToScVal(1, { type: 'u32' }) }), txHash: 'ghi', ledger: 3, ledgerClosedAt: 't' });
  assert.equal(grad.trade, undefined);
  assert.equal(grad.history?.name, 'graduated');
  assert.equal(grad.history?.data.group_id, 1);
});

test('event scan start is estimated from the launch time and clamped to the RPC window', () => {
  // Launch 12,380 seconds before the latest close: about 2,476 ledgers plus the margin.
  assert.equal(estimateStartLedger(1_792_957_812, 5_389_330, 1_792_970_192, 5_268_371), 5_389_330 - 2_476 - 300);
  assert.equal(estimateStartLedger(1_700_000_000, 5_389_330, 1_792_970_192, 5_268_371), 5_268_371, 'older than the window clamps to the oldest ledger');
  assert.equal(estimateStartLedger(1_792_970_192, 5_389_330, 1_792_970_192, 5_268_371), 5_389_030);
  assert.equal(cursorLedger('0023147000392318975-4294967295'), 5389330);
  assert.equal(cursorLedger('garbage'), 0);
});
