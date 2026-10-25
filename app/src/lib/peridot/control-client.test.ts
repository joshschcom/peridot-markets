import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';

process.env.NEXT_PUBLIC_USE_MOCKS='true';
class MemoryStorage {
  values=new Map<string,string>();
  getItem(key:string){return this.values.get(key)??null;}
  setItem(key:string,value:string){this.values.set(key,value);}
  removeItem(key:string){this.values.delete(key);}
}
const storage=new MemoryStorage();
Object.defineProperty(globalThis,'window',{value:{localStorage:storage},configurable:true});
Object.defineProperty(globalThis,'localStorage',{value:storage,configurable:true});
const load=async()=>{
 const c=await import('./control-client');
 const mocks=await import('./mock');
 const factory=await import('./factory');
 return {c,mocks,factory,signer:{address:mocks.MOCK_OWNER,signTransaction:async()=>{throw new Error('Demo must not sign.');}}};
};
let initial:string|undefined;
beforeEach(async()=>{
 const {mocks}=await load();
 initial??=JSON.stringify(mocks.readMockState(),(_key,v)=>typeof v==='bigint'?{__peridotBigint:v.toString()}:v);
 storage.setItem('peridot:mock:v1:mainnet',initial);
 for(const key of storage.values.keys())if(key.startsWith('peridot:control-add:')||key.startsWith('peridot:pair-sync:'))storage.removeItem(key);
});

test('risk cap changes are immediate while CF waits a full 60 seconds and cannot apply twice',async()=>{
 const {c,factory,signer}=await load();
 const originalNow=Date.now;let now=1_800_000_000_000;Date.now=()=>now;
 try{
  const market=(await factory.getGroup(1)).markets[0];
  const cfg=await factory.getMarketConfig(1,market);
  await c.updateRisk(1,market,{...cfg,collateral_factor:650_000n,borrow_cap:321n},signer);
  assert.equal((await factory.getMarketConfig(1,market)).collateral_factor,700_000n);
  assert.equal((await factory.getMarketConfig(1,market)).borrow_cap,321n);
  const pending=(await c.loadControl(1)).pending[0];
  now+=59_000;
  await assert.rejects(c.applyPending(1,pending,signer),/60-second delay/);
  assert.equal((await factory.getMarketConfig(1,market)).collateral_factor,700_000n);
  now+=1000;
  await c.applyPending(1,pending,signer);
  assert.equal((await factory.getMarketConfig(1,market)).collateral_factor,650_000n);
  await assert.rejects(c.applyPending(1,pending,signer),/no longer pending/);
 }finally{Date.now=originalNow;}
});

test('non-owner changes and 90% collateral are rejected without state mutation',async()=>{
 const {c,factory,signer}=await load();
 const market=(await factory.getGroup(1)).markets[0];
 const cfg=await factory.getMarketConfig(1,market);
 await assert.rejects(c.updateBuffer(1,market,4000,{...signer,address:'not-the-owner'}),/current group owner/);
 await assert.rejects(c.updateRisk(1,market,{...cfg,collateral_factor:900_000n},signer),/1% and 75%/);
 assert.equal((await factory.getMarketConfig(1,market)).idle_buffer_bps,2000);
 assert.equal((await factory.getMarketConfig(1,market)).collateral_factor,700_000n);
});

test('margin shows target and applied incentive separately and enforces protocol fee cap',async()=>{
 const {c,signer}=await load();
 const originalNow=Date.now;let now=1_800_000_000_000;Date.now=()=>now;
 try{
  const before=(await c.loadControl(1)).margin!;
  await assert.rejects(c.updateMargin(1,{...before.cfg,liquidation_fee:500_001n},signer),/0% and 50%/);
  await c.updateMargin(1,{...before.cfg,max_leverage:4n,liquidation_incentive:1_100_000n},signer);
  const staged=await c.loadControl(1);
  assert.equal(staged.margin!.cfg.max_leverage,4n);
  assert.equal(staged.margin!.cfg.liquidation_incentive,1_100_000n);
  assert.equal(staged.margin!.applied_liquidation_incentive,1_080_000n);
  assert.equal(staged.margin!.incentive_applied,false);
  await assert.rejects(c.applyPending(1,staged.pending[0],signer),/60-second delay/);
  now+=60_000;await c.applyPending(1,staged.pending[0],signer);
  const applied=await c.loadControl(1);
  assert.equal(applied.margin!.applied_liquidation_incentive,1_100_000n);
  assert.equal(applied.margin!.incentive_applied,true);
  assert.equal(applied.pending.length,0);
 }finally{Date.now=originalNow;}
});

test('pool permission and binding are separate actions and binding requires permission',async()=>{
 const {c,mocks,signer}=await load();
 const pool=mocks.MOCK_USDC;const poolId='ab'.repeat(32);
 await assert.rejects(c.setPoolBinding(1,pool,poolId,true,signer),/Allow this pool/);
 await c.setPoolAllowed(1,pool,true,signer);
 assert.deepEqual((await c.loadControl(1)).margin!.pools,[pool]);
 const extras=mocks.readMockState().pending['control:1'] as {poolBindings?:Record<string,string>};
 assert.equal(extras.poolBindings?.[poolId],undefined);
 await c.setPoolBinding(1,pool,poolId,true,signer);
 assert.equal((mocks.readMockState().pending['control:1'] as typeof extras).poolBindings![poolId],pool);
 await assert.rejects(c.setPoolAllowed(1,pool,false,signer),/Only Peridot admin/);
 await assert.rejects(c.setPoolBinding(1,pool,poolId,false,signer),/Only Peridot admin/);
 assert.deepEqual((await c.loadControl(1)).margin!.pools,[pool]);
});

test('rewards start unfunded and control funding uses the shared launch state',async()=>{
 const {c,mocks,signer}=await load();
 await c.setGroupRewards(1,mocks.MOCK_USDC,signer);
 let state=mocks.readMockState();
 assert.deepEqual(state.pending['reward-token:1'],{address:mocks.MOCK_USDC,symbol:'USDC',decimals:7});
 assert.equal((state.pending['control:1'] as {rewardBalance:bigint}).rewardBalance,0n);
 const distributor=state.groups[0].reward_distributor!;
 await c.fundRewards(1,distributor,100n,signer);
 await c.withdrawRewards(1,signer.address,20n,signer);
 state=mocks.readMockState();assert.equal((state.pending['control:1'] as {rewardBalance:bigint}).rewardBalance,80n);
 await assert.rejects(c.withdrawRewards(1,signer.address,81n,signer),/exceeds available/);
 await assert.rejects(c.setGroupRewards(1,mocks.MOCK_XLM,signer),/cannot be changed/);
});

test('price binding rejects a different asset and market changes apply atomically after all delays',async()=>{
 const {c,factory,mocks,signer}=await load();
 const originalNow=Date.now;let now=1_800_000_000_000;Date.now=()=>now;
 try{
  const market=(await factory.getGroup(1)).markets[0];const cfg=await factory.getMarketConfig(1,market);
  await assert.rejects(c.updatePrice(1,market,{tag:'ReflectorOnly',values:[{oracle:mocks.MOCK_ORACLE,asset:{tag:'Other',values:['XLM']}}]},signer),/not bound/);
  await c.updateRisk(1,market,{...cfg,collateral_factor:650_000n},signer);
  now+=10_000;
  await c.updatePrice(1,market,{tag:'ReflectorOnly',values:[{oracle:mocks.MOCK_ORACLE,asset:{tag:'Stellar',values:[mocks.MOCK_USDC]}}]},signer);
  now+=50_000;
  const pending=(await c.loadControl(1)).pending.find(p=>p.kind==='risk')!;
  await assert.rejects(c.applyPending(1,pending,signer),/60-second delay/);
  assert.equal((await factory.getMarketConfig(1,market)).collateral_factor,700_000n);
  now+=10_000;await c.applyPending(1,pending,signer);
  assert.equal((await factory.getMarketConfig(1,market)).collateral_factor,650_000n);
  const price=(await factory.getMarketConfig(1,market)).price;assert.equal(price.tag,'ReflectorOnly');if(price.tag==='ReflectorOnly')assert.equal(price.values[0].asset.tag,'Stellar');
  assert.equal((await c.loadControl(1)).pending.length,0);
 }finally{Date.now=originalNow;}
});

test('a replaced proposal cannot be applied from a stale control snapshot',async()=>{
 const {c,factory,signer}=await load();const originalNow=Date.now;let now=1_800_000_000_000;Date.now=()=>now;
 try{
  const market=(await factory.getGroup(1)).markets[0],cfg=await factory.getMarketConfig(1,market);
  await c.updateRisk(1,market,{...cfg,collateral_factor:650_000n},signer);const old=(await c.loadControl(1)).pending[0];
  now+=1000;await c.updateRisk(1,market,{...cfg,collateral_factor:600_000n},signer);now+=60_000;
  await assert.rejects(c.applyPending(1,old,signer),/no longer pending/);
  assert.equal((await factory.getMarketConfig(1,market)).collateral_factor,700_000n);
 }finally{Date.now=originalNow;}
});

async function additionFixture(route:'None'|'Defindex'='None') {
 const ctx=await load();const {factory,mocks}=ctx;
 const cfg=await factory.getMarketConfig(1,(await factory.getGroup(1)).markets[0]);
 const token=Object.entries(mocks.readMockState().tokens).find(([,v])=>v.symbol==='EURC')!;
 return {...ctx,cfg:{...cfg,token:token[0],price:{tag:'ReflectorOnly' as const,values:[{oracle:mocks.MOCK_ORACLE,asset:{tag:'Other' as const,values:['EURC'] as const}}] as const},supply_reward_per_sec:0n,borrow_reward_per_sec:0n,yield_route:route==='None'?{tag:'None' as const,values:undefined}:{tag:'Defindex' as const,values:[{vault:mocks.MOCK_USDC}] as const}},token:{address:token[0],...token[1]}};
}

test('interrupted additions resume deployment, activation and attachment without duplicate markets',async()=>{
 const {c,factory,mocks,signer,cfg,token}=await additionFixture('Defindex');
 const before=(await factory.getGroup(1)).markets.length;
 const result=await c.addControlMarket(1,cfg,token,signer);
 assert.equal((await factory.getGroup(1)).markets.length,before);
 assert.equal((await c.getControlMarketRecord(1,result.value)).active,false);
 const recovered=await c.recoverMarketAddition(1,signer.address);
 assert.equal(recovered!.market,result.value);assert.equal(recovered!.active,false);assert.equal(recovered!.attached,false);
 await assert.rejects(c.addControlMarket(1,cfg,token,signer),/unfinished market addition/);
 await assert.rejects(c.attachMarketYield(1,result.value,signer),/Activate the market/);
 await assert.rejects(c.updateRewardSpeeds(1,result.value,1n,0n,signer),/Activate the market/);
 await assert.rejects(c.setGroupRewards(1,mocks.MOCK_USDC,signer),/Activate every pending/);
 await assert.rejects(c.finishMarketAddition(1,signer.address),/Finish activation/);
 await c.activateControlMarket(1,result.value,signer);
 assert.equal((await factory.getGroup(1)).markets.length,before+1);
 assert.equal((await c.recoverMarketAddition(1,signer.address))!.active,true);
 await assert.rejects(c.activateControlMarket(1,result.value,signer),/already active/);
 await c.attachMarketYield(1,result.value,signer);
 assert.equal((await c.recoverMarketAddition(1,signer.address))!.attached,true);
 assert.equal((await c.getControlMarketRecord(1,result.value)).boosted_vault,mocks.MOCK_USDC);
 await assert.rejects(c.attachMarketYield(1,result.value,signer),/already attached/);
 await c.finishMarketAddition(1,signer.address);assert.equal(c.readMarketAddition(1,signer.address),null);
 await assert.rejects(c.addControlMarket(1,cfg,token,signer),/already has a market/);
 assert.equal((await factory.getGroup(1)).markets.length,before+1);
});

test('market address recovery reads activation state after browser addition storage is lost',async()=>{
 const {c,factory,signer,cfg,token}=await additionFixture();
 const {value:market}=await c.addControlMarket(1,cfg,token,signer);
 for(const key of storage.values.keys())if(key.startsWith('peridot:control-add:')||key.startsWith('peridot:pair-sync:'))storage.removeItem(key);
 const recovered=await c.recoverMarketAddition(1,signer.address,market);
 assert.equal(recovered!.market,market);assert.equal(recovered!.active,false);assert.equal(recovered!.attached,true);
 await c.activateControlMarket(1,market,signer);
 await c.finishMarketAddition(1,signer.address);
 assert((await factory.getGroup(1)).markets.includes(market));
});

test('creation rejects rewards enabled groups, nonzero creation emissions and unapproved routes',async()=>{
 const {c,mocks,signer,cfg,token}=await additionFixture();
 await assert.rejects(c.addControlMarket(1,{...cfg,supply_reward_per_sec:1n},token,signer),/Creation reward speeds must be zero/);
 await assert.rejects(c.addControlMarket(1,{...cfg,yield_route:{tag:'Defindex',values:[{vault:'invalid'}]}},token,signer),/yield vault is not approved/);
 await c.setGroupRewards(1,mocks.MOCK_USDC,signer);
 await assert.rejects(c.addControlMarket(1,cfg,token,signer),/Markets cannot be added after group rewards/);
 assert.equal(c.readMarketAddition(1,signer.address),null);
});

test('margin incentive obeys the audited core 110 percent maximum',async()=>{
 const {c,signer}=await load();const margin=(await c.loadControl(1)).margin!;
 await assert.rejects(c.updateMargin(1,{...margin.cfg,liquidation_incentive:1_100_001n},signer),/102% and 110%/);
});


test('applying collateral rejects a changed or newly added companion price proposal',async()=>{
 const {c,factory,mocks,signer}=await load();const originalNow=Date.now;let now=1_800_000_000_000;Date.now=()=>now;
 try{
  const market=(await factory.getGroup(1)).markets[0],cfg=await factory.getMarketConfig(1,market);
  await c.updateRisk(1,market,{...cfg,collateral_factor:650_000n},signer);
  const cfOnly=(await c.loadControl(1)).pending.find(p=>p.kind==='risk')!;
  now+=1000;
  const external={tag:'ReflectorOnly' as const,values:[{oracle:mocks.MOCK_ORACLE,asset:{tag:'Other' as const,values:['USDC'] as const}}] as const};
  const stellar={tag:'ReflectorOnly' as const,values:[{oracle:mocks.MOCK_ORACLE,asset:{tag:'Stellar' as const,values:[mocks.MOCK_USDC] as const}}] as const};
  await c.updatePrice(1,market,external,signer);
  const both=(await c.loadControl(1)).pending.find(p=>p.kind==='risk')!;
  // Replace only the companion configuration at the same ETA, keeping selected CF unchanged.
  await c.updatePrice(1,market,stellar,signer);
  now+=60_000;
  await assert.rejects(c.applyPending(1,cfOnly,signer),/market proposals changed/);
  await assert.rejects(c.applyPending(1,both,signer),/market proposals changed/);
  assert.equal((await factory.getMarketConfig(1,market)).collateral_factor,700_000n);
  const refreshed=(await c.loadControl(1)).pending.find(p=>p.kind==='risk')!;
  assert.equal(refreshed.marketProposals!.price!.config.tag,'ReflectorOnly');
  await c.applyPending(1,refreshed,signer);
  assert.equal((await factory.getMarketConfig(1,market)).collateral_factor,650_000n);
  assert.deepEqual((await c.loadControl(1)).pending,[]);
 }finally{Date.now=originalNow;}
});

test('Vec0/1 proposal decoding rejects malformed vectors and preserves absence',async()=>{
 const {c}=await load();
 assert.deepEqual(c.marketProposalSnapshot({pending_cf:[],pending_price:[]}),{cf:undefined,price:undefined});
 const cf={cf:650000n,execute_after:123n};
 assert.deepEqual(c.marketProposalSnapshot({pending_cf:[cf],pending_price:[]}),{cf,price:undefined});
 assert.throws(()=>c.marketProposalSnapshot({pending_cf:[cf,cf],pending_price:[]}),/Unexpected/);
 assert.throws(()=>c.marketProposalSnapshot({pending_price:[]}),/Unexpected/);
});

test('market recovery storage separates factories and clears only a matching proven rejection',async()=>{
 const {c,signer,cfg,token}=await additionFixture();
 const {TransactionRejectedError,UnknownTransactionError}=await import('./rpc');
 assert.notEqual(c.marketAdditionStorageKey(1,signer.address,'factory-one'),c.marketAdditionStorageKey(1,signer.address,'factory-two'));
 const transaction={hash:'rejected-deployment',method:'add_market',contractId:'factory',maxTime:1000,submissionLedger:10};
 const addition={cfg,token,transaction};
 const key=c.marketAdditionStorageKey(1,signer.address);
 storage.setItem(key,JSON.stringify(addition,(_key,v)=>typeof v==='bigint'?{__controlBigint:String(v)}:v));
 assert.equal(c.clearRejectedMarketAddition(1,signer.address,addition,new UnknownTransactionError(transaction.hash)),false);
 assert.ok(c.readMarketAddition(1,signer.address));
 assert.equal(c.clearRejectedMarketAddition(1,signer.address,addition,new TransactionRejectedError('another-hash','rejected')),false);
 assert.equal(c.clearRejectedMarketAddition(1,signer.address,{...addition,market:'confirmed-market'},new TransactionRejectedError(transaction.hash,'rejected')),false);
 assert.equal(c.clearRejectedMarketAddition(1,signer.address,addition,new TransactionRejectedError(transaction.hash,'rejected')),true);
 assert.equal(c.readMarketAddition(1,signer.address),null);
});

for(const outcome of ['wallet rejected','unknown confirmation'] as const)test(`collateral receipt survives ${outcome} at sync and retry cannot apply collateral again`,async()=>{
 const {c,signer}=await load();const {UnknownTransactionError}=await import('./rpc');let applyCalls=0;
 const apply=async()=>{applyCalls++;return {hash:'confirmed-collateral-receipt'};};
 const sync=async()=>{throw outcome==='wallet rejected'?new Error('Wallet signature rejected'):new UnknownTransactionError('sync-receipt');};
 await assert.rejects(c.applyCollateralAndSync(1,apply,sync),error=>error instanceof c.CollateralSyncError&&error.receipt.hash==='confirmed-collateral-receipt');
 assert.equal(c.readPairSync(1)!.applyConfirmed,true);assert.equal(c.readPairSync(1)!.applyHash,'confirmed-collateral-receipt');
 await assert.rejects(c.applyCollateralAndSync(1,apply,sync),/previous leverage synchronization/);
 assert.equal(applyCalls,1);
 await c.syncLeverageLimits(1,signer);assert.equal(c.readPairSync(1),null);assert.equal(applyCalls,1);
});

test('companion CF apply persists sync recovery and removes the proposal even if second step fails',async()=>{
 const {c,factory,mocks,signer}=await load();const oldNow=Date.now;let now=1800000000000;Date.now=()=>now;
 try{
  const market=(await factory.getGroup(1)).markets[0],cfg=await factory.getMarketConfig(1,market);
  await c.updateRisk(1,market,{...cfg,collateral_factor:650000n},signer);
  await c.updatePrice(1,market,{tag:'ReflectorOnly',values:[{oracle:mocks.MOCK_ORACLE,asset:{tag:'Other',values:['USDC']}}]},signer);
  const proposal=(await c.loadControl(1)).pending.find(p=>p.kind==='price')!;now+=60000;
  await assert.rejects(c.applyPending(1,proposal,signer,p=>{if(p.message?.startsWith('Syncing leverage limits'))throw new Error('Rejected second-step signature');}),/Market changes were applied/);
  assert.equal((await factory.getMarketConfig(1,market)).collateral_factor,650000n);
  assert.equal((await c.loadControl(1)).pending.length,0);assert.equal((await c.loadControl(1)).pairSync!.applyConfirmed,true);
  await assert.rejects(c.applyPending(1,proposal,signer),/previous leverage synchronization/);
  await c.syncLeverageLimits(1,signer);
  assert.equal((await c.loadControl(1)).pairSync,null);
  assert.equal((mocks.readMockState().pending['pair-caps:1'] as Record<string,bigint>)[market],650000n);
  assert.equal(mocks.readMockState().history['1'].filter(h=>h.method==='apply_pending').length,1);
 }finally{Date.now=oldNow;}
});

test('control progress never adopts an unrelated global pending transaction',async()=>{
 const {c}=await load();const old={hash:'other-hash',method:'apply_pending',contractId:'factory'};
 assert.equal(c.captureControlTransaction({status:'unknown',hash:old.hash},false,'apply_pending','factory',old),undefined);
 assert.equal(c.captureControlTransaction({status:'unknown',hash:old.hash},true,'sync_pairs','margin-factory',old),undefined);
 const own={hash:'own-hash',method:'sync_pairs',contractId:'margin-factory',maxTime:123,submissionLedger:10};
 assert.deepEqual(c.captureControlTransaction({status:'submitting',hash:own.hash},true,'sync_pairs','margin-factory',own),own);
 assert.deepEqual(c.captureControlTransaction({status:'success',hash:own.hash},true,'sync_pairs','margin-factory',null,own),own);
});

test('control create and price updates reject unapproved exact feed tuples',async()=>{
 const {c,factory,mocks,signer,cfg,token}=await additionFixture();
 const wrongAsset={tag:'ReflectorOnly' as const,values:[{oracle:mocks.MOCK_ORACLE,asset:{tag:'Other' as const,values:['USDC'] as const}}] as const};
 await assert.rejects(c.addControlMarket(1,{...cfg,price:wrongAsset},token,signer),/price feed tuple is not approved/);
 const market=(await factory.getGroup(1)).markets[0];
 const wrongOracle={tag:'ReflectorOnly' as const,values:[{oracle:mocks.MOCK_USDC,asset:{tag:'Other' as const,values:['USDC'] as const}}] as const};
 await assert.rejects(c.updatePrice(1,market,wrongOracle,signer),/not bound/);
 assert.equal((await c.loadControl(1)).pending.length,0);
});

test('manual leverage synchronization is permissionless without changing group settings',async()=>{
 const {c,factory,mocks,signer}=await load();const before=await factory.getGroup(1);
 await c.syncLeverageLimits(1,{...signer,address:'another-connected-wallet'});
 assert.deepEqual(await factory.getGroup(1),before);
 assert.ok(mocks.readMockState().pending['pair-caps:1']);
 assert.equal(c.readPairSync(1),null);
});

for(const marginEnabled of [true,false])test(`price-only factory apply ${marginEnabled?'synchronizes pairs':'skips sync for non-margin groups'}`,async()=>{
 const {c,factory,mocks,signer}=await load();const oldNow=Date.now;let now=1800000000000;Date.now=()=>now;
 try{
  if(!marginEnabled)mocks.mutateMockState(state=>{state.groups.find(g=>g.id===1)!.margin_controller=undefined;});
  const market=(await factory.getGroup(1)).markets[0],before=await factory.getMarketConfig(1,market);
  await c.updatePrice(1,market,{tag:'ReflectorOnly',values:[{oracle:mocks.MOCK_ORACLE,asset:{tag:'Stellar',values:[mocks.MOCK_USDC]}}]},signer);
  const pending=(await c.loadControl(1)).pending[0];assert.equal(pending.kind,'price');assert.equal(pending.marketProposals?.cf,undefined);
  now+=60000;await c.applyPending(1,pending,signer);
  const history=mocks.readMockState().history['1'];
  assert.equal(history.filter(event=>event.method==='apply_pending').length,1);
  assert.equal(history.filter(event=>event.method==='sync_pairs').length,marginEnabled?1:0);
  assert.equal((await factory.getMarketConfig(1,market)).collateral_factor,before.collateral_factor);
  assert.equal((await c.loadControl(1)).pending.length,0);assert.equal(c.readPairSync(1),null);
 }finally{Date.now=oldNow;}
});

test('separate margin configuration apply does not call sync_pairs',async()=>{
 const {c,mocks,signer}=await load();const oldNow=Date.now;let now=1800000000000;Date.now=()=>now;
 try{
  const margin=(await c.loadControl(1)).margin!;
  await c.updateMargin(1,{...margin.cfg,liquidation_incentive:1100000n},signer);
  const pending=(await c.loadControl(1)).pending[0];assert.equal(pending.kind,'margin');
  now+=60000;await c.applyPending(1,pending,signer);
  assert.equal(mocks.readMockState().history['1'].filter(event=>event.method==='sync_pairs').length,0);
  assert.equal(c.readPairSync(1),null);
 }finally{Date.now=oldNow;}
});
