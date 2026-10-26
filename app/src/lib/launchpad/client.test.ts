import test from 'node:test';
import assert from 'node:assert/strict';
import { Address, nativeToScVal, xdr } from '@stellar/stellar-sdk';
import { describeLaunchpadError } from './errors';
import { cursorLedger, decodeCurveEvent, estimateStartLedger } from './testnet-rpc';

const CURVE = 'CAIA6FUZGSY4454KNTOYQ3MT7CGTQMUZBOWUP2C3JNXXH44QPT3B5EFT';
const FACTORY = 'CBYQC54BS5HIWEO6KQNVGZ6XRNOTG3OMT6UZYBUD2NESGHBQMALGSBWC';
const USER = 'GAXGGPKR2K3PXRVHSVN654AIRQDPETWDSRPDTGV4Q7ZUFY66VRM7TNYT';
const diagnostic = (contract: string, code: number, fn: string) => new Error(`Unable to read ${fn}: HostError: Error(Contract, #${code})\n\nEvent log (newest first):\n   0: [Diagnostic Event] contract:${contract}, topics:[error, Error(Contract, #${code})], data:"escalating Ok(ScErrorType::Contract) frame-exit to Err"\n   1: [Diagnostic Event] topics:[fn_call, ${contract}, ${fn}], data:1000000000\n`);

const XLM = 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC';
const NEW_CURVE = 'CAC2RFMTBBSXYIPOYJKL3ZLIJH7IJJQDWZ5T2LLXOFAGNEL5JEWBXE3M';
/** Recorded from a testnet simulation of launch_curve with an over-cap creator buy (2026-10-26): the factory
 * escalates twice before the curve frame that actually failed, which the host prints last. */
const nestedLaunch = new Error(`Simulation failed: HostError: Error(Contract, #15)\n\nEvent log (newest first):\n   0: [Diagnostic Event] contract:${FACTORY}, topics:[error, Error(Contract, #15)], data:"escalating error to VM trap from failed host function call: call"\n   1: [Diagnostic Event] contract:${FACTORY}, topics:[error, Error(Contract, #15)], data:["contract call failed", buy, [${USER}, 1000000000000, 1]]\n   2: [Failed Diagnostic Event (not emitted)] contract:${NEW_CURVE}, topics:[error, Error(Contract, #15)], data:"escalating Ok(ScErrorType::Contract) frame-exit to Err"\n   3: [Diagnostic Event] contract:${FACTORY}, topics:[fn_call, ${NEW_CURVE}, buy], data:[${USER}, 1000000000000, 1]`);

test('contract errors are mapped by the innermost failing contract, not by the code alone', () => {
  const roles = { [FACTORY]: 'factory' as const, [CURVE]: 'curve' as const, [XLM]: 'sac' as const };
  assert.match(describeLaunchpadError(diagnostic(CURVE, 13, 'quote_buy'), roles), /Trading is closed/);
  assert.match(describeLaunchpadError(diagnostic(FACTORY, 10, 'get_launch'), roles), /not launched through/);
  assert.match(describeLaunchpadError(diagnostic(CURVE, 10, 'buy'), roles), /amount above zero/);
  assert.match(describeLaunchpadError(diagnostic(CURVE, 12, 'buy'), roles), /slippage/);
  assert.match(describeLaunchpadError(diagnostic(CURVE, 15, 'buy'), roles), /creator cap/);
  // launch_curve: the new curve has no address before the call, so the innermost unknown frame is read as a curve.
  assert.match(describeLaunchpadError(nestedLaunch, roles, { fallbackRole: 'factory', innerFallback: 'curve' }), /creator cap/);
  // Without the inner fallback an unknown innermost contract yields the raw message, never the outer frame's text.
  assert.equal(describeLaunchpadError(nestedLaunch, roles), nestedLaunch.message);
  // A SAC failure inside buy (XLM transfer) is reported as a balance problem, not as a curve code 10.
  const sacInside = new Error(`HostError: Error(Contract, #10)\n\nEvent log (newest first):\n   0: [Diagnostic Event] contract:${CURVE}, topics:[error, Error(Contract, #10)], data:"escalating"\n   1: [Failed Diagnostic Event (not emitted)] contract:${XLM}, topics:[error, Error(Contract, #10)], data:"balance"`);
  assert.match(describeLaunchpadError(sacInside, roles), /Insufficient balance/);
  // Without a contract id the fallback role decides.
  assert.match(describeLaunchpadError(new Error('HostError: Error(Contract, #19)'), roles, { fallbackRole: 'curve' }), /target has not been reached/);
  assert.equal(describeLaunchpadError(new Error('RPC unavailable'), roles), 'RPC unavailable');
  assert.match(describeLaunchpadError(new Error(`contract:${XLM}, topics:[error, Error(Contract, #13)], data:["trustline entry is missing for account", ${USER}]`), roles), /trustline/);
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
