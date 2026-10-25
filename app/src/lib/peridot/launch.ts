import { Address, StrKey, scValToNative, xdr } from '@stellar/stellar-sdk';
import type { GroupMarginConfig, MarketConfig } from './types';
import { getDeployments, network } from './network';
import { parseAmount } from './amount';
import { encodeMarketConfig, getTokenMetadata, isOracleAllowed, isYieldVaultAllowed, normalizeContract, scBool, scAddress, scEnum, scI128, scMap, scSymbol, scU128, scU32, writeFactory } from './factory';
import { assertRpcNetwork, getPendingTransaction, getRpc, isDefinitivelyExpired, readContract, readContractRaw, reconcilePendingTransaction, submitContract, TransactionRejectedError, type PendingTransaction, type Signer, type TxProgress } from './rpc';
import { mockCreateMarket, mockActivateMarket, mutateMockState, readMockState, writeMockEvent } from './mock';
import { marketDraftToConfig, validateMarketDraft, type MarketDraft } from './market-config';

export interface MarginPoolDraft { pool: string; poolId: string; tokens: string[] }
export interface LaunchDraft {
  name: string;
  description: string;
  markets: MarketDraft[];
  rewardsEnabled: boolean;
  rewardToken: string;
  rewardSymbol: string;
  rewardDecimals: number;
  rewardFunding: string;
  marginEnabled: boolean;
  maxLeverage: string;
  slippage: string;
  liquidationIncentive: string;
  liquidationFee: string;
  marginPools: MarginPoolDraft[];
}
export interface LaunchStep { id: string; label: string; kind: 'create'|'market'|'activate'|'yield'|'rewards'|'fund'|'speed'|'margin'|'pool'|'binding'|'marginmarket'|'applymargin'; marketIndex?: number; poolIndex?: number }
export interface LaunchReceipt { step: string; hash: string; value?: number|string }
export interface LaunchSession {
  version: 1; id: string; scope: string; draft: LaunchDraft; groupId?: number; markets: Record<number,string>;
  receipts: LaunchReceipt[]; pending?: { step: string; hash?: string; status: string; started?:boolean; transaction?: PendingTransaction }; completed: boolean;
}
export function launchScope(owner: string): string {
  return `${network.name}:${network.useMocks?'mock-factory':getDeployments().factory}:${owner}`;
}
const storageKey=(scope:string)=>`peridot:launch:v1:${scope}`;
export function saveLaunch(session:LaunchSession):void {
  try { localStorage.setItem(storageKey(session.scope),JSON.stringify(session)); }
  catch { throw new Error('Browser storage is unavailable. Enable it before starting or continuing launch.'); }
}
export function loadLaunch(scope:string):LaunchSession|null {
  const raw=localStorage.getItem(storageKey(scope));
  if(!raw)return null;
  const result=JSON.parse(raw) as LaunchSession;
  if(result.version!==1||typeof result.id!=='string'||result.scope!==scope||!Array.isArray(result.receipts)||!result.draft)throw new Error('The saved launch is not compatible with this session.');
  return result;
}
export function clearCompletedLaunch(scope:string):void {
  const session=loadLaunch(scope);
  if(session&&!session.completed)throw new Error('Finish the saved launch before starting another group.');
  localStorage.removeItem(storageKey(scope));
}
export function marginConfig(d:LaunchDraft):GroupMarginConfig {
  if(!/^[1-5]$/.test(d.maxLeverage))throw new Error('Choose an integer maximum leverage between 1x and 5x.');
  const cfg:GroupMarginConfig={variant:{tag:'Audited',values:undefined},max_leverage:BigInt(d.maxLeverage),max_slippage:parseAmount(d.slippage,4),liquidation_incentive:parseAmount(d.liquidationIncentive,4),liquidation_fee:parseAmount(d.liquidationFee,4)};
  if(cfg.max_slippage<=0n||cfg.max_slippage>100000n)throw new Error('Slippage must be greater than zero and at most 10%.');
  if(cfg.liquidation_incentive<1020000n||cfg.liquidation_incentive>1100000n)throw new Error('Liquidation incentive must be between 102% and 110%.');
  if(cfg.liquidation_fee>500000n)throw new Error('Liquidation fee must not exceed 50%.');
  return cfg;
}
export function validateLaunch(d:LaunchDraft):string[] {
  const errors:string[]=[];
  if(!/^[A-Za-z0-9_]{1,32}$/.test(d.name))errors.push('Group name must contain 1 to 32 letters, numbers or underscores.');
  if(d.markets.length>16)errors.push('A group supports at most 16 markets.');
  if(!d.markets.length)errors.push('Add at least one market.');
  if(new Set(d.markets.map(m=>m.token)).size!==d.markets.length)errors.push('Each token can have only one market in a group.');
  d.markets.forEach((m,i)=>validateMarketDraft(m,d.rewardsEnabled?d.rewardDecimals:7).forEach(error=>errors.push(`Market ${i+1}: ${error}`)));
  if(d.rewardsEnabled){
    if(!StrKey.isValidContract(d.rewardToken)||!d.rewardSymbol)errors.push('Verify the reward token before launching.');
    try {parseAmount(d.rewardFunding,d.rewardDecimals);}catch(e){errors.push(e instanceof Error?e.message:'Invalid reward funding.');}
  }
  if(d.marginEnabled){try{marginConfig(d);}catch(e){errors.push(e instanceof Error?e.message:'Invalid leverage configuration.');}if(d.markets.filter(m=>m.marginEnabled).length>4)errors.push('This margin controller supports at most four margin markets.');if(d.markets.filter(m=>m.marginEnabled).length<2)errors.push('Select at least two seven-decimal markets for leverage.');}
  if(d.marginEnabled){for(const market of d.markets.filter(m=>m.marginEnabled)){if(!(d.marginPools||[]).some(p=>p.tokens.includes(market.token)))errors.push(`Discover a verified pool route for ${market.symbol||'each margin token'}.`);}}
  return errors;
}
export function launchSteps(d:LaunchDraft):LaunchStep[] {
  const steps:LaunchStep[]=[{id:'create',label:'Create isolated group',kind:'create'}];
  d.markets.forEach((m,i)=>steps.push({id:`market:${i}`,label:`Add ${m.symbol||`market ${i+1}`}`,kind:'market',marketIndex:i}));
  d.markets.forEach((m,i)=>steps.push({id:`activate:${i}`,label:`Activate ${m.symbol||`market ${i+1}`}`,kind:'activate',marketIndex:i}));
  d.markets.forEach((m,i)=>{if(m.route!=='None')steps.push({id:`yield:${i}`,label:`Attach ${m.route} for ${m.symbol}`,kind:'yield',marketIndex:i});});
  if(d.rewardsEnabled){
    steps.push({id:'rewards',label:`Set ${d.rewardSymbol} rewards`,kind:'rewards'});
    if(parseAmount(d.rewardFunding,d.rewardDecimals)>0n)steps.push({id:'fund',label:`Fund ${d.rewardFunding} ${d.rewardSymbol} rewards`,kind:'fund'});
    d.markets.forEach((m,i)=>steps.push({id:`speed:${i}`,label:`Set ${m.symbol} reward speeds`,kind:'speed',marketIndex:i}));
  }
  if(d.marginEnabled){
    steps.push({id:'margin',label:'Create group margin controller',kind:'margin'});
    (d.marginPools||[]).forEach((pool,i)=>{steps.push({id:`pool:${i}`,label:`Allow verified pool ${i+1}`,kind:'pool',poolIndex:i});steps.push({id:`binding:${i}`,label:`Bind pool ${i+1} to its router ID`,kind:'binding',poolIndex:i});});
    d.markets.forEach((market,i)=>{if(market.marginEnabled)steps.push({id:`marginmarket:${i}`,label:`Enable ${market.symbol} leverage`,kind:'marginmarket',marketIndex:i});});
    steps.push({id:'applymargin',label:'Apply staged liquidation incentive',kind:'applymargin'});
  }
  return steps;
}
export function newLaunch(draft:LaunchDraft,owner:string):LaunchSession {
  const errors=validateLaunch(draft);if(errors.length)throw new Error(errors.join(' '));
  return {version:1,id:crypto.randomUUID(),scope:launchScope(owner),draft:structuredClone(draft),markets:{},receipts:[],completed:false};
}
function assertOwner(session:LaunchSession,signer:Signer){if(session.scope!==launchScope(signer.address))throw new Error('This saved launch belongs to another wallet, network or factory.');}
function nextStep(session:LaunchSession){return launchSteps(session.draft).find(step=>!session.receipts.some(receipt=>receipt.step===step.id));}
function groupId(session:LaunchSession){if(!Number.isSafeInteger(session.groupId)||session.groupId!<0)throw new Error('Confirmed group ID is missing.');return session.groupId!;}
function marketAddress(session:LaunchSession,index?:number){const value=session.markets[index!];if(!value)throw new Error('Confirmed market address is missing.');return value;}
function rewardDistributor(session:LaunchSession){const value=session.receipts.find(r=>r.step==='rewards')?.value;if(typeof value!=='string')throw new Error('Confirmed reward distributor address is missing.');return value;}
function completeStep(session:LaunchSession,step:LaunchStep,hash:string,value:unknown):LaunchSession {
  const updated=structuredClone(session);
  let stored:number|string|undefined;
  if(step.kind==='create'){
    const id=typeof value==='bigint'?Number(value):value;
    if(typeof id!=='number'||!Number.isSafeInteger(id)||id<0)throw new Error('The transaction succeeded, but its group ID could not be decoded. Do not launch again.');
    updated.groupId=id;stored=id;
  }else if(step.kind==='market'||step.kind==='rewards'){
    if(typeof value!=='string'||(!network.useMocks&&!StrKey.isValidContract(value)))throw new Error('The transaction succeeded, but its contract address could not be decoded. Do not repeat this step.');
    stored=value;if(step.kind==='market')updated.markets[step.marketIndex!]=value;
  }
  updated.receipts.push({step:step.id,hash,value:stored});updated.pending=undefined;
  updated.completed=!nextStep(updated);
  saveLaunch(updated);return updated;
}
function mockStep(session:LaunchSession,step:LaunchStep,owner:string):{hash:string;value:unknown}{
  return mutateMockState(state=>{
    const journalKey=`launch-result:${session.scope}:${session.id}:${step.id}`;
    const existing=state.pending[journalKey] as {hash:string;value:unknown}|undefined;if(existing)return existing;
    let value:unknown;
    if(step.kind==='create'){
      const id=state.nextId++;state.groups.push({id,owner,name:session.draft.name,controller:`mock-controller-${id}`,price_router:`mock-router-${id}`,reward_distributor:undefined,margin_controller:undefined,markets:[],created_at:BigInt(Math.floor(Date.now()/1000)),keeper_mode:{tag:'None',values:undefined},keeper_paid_until:0n});value=id;
      const result={hash:writeMockEvent(state,id,'create_group','Created isolated group'),value};state.pending[journalKey]=result;return result;
    }
    const id=groupId(session),group=state.groups.find(g=>g.id===id);if(!group||group.owner!==owner)throw new Error('Only the group owner can finish launch.');
    const draft=session.draft.markets[step.marketIndex!];
    if(step.kind==='market'){
      const cfg=marketDraftToConfig(draft,session.draft.rewardDecimals);cfg.supply_reward_per_sec=0n;cfg.borrow_reward_per_sec=0n;
      const market=`mock-market-${id}-${step.marketIndex}`;mockCreateMarket(state,id,market,cfg,{symbol:draft.symbol,decimals:draft.decimals});value=market;
    }else if(step.kind==='activate'){
      mockActivateMarket(state,id,marketAddress(session,step.marketIndex));
    }else if(step.kind==='yield'){
      const market=marketAddress(session,step.marketIndex);if(!group.markets.includes(market))throw new Error('Activate the market before attaching yield.');
      state.pending[`market-record:${id}:${market}`]={active:true,boosted_vault:draft.route==='Blend'?`mock-adapter-${id}-${step.marketIndex}`:draft.routeAddress,adapter:draft.route==='Blend'?`mock-adapter-${id}-${step.marketIndex}`:undefined};
    }else if(step.kind==='rewards'){value=`mock-rewards-${id}`;group.reward_distributor=value as string;state.pending[`reward-token:${id}`]={address:session.draft.rewardToken,symbol:session.draft.rewardSymbol,decimals:session.draft.rewardDecimals};const extra=(state.pending[`control:${id}`]??={changes:[],pauses:{}}) as {rewardBalance?:bigint};extra.rewardBalance=0n;}
    else if(step.kind==='speed'){
      const market=marketAddress(session,step.marketIndex),cfg=marketDraftToConfig(draft,session.draft.rewardDecimals);
      Object.assign(state.configs[`${id}:${market}`],{supply_reward_per_sec:cfg.supply_reward_per_sec,borrow_reward_per_sec:cfg.borrow_reward_per_sec});
    }else if(step.kind==='fund'){
      const key=`control:${id}`;const extra=(state.pending[key]??={changes:[],pauses:{}}) as {rewardBalance?:bigint};extra.rewardBalance=(extra.rewardBalance??0n)+parseAmount(session.draft.rewardFunding,session.draft.rewardDecimals);
    }else if(step.kind==='margin'){
      group.margin_controller=`mock-margin-${id}`;const key=`control:${id}`;const cfg=marginConfig(session.draft);const applied=cfg.liquidation_incentive===1080000n;const eta=applied?0n:BigInt(Math.floor(Date.now()/1000)+60);const extra=(state.pending[key]??={changes:[],pauses:{}}) as {margin?:unknown;changes:unknown[]};extra.margin={controller:group.margin_controller,swap_adapter:`mock-swap-${id}`,variant:{tag:'Audited',values:undefined},cfg,enabled_markets:[],applied_liquidation_incentive:1080000n,applied_liquidation_fee:cfg.liquidation_fee,incentive_applied:applied,incentive_apply_after:eta,pools:[]};if(!applied)extra.changes.push({id:`margin:group:${Date.now()}`,kind:'margin',executeAfter:Number(eta),proposed:cfg});
    }
    if(step.kind==='pool'||step.kind==='binding'||step.kind==='marginmarket'||step.kind==='applymargin'){
      const extra=state.pending[`control:${id}`] as {margin:{cfg:GroupMarginConfig;pools:string[];enabled_markets:string[];applied_liquidation_incentive:bigint;incentive_applied:boolean;incentive_apply_after:bigint};changes:Array<{kind:string}>;poolBindings?:Record<string,string>};
      if(step.kind==='pool')extra.margin.pools.push(session.draft.marginPools[step.poolIndex!].pool);
      if(step.kind==='binding'){const pool=session.draft.marginPools[step.poolIndex!];(extra.poolBindings??={})[pool.poolId]=pool.pool;}
      if(step.kind==='marginmarket')extra.margin.enabled_markets.push(marketAddress(session,step.marketIndex));
      if(step.kind==='applymargin'){extra.margin.applied_liquidation_incentive=extra.margin.cfg.liquidation_incentive;extra.margin.incentive_applied=true;extra.margin.incentive_apply_after=0n;extra.changes=extra.changes.filter(c=>c.kind!=='margin');}
    }
    const result={hash:writeMockEvent(state,id,step.kind,step.label),value};state.pending[journalKey]=result;return result;
  });
}
/** Transport may report an older global transaction before this step starts. */
export function launchProgressState(step:string,previous:LaunchSession['pending'],progress:TxProgress,shared:PendingTransaction|null):NonNullable<LaunchSession['pending']> {
  const started=previous?.started||progress.status==='simulating';
  const hash=started?progress.hash||previous?.hash:previous?.hash;
  const transaction=shared&&shared.hash===hash?shared:previous?.transaction;
  return {step,status:progress.status,started,hash,transaction};
}
export async function runNextLaunchStep(session:LaunchSession,signer:Signer,onProgress?:(progress:TxProgress)=>void):Promise<LaunchSession>{
  assertOwner(session,signer);
  if(session.pending)throw new Error('Resolve the saved pending step before continuing.');
  const step=nextStep(session);if(!step)return session;
  const pending:LaunchSession={...session,pending:{step:step.id,status:'preparing'}};saveLaunch(pending);
  const progress=(p:TxProgress)=>{
    const shared=network.useMocks?null:getPendingTransaction(signer.address);
    pending.pending=launchProgressState(step.id,pending.pending,p,shared);
    saveLaunch(pending);onProgress?.(p);
  };
  try {
    if(network.useMocks){
      if(step.kind==='applymargin'){
        const extra=readMockState().pending[`control:${groupId(session)}`] as {margin:{incentive_apply_after:bigint}};
        const eta=Number(extra.margin.incentive_apply_after);
        while(Math.floor(Date.now()/1000)<eta){progress({status:'simulating',message:`Liquidation incentive can apply in ${eta-Math.floor(Date.now()/1000)} seconds.`});await new Promise(resolve=>setTimeout(resolve,1000));}
      }
      progress({status:'simulating',message:'Applying demo configuration.'});const result=mockStep(session,step,signer.address);const updated=completeStep(pending,step,result.hash,result.value);onProgress?.({status:'success',message:'Demo step saved. No onchain transaction.'});return updated;}
    const owner=scAddress(signer.address);
    const ownerArgs=()=>[owner,scU32(groupId(session))];
    let result:{hash:string;value:unknown};
    const draft=session.draft.markets[step.marketIndex!];
    if(step.kind==='create'){
      await Promise.all(session.draft.markets.map(async market=>{
        if(market.price?.tag!=='ReflectorOnly'||!await isOracleAllowed(market.price.values[0].oracle))throw new Error(`The price feed for ${market.symbol} is not approved by the factory.`);
        if(market.route!=='None'&&!await isYieldVaultAllowed(market.routeAddress))throw new Error(`The yield vault for ${market.symbol} is not approved by the factory.`);
      }));
      result=await writeFactory('create_group',[owner,scSymbol(session.draft.name)],signer,progress);
    }else if(step.kind==='market'){
      const cfg=marketDraftToConfig(draft,session.draft.rewardDecimals);cfg.supply_reward_per_sec=0n;cfg.borrow_reward_per_sec=0n;
      result=await writeFactory('add_market',[...ownerArgs(),encodeMarketConfig(cfg)],signer,progress);
    }else if(step.kind==='activate')result=await writeFactory('activate_market',[...ownerArgs(),scAddress(marketAddress(session,step.marketIndex))],signer,progress);
    else if(step.kind==='yield')result=await writeFactory('attach_yield',[...ownerArgs(),scAddress(marketAddress(session,step.marketIndex))],signer,progress);
    else if(step.kind==='rewards')result=await writeFactory('set_rewards',[...ownerArgs(),scAddress(session.draft.rewardToken)],signer,progress);
    else if(step.kind==='fund')result=await submitContract({contractId:rewardDistributor(session),method:'fund',args:[owner,scI128(parseAmount(session.draft.rewardFunding,session.draft.rewardDecimals))],signer,onProgress:progress});
    else if(step.kind==='speed'){
      const cfg=marketDraftToConfig(draft,session.draft.rewardDecimals);
      result=await writeFactory('set_reward_speeds',[...ownerArgs(),scAddress(marketAddress(session,step.marketIndex)),scU128(cfg.supply_reward_per_sec),scU128(cfg.borrow_reward_per_sec)],signer,progress);
    }else if(step.kind==='margin'){
      const cfg=marginConfig(session.draft),contractId=getDeployments().margin_factory;
      if(!contractId||!StrKey.isValidContract(contractId))throw new Error('The margin factory has not been deployed for this network.');
      result=await submitContract({contractId,method:'enable_margin',args:[...ownerArgs(),scMap({variant:scEnum('Audited'),max_leverage:scU128(cfg.max_leverage),max_slippage:scU128(cfg.max_slippage),liquidation_incentive:scU128(cfg.liquidation_incentive),liquidation_fee:scU128(cfg.liquidation_fee)})],signer,onProgress:progress});
    }
    else {
      const contractId=getDeployments().margin_factory;
      let method:string;let args:xdr.ScVal[];
      if(step.kind==='pool'||step.kind==='binding'){
        const pool=session.draft.marginPools[step.poolIndex!];
        if(!pool)throw new Error('Saved pool configuration is missing.');
        method=step.kind==='pool'?'set_pool_allowed':'set_pool_binding';
        args=step.kind==='pool'?[...ownerArgs(),scAddress(pool.pool),scBool(true)]:[...ownerArgs(),xdr.ScVal.scvBytes(Buffer.from(pool.poolId,'hex')),scAddress(pool.pool),scBool(true)];
      }else if(step.kind==='marginmarket'){
        method='set_market_margin';args=[...ownerArgs(),scAddress(marketAddress(session,step.marketIndex)),scBool(true)];
      }else {
        type Status={incentive_applied:boolean;incentive_apply_after:bigint};
        const status=normalizeContract<Status|undefined>(await readContract(contractId,'get_margin_status',[scU32(groupId(session))]));
        if(!status)throw new Error('Margin status is unavailable.');
        if(status.incentive_applied)return completeStep(pending,step,'',undefined);
        const eta=Number(status.incentive_apply_after);
        if(!Number.isSafeInteger(eta)||eta<=0)throw new Error('Margin incentive ETA is unavailable.');
        while(Math.floor(Date.now()/1000)<eta){progress({status:'simulating',message:`Liquidation incentive can apply in ${eta-Math.floor(Date.now()/1000)} seconds.`});await new Promise(resolve=>setTimeout(resolve,1000));}
        method='apply_margin';args=ownerArgs();
      }
      result=await submitContract({contractId,method,args,signer,onProgress:progress});
      if(step.kind==='applymargin'){
        const status=await readContract<{incentive_applied:boolean}>(contractId,'get_margin_status',[scU32(groupId(session))]);
        if(!status?.incentive_applied)throw new Error('The transaction confirmed, but the incentive is still pending. Check its chain status before continuing.');
      }
    }
    return completeStep(pending,step,result.hash,result.value);
  }catch(error){
    recordLaunchError(pending,error);
    throw error;
  }
}
/** A submit rejection is definitive; unknown and confirmed stages remain recoverable. */
export function recordLaunchError(session:LaunchSession,error:unknown):LaunchSession {
  const rejected=error instanceof TransactionRejectedError&&session.pending?.hash===error.hash;
  const updated=!session.pending?.hash||rejected?{...session,pending:undefined}:session;
  saveLaunch(updated);
  return updated;
}
export async function recoverLaunchStep(session:LaunchSession,signer:Signer):Promise<LaunchSession>{
  assertOwner(session,signer);if(!session.pending)return session;
  const step=launchSteps(session.draft).find(s=>s.id===session.pending!.step);if(!step)throw new Error('Saved launch step is not recognized.');
  if(network.useMocks){
    const result=readMockState().pending[`launch-result:${session.scope}:${session.id}:${step.id}`] as {hash:string;value:unknown}|undefined;
    if(result)return completeStep(session,step,result.hash,result.value);
    const updated={...session,pending:undefined};saveLaunch(updated);return updated;
  }
  const transportPending=getPendingTransaction(signer.address);
  if(!session.pending.hash&&!session.pending.started){const updated={...session,pending:undefined};saveLaunch(updated);return updated;}
  if(!session.pending.hash&&transportPending){
    const methods:Record<LaunchStep['kind'],string>={create:'create_group',market:'add_market',activate:'activate_market',yield:'attach_yield',rewards:'set_rewards',fund:'fund',speed:'set_reward_speeds',margin:'enable_margin',pool:'set_pool_allowed',binding:'set_pool_binding',marginmarket:'set_market_margin',applymargin:'apply_margin'};
    const marginKinds=['margin','pool','binding','marginmarket','applymargin'];
    const expectedContract=step.kind==='fund'?rewardDistributor(session):marginKinds.includes(step.kind)?getDeployments().margin_factory:getDeployments().factory;
    if(transportPending.method!==methods[step.kind]||transportPending.contractId!==expectedContract)throw new Error('Another wallet transaction is pending. Resolve it before recovering this launch step.');
  }
  const hash=session.pending.hash||transportPending?.hash;
  if(!hash){const updated={...session,pending:undefined};saveLaunch(updated);return updated;}
  await assertRpcNetwork();
  const tx=await getRpc().getTransaction(hash);
  if(tx.status==='NOT_FOUND'){
    const saved=session.pending.transaction?.hash===hash?session.pending.transaction:transportPending?.hash===hash?transportPending:undefined;
    if(saved&&isDefinitivelyExpired(saved,tx)){
      if(transportPending?.hash===hash)await reconcilePendingTransaction(signer.address);
      const updated={...session,pending:undefined};saveLaunch(updated);return updated;
    }
    throw new Error('The transaction outcome is still unknown. Its hash is preserved. Do not repeat the step.');
  }
  if(transportPending?.hash===hash)await reconcilePendingTransaction(signer.address);
  if(tx.status==='FAILED'){const updated={...session,pending:undefined};saveLaunch(updated);return updated;}
  if(step.kind==='applymargin'){
    const status=await readContract<{incentive_applied:boolean}>(getDeployments().margin_factory,'get_margin_status',[scU32(groupId(session))]);
    if(!status?.incentive_applied){const updated={...session,pending:undefined};saveLaunch(updated);return updated;}
  }
  return completeStep(session,step,hash,tx.returnValue?scValToNative(tx.returnValue):undefined);
}
export async function verifyRewardToken(token:string){return getTokenMetadata(token);}

/** Decode binary pool IDs directly from XDR, before generic map conversion loses key types. */
export function decodeMarginPoolRegistry(raw:xdr.ScVal):Array<{poolId:string;pool:string}> {
  if(raw.type!=='scvMap'||!raw.map)throw new Error('Unexpected Aquarius pool registry response.');
  return raw.map.map(entry=>{
    if(entry.key.type!=='scvBytes'||entry.key.bytes.value.length!==32||entry.val.type!=='scvAddress')throw new Error('Malformed Aquarius pool registry entry.');
    const pool=Address.fromScVal(entry.val).toString();
    if(!StrKey.isValidContract(pool))throw new Error('Aquarius pool registry entry is not a contract.');
    return {poolId:Array.from(entry.key.bytes.value,byte=>byte.toString(16).padStart(2,'0')).join(''),pool};
  });
}

/** Resolve pool IDs through the configured router, then verify the returned pool tokens. */
export async function discoverMarginPools(markets:MarketDraft[]):Promise<MarginPoolDraft[]> {
  const enabled=markets.filter(m=>m.marginEnabled);
  if(enabled.length<2||enabled.length>4)throw new Error('Select between two and four markets for leverage.');
  const found:MarginPoolDraft[]=[];
  for(let i=0;i<enabled.length;i++)for(let j=i+1;j<enabled.length;j++){
    const tokens=[enabled[i].token,enabled[j].token].sort((a,b)=>{
      const aa=new Address(a).toScAddress().toXDR(),bb=new Address(b).toScAddress().toXDR();
      for(let n=0;n<aa.length;n++)if(aa[n]!==bb[n])return aa[n]-bb[n];return 0;
    });
    if(network.useMocks){found.push({pool:`mock-pool-${i}-${j}`,poolId:(i*4+j).toString(16).padStart(64,'0'),tokens});continue;}
    const router=getDeployments().external.aquarius_router;
    if(typeof router!=='string'||!StrKey.isValidContract(router))throw new Error('The verified Aquarius router is not configured.');
    const pools=decodeMarginPoolRegistry(await readContractRaw(router,'get_pools',[xdr.ScVal.scvVec(tokens.map(scAddress))]));
    let selected:MarginPoolDraft|undefined;
    for(const {poolId,pool} of pools){
      const live=await readContract<string[]>(pool,'get_tokens');
      if(live.length===2&&live.every((token,index)=>token===tokens[index])){selected={pool,poolId,tokens};break;}
    }
    if(!selected)throw new Error(`No verified Aquarius route connects ${enabled[i].symbol} and ${enabled[j].symbol}.`);
    found.push(selected);
  }
  return found;
}
