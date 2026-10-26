import test from 'node:test';
import assert from 'node:assert/strict';
import {WalletRequest,WalletWindowError} from './request';

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

type FakeWindow={open:(...args:unknown[])=>unknown;focus?:()=>void};
function withWindow<T>(open:(...args:unknown[])=>unknown,body:(win:FakeWindow)=>Promise<T>):Promise<T>{
 const previous=(globalThis as {window?:unknown}).window,win:FakeWindow={open};
 (globalThis as {window?:unknown}).window=win;
 return body(win).finally(()=>{(globalThis as {window?:unknown}).window=previous;});
}
const handle=(state:{closed:boolean;focused:number;closeCalls:number})=>({get closed(){return state.closed;},focus(){state.focused++;},close(){state.closeCalls++;state.closed=true;}});

test('a blocked popup fails immediately with an actionable message and restores window.open',async()=>{
 await withWindow(()=>null,async(win)=>{
  const original=win.open,request=new WalletRequest();
  let calledSynchronously=false;
  const started=Date.now();
  const result=request.run(()=>{win.open('https://albedo.link/confirm');calledSynchronously=true;return new Promise(()=>{});},60_000,{watchPopup:true});
  assert.equal(calledSynchronously,true);
  await assert.rejects(result,(error:Error)=>error instanceof WalletWindowError&&error.kind==='blocked'&&/Allow pop-ups/.test(error.message));
  assert.ok(Date.now()-started<500);
  assert.equal(win.open,original);assert.equal(request.isBusy,false);
 });
});
test('a closed Albedo window is reported within seconds, not after the timeout',async()=>{
 const state={closed:false,focused:0,closeCalls:0};
 await withWindow(()=>handle(state),async(win)=>{
  const request=new WalletRequest();
  const result=request.run(()=>{win.open('https://albedo.link/confirm');return new Promise(()=>{});},60_000,{watchPopup:true});
  assert.equal(state.focused,1);
  setTimeout(()=>{state.closed=true;},50);
  await assert.rejects(result,(error:Error)=>error instanceof WalletWindowError&&error.kind==='closed');
  assert.equal(request.isBusy,false);
 });
});
test('a reply that arrives while Albedo closes its own window is still accepted',async()=>{
 const state={closed:false,focused:0,closeCalls:0};
 await withWindow(()=>handle(state),async(win)=>{
  const request=new WalletRequest();
  const result=request.run(()=>{win.open('https://albedo.link/confirm');return new Promise<string>(resolve=>setTimeout(()=>{state.closed=true;resolve('account');},700));},60_000,{watchPopup:true});
  assert.equal(await result,'account');
 });
});
test('requests that never open a window are not treated as blocked',async()=>{
 await withWindow(()=>{throw new Error('must not open');},async()=>{
  const request=new WalletRequest();
  assert.equal(await request.run(()=>new Promise<string>(resolve=>setTimeout(()=>resolve('freighter'),20)),60_000,{watchPopup:true}),'freighter');
 });
});
test('cancel and timeout close the window this app opened',async()=>{
 const state={closed:false,focused:0,closeCalls:0};
 await withWindow(()=>handle(state),async(win)=>{
  const request=new WalletRequest();
  const first=request.run(()=>{win.open('x');return new Promise(()=>{});},60_000,{watchPopup:true});
  request.cancel();await assert.rejects(first,/cancelled/);
  assert.equal(state.closeCalls,1);
  state.closed=false;
  await assert.rejects(request.run(()=>{win.open('x');return new Promise(()=>{});},5,{watchPopup:true}),/did not respond/);
  assert.equal(state.closeCalls,2);
 });
});
test('window.open is restored when the wallet call throws synchronously',async()=>{
 await withWindow(()=>null,async(win)=>{
  const original=win.open,request=new WalletRequest();
  await assert.rejects(request.run(()=>{throw new Error('boom');},1000,{watchPopup:true}),/boom/);
  assert.equal(win.open,original);
 });
});
