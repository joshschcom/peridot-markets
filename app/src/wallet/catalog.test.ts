import test from 'node:test';
import assert from 'node:assert/strict';
import {buildOptions,readLastWallet,writeLastWallet,isWalletId,usesReviewStep,reportsNetwork,shortAddress,walletStorageKey} from './catalog';
const memory=(initial?:string)=>{const m=new Map<string,string>(initial?[[walletStorageKey,initial]]:[]);return {getItem:(k:string)=>m.get(k)??null,setItem:(k:string,v:string)=>{m.set(k,v);},m};};
test('Albedo and Freighter are always first, whatever else is installed',()=>{
  const ids=buildOptions([{id:'lobstr',isAvailable:true},{id:'freighter',isAvailable:false}],'lobstr').map(o=>o.id);
  assert.deepEqual(ids.slice(0,3),['albedo','freighter','lobstr']);
});
test('hints: popup wallets, detected extensions, missing extensions and pending detection',()=>{
  const by=(d:Parameters<typeof buildOptions>[0])=>Object.fromEntries(buildOptions(d,null).map(o=>[o.id,o.hint]));
  const loaded=by([{id:'freighter',isAvailable:true},{id:'lobstr',isAvailable:false},{id:'hana',isAvailable:true}]);
  assert.deepEqual([loaded.albedo,loaded.xbull,loaded.freighter,loaded.lobstr,loaded.hana],['popup','popup','installed','not-installed','installed']);
  assert.equal(by(null).freighter,'checking');
  assert.equal(by([]).freighter,'not-installed');
});
test('installed extensions rank above popup wallets and uninstalled ones, after the two primary wallets',()=>{
  const ids=buildOptions([{id:'hana',isAvailable:true}],null).map(o=>o.id);
  assert.deepEqual(ids,['albedo','freighter','hana','xbull','lobstr']);
});
test('WalletConnect is listed only when enabled',()=>{
  assert.ok(!buildOptions([],null).some(o=>o.id==='wallet_connect'));
  assert.equal(buildOptions([],null,true).find(o=>o.id==='wallet_connect')?.hint,'scan');
});
test('the last used wallet is flagged and ranked right after the primary pair',()=>{
  const options=buildOptions([{id:'hana',isAvailable:true}],'xbull');
  assert.deepEqual(options.slice(0,4).map(o=>o.id),['albedo','freighter','xbull','hana']);
  assert.equal(options.filter(o=>o.lastUsed).length,1);
});
test('last wallet persistence validates and survives unavailable storage',()=>{
  const store=memory();
  assert.equal(readLastWallet(store),null);
  writeLastWallet('xbull',store);assert.equal(readLastWallet(store),'xbull');
  assert.equal(readLastWallet(memory('metamask')),null);
  const broken={getItem:()=>{throw new Error('blocked');},setItem:()=>{throw new Error('blocked');}};
  assert.equal(readLastWallet(broken),null);assert.doesNotThrow(()=>writeLastWallet('albedo',broken));
});
test('signing mode per wallet',()=>{
  assert.ok(usesReviewStep('albedo')&&usesReviewStep('xbull'));
  assert.ok(!usesReviewStep('freighter')&&!usesReviewStep('lobstr')&&!usesReviewStep('hana'));
  assert.ok(reportsNetwork('freighter')&&!reportsNetwork('albedo')&&!reportsNetwork('hana'));
  assert.ok(isWalletId('hana')&&!isWalletId('rabet'));
});
test('short address',()=>{assert.equal(shortAddress('GABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890'),'GABC…7890');});
