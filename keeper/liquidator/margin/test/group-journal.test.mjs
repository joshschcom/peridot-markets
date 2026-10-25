import assert from 'node:assert/strict';
import test from 'node:test';
import { EventEmitter } from 'node:events';
import { PostgresJournal } from '../src/journal.mjs';

const margin='margin-controller';
const receipt='approved-receipt';
const lending='approved-lending-controller';
function makeJournal(row) {
  const calls=[];
  const client=new EventEmitter();
  client.query=async(sql,args)=>{
    calls.push({sql,args});
    if(sql.startsWith('SELECT *'))return {rows:row?[row]:[]};
    if(sql.includes('SUM(max_fee)'))return {rows:[{reserved:'0'}]};
    return {rows:[],rowCount:1};
  };
  const journal=new PostgresJournal(client,{networkPassphrase:'test',publicKey:'public',controllerId:margin,
    allowedControllers:[margin,receipt,lending],maxTransactionFeeStroops:100n,maxFee24hStroops:1000n});
  journal.healthy=true;
  return {journal,calls};
}
test('shared journal records actual approved target and rejects contracts outside group',async()=>{
  const {journal,calls}=makeJournal();
  const record={hash:'a'.repeat(64),sequence:'1',maxTime:'100',method:'refresh_boosted_underlying',fee:'20',controllerId:receipt};
  await journal.intent(record);
  const insert=calls.find(c=>c.sql.startsWith('INSERT'));
  assert.equal(insert.args[2],receipt);
  await assert.rejects(journal.intent({...record,controllerId:'another-group'}),/not in selected group/);
});
test('restart can reconcile approved receipt intent but not an unexpected target',async()=>{
  const row={controller:receipt,status:'INTENT',hash:'b'.repeat(64)};
  assert.equal((await makeJournal(row).journal.pending()).controller,receipt);
  await assert.rejects(makeJournal({...row,controller:'another-group'}).journal.pending(),/controller mismatch/);
});

test('ordinary lending intent remains scoped in shared journal across restart',async()=>{
  const {journal,calls}=makeJournal();
  await journal.intent({hash:'c'.repeat(64),sequence:'3',maxTime:'101',method:'liquidate',fee:'25',controllerId:lending});
  assert.equal(calls.find(c=>c.sql.startsWith('INSERT')).args[2],lending);
  assert.equal((await makeJournal({controller:lending,status:'INTENT',hash:'c'.repeat(64)}).journal.pending()).controller,lending);
});
