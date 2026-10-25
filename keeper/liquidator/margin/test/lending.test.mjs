import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Keypair, StrKey, nativeToScVal } from '@stellar/stellar-sdk';
import { lendingSettings, loadLendingState, discoverBorrowers, planLendingLiquidation, LendingLiquidationKeeper } from '../src/lending.mjs';
import { assertKeeperCall } from '../src/safety.mjs';
import { scAddress, scU128 } from '../src/stellar.mjs';
const C=n=>StrKey.encodeContract(Buffer.alloc(32,n));
const controller=C(1),a=C(2),b=C(3),token=C(4),factory=C(5),priceRouter=C(6);
const borrower=Keypair.random().publicKey(),publicKey=Keypair.random().publicKey();
const group={factory,priceRouter,lendingController:controller,markets:[a,b]};
const config=lendingSettings({LENDING_START_LEDGER:'1',LENDING_REPAY_CAPS_JSON:JSON.stringify({[a]:'200'})},group,{network:'testnet',groupId:1});
const event=(name,address,index=1)=>({ledger:5,topic:[nativeToScVal(name,{type:'symbol'}),...(index===2?[scAddress(publicKey)]:[]),scAddress(address)]});
test('lending caps are explicit raw-unit strings scoped to selected group',()=>{
  assert.equal(config.repayCaps[a],200n);
  assert.throws(()=>lendingSettings({LENDING_REPAY_CAPS_JSON:JSON.stringify({[C(9)]:'10'})},group,{network:'testnet',groupId:1}),/Invalid/);
  assert.throws(()=>lendingSettings({LENDING_REPAY_CAPS_JSON:JSON.stringify({[a]:10})},group,{network:'testnet',groupId:1}),/Invalid/);
});
test('borrower discovery tracks borrower instead of repayment payer and never deletes on exit',()=>{
  assert.deepEqual(discoverBorrowers([],[event('repay_borrow',borrower,2)]),[borrower]);
  assert.deepEqual(discoverBorrowers([borrower],[event('market_exited',borrower)]),[borrower]);
});
test('ordinary plan clamps repay by debt, close factor, funds, allowance, explicit cap and collateral',async()=>{
  const read=async(id,method,args)=>{
    if(method==='decimals')return id===priceRouter?14:0;
    if(method==='resolution')return 300;
    if(method==='check')return {status:'ok',timestamp:BigInt(Math.floor(Date.now()/1000)),reflector_price:10n**14n};
    if(method==='get_liquidation_fee_scaled')return 0n;
    if(method==='get_reserve_recipient')return undefined;
    if(method==='get_exchange_rate')return 1000000n;
    if(method==='get_user_borrow_balance')return id===a?1000n:0n;
    if(method==='account_liquidity')return[0n,100n];
    if(method==='get_user_markets')return[a,b];
    if(method==='get_underlying_token')return token;
    if(method==='balance')return 90n;
    if(method==='allowance')return 70n;
    if(method==='preview_repay_cap')return 500n;
    if(method==='get_ptoken_balance')return 50n;
    if(method==='preview_seize_ptokens')return BigInt(args[2].u128().lo().toString())*2n;
    throw new Error(method);
  };
  const result=await planLendingLiquidation({borrower,publicKey,markets:[a,b],caps:config.repayCaps,priceRouter,settings:config,read});
  assert.equal(result.plan.repayAmount,25n);assert.equal(result.plan.seizeAmount,50n);
  assert.equal(result.plan.collateralMarket,b);
  await assert.rejects(planLendingLiquidation({borrower,publicKey,markets:[a,b],caps:{},priceRouter,settings:config,read}),/no executable plan/);
  await assert.rejects(planLendingLiquidation({borrower,publicKey,markets:[a,b],caps:config.repayCaps,priceRouter,settings:config,read:async(id,m,args)=>m==='preview_repay_cap'?Promise.reject(new Error('preview failed')):read(id,m,args)}),/preview failed/);
  await assert.rejects(planLendingLiquidation({borrower,publicKey,markets:[a,b],caps:config.repayCaps,priceRouter,settings:config,read:async()=>{throw new Error('debt read failed');}}),/debt read failed/);
});
test('lending role signs only exact group liquidation with bounded repayment and self beneficiary',()=>{
  const role={role:'lending-liquidation',publicKey,lendingMarkets:[a,b],lendingRepayCaps:{[a]:200n}};
  const args=[scAddress(borrower),scAddress(a),scAddress(b),scU128(100n),scAddress(publicKey)];
  assert.doesNotThrow(()=>assertKeeperCall(role,'liquidate',args));
  assert.throws(()=>assertKeeperCall(role,'approve',args),/only permits/);
  assert.throws(()=>assertKeeperCall(role,'liquidate',[...args.slice(0,3),scU128(201n),args[4]]),/cap exceeded/);
  assert.throws(()=>assertKeeperCall(role,'liquidate',[args[0],scAddress(C(9)),...args.slice(2)]),/outside/);
  assert.throws(()=>assertKeeperCall(role,'liquidate',[...args.slice(0,4),scAddress(borrower)]),/beneficiary/);
  assert.throws(()=>assertKeeperCall(role,'liquidate',[scAddress(publicKey),...args.slice(1)]),/borrower/);
});
test('first startup requires explicit history or complete attested snapshot, and scope must match',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'peridot-lending-test-'));
  const base={...config,stateFile:join(dir,'state.json'),startLedger:null};
  try{
    await assert.rejects(loadLendingState(base),/First lending startup/);
    const file=join(dir,'bootstrap.json');
    await writeFile(file,JSON.stringify({complete:true,network:'testnet',factory,group_id:1,lending_controller:controller,as_of_ledger:10,borrowers:[borrower]}));
    const state=await loadLendingState({...base,bootstrapFile:file});assert.equal(state.indexedThrough,10);assert.deepEqual(state.borrowers,[borrower]);
    await writeFile(base.stateFile,JSON.stringify({...state,scope:'wrong-group'}));await assert.rejects(loadLendingState(base),/scope/);
  }finally{await rm(dir,{recursive:true,force:true});}
});
test('event backfill checkpoints only after every contract window is fully indexed',async()=>{
  const state={borrowers:[],indexedThrough:0};let saved=0;
  const client={latestLedger:async()=>({sequence:10}),getEvents:async req=>{
    if(req.filters[0].contractIds[0]===a)throw new Error('archive unavailable');
    return {latestLedger:10,events:[event('borrow_event',borrower)]};
  }};
  const keeper=new LendingLiquidationKeeper(config,group,client,null,state,async()=>saved++,console,{});
  await assert.rejects(keeper.syncEvents(),/archive unavailable/);assert.equal(state.indexedThrough,0);assert.equal(saved,0);
  client.getEvents=async()=>({latestLedger:10,events:[event('borrow_event',borrower)]});
  assert.equal(await keeper.syncEvents(),true);assert.equal(state.indexedThrough,10);assert.deepEqual(state.borrowers,[borrower]);
});
test('healthy borrowers with existing debt stay indexed across every cycle',async()=>{
  const state={borrowers:[borrower],indexedThrough:10};let submitted=0;
  const client={config:{publicKey},submit:async()=>submitted++};
  const read=async(id,method)=>method==='get_user_borrow_balance'?(id===a?100n:0n):[100n,0n];
  const keeper=new LendingLiquidationKeeper(config,group,client,read,state,async()=>{},console,{});
  keeper.syncEvents=async()=>true;
  await keeper.runCycle();await keeper.runCycle();assert.deepEqual(state.borrowers,[borrower]);assert.equal(submitted,0);
});
test('fatal lending submission stops the loop rather than being swallowed',async()=>{
  const state={borrowers:[borrower],indexedThrough:10};
  const client={config:{publicKey},submit:async()=>{throw Object.assign(new Error('reconcile exact hash'),{fatal:true});}};
  const read=async(id,m)=>{
    if(m==='decimals')return id===priceRouter?14:0;if(m==='resolution')return 300;
    if(m==='check')return {status:'ok',timestamp:BigInt(Math.floor(Date.now()/1000)),reflector_price:10n**14n};
    if(m==='get_liquidation_fee_scaled')return 0n;if(m==='get_reserve_recipient')return undefined;if(m==='get_exchange_rate')return 2000000n;
    if(m==='get_user_borrow_balance')return id===a?100n:0n;
    if(m==='account_liquidity')return[0n,10n];if(m==='get_user_markets')return[b];if(m==='get_underlying_token')return token;
    return 100n;
  };
  const keeper=new LendingLiquidationKeeper(config,group,client,read,state,async()=>{},console,{});keeper.syncEvents=async()=>true;
  await assert.rejects(keeper.runCycle(),/reconcile exact hash/);
});
