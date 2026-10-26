import test from 'node:test';
import assert from 'node:assert/strict';
import { decodeResultCode, describeTxError, humanizeTxError, looksRaw, rawMessage } from './humanize-tx-error';

const HOST_PREFIX = 'Simulation failed: HostError: Error(WasmVm, InvalidAction)\nEvent log (newest first):\n   0: [Diagnostic Event] contract:CCTF..., topics:[error, Error(WasmVm, InvalidAction)], data:["VM call trapped with HostError", ';

test('core panic strings map to plain sentences', () => {
  assert.equal(describeTxError(`${HOST_PREFIX}"supply cap exceeded"]`).kind, 'supply-cap');
  assert.equal(describeTxError(`${HOST_PREFIX}"deposit paused"]`).kind, 'paused');
  assert.equal(describeTxError(`${HOST_PREFIX}"borrow paused"]`).kind, 'paused');
  assert.equal(describeTxError(`${HOST_PREFIX}"boosted health cache stale"]`).kind, 'stale-boosted');
  assert.match(humanizeTxError(`${HOST_PREFIX}"boosted health cache stale"]`), /Refresh the market first/);
  assert.equal(describeTxError(`${HOST_PREFIX}"Not enough liquidity"]`).kind, 'liquidity');
  assert.equal(describeTxError(`${HOST_PREFIX}"Insufficient collateral"]`).kind, 'collateral');
  assert.equal(describeTxError(`${HOST_PREFIX}"Insufficient pTokens"]`).kind, 'balance');
  assert.equal(describeTxError(`${HOST_PREFIX}"market not entered"]`).kind, 'not-entered');
});

test('footprint timing, SAC balance and trustline diagnostics are recognised', () => {
  const footprint = 'The transaction failed on chain: HostError: Error(Storage, ExceededLimit) ... "storage exceeded_limit" SupplyIndex';
  assert.equal(describeTxError(footprint).kind, 'footprint');
  assert.match(humanizeTxError(footprint), /Try again in a few seconds/);
  assert.equal(describeTxError('HostError: Error(Contract, #10) ... "resulting balance is not sufficient to spend"').kind, 'balance');
  assert.equal(describeTxError('HostError: Error(Contract, #13) ... ["trustline entry is missing for account", GABC]').kind, 'trustline');
  assert.equal(describeTxError('Error(Contract, #13) from a different contract').kind, 'raw', 'a bare #13 without the SAC diagnostic is not mapped');
});

test('wallet rejections, blocked popups, expiry and rate limits', () => {
  assert.equal(describeTxError(new Error('User declined access')).kind, 'cancelled');
  assert.equal(describeTxError('Action rejected by user').kind, 'cancelled');
  assert.equal(describeTxError({ message: 'The user rejected this request' }).kind, 'cancelled');
  assert.equal(describeTxError('Popup blocked by the browser').kind, 'popup');
  assert.equal(describeTxError('Transaction review expired. Review the action again.').kind, 'expired');
  assert.equal(describeTxError('HTTP 429 Too Many Requests').kind, 'rate-limit');
  assert.equal(describeTxError('Archived contract data must be restored before this transaction.').kind, 'archived');
});

test('a rejected submission decodes its TransactionResult XDR into a specific reason', () => {
  assert.equal(decodeResultCode('Transaction rejected: AAAAAAAAAGT////9AAAAAA=='), 'txTooLate');
  assert.equal(decodeResultCode('Transaction rejected: AAAAAAAAAGT////5AAAAAA=='), 'txInsufficientBalance');
  assert.equal(decodeResultCode('Transaction rejected: AAAAAAAAAGT////7AAAAAA=='), 'txBadSeq');
  assert.equal(decodeResultCode('Transaction rejected: AAAAAAAAAGT////vAAAAAA=='), 'txSorobanInvalid');
  assert.equal(decodeResultCode('Transaction rejected: not-xdr'), null);
  assert.equal(decodeResultCode('Transaction rejected: Check balances, limits and permissions.'), null);
  assert.equal(describeTxError('Transaction rejected: AAAAAAAAAGT////9AAAAAA==').kind, 'expired');
  assert.match(humanizeTxError('Transaction rejected: AAAAAAAAAGT////5AAAAAA=='), /enough XLM/);
  assert.equal(describeTxError('Transaction rejected: AAAAAAAAAGT////vAAAAAA==').kind, 'footprint');
});

test('app sentences and unknown errors pass through unchanged', () => {
  const own = 'Another tab is handling this wallet. Finish or close that operation before continuing.';
  assert.equal(humanizeTxError(own), own);
  assert.equal(describeTxError(own).kind, 'raw');
  const unknown = 'Something new happened';
  assert.equal(humanizeTxError(new Error(unknown)), unknown);
  assert.equal(rawMessage(42), '42');
  assert.equal(rawMessage(new Error('')), 'Error');
  assert.equal(describeTxError(own).raw, own);
});

test('looksRaw separates machine output from sentences', () => {
  assert.equal(looksRaw('HostError: Error(Contract, #4)'), true);
  assert.equal(looksRaw('Transaction rejected: AAAAAAAAAGT////9AAAAAA=='), false, 'short XDR alone is not enough; the decoder handles it');
  assert.equal(looksRaw('x'.repeat(300)), true);
  assert.equal(looksRaw('Connect your wallet first.'), false);
});
