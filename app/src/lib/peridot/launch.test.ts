import test from 'node:test';
import type { xdr as StellarXdr } from '@stellar/stellar-sdk';
import assert from 'node:assert/strict';

// Isolated test process: all simulated writes remain in this in-memory browser store.
process.env.NEXT_PUBLIC_USE_MOCKS='true';
process.env.NEXT_PUBLIC_NETWORK='testnet';
class Storage {
  private values=new Map<string,string>();
  fail=false;
  getItem(key:string){return this.values.get(key)??null;}
  setItem(key:string,value:string){if(this.fail)throw new Error('Storage blocked');this.values.set(key,value);}
  removeItem(key:string){this.values.delete(key);}
}
test('launch preserves confirmed steps and never duplicates a recovered group',async()=>{
  const storage=new Storage();
  Object.defineProperty(globalThis,'localStorage',{value:storage,configurable:true});
  Object.defineProperty(globalThis,'window',{value:{localStorage:storage},configurable:true});
  const {newMarketDraft,validateMarketDraft}=await import('./market-config');
  const {MOCK_USDC,MOCK_XLM,MOCK_ORACLE,MOCK_OWNER,readMockState,mockCreateMarket,mockActivateMarket}=await import('./mock');
  const {newLaunch,launchSteps,runNextLaunchStep,recoverLaunchStep,discoverMarginPools,validateLaunch,loadLaunch}=await import('./launch');
  const market=(token:string,symbol:string)=>({...newMarketDraft(),token,symbol,marginEnabled:true,price:{tag:'ReflectorOnly' as const,values:[{oracle:MOCK_ORACLE,asset:{tag:'Other' as const,values:[symbol] as readonly[string]}}] as const},supplyRewardsPerDay:'86.4',borrowRewardsPerDay:'0'});
  const markets=[market(MOCK_USDC,'USDC'),market(MOCK_XLM,'XLM')];
  assert.ok(validateMarketDraft({...markets[0],collateralFactor:'0.5'}).some(e=>e.includes('1%')));
  assert.ok(validateMarketDraft({...markets[0],decimals:6}).some(e=>e.includes('seven')));
  const draft={name:'ResumeTest',description:'',markets,rewardsEnabled:true,rewardToken:MOCK_USDC,rewardSymbol:'USDC',rewardDecimals:7,rewardFunding:'100',marginEnabled:true,maxLeverage:'3',slippage:'1',liquidationIncentive:'108',liquidationFee:'0',marginPools:await discoverMarginPools(markets)};
  assert.deepEqual(validateLaunch(draft),[]);
  const order=launchSteps(draft).map(s=>s.id);
  assert.ok(order.indexOf('activate:0')<order.indexOf('market:1'));
  assert.ok(order.indexOf('rewards')>order.indexOf('applymargin'));
  assert.ok(validateLaunch({...draft,markets:[markets[0],markets[0]]}).some(e=>e.includes('only one market')));
  assert.ok(validateLaunch({...draft,liquidationFee:'51'}).some(e=>e.includes('50%')));
  assert.ok(validateLaunch({...draft,liquidationIncentive:'111'}).some(e=>e.includes('110%')));
  const signer={address:MOCK_OWNER,signTransaction:async()=>{throw new Error('Mock launch must never sign');}};
  let session=newLaunch(draft,MOCK_OWNER);
  const count=readMockState().groups.length;
  storage.fail=true;
  await assert.rejects(runNextLaunchStep(session,signer),/storage/i);
  assert.equal(readMockState().groups.length,count,'storage failure must prevent creating the group');
  storage.fail=false;
  const beforeCreate=structuredClone(session);
  session=await runNextLaunchStep(session,signer);
  assert.equal(readMockState().groups.length,count+1);
  // Crash after mock mutation but before the launch receipt was saved.
  const recovered=await recoverLaunchStep({...beforeCreate,pending:{step:'create',status:'simulating'}},signer);
  assert.equal(recovered.groupId,session.groupId);
  assert.equal(readMockState().groups.length,count+1,'recovery must not create a second group');
  session=recovered;
  session=await runNextLaunchStep(session,signer);
  assert.equal(readMockState().configs[`${session.groupId}:${session.markets[0]}`].supply_reward_per_sec,0n,'market creation must not emit rewards before distributor setup');
  assert.deepEqual(readMockState().groups.find(g=>g.id===session.groupId)?.markets,[],'deploying a market must not list it before activation');
  while(!session.completed){
    const next=launchSteps(draft).find(step=>!session.receipts.some(r=>r.step===step.id));
    if(next?.kind==='rewards')assert.equal(readMockState().groups.find(g=>g.id===session.groupId)?.markets.length,markets.length,'all markets must activate before rewards');
    session=await runNextLaunchStep(session,signer);
  }
  assert.equal(session.receipts.length,launchSteps(draft).length);
  assert.equal(readMockState().configs[`${session.groupId}:${session.markets[0]}`].supply_reward_per_sec,10000n);
  assert.equal((readMockState().pending[`control:${session.groupId}`] as {rewardBalance:bigint}).rewardBalance,1_000_000_000n);
  assert.equal(loadLaunch(session.scope)?.completed,true);
  const completedState=readMockState();
  const completedConfig=completedState.configs[`${session.groupId}:${session.markets[0]}`];
  assert.throws(()=>mockCreateMarket(completedState,session.groupId!,'extra',completedConfig,{symbol:'USDC',decimals:7}),/after group rewards/);
  assert.throws(()=>mockActivateMarket(completedState,session.groupId!,session.markets[0]),/after group rewards/);
  const second=await runNextLaunchStep(newLaunch({...draft,name:'SecondGroup'},MOCK_OWNER),signer);
  assert.notEqual(second.groupId,session.groupId,'a new launch must have a distinct operation journal');
  const other={...signer,address:'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5'};
  await assert.rejects(runNextLaunchStep(second,other),/another wallet/);
});

test('Aquarius registry preserves binary BytesN pool IDs and rejects malformed entries',async()=>{
  const {Address,xdr}=await import('@stellar/stellar-sdk');
  const {decodeMarginPoolRegistry}=await import('./launch');
  const {MOCK_USDC,MOCK_XLM,MOCK_OWNER}=await import('./mock');
  const first=Uint8Array.from({length:32},(_,i)=>i===0?0xff:i);
  const second=Uint8Array.from(first);second[0]=0xfe;
  const entry=(key:StellarXdr.ScVal,address:string)=>new xdr.ScMapEntry({key,val:new Address(address).toScVal()});
  const raw=xdr.ScVal.scvMap([entry(xdr.ScVal.scvBytes(first),MOCK_USDC),entry(xdr.ScVal.scvBytes(second),MOCK_XLM)]);
  // Exercise serialized RPC-style XDR, including non-UTF8 bytes and a zero byte.
  const decoded=decodeMarginPoolRegistry(xdr.ScVal.fromXDR(raw.toXDR()));
  assert.deepEqual(decoded,[{poolId:Buffer.from(first).toString('hex'),pool:MOCK_USDC},{poolId:Buffer.from(second).toString('hex'),pool:MOCK_XLM}]);
  assert.notEqual(decoded[0].poolId,decoded[1].poolId);
  assert.deepEqual(decodeMarginPoolRegistry(xdr.ScVal.scvMap([])),[]);
  assert.throws(()=>decodeMarginPoolRegistry(xdr.ScVal.scvVec([])),/Unexpected/);
  assert.throws(()=>decodeMarginPoolRegistry(xdr.ScVal.scvMap([entry(xdr.ScVal.scvBytes(new Uint8Array(31)),MOCK_USDC)])),/Malformed/);
  assert.throws(()=>decodeMarginPoolRegistry(xdr.ScVal.scvMap([entry(xdr.ScVal.scvSymbol('invalid'),MOCK_USDC)])),/Malformed/);
  assert.throws(()=>decodeMarginPoolRegistry(xdr.ScVal.scvMap([entry(xdr.ScVal.scvBytes(first),MOCK_OWNER)])),/not a contract/);
});


test('definitive rejection clears only the matching launch step while preserving earlier receipts',async()=>{
  const storage=new Storage();
  Object.defineProperty(globalThis,'localStorage',{value:storage,configurable:true});
  Object.defineProperty(globalThis,'window',{value:{localStorage:storage},configurable:true});
  const {recordLaunchError,loadLaunch}=await import('./launch');
  const {TransactionRejectedError,UnknownTransactionError}=await import('./rpc');
  const transaction={hash:'rejected',contractId:'factory',method:'add_market',maxTime:1000,submissionLedger:10};
  const session={version:1 as const,id:'recovery-test',scope:'test-scope',draft:{} as import('./launch').LaunchDraft,groupId:7,markets:{},receipts:[{step:'create',hash:'confirmed-create',value:7}],pending:{step:'market:0',status:'error',hash:'rejected',transaction},completed:false};
  const unknown=recordLaunchError(session,new UnknownTransactionError('rejected'));
  assert.deepEqual(unknown.pending?.transaction,transaction,'unknown hash retains expiry evidence even if shared pending is later cleared');
  assert.ok(loadLaunch(session.scope)?.pending);
  assert.ok(recordLaunchError(session,new TransactionRejectedError('different-hash','rejected')).pending,'an unrelated rejection must not clear this step');
  const retriable=recordLaunchError(session,new TransactionRejectedError('rejected','definitively rejected'));
  assert.equal(retriable.pending,undefined);
  assert.equal(loadLaunch(session.scope)?.pending,undefined);
  assert.deepEqual(retriable.receipts,session.receipts);
  assert.equal(retriable.groupId,7);
  assert.equal(recordLaunchError({...session,pending:{step:'market:0',status:'signing'}},new Error('Wallet declined')).pending,undefined);
});


test('an older global transaction cannot become a new launch step receipt before simulation starts',async()=>{
 const {launchProgressState}=await import('./launch');
 const shared={hash:'older-fund',method:'fund',contractId:'distributor'};
 const prior={step:'create',status:'preparing'};
 const blocked=launchProgressState('create',prior,{status:'unknown',hash:shared.hash},shared);
 assert.equal(blocked.hash,undefined);
 assert.equal(blocked.transaction,undefined);
 assert.equal(blocked.started,false);
 const begun=launchProgressState('create',prior,{status:'simulating'},null);
 const own={hash:'own-create',method:'create_group',contractId:'factory',maxTime:2000,submissionLedger:10};
 const submitting=launchProgressState('create',begun,{status:'submitting',hash:own.hash},own);
 assert.equal(submitting.hash,own.hash);
 assert.deepEqual(submitting.transaction,own);
});


test('exact feed mapping is required before group creation and rechecked before market deployment',async()=>{
 const storage=new Storage();
 Object.defineProperty(globalThis,'localStorage',{value:storage,configurable:true});
 Object.defineProperty(globalThis,'window',{value:{localStorage:storage},configurable:true});
 const {newMarketDraft}=await import('./market-config');
 const {MOCK_USDC,MOCK_XLM,MOCK_ORACLE,MOCK_OWNER,readMockState}=await import('./mock');
 const {isOracleAllowed,isPriceFeedAllowed,findReflectorFeed}=await import('./factory');
 const {newLaunch,runNextLaunchStep,loadLaunch}=await import('./launch');
 const price=await findReflectorFeed(MOCK_USDC,'USDC');
 const wrong={tag:'ReflectorOnly' as const,values:[{oracle:MOCK_ORACLE,asset:{tag:'Other' as const,values:['XLM'] as const}}] as const};
 assert.equal(await isOracleAllowed(MOCK_ORACLE),true);
 assert.equal(await isPriceFeedAllowed(MOCK_USDC,price),true);
 assert.equal(await isPriceFeedAllowed(MOCK_USDC,wrong),false,'an approved oracle cannot price USDC using the XLM entry');
 assert.equal(await isPriceFeedAllowed(MOCK_USDC,{tag:'ReflectorOnly',values:[{oracle:MOCK_ORACLE,asset:{tag:'Stellar',values:[MOCK_XLM]}}]}),false);
 assert.equal(await isPriceFeedAllowed(MOCK_USDC,{tag:'ReflectorOnly',values:[{oracle:MOCK_XLM,asset:{tag:'Other',values:['USDC']}}]}),false);
 await assert.rejects(findReflectorFeed(MOCK_USDC,'XLM'),/not approved/);
 const market={...newMarketDraft(),token:MOCK_USDC,symbol:'USDC',price};
 const draft={name:'FeedPreflight',description:'',markets:[market],rewardsEnabled:false,rewardToken:'',rewardSymbol:'',rewardDecimals:7,rewardFunding:'0',marginEnabled:false,maxLeverage:'3',slippage:'1',liquidationIncentive:'108',liquidationFee:'0',marginPools:[]};
 const signer={address:MOCK_OWNER,signTransaction:async()=>{throw new Error('Preflight must never sign');}};
 const count=readMockState().groups.length;
 const invalid=newLaunch({...draft,markets:[{...market,price:wrong}]},MOCK_OWNER);
 await assert.rejects(runNextLaunchStep(invalid,signer),/token, oracle and asset mapping/);
 assert.equal(readMockState().groups.length,count,'rejection must precede group creation');
 assert.equal(loadLaunch(invalid.scope)?.pending,undefined);
 const created=await runNextLaunchStep(newLaunch(draft,MOCK_OWNER),signer);
 const configs=Object.keys(readMockState().configs).length;
 const changed={...created,draft:{...created.draft,markets:[{...market,price:wrong}]}};
 await assert.rejects(runNextLaunchStep(changed,signer),/token, oracle and asset mapping/);
 assert.equal(Object.keys(readMockState().configs).length,configs,'a saved launch cannot bypass the current tuple preflight');
 assert.deepEqual(loadLaunch(created.scope)?.receipts,created.receipts);
});


test('lending-only deployment rejects leverage before creating a group or saving a transaction',async()=>{
 const {network}=await import('./network');
 const {validateLaunch,runNextLaunchStep}=await import('./launch');
 const {newMarketDraft}=await import('./market-config');
 const {MOCK_OWNER,MOCK_USDC,MOCK_ORACLE}=await import('./mock');
 const market={...newMarketDraft(),token:MOCK_USDC,symbol:'USDC',price:{tag:'ReflectorOnly' as const,values:[{oracle:MOCK_ORACLE,asset:{tag:'Other' as const,values:['USDC'] as const}}] as const}};
 const draft={name:'NoMargin',description:'',markets:[market],rewardsEnabled:false,rewardToken:'',rewardSymbol:'',rewardDecimals:7,rewardFunding:'0',marginEnabled:true,maxLeverage:'3',slippage:'1',liquidationIncentive:'108',liquidationFee:'0',marginPools:[]};
 const wasMock=network.useMocks;
 try{
  Object.assign(network,{useMocks:false});
  assert.ok(validateLaunch(draft).some(error=>error.includes('Leverage is not deployed')));
  const session={version:1 as const,id:'unavailable',scope:'unused',draft,markets:{},receipts:[],completed:false};
  await assert.rejects(runNextLaunchStep(session,{address:MOCK_OWNER,signTransaction:async()=>{throw new Error('Must never sign');}}),/Leverage is not deployed/);
 }finally{Object.assign(network,{useMocks:wasMock});}
});
