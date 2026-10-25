import test from 'node:test';
import assert from 'node:assert/strict';
import {WalletRequest} from './request';

test('opens synchronously in the invoking user gesture',async()=>{
 const request=new WalletRequest();let opened=false;
 const result=request.run(()=>{opened=true;return Promise.resolve('account');});
 assert.equal(opened,true);assert.equal(await result,'account');
});
test('cancellation ignores a late popup result and permits a new request',async()=>{
 const request=new WalletRequest();let late!:(value:string)=>void;
 const first=request.run(()=>new Promise<string>(resolve=>{late=resolve;}));
 request.cancel();await assert.rejects(first,/cancelled/);
 const second=request.run(()=>Promise.resolve('new account'));
 late('old account');assert.equal(await second,'new account');
});
test('closed or blocked popup cannot leave connecting indefinitely',async()=>{
 const request=new WalletRequest();
 await assert.rejects(request.run(()=>new Promise(()=>{}),5),/did not respond/);
 assert.equal(await request.run(()=>Promise.resolve('retry')),'retry');
});
test('a concurrent request is rejected without opening another popup',async()=>{
 const request=new WalletRequest();let opened=false;
 assert.equal(request.isBusy,false);
 const first=request.run(()=>new Promise(()=>{}));
 assert.equal(request.isBusy,true);
 await assert.rejects(request.run(()=>{opened=true;return Promise.resolve();}),/already open/);
 assert.equal(opened,false);assert.equal(request.isBusy,true);
 request.cancel();assert.equal(request.isBusy,false);await assert.rejects(first,/cancelled/);
});
