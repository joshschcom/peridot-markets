import test from 'node:test';
import assert from 'node:assert/strict';
import { getRpc, readContractRaw, invalidateContractReads, isDefinitivelyExpired, withWalletLock } from './rpc';
const pending = { hash: 'hash', method: 'supply', contractId: 'contract', maxTime: 1000, submissionLedger: 100 };
const result = { status: 'NOT_FOUND', latestLedger: 150, latestLedgerCloseTime: 1001, oldestLedger: 90 };
test('unseen transaction expires only with complete RPC history beyond its time bound', () => {
  assert.equal(isDefinitivelyExpired(pending, result), true);
  assert.equal(isDefinitivelyExpired(pending, { ...result, oldestLedger: 101 }), false);
  assert.equal(isDefinitivelyExpired(pending, { ...result, latestLedgerCloseTime: 1000 }), false);
  assert.equal(isDefinitivelyExpired(pending, { ...result, latestLedger: 99 }), false);
  assert.equal(isDefinitivelyExpired(pending, { ...result, status: 'SUCCESS' }), false);
  assert.equal(isDefinitivelyExpired({ ...pending, maxTime: undefined }, result), false);
  assert.equal(isDefinitivelyExpired({ ...pending, submissionLedger: undefined }, result), false);
});

test('wallet lock rejects competing tabs and releases after a rejected signature', async () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  let held = false;
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { locks: { request: async (_name: string, _options: unknown, callback: (lock: unknown) => Promise<unknown>) => {
    if (held) return callback(null);
    held = true;
    try { return await callback({}); } finally { held = false; }
  } } } });
  try {
    let release!: () => void;
    const first = withWalletLock('owner', () => new Promise<void>(resolve => { release = resolve; }));
    await assert.rejects(withWalletLock('owner', async () => undefined), /Another tab/);
    release(); await first;
    await assert.rejects(withWalletLock('owner', async () => { throw new Error('Signature rejected'); }), /Signature rejected/);
    assert.equal(await withWalletLock('owner', async () => 'available'), 'available');
  } finally {
    if (original) Object.defineProperty(globalThis, 'navigator', original);
    else Reflect.deleteProperty(globalThis, 'navigator');
  }
});


test('simultaneous identical reads coalesce, while settled values and failures are never cached', async () => {
  const { nativeToScVal } = await import('@stellar/stellar-sdk');
  const { network } = await import('./network');
  const originalUrl=network.rpcUrl;
  Object.defineProperty(network,'rpcUrl',{value:'https://rpc.example.invalid',configurable:true});
  const client=getRpc(), originalNetwork=client.getNetwork, originalSimulate=client.simulateTransaction;
  let calls=0, complete!:(value:unknown)=>void;
  client.getNetwork=async()=>({passphrase:network.passphrase,protocolVersion:'29'});
  client.simulateTransaction=(()=>{calls++;return new Promise(resolve=>{complete=value=>resolve(value as Awaited<ReturnType<typeof client.simulateTransaction>>);});}) as typeof client.simulateTransaction;
  const contract='CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA';
  const tick=()=>new Promise(resolve=>setTimeout(resolve,230));
  try {
    const first=readContractRaw(contract,'symbol'), second=readContractRaw(contract,'symbol');
    await tick();assert.equal(calls,1);
    const beforeMutation=complete;
    invalidateContractReads();
    const afterMutation=readContractRaw(contract,'symbol');await tick();assert.equal(calls,2);
    const afterMutationComplete=complete;
    beforeMutation({result:{retval:nativeToScVal('XLM')},transactionData:{},minResourceFee:'0',events:[]});
    await Promise.all([first,second]);
    const coalescedAfterMutation=readContractRaw(contract,'symbol');await tick();assert.equal(calls,2);
    afterMutationComplete({result:{retval:nativeToScVal('XLM')},transactionData:{},minResourceFee:'0',events:[]});
    await Promise.all([afterMutation,coalescedAfterMutation]);
    const next=readContractRaw(contract,'symbol');await tick();assert.equal(calls,3);
    complete({error:'temporary RPC failure'});await assert.rejects(next,/temporary RPC failure/);
    const retry=readContractRaw(contract,'symbol');await tick();assert.equal(calls,4);
    complete({result:{retval:nativeToScVal('XLM')},transactionData:{},minResourceFee:'0',events:[]});await retry;
  } finally {client.getNetwork=originalNetwork;client.simulateTransaction=originalSimulate;Object.defineProperty(network,'rpcUrl',{value:originalUrl,configurable:true});}
});
