import assert from 'node:assert/strict';
import test from 'node:test';
import { Keypair, Networks } from '@stellar/stellar-sdk';
import { groupSettings, validateManifest, validateGroup, resolveGroup, assertGroupUnchanged } from '../src/group-config.mjs';
import { publicStatus, createStatusState, createStatusServer } from '../src/status.mjs';
import { refreshBoostedMarkets, refreshInterestMarkets, interestReady } from '../src/refresh.mjs';
import { assertKeeperCall } from '../src/safety.mjs';

const C='CAKKHUGHP67UA4F42QOYPKNGRSBJEOE62MGDXA2UURTEYFOQGSMIRUFO';
const M='CB32OVY4AADCHQT3DLKJYW5QVTWY5MOX7BBNZFT3SDHZ5HPSDDEA2THJ';
const manifest={network:'mainnet',factory:C,margin_factory:M,wasm:{margin:'a'.repeat(64),receipt_vault:'b'.repeat(64),controller:'c'.repeat(64),price_router:'d'.repeat(64)}};
const settings=groupSettings({GROUP_ID:'1',RPC_URL:'https://rpc.example.com'});
test('group settings default to mainnet and dry-run, reject ambiguous signing networks',()=>{
  assert.equal(settings.network,'mainnet');assert.equal(settings.dryRun,true);
  assert.throws(()=>groupSettings({RPC_URL:'https://rpc.example.com'}),/GROUP_ID/);
  assert.throws(()=>groupSettings({GROUP_ID:'1',NETWORK:'mainnet'}),/RPC_URL/);
  assert.throws(()=>groupSettings({GROUP_ID:'1',NETWORK:'testnet',NETWORK_PASSPHRASE:Networks.PUBLIC}),/conflicts/);
  assert.throws(()=>groupSettings({GROUP_ID:'1',NETWORK:'testnet',DRY_RUN:'yes'}),/DRY_RUN/);
  assert.throws(()=>groupSettings({GROUP_ID:'1',NETWORK:'testnet',BOOSTED_REFRESH_INTERVAL_MS:'300000'}),/REFRESH/);
  assert.equal(groupSettings({GROUP_ID:'1',NETWORK:'testnet'}).networkPassphrase,Networks.TESTNET);
});
test('manifest and group validation fail closed on network, hashes, controller mismatch or custom ABI',()=>{
  assert.equal(validateManifest(manifest,settings).marginHash,'a'.repeat(64));
  assert.throws(()=>validateManifest({...manifest,network:'testnet'},settings),/network/);
  assert.throws(()=>validateManifest({...manifest,wasm:{}},settings),/hash/);
  const group={id:1,controller:M,margin_controller:C,markets:[M]};
  assert.deepEqual(validateGroup(group,{controller:C,variant:['Audited']},1),{controllerId:C,markets:[M],lendingController:M});
  assert.throws(()=>validateGroup(group,{controller:M,variant:['Audited']},1),/disagree/);
  assert.throws(()=>validateGroup(group,{controller:C,variant:['Custom']},1),/Audited/);
});
test('group discovery verifies both factories and never treats failed boosted reads as unboosted',async()=>{
  const deps={readFile:async()=>JSON.stringify(manifest),server:{getNetwork:async()=>({passphrase:Networks.PUBLIC})},readView:async(id,method)=>{
    if(method==='get_group')return{id:1,controller:M,margin_controller:C,price_router:C,markets:[M]};
    if(method==='get_margin')return{controller:C,swap_adapter:M,variant:['Audited']};
    return C;
  }};
  assert.deepEqual((await resolveGroup(settings,{},deps)).boostedMarkets,[M]);
  await assert.rejects(resolveGroup(settings,{MARGIN_CONTROLLER_ID:M},deps),/selected group/);
  await assert.rejects(resolveGroup(settings,{}, {...deps,readView:async(id,method)=>{if(method==='get_boosted_vault')throw new Error('RPC down');return deps.readView(id,method);}}),/RPC down/);
});
test('refresh-only signer cannot liquidate, rebalance, transfer or pass arguments',()=>{
  const config={role:'boosted-refresh'};
  assert.doesNotThrow(()=>assertKeeperCall(config,'refresh_boosted_underlying',[]));
  for(const method of ['rebalance_idle_cash','transfer','begin_liquidation_v3'])assert.throws(()=>assertKeeperCall(config,method,[]),/only permits/);
  assert.throws(()=>assertKeeperCall(config,'refresh_boosted_underlying',[1]),/only permits/);
  assert.throws(()=>assertKeeperCall({publicKey:Keypair.random().publicKey()},'refresh_boosted_underlying',[]),/not allowed/);
});
test('refresh jobs are serial, back off failures and propagate fatal signing stops',async()=>{
  const calls=[],status={};let active=0;
  const clients=new Map([C,M].map(id=>[id,{submit:async(method,args)=>{assert.equal(active++,0);calls.push([id,method,args]);await Promise.resolve();active--;}}]));
  await refreshBoostedMarkets({clients,status,dryRun:true,now:100,intervalMs:120000});
  assert.equal(calls.length,2);assert.equal(status[C].lastSuccess,null);
  await refreshBoostedMarkets({clients,status,dryRun:true,now:101,intervalMs:120000});assert.equal(calls.length,2);
  const broken=new Map([[C,{submit:async()=>{throw new Error('simulation');}}]]);
  await assert.rejects(refreshBoostedMarkets({clients:broken,status:{},dryRun:true,now:0,intervalMs:120000}),/failed/);
  await assert.rejects(refreshBoostedMarkets({clients:new Map([[C,{submit:async()=>{throw Object.assign(new Error('stop'),{fatal:true});}}]]),status:{},dryRun:false,now:0,intervalMs:120000}),/stop/);
});
test('status distinguishes simulation from live coverage and fails health when stale or refresh failed',()=>{
  const state=createStatusState(settings,{controllerId:C,markets:[M]},0);
  assert.equal(publicStatus(state,100).healthy,false);state.lastSuccessfulCycle=100;
  assert.equal(publicStatus(state,200).healthy,true);assert.equal(publicStatus(state,200).mode,'simulation-only');
  assert.equal(publicStatus(state,200).liveSigning,false);assert.equal(publicStatus(state,200000).healthy,false);
  state.refresh[M]={failures:1};assert.equal(publicStatus(state,200).healthy,false);
});
test('HTTP status endpoint exposes only public operational state',async()=>{
  const state=createStatusState(settings,{controllerId:C,markets:[M],lendingController:M});
  const server=createStatusServer(state);
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  try{
    const url=`http://127.0.0.1:${server.address().port}`;
    assert.equal((await fetch(`${url}/health`)).status,503);
    const result=await (await fetch(`${url}/status`)).json();assert.equal(result.mode,'simulation-only');assert.equal('rpcUrl' in result,false);
    assert.equal((await fetch(`${url}/status`,{method:'POST'})).status,404);
  }finally{await new Promise(resolve=>server.close(resolve));}
});

test('group topology drift stops before signing while transient discovery failures remain retryable',async()=>{
  let markets=[M],boosted=C,margin=C;
  const deps={readFile:async()=>JSON.stringify(manifest),server:{getNetwork:async()=>({passphrase:Networks.PUBLIC})},readView:async(id,method)=>{
    if(method==='get_group')return{id:1,controller:M,margin_controller:margin,price_router:C,markets};
    if(method==='get_margin')return{controller:margin,swap_adapter:M,variant:['Audited']};
    return boosted;
  }};
  const original=await resolveGroup(settings,{},deps);
  await assertGroupUnchanged(settings,original,deps);
  markets=[M,C];await assert.rejects(assertGroupUnchanged(settings,original,deps),e=>e.fatal&&/changed/.test(e.message));
  markets=[M];boosted=M;await assert.rejects(assertGroupUnchanged(settings,original,deps),e=>e.fatal&&/changed/.test(e.message));
  boosted=C;margin=M;await assert.rejects(assertGroupUnchanged(settings,original,deps),e=>e.fatal&&/changed/.test(e.message));
});

test('interest refresh permits only pinned group receipt update_interest and records simulation honestly',async()=>{
 const cfg={role:'interest-refresh',controllerId:M,interestMarkets:[M],expectedControllerHash:'pinned',receiptHash:'pinned'};
 assert.doesNotThrow(()=>assertKeeperCall(cfg,'update_interest',[]));
 assert.throws(()=>assertKeeperCall(cfg,'refresh_boosted_underlying',[]),/only permits/);
 assert.throws(()=>assertKeeperCall(cfg,'update_interest',[1]),/only permits/);
 assert.throws(()=>assertKeeperCall({...cfg,controllerId:C},'update_interest',[]),/whitelist/);
 assert.throws(()=>assertKeeperCall({...cfg,expectedControllerHash:'wrong'},'update_interest',[]),/whitelist/);
 assert.throws(()=>groupSettings({GROUP_ID:'1',NETWORK:'testnet',INTEREST_REFRESH_INTERVAL_MS:'20000'}),/INTEREST/);
 const status={},calls=[];let active=0;
 const clients=new Map([C,M].map(id=>[id,{submit:async(method,args)=>{assert.equal(active++,0);calls.push({id,method,args});await Promise.resolve();active--;}}]));
 const now=Date.now();await refreshInterestMarkets({clients,status,dryRun:true,now,intervalMs:120000});
 assert.equal(calls.length,2);assert.ok(calls.every(c=>c.method==='update_interest'&&c.args.length===0));
 assert.equal(interestReady([C,M],status,true),true);assert.equal(interestReady([C,M],status,false),false);
 assert.equal(status[C].lastSuccess,null);
 await refreshInterestMarkets({clients,status,dryRun:true,now:now+1,intervalMs:120000});assert.equal(calls.length,2);
 status[C].failures=1;assert.equal(interestReady([C,M],status,true),false);
 assert.equal(interestReady([C,M],{},false),false);
});
