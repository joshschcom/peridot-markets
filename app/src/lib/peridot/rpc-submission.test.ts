import test from 'node:test';
import assert from 'node:assert/strict';
import {Account,Asset,Keypair,Operation,Transaction,TransactionBuilder} from '@stellar/stellar-sdk';
import {network} from './network';
import {getRpc,getPendingTransaction,reconcilePendingTransaction,rpcRead,submitPreparedTrustline,UnknownTransactionError} from './rpc';

test('prepared classic path journals before one send, confirms, and never retries an uncertain submission',async()=>{
 const originalUrl=network.rpcUrl;Object.defineProperty(network,'rpcUrl',{value:'https://rpc.example.invalid',configurable:true});
 const client=getRpc(),methods=['getNetwork','getAccount','getLatestLedger','sendTransaction','getTransaction'] as const;
 const originals=Object.fromEntries(methods.map(method=>[method,client[method]]));
 const originalWindow=Object.getOwnPropertyDescriptor(globalThis,'window'),originalNavigator=Object.getOwnPropertyDescriptor(globalThis,'navigator');
 const storage=new Map<string,string>();
 Object.defineProperty(globalThis,'window',{configurable:true,value:{localStorage:{getItem:(key:string)=>storage.get(key)??null,setItem:(key:string,value:string)=>storage.set(key,value),removeItem:(key:string)=>storage.delete(key)}}});
 Object.defineProperty(globalThis,'navigator',{configurable:true,value:{locks:{request:async(_name:string,_options:unknown,run:(lock:unknown)=>Promise<unknown>)=>run({})}}});
 const key=Keypair.random(),address=key.publicKey(),asset=new Asset('USD',Keypair.random().publicKey());
 const tx=new TransactionBuilder(new Account(address,'7'),{fee:'100',networkPassphrase:network.passphrase}).addOperation(Operation.changeTrust({asset})).setTimeout(180).build();
 const hash=Buffer.from(tx.hash()).toString('hex');let sends=0,signatures=0,uncertain=false,expired=false;
 Object.assign(client,{
  getNetwork:async()=>({passphrase:network.passphrase,protocolVersion:'29'}),
  getAccount:async()=>new Account(address,'7'),getLatestLedger:async()=>({sequence:100}),
  sendTransaction:async()=>{sends++;assert.equal(getPendingTransaction(address)?.hash,hash);if(uncertain)throw new Error('connection lost');return{status:'PENDING',hash};},
  getTransaction:async()=>uncertain?{status:'NOT_FOUND',latestLedger:101,oldestLedger:90,latestLedgerCloseTime:expired?Number(tx.timeBounds!.maxTime)+1:Number(tx.timeBounds!.maxTime)-1}:{status:'SUCCESS',hash,ledger:101},
 });
 const signer={address,signTransaction:async(xdr:string)=>{signatures++;const signed=TransactionBuilder.fromXDR(xdr,network.passphrase) as Transaction;signed.sign(key);return signed.toXDR();}};
 try{
  const progress:string[]=[];
  const result=await submitPreparedTrustline({token:asset.contractId(network.passphrase),validate:()=>tx,signer,onProgress:p=>progress.push(p.status)});
  assert.equal(result.hash,hash);assert.equal(result.ledger,101);assert.equal(sends,1);assert.equal(getPendingTransaction(address),null);
  assert.deepEqual(progress,['simulating','signing','submitting','confirming','success']);
  uncertain=true;
  await assert.rejects(submitPreparedTrustline({token:asset.contractId(network.passphrase),validate:()=>tx,signer}),UnknownTransactionError);
  assert.equal(sends,2);assert.equal(signatures,2);assert.equal(getPendingTransaction(address)?.hash,hash);
  await assert.rejects(submitPreparedTrustline({token:asset.contractId(network.passphrase),validate:()=>tx,signer}),UnknownTransactionError);
  assert.equal(sends,2);assert.equal(signatures,2);
  expired=true;assert.equal(await reconcilePendingTransaction(address),'expired');assert.equal(getPendingTransaction(address),null);
  await assert.rejects((rpcRead as unknown as (m:string,...a:unknown[])=>Promise<unknown>)('sendTransaction',tx),/Only approved read/);assert.equal(sends,2);
 }finally{
  Object.assign(client,originals);Object.defineProperty(network,'rpcUrl',{value:originalUrl,configurable:true});
  if(originalWindow)Object.defineProperty(globalThis,'window',originalWindow);else Reflect.deleteProperty(globalThis,'window');
  if(originalNavigator)Object.defineProperty(globalThis,'navigator',originalNavigator);else Reflect.deleteProperty(globalThis,'navigator');
 }
});
