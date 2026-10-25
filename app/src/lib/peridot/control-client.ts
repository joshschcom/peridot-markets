import { Address, nativeToScVal, StrKey, xdr } from '@stellar/stellar-sdk';
import { network, getDeployments } from './network';
import { readContract, submitContract, getPendingTransaction, isDefinitivelyExpired, reconcilePendingTransaction, TransactionRejectedError, type PendingTransaction } from './rpc';
import type { Group, MarketConfig, RateModel, PriceConfig, GroupMarginConfig, MarginInfo } from './types';
import { tokenInfo, readRewards, type TokenInfo, type Signer, type Progress } from './group-client';
import { getGroup, getMarketConfig, normalizeContract, isPriceFeedAllowed, isYieldVaultAllowed } from './factory';

export type { Signer, Progress };
export interface MarketProposalSnapshot {cf?:{cf:bigint;execute_after:bigint};price?:{config:PriceConfig;execute_after:bigint};}
export interface PendingChange { id: string; market?: string; kind: 'risk'|'price'|'margin'; executeAfter: number; proposed: MarketConfig|PriceConfig|GroupMarginConfig; marketProposals?:MarketProposalSnapshot; }
export interface HistoryItem { id: string; label: string; at: number; hash?: string; market?: string; }
export interface ControlMarket { address: string; config: MarketConfig; token: TokenInfo; depositPaused: boolean; borrowPaused: boolean; }
export interface ControlMargin extends MarginInfo { applied_liquidation_incentive?:bigint; applied_liquidation_fee?:bigint; incentive_applied?:boolean; incentive_apply_after?:bigint; pools?:string[]; }
export interface ControlState { pairSync:PairSyncState|null; group: Group; markets: ControlMarket[]; pending: PendingChange[]; pendingAvailable: boolean; history: HistoryItem[]; historyError?: string; margin: ControlMargin|null; rewards: Awaited<ReturnType<typeof readRewards>>; }
export const addr = (v:string) => new Address(v).toScVal();
const u = (v:bigint|number,type:'u32'|'u128'|'u64'='u128') => nativeToScVal(v,{type});
const sym = (v:string) => xdr.ScVal.scvSymbol(v);
const struct = (v:Record<string,xdr.ScVal>) => xdr.ScVal.scvMap(Object.entries(v).sort(([a],[b])=>a.localeCompare(b)).map(([key,val])=>new xdr.ScMapEntry({key:sym(key),val})));
export function encodeRates(v:RateModel) {return struct({base:u(v.base),multiplier:u(v.multiplier),jump:u(v.jump),kink:u(v.kink)});}
export function encodePrice(v:PriceConfig) {
  if(v.tag!=='ReflectorOnly') throw new Error('Only Reflector pricing is available in phase 1.');
  const cfg=v.values[0],asset=cfg.asset;
  const encodedAsset=xdr.ScVal.scvVec([sym(asset.tag),asset.tag==='Stellar'?addr(asset.values[0]):sym(asset.values[0])]);
  return xdr.ScVal.scvVec([sym(v.tag),struct({oracle:addr(cfg.oracle),asset:encodedAsset})]);
}
function encodeMargin(v:GroupMarginConfig) {return struct({variant:xdr.ScVal.scvVec([sym(v.variant.tag)]),max_leverage:u(v.max_leverage),max_slippage:u(v.max_slippage),liquidation_incentive:u(v.liquidation_incentive),liquidation_fee:u(v.liquidation_fee)});}
const ownerArgs=(id:number,signer:Signer)=>[addr(signer.address),u(id,'u32')];
function factoryWrite<T>(method:string,args:xdr.ScVal[],signer:Signer,onProgress?:(v:Progress)=>void,margin=false) {
  const d=getDeployments();return submitContract<T>({contractId:margin?d.margin_factory:d.factory,method,args,signer,onProgress});
}
function validateRisk(v:MarketConfig) {
  const max=v.price.tag==='AquariusOnly'?500_000n:750_000n;
  if(v.collateral_factor<10_000n||v.collateral_factor>max)throw new Error(`Collateral factor must be between 1% and ${Number(max)/10000}%.`);
  if(v.supply_cap<=0n||v.borrow_cap<=0n)throw new Error('Supply and borrow caps must be greater than zero.');
  if(v.reserve_factor<0n||v.reserve_factor>500_000n)throw new Error('Reserve factor must be between 0% and 50%.');
}
export function validateMargin(v:GroupMarginConfig) {
  if(v.max_leverage<1n||v.max_leverage>5n)throw new Error('Maximum leverage must be between 1x and 5x.');
  if(v.max_slippage<=0n||v.max_slippage>100_000n)throw new Error('Slippage must be greater than 0% and at most 10%.');
  if(v.liquidation_incentive<1_020_000n||v.liquidation_incentive>1_100_000n)throw new Error('Liquidation incentive must be between 102% and 110%.');
  if(v.liquidation_fee<0n||v.liquidation_fee>500_000n)throw new Error('Liquidation fee must be between 0% and 50%.');
}

import { readMockState, mutateMockState, writeMockEvent, mockCreateMarket, mockActivateMarket, type MockState } from './mock';
import { getRpc } from './rpc';
import { scValToNative } from '@stellar/stellar-sdk';
interface Extras { changes:PendingChange[]; pauses:Record<string,{deposit:boolean;borrow:boolean}>; margin?:ControlMargin; rewardBalance?:bigint; rewardAccrued?:Record<string,bigint>; poolBindings?:Record<string,string>; }
function extras(state:MockState,id:number):Extras {
  const key=`control:${id}`;
  if(!state.pending[key])state.pending[key]={changes:[],pauses:{}} satisfies Extras;
  return state.pending[key] as Extras;
}
function mockMargin(state:MockState,id:number,ex:Extras):ControlMargin|null {
  const group=state.groups.find(g=>g.id===id);
  if(!group?.margin_controller)return null;
  ex.margin??={controller:group.margin_controller,swap_adapter:`mock-swap-${id}`,variant:{tag:'Audited',values:undefined},cfg:{variant:{tag:'Audited',values:undefined},max_leverage:3n,max_slippage:50_000n,liquidation_incentive:1_080_000n,liquidation_fee:0n},enabled_markets:group.markets.filter(m=>config(state,id,m).margin_enabled)};
  const margin=ex.margin;
  margin.applied_liquidation_incentive??=1_080_000n;
  margin.applied_liquidation_fee??=margin.cfg.liquidation_fee;
  margin.incentive_applied??=margin.applied_liquidation_incentive===margin.cfg.liquidation_incentive;
  margin.incentive_apply_after??=0n;
  margin.pools??=[];
  return margin;
}
function assertOwner(state:MockState,id:number,signer:Signer) {const g=state.groups.find(g=>g.id===id);if(!g||g.owner!==signer.address)throw new Error('Only the current group owner can change these settings.');return g;}
function mockWrite(id:number,method:string,signer:Signer,fn:(state:MockState,ex:Extras)=>void,onProgress?:(p:Progress)=>void) {
  onProgress?.({status:'simulating',message:'Checking demo guardrails...'});
  mutateMockState(state=>{assertOwner(state,id,signer);fn(state,extras(state,id));writeMockEvent(state,id,method,method.replaceAll('_',' '));});
  onProgress?.({status:'success',message:'Demo change saved. No onchain transaction.'});return Promise.resolve({hash:'',value:undefined});
}
function config(state:MockState,id:number,market:string) {const v=state.configs[`${id}:${market}`];if(!v)throw new Error('Market not found in this group.');return v;}
function stage(ex:Extras,kind:PendingChange['kind'],market:string|undefined,proposed:PendingChange['proposed']) {
  ex.changes=ex.changes.filter(p=>!(p.kind===kind&&p.market===market));
  ex.changes.push({id:`${kind}:${market||'group'}:${Date.now()}`,kind,market,executeAfter:Math.floor(Date.now()/1000)+60,proposed});
}
async function eventHistory(id:number):Promise<HistoryItem[]> {
  const d=getDeployments(),server=getRpc(),latest=await server.getLatestLedger();
  const response=await server.getEvents({startLedger:Math.max(1,latest.sequence-1000),filters:[{type:'contract',contractIds:[d.factory,...(d.margin_factory?[d.margin_factory]:[])]}],limit:100});
  return response.events.flatMap(e=>{
    const value=scValToNative(e.value) as Record<string,unknown>;
    const topics=e.topic.map(t=>scValToNative(t));
    if(!value||typeof value!=='object'||Number(topics[1]??value.group_id??value.group)!==id)return [];
    return [{id:e.id,label:topics.map(String).join(' · '),at:Math.floor(Date.parse(e.ledgerClosedAt)/1000),hash:e.txHash,market:typeof value.market==='string'?value.market:undefined}];
  }).reverse();
}
type PendingRecord = {pending_cf?:{cf:bigint;execute_after:bigint}[];pending_price?:{config:PriceConfig;execute_after:bigint}[]};
export function marketProposalSnapshot(record:PendingRecord):MarketProposalSnapshot {
  if(!Array.isArray(record.pending_cf)||record.pending_cf.length>1||!Array.isArray(record.pending_price)||record.pending_price.length>1)throw new Error('Unexpected staged market proposal response.');
  return {cf:record.pending_cf[0],price:record.pending_price[0]};
}
function mockMarketProposals(changes:PendingChange[],market:string):MarketProposalSnapshot {
  const cf=changes.find(p=>p.market===market&&p.kind==='risk'),price=changes.find(p=>p.market===market&&p.kind==='price');
  return {cf:cf?{cf:(cf.proposed as MarketConfig).collateral_factor,execute_after:BigInt(cf.executeAfter)}:undefined,price:price?{config:price.proposed as PriceConfig,execute_after:BigInt(price.executeAfter)}:undefined};
}
export function assertMarketProposalsUnchanged(reviewed:MarketProposalSnapshot|undefined,current:MarketProposalSnapshot):void {
  const sameCf=!!reviewed&&(!reviewed.cf&&!current.cf||!!reviewed.cf&&!!current.cf&&reviewed.cf.cf===current.cf.cf&&reviewed.cf.execute_after===current.cf.execute_after);
  const samePrice=!!reviewed&&(!reviewed.price&&!current.price||!!reviewed.price&&!!current.price&&reviewed.price.execute_after===current.price.execute_after&&encodePrice(reviewed.price.config).toXDR('base64')===encodePrice(current.price.config).toXDR('base64'));
  if(!sameCf||!samePrice)throw new Error('The staged market proposals changed. Refresh and review all collateral and price changes before signing.');
}

export async function loadControl(id:number):Promise<ControlState> {
  const group=await getGroup(id);
  const markets=await Promise.all(group.markets.map(async address=>{
    const c=await getMarketConfig(id,address);let token:TokenInfo;
    if(network.useMocks){const t=readMockState().tokens[c.token];token={address:c.token,symbol:t?.symbol||'Token',decimals:t?.decimals??7};}
    else token=await tokenInfo(c.token);
    const pause=network.useMocks?(extras(readMockState(),id).pauses[address]||{deposit:false,borrow:false}):{deposit:await readContract<boolean>(group.controller,'is_deposit_paused',[addr(address)]),borrow:await readContract<boolean>(group.controller,'is_borrow_paused',[addr(address)])};
    return {address,config:c,token,depositPaused:pause.deposit,borrowPaused:pause.borrow};
  }));
  const rewards=await readRewards(group,null);
  if(network.useMocks){const state=readMockState(),ex=extras(state,id);if(rewards&&ex.rewardBalance!==undefined)rewards.available=ex.rewardBalance;return {pairSync:readPairSync(id),group,markets,rewards,pending:ex.changes.map(change=>change.market?{...change,marketProposals:mockMarketProposals(ex.changes,change.market)}:change),pendingAvailable:true,history:(state.history[String(id)]||[]).map((h,i)=>({id:`${i}:${h.hash}`,label:h.detail||h.method,at:h.timestamp})).reverse(),margin:mockMargin(state,id,ex)};}
  let history:HistoryItem[]=[],historyError:string|undefined,margin:ControlMargin|null=null;
  try{history=await eventHistory(id);}catch(e){historyError=`Recent event history unavailable: ${e instanceof Error?e.message:String(e)}`;}
  if(group.margin_controller) {try{margin=normalizeContract<ControlMargin|undefined>(await readContract(getDeployments().margin_factory,'get_margin_status',[u(id,'u32')]))||null;}catch{historyError=(historyError?historyError+' ':'')+'Margin settings could not be loaded.';}}
  const pending:PendingChange[]=[];
  if(margin?.incentive_applied===false&&margin.incentive_apply_after&&margin.incentive_apply_after>0n)pending.push({id:`margin:group:${margin.incentive_apply_after}`,kind:'margin',executeAfter:Number(margin.incentive_apply_after),proposed:margin.cfg});
  for (const m of markets) {
    const record=normalizeContract<PendingRecord>(await readContract(getDeployments().factory,'get_market_record',[u(id,'u32'),addr(m.address)]));
    const marketProposals=marketProposalSnapshot(record);
    if(record.pending_cf?.[0]) pending.push({id:`risk:${m.address}:${record.pending_cf[0].execute_after}`,market:m.address,kind:'risk',marketProposals,executeAfter:Number(record.pending_cf[0].execute_after),proposed:{...m.config,collateral_factor:record.pending_cf[0].cf}});
    if(record.pending_price?.[0]) pending.push({id:`price:${m.address}:${record.pending_price[0].execute_after}`,market:m.address,kind:'price',marketProposals,executeAfter:Number(record.pending_price[0].execute_after),proposed:record.pending_price[0].config});
  }
  return {pairSync:readPairSync(id),group,markets,rewards,pending,pendingAvailable:true,history,historyError,margin};
}
export async function updateRisk(id:number,market:string,next:MarketConfig,signer:Signer,onProgress?:(p:Progress)=>void) {
  validateRisk(next);
  if(network.useMocks)return mockWrite(id,'update_risk',signer,(state,ex)=>{const c=config(state,id,market);if(c.collateral_factor!==next.collateral_factor)stage(ex,'risk',market,next);state.configs[`${id}:${market}`]={...c,supply_cap:next.supply_cap,borrow_cap:next.borrow_cap,reserve_factor:next.reserve_factor};},onProgress);
  return factoryWrite('update_risk',[...ownerArgs(id,signer),addr(market),u(next.collateral_factor),u(next.supply_cap),u(next.borrow_cap),u(next.reserve_factor)],signer,onProgress);
}
export async function updateRates(id:number,market:string,rates:RateModel,signer:Signer,onProgress?:(p:Progress)=>void) {
  if([rates.base,rates.multiplier,rates.jump].some(v=>v<0n||v>10_000_000n)||rates.kink<0n||rates.kink>1_000_000n)throw new Error('Rate inputs must be 0% to 1,000%; kink must be 0% to 100%.');
  if(network.useMocks)return mockWrite(id,'update_rates',signer,state=>{config(state,id,market).rates=rates;},onProgress);
  return factoryWrite('update_rates',[...ownerArgs(id,signer),addr(market),encodeRates(rates)],signer,onProgress);
}
export async function updateBuffer(id:number,market:string,bps:number,signer:Signer,onProgress?:(p:Progress)=>void) {
  if(!Number.isInteger(bps)||bps<1000||bps>10000)throw new Error('Kept liquid must be between 10% and 100%.');
  if(network.useMocks)return mockWrite(id,'update_idle_buffer',signer,state=>{config(state,id,market).idle_buffer_bps=bps;},onProgress);
  return factoryWrite('update_idle_buffer',[...ownerArgs(id,signer),addr(market),u(bps,'u32')],signer,onProgress);
}
export async function updatePrice(id:number,market:string,price:PriceConfig,signer:Signer,onProgress?:(p:Progress)=>void) {
  const encoded=encodePrice(price);
  const current=await getMarketConfig(id,market);
  if(!await isPriceFeedAllowed(current.token,price))throw new Error('The price feed tuple is not bound to this token or is not approved by the factory.');
  if(network.useMocks)return mockWrite(id,'update_price',signer,(_state,ex)=>stage(ex,'price',market,price),onProgress);
  return factoryWrite('update_price',[...ownerArgs(id,signer),addr(market),encoded],signer,onProgress);
}
export async function updateRewardSpeeds(id:number,market:string,supply:bigint,borrow:bigint,signer:Signer,onProgress?:(p:Progress)=>void) {
  if(supply<0n||borrow<0n||supply>1_000_000_000_000n||borrow>1_000_000_000_000n)throw new Error('Reward speed exceeds the allowed range.');
  if(network.useMocks)return mockWrite(id,'set_reward_speeds',signer,state=>{const group=state.groups.find(g=>g.id===id)!;if(!group.markets.includes(market))throw new Error('Activate the market before setting reward speeds.');if(!group.reward_distributor)throw new Error('Enable group rewards before setting reward speeds.');const c=config(state,id,market);c.supply_reward_per_sec=supply;c.borrow_reward_per_sec=borrow;},onProgress);
  return factoryWrite('set_reward_speeds',[...ownerArgs(id,signer),addr(market),u(supply),u(borrow)],signer,onProgress);
}
export async function pauseMarket(id:number,market:string,deposit:boolean,borrow:boolean,signer:Signer,onProgress?:(p:Progress)=>void) {
  if(network.useMocks)return mockWrite(id,'pause_market',signer,(_state,ex)=>{ex.pauses[market]={deposit,borrow};},onProgress);
  return factoryWrite('pause_market',[...ownerArgs(id,signer),addr(market),nativeToScVal(deposit),nativeToScVal(borrow)],signer,onProgress);
}
export interface PairSyncState { applyConfirmed:boolean; applyHash?:string; applyTransaction?:PendingTransaction; syncTransaction?:PendingTransaction; }
const pairSyncKey=(id:number)=>`peridot:pair-sync:${network.name}:${network.useMocks?'demo':getDeployments().margin_factory}:${id}`;
export function readPairSync(id:number):PairSyncState|null {
  if(typeof window==='undefined')return null;
  return JSON.parse(window.localStorage.getItem(pairSyncKey(id))||'null');
}
function savePairSync(id:number,state:PairSyncState|null) {
  if(typeof window==='undefined')throw new Error('Browser storage is required to recover leverage synchronization.');
  if(state)window.localStorage.setItem(pairSyncKey(id),JSON.stringify(state));else window.localStorage.removeItem(pairSyncKey(id));
}
export class CollateralSyncError extends Error {
  constructor(public readonly receipt:{hash:string},public readonly syncError:unknown){super(`Collateral changes were applied${receipt.hash?` in transaction ${receipt.hash}`:''}. Leverage synchronization is still required. Use Sync leverage limits to continue. ${syncError instanceof Error?syncError.message:String(syncError)}`);this.name='CollateralSyncError';}
}
/** Ignore a global pending transaction reported before this invocation started simulation. */
export function captureControlTransaction(progress:Progress,started:boolean,method:string,contractId:string,shared:PendingTransaction|null,previous?:PendingTransaction):PendingTransaction|undefined {
  if(!started||!progress.hash)return previous;
  if(shared)return shared.hash===progress.hash&&shared.method===method&&shared.contractId===contractId?shared:previous;
  if(previous?.hash===progress.hash)return previous;
  return ['submitting','confirming','success'].includes(progress.status)?{hash:progress.hash,method,contractId}:previous;
}
/** Keep the first receipt even if the independent second transaction is rejected or unconfirmed. */
export async function applyCollateralAndSync<T extends {hash:string}>(id:number,apply:(progress:(p:Progress)=>void)=>Promise<T>,sync:()=>Promise<unknown>,onProgress?:(p:Progress)=>void,owner?:string):Promise<T> {
  if(readPairSync(id))throw new Error('Resolve the previous leverage synchronization with Sync leverage limits before applying another collateral change.');
  const state:PairSyncState={applyConfirmed:false};savePairSync(id,state);
  let receipt:T,started=false;
  try{
    receipt=await apply(progress=>{
      if(progress.status==='simulating')started=true;
      const tx=captureControlTransaction(progress,started,'apply_pending',network.useMocks?'demo-market-factory':getDeployments().factory,owner?getPendingTransaction(owner):null,state.applyTransaction);
      if(tx){state.applyHash=tx.hash;state.applyTransaction=tx;savePairSync(id,state);}
      onProgress?.(progress);
    });
  }catch(error){
    if(!state.applyHash||(error instanceof TransactionRejectedError&&error.hash===state.applyHash))savePairSync(id,null);
    throw error;
  }
  state.applyHash=receipt.hash;state.applyConfirmed=true;savePairSync(id,state);
  try{await sync();}catch(error){throw new CollateralSyncError(receipt,error);}
  return receipt;
}
export async function syncLeverageLimits(id:number,signer:Signer,onProgress?:(p:Progress)=>void) {
  if(!(await getGroup(id)).margin_controller)throw new Error('Margin is not enabled for this group.');
  let state=readPairSync(id);
  if(state&&!state.applyConfirmed&&!network.useMocks){
    if(!state.applyHash){savePairSync(id,null);state=null;}
    else{
      const result=await getRpc().getTransaction(state.applyHash);
      if(result.status==='SUCCESS'){
        if(getPendingTransaction(signer.address)?.hash===state.applyHash)await reconcilePendingTransaction(signer.address);
        state.applyConfirmed=true;savePairSync(id,state);
      }else if(result.status==='FAILED'||!!state.applyTransaction&&isDefinitivelyExpired(state.applyTransaction,result)){
        if(getPendingTransaction(signer.address)?.hash===state.applyHash)await reconcilePendingTransaction(signer.address);
        savePairSync(id,null);throw new Error('The collateral transaction did not succeed. Refresh and review its pending proposal.');
      }else throw new Error('The collateral transaction remains unconfirmed. Do not repeat it; check again before synchronizing leverage.');
    }
  }
  if(state?.syncTransaction&&!network.useMocks){
    const transaction=state.syncTransaction,result=await getRpc().getTransaction(transaction.hash);
    if(result.status==='SUCCESS'){
      if(getPendingTransaction(signer.address)?.hash===transaction.hash)await reconcilePendingTransaction(signer.address);
      savePairSync(id,null);onProgress?.({status:'success',hash:transaction.hash,message:'Leverage limits synchronized.'});return {hash:transaction.hash,value:undefined};
    }
    if(result.status==='FAILED'||isDefinitivelyExpired(transaction,result)){
      if(getPendingTransaction(signer.address)?.hash===transaction.hash)await reconcilePendingTransaction(signer.address);
      delete state.syncTransaction;savePairSync(id,state);
    }else throw new Error('The leverage synchronization transaction remains unconfirmed. Check again before signing another.');
  }
  state??={applyConfirmed:true};savePairSync(id,state);
  const syncState=state;let started=false;
  const progress=(p:Progress)=>{
    if(p.status==='simulating')started=true;
    const tx=captureControlTransaction(p,started,'sync_pairs',getDeployments().margin_factory,getPendingTransaction(signer.address),syncState.syncTransaction);
    if(tx){syncState.syncTransaction=tx;savePairSync(id,syncState);}
    onProgress?.({...p,message:p.message||'Syncing leverage limits. This is a separate transaction.'});
  };
  try{
    onProgress?.({status:'simulating',message:'Syncing leverage limits. This is a separate transaction.'});
    let result:{hash:string;value:unknown};
    if(network.useMocks){
      mutateMockState(mock=>{mock.pending[`pair-caps:${id}`]=Object.fromEntries(mock.groups.find(g=>g.id===id)!.markets.map(m=>[m,config(mock,id,m).collateral_factor]));writeMockEvent(mock,id,'sync_pairs','sync leverage limits');});
      onProgress?.({status:'success',message:'Demo leverage limits synchronized. No onchain transaction.'});result={hash:'',value:undefined};
    }else result=await factoryWrite('sync_pairs',[u(id,'u32')],signer,progress,true);
    savePairSync(id,null);return result;
  }catch(error){
    if(error instanceof TransactionRejectedError&&syncState.syncTransaction?.hash===error.hash){delete syncState.syncTransaction;savePairSync(id,syncState);}
    throw error;
  }
}
export async function applyPending(id:number,pending:PendingChange|undefined,signer:Signer,onProgress?:(p:Progress)=>void) {
  const group=await getGroup(id);
  const hasCollateral=pending?.kind==='risk'||!!pending?.marketProposals?.cf||!pending;
  if(group.margin_controller&&hasCollateral)return applyCollateralAndSync(id,p=>applyPendingTransaction(id,pending,signer,p),()=>syncLeverageLimits(id,signer,onProgress),onProgress,signer.address);
  return applyPendingTransaction(id,pending,signer,onProgress);
}
async function applyPendingTransaction(id:number,pending:PendingChange|undefined,signer:Signer,onProgress?:(p:Progress)=>void) {
  if(network.useMocks)return mockWrite(id,'apply_pending',signer,(state,ex)=>{
    if(pending&&!ex.changes.some(p=>p.id===pending.id))throw new Error('This proposal is no longer pending. Refresh the settings.');
    if(pending?.market)assertMarketProposalsUnchanged(pending.marketProposals,mockMarketProposals(ex.changes,pending.market));
    const changes=pending?ex.changes.filter(p=>pending.kind==='margin'?p.id===pending.id:p.market===pending.market):ex.changes.filter(p=>!p.market);
    if(!changes.length)throw new Error('This proposal is no longer pending. Refresh the settings.');
    if(changes.some(p=>p.executeAfter>Math.floor(Date.now()/1000)))throw new Error('The 60-second delay has not elapsed.');
    for(const p of changes){if(p.kind==='risk'&&p.market)config(state,id,p.market).collateral_factor=(p.proposed as MarketConfig).collateral_factor;if(p.kind==='price'&&p.market)config(state,id,p.market).price=p.proposed as PriceConfig;if(p.kind==='margin'&&ex.margin){ex.margin.applied_liquidation_incentive=ex.margin.cfg.liquidation_incentive;ex.margin.incentive_applied=true;ex.margin.incentive_apply_after=0n;}}
    ex.changes=ex.changes.filter(p=>!changes.includes(p));
  },onProgress);
  if(pending){
    let unchanged=false;
    if(pending.kind==='margin'){
      const current=normalizeContract<ControlMargin|undefined>(await readContract(getDeployments().margin_factory,'get_margin_status',[u(id,'u32')]));
      unchanged=!!current&&current.incentive_applied===false&&Number(current.incentive_apply_after)===pending.executeAfter&&encodeMargin(current.cfg).toXDR('base64')===encodeMargin(pending.proposed as GroupMarginConfig).toXDR('base64');
    }else if(pending.market){
      const current=normalizeContract<PendingRecord>(await readContract(getDeployments().factory,'get_market_record',[u(id,'u32'),addr(pending.market)]));
      const proposals=marketProposalSnapshot(current);
      assertMarketProposalsUnchanged(pending.marketProposals,proposals);
      const latestEta=[proposals.cf?.execute_after??0n,proposals.price?.execute_after??0n].reduce((a,b)=>a>b?a:b);
      if(latestEta>BigInt(Math.floor(Date.now()/1000)))throw new Error('The 60-second delay has not elapsed for every market proposal.');
      unchanged=!!proposals.cf||!!proposals.price;
    }
    if(!unchanged)throw new Error('The staged proposal changed or was already applied. Refresh and review it before signing.');
  }
  if(pending?.kind==='margin')return factoryWrite('apply_margin',ownerArgs(id,signer),signer,onProgress,true);
  return factoryWrite('apply_pending',[...ownerArgs(id,signer),pending?.market?addr(pending.market):xdr.ScVal.scvVoid()],signer,onProgress);
}
export async function fundRewards(id:number,distributor:string,amount:bigint,signer:Signer,onProgress?:(p:Progress)=>void) {
  if(amount<=0n)throw new Error('Enter a funding amount greater than zero.');
  if(network.useMocks)return mockWrite(id,'fund_rewards',signer,(_state,ex)=>{ex.rewardBalance=(ex.rewardBalance??0n)+amount;},onProgress);
  return submitContract({contractId:distributor,method:'fund',args:[addr(signer.address),nativeToScVal(amount,{type:'i128'})],signer,onProgress});
}
export async function withdrawRewards(id:number,to:string,amount:bigint,signer:Signer,onProgress?:(p:Progress)=>void) {
  Address.fromString(to);if(amount<=0n)throw new Error('Enter a withdrawal amount greater than zero.');
  if(network.useMocks)return mockWrite(id,'withdraw_unallocated_rewards',signer,(_state,ex)=>{const balance=ex.rewardBalance??0n;if(amount>balance)throw new Error('Amount exceeds available rewards.');ex.rewardBalance=balance-amount;},onProgress);
  return factoryWrite('withdraw_unallocated',[...ownerArgs(id,signer),addr(to),nativeToScVal(amount,{type:'i128'})],signer,onProgress);
}
export async function transferOwnership(id:number,to:string,signer:Signer,onProgress?:(p:Progress)=>void) {
  Address.fromString(to);if(to===signer.address)throw new Error('Enter a different owner address.');
  if(network.useMocks)return mockWrite(id,'transfer_ownership',signer,state=>{assertOwner(state,id,signer).owner=to;},onProgress);
  return factoryWrite('transfer_ownership',[...ownerArgs(id,signer),addr(to)],signer,onProgress);
}
export async function updateMargin(id:number,cfg:GroupMarginConfig,signer:Signer,onProgress?:(p:Progress)=>void) {
  validateMargin(cfg);
  if(network.useMocks)return mockWrite(id,'update_margin',signer,(state,ex)=>{
    const margin=mockMargin(state,id,ex);if(!margin)throw new Error('Enable margin from the launch flow first.');
    if(cfg.variant.tag!==margin.variant.tag)throw new Error('Margin variant cannot be changed for this group.');
    const previous=margin.cfg;
    const pending=margin.incentive_applied===false;
    const ready=pending&&Number(margin.incentive_apply_after||0n)<=Math.floor(Date.now()/1000);
    if(pending&&!ready&&cfg.liquidation_incentive===previous.liquidation_incentive&&cfg.liquidation_fee!==previous.liquidation_fee)throw new Error('Apply the pending liquidation incentive before changing its protocol fee.');
    margin.cfg=cfg;
    if(cfg.liquidation_incentive!==previous.liquidation_incentive){
      ex.changes=ex.changes.filter(p=>p.kind!=='margin');
      if(cfg.liquidation_incentive===margin.applied_liquidation_incentive){margin.incentive_applied=true;margin.incentive_apply_after=0n;}
      else {stage(ex,'margin',undefined,cfg);margin.incentive_applied=false;margin.incentive_apply_after=BigInt(ex.changes.find(p=>p.kind==='margin')!.executeAfter);}
    }else if(ready){margin.applied_liquidation_incentive=cfg.liquidation_incentive;margin.incentive_applied=true;margin.incentive_apply_after=0n;ex.changes=ex.changes.filter(p=>p.kind!=='margin');}
    margin.applied_liquidation_fee=cfg.liquidation_fee;
  },onProgress);
  return factoryWrite('update_margin',[...ownerArgs(id,signer),encodeMargin(cfg)],signer,onProgress,true);
}
export async function setMarketMargin(id:number,market:string,enabled:boolean,signer:Signer,onProgress?:(p:Progress)=>void) {
  if(network.useMocks)return mockWrite(id,'set_market_margin',signer,state=>{const c=config(state,id,market);if(c.price.tag==='AquariusOnly'&&enabled)throw new Error('Aquarius-only pricing cannot enable margin.');if(enabled&&(state.tokens[c.token]?.decimals??7)!==7)throw new Error('Margin requires seven-decimal tokens.');const margin=mockMargin(state,id,extras(state,id));if(!margin)throw new Error('Margin is not enabled for this group.');c.margin_enabled=enabled;margin.enabled_markets=enabled?Array.from(new Set([...margin.enabled_markets,market])):margin.enabled_markets.filter(m=>m!==market);},onProgress);
  return factoryWrite('set_market_margin',[...ownerArgs(id,signer),addr(market),nativeToScVal(enabled)],signer,onProgress,true);
}
function validatePool(pool:string) { if(!StrKey.isValidContract(pool))throw new Error('Enter a valid pool contract address.'); }
export async function setPoolAllowed(id:number,pool:string,allowed:boolean,signer:Signer,onProgress?:(p:Progress)=>void) {
  if(!allowed)throw new Error('Only Peridot admin can revoke an exit pool or binding.');
  validatePool(pool);
  if(network.useMocks)return mockWrite(id,'set_pool_allowed',signer,(state,ex)=>{const margin=mockMargin(state,id,ex);if(!margin)throw new Error('Margin is not enabled.');margin.pools=allowed?Array.from(new Set([...(margin.pools||[]),pool])):(margin.pools||[]).filter(p=>p!==pool);},onProgress);
  return factoryWrite('set_pool_allowed',[...ownerArgs(id,signer),addr(pool),nativeToScVal(allowed)],signer,onProgress,true);
}
export async function setPoolBinding(id:number,pool:string,poolId:string,allowed:boolean,signer:Signer,onProgress?:(p:Progress)=>void) {
  if(!allowed)throw new Error('Only Peridot admin can revoke an exit pool or binding.');
  validatePool(pool);if(!/^[a-fA-F0-9]{64}$/.test(poolId)||/^0+$/.test(poolId))throw new Error('Pool ID must be a nonzero 32-byte hex value.');
  if(network.useMocks)return mockWrite(id,'set_pool_binding',signer,(state,ex)=>{const margin=mockMargin(state,id,ex);if(!margin)throw new Error('Margin is not enabled.');if(allowed&&!margin.pools?.includes(pool))throw new Error('Allow this pool before adding its binding.');ex.poolBindings??={};if(allowed)ex.poolBindings[poolId.toLowerCase()]=pool;else delete ex.poolBindings[poolId.toLowerCase()];},onProgress);
  const bytes=Uint8Array.from(poolId.match(/../g)!,byte=>parseInt(byte,16));
  return factoryWrite('set_pool_binding',[...ownerArgs(id,signer),nativeToScVal(bytes,{type:'bytes'}),addr(pool),nativeToScVal(allowed)],signer,onProgress,true);
}

import { encodeMarketConfig } from './factory';
function mockAddress() {const bytes=new Uint8Array(32);crypto.getRandomValues(bytes);return StrKey.encodeContract(Buffer.from(bytes));}
export interface ControlMarketRecord {cfg:MarketConfig;active:boolean;boosted_vault?:string;adapter?:string;}
export async function getControlMarketRecord(id:number,market:string):Promise<ControlMarketRecord> {
  if(network.useMocks){const state=readMockState();return {cfg:config(state,id,market),active:state.groups.find(g=>g.id===id)?.markets.includes(market)??false,...state.pending[`market-record:${id}:${market}`] as object};}
  return normalizeContract(await readContract(getDeployments().factory,'get_market_record',[u(id,'u32'),addr(market)]));
}
export interface MarketAddition {cfg:MarketConfig;token:TokenInfo;market?:string;transaction?:PendingTransaction;active?:boolean;attached?:boolean;}
export const marketAdditionStorageKey=(id:number,owner:string,factory=network.useMocks?'mock-factory':getDeployments().factory)=>`peridot:control-add:${network.name}:${factory}:${id}:${owner}`;
const additionKey=marketAdditionStorageKey;
export function readMarketAddition(id:number,owner:string):MarketAddition|null {
  if(typeof window==='undefined')return null;
  return JSON.parse(window.localStorage.getItem(additionKey(id,owner))||'null',(_key,value)=>value&&typeof value==='object'&&'__controlBigint' in value?BigInt(value.__controlBigint):value);
}
function saveMarketAddition(id:number,owner:string,value:MarketAddition|null) {
  if(typeof window==='undefined')throw new Error('Market creation requires browser storage for recovery.');
  if(value)window.localStorage.setItem(additionKey(id,owner),JSON.stringify(value,(_key,v)=>typeof v==='bigint'?{__controlBigint:String(v)}:v));
  else window.localStorage.removeItem(additionKey(id,owner));
}
/** Reconcile the original transaction before considering another deployment. */
export async function recoverMarketAddition(id:number,owner:string,knownMarket?:string):Promise<MarketAddition|null> {
  let addition=readMarketAddition(id,owner);
  if(knownMarket){
    const record=await getControlMarketRecord(id,knownMarket),token=await tokenInfo(record.cfg.token);
    addition={cfg:record.cfg,token,market:knownMarket};
    saveMarketAddition(id,owner,addition);
  }
  if(!addition)return null;
  if(!addition.market&&!network.useMocks){
    const shared=getPendingTransaction(owner);
    const transaction=addition.transaction||(shared?.method==='add_market'&&shared.contractId===getDeployments().factory?shared:undefined);
    if(transaction){
      addition.transaction=transaction;saveMarketAddition(id,owner,addition);
      const result=await getRpc().getTransaction(transaction.hash);
      if(result.status==='SUCCESS'){
        if(!result.returnValue)throw new Error('The confirmed creation has no market address. Recover using the market address from its transaction.');
        addition.market=scValToNative(result.returnValue) as string;
        if(shared?.hash===transaction.hash)await reconcilePendingTransaction(owner);
      }else if(result.status==='FAILED'||isDefinitivelyExpired(transaction,result)){
        if(shared?.hash===transaction.hash)await reconcilePendingTransaction(owner);
        saveMarketAddition(id,owner,null);return null;
      }else throw new Error('The original market deployment is still unconfirmed. Check its transaction before trying again.');
    }else {saveMarketAddition(id,owner,null);return null;}
  }
  if(addition.market){
    const record=await getControlMarketRecord(id,addition.market);
    addition={...addition,cfg:record.cfg,active:record.active,attached:record.cfg.yield_route.tag==='None'||!!record.boosted_vault||!!record.adapter};
    saveMarketAddition(id,owner,addition);
  }
  return addition;
}
export async function finishMarketAddition(id:number,owner:string) {
  const addition=await recoverMarketAddition(id,owner);
  if(addition&&(!addition.active||!addition.attached))throw new Error('Finish activation and yield attachment before adding another market.');
  saveMarketAddition(id,owner,null);
}
async function validateNewMarket(id:number,cfg:MarketConfig,signer:Signer) {
  validateRisk(cfg);
  const group=await getGroup(id);
  if(group.owner!==signer.address)throw new Error('Only the current group owner can change these settings.');
  if(group.reward_distributor)throw new Error('Markets cannot be added after group rewards are enabled.');
  if(cfg.supply_reward_per_sec!==0n||cfg.borrow_reward_per_sec!==0n)throw new Error('Creation reward speeds must be zero. Set emissions after activation and enabling rewards.');
  if(!await isPriceFeedAllowed(cfg.token,cfg.price))throw new Error('The price feed tuple is not approved for this token by the factory.');
  const route=cfg.yield_route;
  if(route.tag!=='None'){
    const vault=route.tag==='Defindex'?route.values[0].vault:route.tag==='Blend'?route.values[0].fee_vault:'';
    if(!vault||!await isYieldVaultAllowed(vault))throw new Error('The yield vault is not approved by this factory.');
  }
}
export async function addControlMarket(id:number,cfg:MarketConfig,token:TokenInfo,signer:Signer,onProgress?:(p:Progress)=>void) {
  await validateNewMarket(id,cfg,signer);
  const existing=await recoverMarketAddition(id,signer.address);
  if(existing)throw new Error('An unfinished market addition exists. Resume it before deploying another market.');
  const addition:MarketAddition={cfg,token};saveMarketAddition(id,signer.address,addition);
  let submissionStarted=false;
  const progress=(p:Progress)=>{if(p.status==='simulating')submissionStarted=true;if(p.hash&&submissionStarted){addition.transaction=getPendingTransaction(signer.address)||addition.transaction||{hash:p.hash,method:'add_market',contractId:getDeployments().factory};saveMarketAddition(id,signer.address,addition);}onProgress?.(p);};
  try {
    let result:{hash:string;value:string};
    if(network.useMocks){const market=mockAddress();await mockWrite(id,'add_market',signer,state=>mockCreateMarket(state,id,market,cfg,token),onProgress);result={hash:'',value:market};}
    else result=await factoryWrite<string>('add_market',[...ownerArgs(id,signer),encodeMarketConfig(cfg)],signer,progress);
    addition.market=result.value;saveMarketAddition(id,signer.address,addition);
    await recoverMarketAddition(id,signer.address);return result;
  }catch(error){if(!clearRejectedMarketAddition(id,signer.address,addition,error)&&!addition.transaction&&!addition.market)saveMarketAddition(id,signer.address,null);throw error;}
}
/** Clear only a proven rejection for this deployment; never discard a confirmed market. */
export function clearRejectedMarketAddition(id:number,owner:string,addition:MarketAddition,error:unknown):boolean {
  if(error instanceof TransactionRejectedError&&!addition.market&&addition.transaction?.hash===error.hash){saveMarketAddition(id,owner,null);return true;}
  return false;
}
export async function activateControlMarket(id:number,market:string,signer:Signer,onProgress?:(p:Progress)=>void) {
  const record=await getControlMarketRecord(id,market);
  if(record.active)throw new Error('Market is already active. Refresh the addition status.');
  if(network.useMocks)return mockWrite(id,'activate_market',signer,state=>mockActivateMarket(state,id,market),onProgress);
  return factoryWrite('activate_market',[...ownerArgs(id,signer),addr(market)],signer,onProgress);
}
export async function attachMarketYield(id:number,market:string,signer:Signer,onProgress?:(p:Progress)=>void) {
  const record=await getControlMarketRecord(id,market);
  if(!record.active)throw new Error('Activate the market before attaching yield.');
  if(record.boosted_vault||record.adapter)throw new Error('Yield is already attached. Refresh the addition status.');
  if(record.cfg.yield_route.tag==='None')throw new Error('This market has no yield route to attach.');
  if(network.useMocks)return mockWrite(id,'attach_yield',signer,state=>{const route=record.cfg.yield_route;state.pending[`market-record:${id}:${market}`]={active:true,boosted_vault:route.tag==='Defindex'?route.values[0].vault:`mock-adapter-${market}`,adapter:route.tag==='Blend'?`mock-adapter-${market}`:undefined};},onProgress);
  return factoryWrite('attach_yield',[...ownerArgs(id,signer),addr(market)],signer,onProgress);
}
export async function setGroupRewards(id:number,token:string,signer:Signer,onProgress?:(p:Progress)=>void) {
  Address.fromString(token);
  if(network.useMocks)return mockWrite(id,'set_rewards',signer,state=>{const group=assertOwner(state,id,signer);if(group.reward_distributor)throw new Error('Reward token is already set and cannot be changed.');if(Object.keys(state.configs).some(key=>key.startsWith(`${id}:`)&&!group.markets.includes(key.slice(`${id}:`.length))))throw new Error('Activate every pending market before enabling rewards.');const metadata=state.tokens[token];if(!metadata)throw new Error('Verify the reward token metadata first.');group.reward_distributor=`mock-rewards-${id}`;state.pending[`reward-token:${id}`]={address:token,...metadata};extras(state,id).rewardBalance=0n;},onProgress);
  return factoryWrite('set_rewards',[...ownerArgs(id,signer),addr(token)],signer,onProgress);
}
