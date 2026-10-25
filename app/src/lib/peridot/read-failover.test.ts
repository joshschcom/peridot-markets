import test from 'node:test';
import assert from 'node:assert/strict';
import {ReadFailover,isReadTransportFailure} from './read-failover';
const unavailable=()=>Object.assign(new Error('Service unavailable'),{response:{status:503}});

test('successful primary read never consults fallback or verification',async()=>{
 let primary=0,fallback=0,verified=0;
 const reader=new ReadFailover(async()=>{verified++;});
 assert.equal(await reader.run(async()=>{primary++;return 'primary';},async()=>{fallback++;return 'fallback';}),'primary');
 assert.deepEqual({primary,fallback,verified},{primary:1,fallback:0,verified:0});
});

test('transport failure falls back once, verifies once and observes cooldown before probing primary',async()=>{
 let now=1000,primary=0,fallback=0,verified=0;
 const reader=new ReadFailover(async()=>{verified++;},30_000,()=>now);
 const primaryRead=async()=>{primary++;throw unavailable();};
 const fallbackRead=async()=>{fallback++;return 'fallback';};
 assert.equal(await reader.run(primaryRead,fallbackRead),'fallback');
 now=30_999;
 assert.equal(await reader.run(primaryRead,fallbackRead),'fallback');
 assert.deepEqual({primary,fallback,verified},{primary:1,fallback:2,verified:1});
 now=31_000;
 assert.equal(await reader.run(async()=>{primary++;return 'recovered';},fallbackRead),'recovered');
 assert.deepEqual({primary,fallback,verified},{primary:2,fallback:2,verified:1});
});

test('fallback network mismatch rejects without executing the fallback read and can be reverified',async()=>{
 let verified=0,reads=0;
 const wrongNetwork=new Error('RPC network does not match mainnet.');
 const reader=new ReadFailover(async()=>{verified++;if(verified===1)throw wrongNetwork;});
 const primary=async()=>{throw unavailable();},fallback=async()=>{reads++;return 7;};
 await assert.rejects(reader.run(primary,fallback),error=>error===wrongNetwork);
 assert.equal(reads,0);
 assert.equal(await reader.run(primary,fallback),7);
 assert.equal(verified,2);
});

test('concurrent fallbacks share network verification',async()=>{
 let verified=0,release!:()=>void;
 const reader=new ReadFailover(()=>{verified++;return new Promise<void>(resolve=>{release=resolve;});});
 const first=reader.run(async()=>{throw unavailable();},async()=>1);
 const second=reader.run(async()=>{throw unavailable();},async()=>2);
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(verified,1);release();
 assert.deepEqual(await Promise.all([first,second]),[1,2]);
});

test('contract, authorization and cancellation errors remain unchanged without fallback',async()=>{
 for(const error of [new Error('Error(Contract, #13)'),{code:-32000,message:'simulation failed'},Object.assign(new Error('Unauthorised'),{response:{status:401}}),Object.assign(new Error('User cancelled'),{name:'AbortError'})]){
  let called=false;
  const reader=new ReadFailover(async()=>{called=true;});
  await assert.rejects(reader.run(async()=>{throw error;},async()=>{called=true;return 1;}),actual=>actual===error);
  assert.equal(called,false);
 }
});

test('fallback transport failure is preserved and next request can recover on primary',async()=>{
 let primary=0,fallback=0;
 const reader=new ReadFailover(async()=>{});
 const error=Object.assign(new Error('Network unavailable'),{code:'ERR_NETWORK'});
 await assert.rejects(reader.run(async()=>{primary++;throw unavailable();},async()=>{fallback++;throw error;}),actual=>actual===error);
 assert.equal(await reader.run(async()=>{primary++;return 3;},async()=>{fallback++;return 4;}),3);
 assert.deepEqual({primary,fallback},{primary:2,fallback:1});
});

test('fallback semantic errors do not retry primary during cooldown',async()=>{
 let primary=0;
 const reader=new ReadFailover(async()=>{});
 const primaryRead=async()=>{primary++;throw unavailable();};
 const error=new Error('Error(Contract, #1)');
 await assert.rejects(reader.run(primaryRead,async()=>{throw error;}),actual=>actual===error);
 assert.equal(await reader.run(primaryRead,async()=>2),2);
 assert.equal(primary,1);
});

test('transport classifier accepts explicit transient failures only',()=>{
 for(const error of [{response:{status:408}},{response:{status:429}},{response:{status:500}},{response:{status:599}},{code:'ETIMEDOUT'},{code:'ERR_NETWORK'},new TypeError('Failed to fetch'),new TypeError('Load failed'),{name:'TimeoutError'}])assert.equal(isReadTransportFailure(error),true);
 for(const error of [null,undefined,'503',new Error('timeout'),new TypeError('Invalid XDR'),{code:-32602},{response:{status:400}},{response:{status:401}},{response:{status:404}},{response:{status:600}},{response:{status:'503'}},{response:{status:503,data:{error:{code:-32000}}}},{name:'AbortError'},{code:'ERR_CANCELED'}])assert.equal(isReadTransportFailure(error),false);
});
