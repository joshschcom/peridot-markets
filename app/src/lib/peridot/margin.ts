/** Staged V3 flow and recovery adapted from PeridotV2Full@86ae3795:
 * lib/stellar-margin.ts, use-stellar-margin-open.ts, use-stellar-margin-close.ts,
 * and marginMath.ts. All addresses/config are resolved per group. */
import { Address, scValToNative, xdr } from '@stellar/stellar-sdk';
import { network, getDeployments } from './network';
import { getRpc, readContract, readContractRaw, submitContract, waitForLedgerBeyond, type TxResult } from './rpc';
import { addr, uint, unitEnum, enumName, type Signer, type Progress, type MarketView } from './group-client';
import { normalizeContract } from './factory';
import type { Group, MarginInfo } from './types';
export type Side='Long'|'Short';
export interface PoolRoute { pool:string; poolId:Uint8Array; tokens:string[] }
export interface MarginStatus extends MarginInfo { incentive_applied:boolean; incentive_apply_after:bigint; applied_liquidation_incentive:bigint; pair_liquidation_incentive:bigint; maintenance_margin:bigint }
export interface MarginContext { group:Group; info:MarginInfo; markets:MarketView[]; status?:MarginStatus }
export interface Position {
  id:bigint; owner:string; side:Side; collateral_asset:string; debt_asset:string; collateral_ptokens:bigint;
  status:string; entry_price_scaled:bigint; opened_at:bigint;
  health:bigint|null; debt:bigint; collateralUnderlying:bigint; liquidationPrice:number|null;
  perps:Perps|null; pendingOpen:PendingOpen|null; execution:unknown; pendingClose:PendingClose|null;
}
interface Perps { margin_asset:string;base_asset:string;side:unknown;margin_amount:bigint;notional_value:bigint;maintenance_margin_scaled:bigint;pool_tokens:string[];pool_id:Uint8Array;pool:string }
interface PendingOpen { margin_asset:string;base_asset:string;side:unknown;margin_ptokens:bigint;margin_amount:bigint;borrow_amount:bigint;expires_at:bigint }
interface PendingClose { collateral_underlying:bigint;debt_amount:bigint;received_debt_asset:bigint;expires_at:bigint }
interface ExecutionConfig { open_slippage_scaled:bigint;close_slippage_scaled:bigint;max_open_deviation_scaled:bigint }
export interface OpenQuote { margin:MarketView;base:MarketView;side:Side;shares:bigint;leverage:number;route:PoolRoute;minOut:bigint;expectedOut:bigint;feeShares:bigint;closeFeeBps:bigint;totalShares:bigint;freeMargin:bigint;maxLeverage:number;slippageBps:number }
const SCALE=1_000_000n;
const MOCK_POSITIONS='peridot:margin-demo:v1';
function revive(_key:string,value:unknown) { return typeof value==='string'&&/^\d+n$/.test(value)?BigInt(value.slice(0,-1)):value; }
function mockPositions(ctx:MarginContext,owner:string):Position[] {try{return JSON.parse(localStorage.getItem(`${MOCK_POSITIONS}:${network.name}:${ctx.group.id}:${ctx.info.controller}:${owner}`)||'[]',revive);}catch{return [];}}
function saveMock(ctx:MarginContext,owner:string,positions:Position[]) {localStorage.setItem(`${MOCK_POSITIONS}:${network.name}:${ctx.group.id}:${ctx.info.controller}:${owner}`,JSON.stringify(positions,(_key,value)=>typeof value==='bigint'?`${value}n`:value));}
export const effectiveLeverage=(groupMax:number,cf:bigint)=> {
  if(!Number.isFinite(groupMax)||groupMax<1||cf<0n||cf>=1_000_000n)throw new Error('Invalid leverage limits.');
  return Math.min(groupMax,1/(1-Number(cf)/1e6));
};
/** Same staged valuation and flooring as core begin_open_position_v3. */
export function openTradeAmount(underlying:bigint,leverage:number,side:Side,marginPrice:readonly[bigint,bigint],basePrice:readonly[bigint,bigint]):bigint {
  if(underlying<=0n||!Number.isInteger(leverage)||leverage<2||marginPrice.some(v=>v<=0n)||basePrice.some(v=>v<=0n))throw new Error('Invalid open valuation.');
  const value=underlying*marginPrice[0]/marginPrice[1],notional=value*BigInt(leverage);
  if(side==='Long')return underlying+(notional-value)*marginPrice[1]/marginPrice[0];
  return notional*basePrice[1]/basePrice[0];
}
export function liquidationPriceEstimate(side:Side,collateral:bigint,debt:bigint,maintenance:bigint):number|null {
  if(collateral<=0n||debt<=0n||maintenance<=0n||maintenance>=SCALE)return null;
  const ratio=Number(maintenance)/Number(SCALE);
  // Long maintenance is based on collateral value; short maintenance on debt value.
  return side==='Long'?Number(debt)/(Number(collateral)*(1-ratio)):Number(collateral)/(Number(debt)*(1+ratio));
}
export function closeHasSwapped(pending:Pick<PendingClose,'received_debt_asset'|'debt_amount'>):boolean {
  return pending.received_debt_asset>0n||pending.debt_amount>0n;
}
export function minOutput(quote:bigint,slippageBps:number) {if(!Number.isInteger(slippageBps)||slippageBps<0||slippageBps>1000)throw new Error('Slippage must be between 0 and 10%.');return quote*BigInt(10000-slippageBps)/10000n;}
export function bufferedDebt(debt:bigint) {return (debt*10010n+9999n)/10000n;}
export async function solveShortInput(collateral:bigint,target:bigint,quote:(amount:bigint)=>Promise<bigint>) {
  if(collateral<=0n||target<=0n)throw new Error('Invalid close amount.');
  if(await quote(collateral)<target)throw new Error('Position collateral cannot cover the current debt and interest buffer.');
  let lo=1n,hi=collateral;
  // Integer bisection verifies the result against actual pool quotes.
  for(let i=0;lo<hi&&i<128;i++){const mid=(lo+hi)/2n;if(await quote(mid)>=target)hi=mid;else lo=mid+1n;}
  if(await quote(hi)<target)throw new Error('Pool quote changed. Review the close again.');return hi;
}
export async function marginContext(group:Group,markets:MarketView[]):Promise<MarginContext|null> {
  if(!group.margin_controller)return null;
  if(network.useMocks)return {group,markets,info:{controller:group.margin_controller,swap_adapter:'mock-swap',variant:{tag:'Audited',values:undefined},cfg:{variant:{tag:'Audited',values:undefined},max_leverage:3n,max_slippage:10000n,liquidation_incentive:1080000n,liquidation_fee:0n},enabled_markets:markets.filter(m=>m.config.margin_enabled).map(m=>m.address)}};
  const info=normalizeContract<MarginStatus|undefined>(await readContract(getDeployments().margin_factory,'get_margin_status',[uint(group.id,'u32')]));
  if(!info||info.controller!==group.margin_controller)throw new Error('Margin configuration does not match this group.');
  return {group,info,markets,status:info};
}
const read=<T>(ctx:MarginContext,method:string,args:xdr.ScVal[]=[])=>readContract<T>(ctx.info.controller,method,args);
async function write(ctx:MarginContext,method:string,args:xdr.ScVal[],signer:Signer,onProgress?:(p:Progress)=>void) {
  onProgress?.({status:'simulating',message:method.replaceAll('_',' ')});
  const result=await submitContract({contractId:ctx.info.controller,method,args,signer,onProgress});
  // A later stage must simulate against state that includes the confirmed write.
  try { await waitForLedgerBeyond(result.ledger); }
  catch { throw new ConfirmedStageError(method,result); }
  return result;
}

/** Keep the confirmed receipt when RPC cannot advance to the next stage. */
export class ConfirmedStageError extends Error {
  constructor(public readonly method:string,public readonly receipt:TxResult<unknown>){
    const id=method==='begin_open_position_v3'&&typeof receipt.value==='bigint'?` Position #${receipt.value}.`:'';
    const recovery=method==='transfer_spot_to_margin'?' Your funds are free margin; return them to supply below or review the open again.':' Refresh positions and resume the confirmed stage.';
    super(`${method.replaceAll('_',' ')} confirmed in transaction ${receipt.hash}.${id} The next ledger is unavailable.${recovery}`);
    this.name='ConfirmedStageError';
  }
}
export function decodeMarginPoolRegistry(raw:xdr.ScVal):Array<{poolId:Uint8Array;pool:string}> {
  if(raw.type!=='scvMap'||raw.map===null)throw new Error('Unexpected pool registry response.');
  return raw.map.map(entry=>{
    if(entry.key.type!=='scvBytes'||entry.key.bytes.value.length!==32||entry.val.type!=='scvAddress')throw new Error('Invalid pool registry entry.');
    return {poolId:new Uint8Array(entry.key.bytes.value),pool:Address.fromScVal(entry.val).toString()};
  });
}
const YEAR_SECONDS=31_536_000n,MAX_APR=10_000_000n,SIGNING_HEADROOM_SECONDS=600n;
const ceilDiv=(n:bigint,d:bigint)=>(n+d-1n)/d;
/** Upper-bound stored-index rounding, elapsed interest and ten minutes of signing. */
export function accruedCloseTarget(debt:bigint,annualRate:bigint,lastUpdate:bigint,now:bigint):bigint {
  if(debt<=0n||annualRate<0n||annualRate>MAX_APR||lastUpdate<0n||now<lastUpdate)throw new Error('Invalid debt accrual state. Refresh chain data.');
  const elapsed=now-lastUpdate;
  const interest=ceilDiv((debt+1n)*(annualRate*elapsed+MAX_APR*SIGNING_HEADROOM_SECONDS),SCALE*YEAR_SECONDS)+1n;
  // An unexpectedly stale snapshot must be accrued on chain, not silently over-sized.
  if(interest>ceilDiv(debt,10n)+2n)throw new Error('Debt accrual exceeds the 10% close headroom. Refresh market interest before resuming; an unswapped close can be cancelled.');
  return bufferedDebt(debt+interest);
}
/** Quote enough input that even the selected slippage floor covers padded debt. */
export function closeQuoteTarget(target:bigint,slippageBps:number,protocolSlippage:bigint):bigint {
  minOutput(target,slippageBps);
  if(protocolSlippage<0n||protocolSlippage>=SCALE)throw new Error('Invalid close slippage configuration.');
  const user=BigInt(slippageBps)*100n,allowed=user<protocolSlippage?user:protocolSlippage;
  return ceilDiv(target*SCALE,SCALE-allowed);
}
/** A valid curve may exceed the vault APR ceiling at unused high utilization.
 * Only rates at or below the core ceiling can accrue successfully on chain. */
export function closeAccrualApr(modelMaximum:bigint,staticRate:bigint):bigint {
  if(typeof modelMaximum!=='bigint'||modelMaximum<0n||typeof staticRate!=='bigint'||staticRate<0n||staticRate>MAX_APR)throw new Error('Invalid borrow rate bound. Refresh chain data.');
  const bound=modelMaximum>staticRate?modelMaximum:staticRate;
  return bound>MAX_APR?MAX_APR:bound;
}
/** Decode only the known receipt-vault storage schema; no missing-balance defaults. */
export function decodeDebtAccrualState(values:unknown[]) {
  const [lastUpdate,staticRate,model,index,snapshot]=values as [bigint,bigint,string|undefined,bigint,{principal:bigint;interest_index:bigint}];
  if(typeof lastUpdate!=='bigint'||lastUpdate<0n||typeof staticRate!=='bigint'||staticRate<0n||staticRate>MAX_APR||typeof index!=='bigint'||index<=0n||!snapshot||typeof snapshot.principal!=='bigint'||snapshot.principal<0n||typeof snapshot.interest_index!=='bigint'||snapshot.interest_index<=0n||(model!==undefined&&typeof model!=='string'))throw new Error('Debt accrual storage is unavailable. Refresh before continuing.');
  if(model!==undefined)new Address(model);
  return {lastUpdate,staticRate,model,debt:snapshot.principal*index/snapshot.interest_index};
}
async function closeDebtTarget(market:MarketView,id:bigint):Promise<bigint> {
  const names=['LastUpdateTime','BorrowYearlyRateScaled','InterestModel','BorrowIndex'];
  const keys=names.map(name=>unitEnum(name));
  keys.push(xdr.ScVal.scvVec([xdr.ScVal.scvSymbol('MarginBorrowSnapshots'),uint(id,'u64')]));
  const ledgerKeys=keys.map(key=>xdr.LedgerKey.contractData(new xdr.LedgerKeyContractData({contract:new Address(market.address).toScAddress(),key,durability:xdr.ContractDataDurability.persistent})));
  const client=getRpc();
  if((await client.getNetwork()).passphrase!==network.passphrase)throw new Error('RPC network does not match the selected app network.');
  const response=await client.getLedgerEntries(...ledgerKeys);
  const values=ledgerKeys.map(key=>{
    const entry=response.entries.find(e=>e.key.toXDR('base64')===key.toXDR('base64'));
    if(!entry)return undefined;
    if(entry.val.type!=='contractData')throw new Error('Unexpected vault storage response.');
    return scValToNative(entry.val.contractData.val);
  });
  const {lastUpdate,staticRate,model,debt}=decodeDebtAccrualState(values);
  // Factory JumpRateModel has nonnegative slopes and clamps utilization to 100%.
  // Full-utilization APR therefore bounds its current rate; retain static fallback.
  const modelMax=model===undefined?staticRate:await readContract<bigint>(model,'get_borrow_rate',[uint(0n),uint(1n),uint(0n)]);
  const apr=closeAccrualApr(modelMax,staticRate);
  return accruedCloseTarget(debt,apr,lastUpdate,BigInt(Math.floor(Date.now()/1000)));
}
export function openExecutionFloor(reviewedMinimum:bigint,current:Pick<OpenQuote,'minOut'|'expectedOut'>):bigint {
  if(current.expectedOut<reviewedMinimum)throw new Error('Quote moved below your reviewed minimum. Review again.');
  return reviewedMinimum>current.minOut?reviewedMinimum:current.minOut;
}

export async function findRoute(ctx:MarginContext,margin:string,base:string):Promise<PoolRoute> {
  const sorted=[margin,base].sort((a,b)=>{
    const aa=new Address(a).toScAddress().toXDR(),bb=new Address(b).toScAddress().toXDR();
    for(let i=0;i<aa.length;i++){if(aa[i]!==bb[i])return aa[i]-bb[i];}return 0;
  });
  const router=getDeployments().external.aquarius_router;
  if(typeof router!=='string'||!router)throw new Error('Aquarius router is not configured for this network.');
  const pools=decodeMarginPoolRegistry(await readContractRaw(router,'get_pools',[xdr.ScVal.scvVec(sorted.map(addr))]));
  for(const {poolId,pool} of pools){
    const allowed=await readContract<boolean>(ctx.info.swap_adapter,'is_pool_binding_allowed',[xdr.ScVal.scvBytes(Buffer.from(poolId)),addr(pool)]);
    if(allowed)return {pool,poolId:new Uint8Array(poolId),tokens:sorted};
  }
  throw new Error('No approved pool route connects these assets. Ask the group owner to configure one.');
}
async function poolQuote(route:PoolRoute,inputToken:string,amount:bigint) {
  const i=route.tokens.indexOf(inputToken);if(i<0||route.tokens.length!==2)throw new Error('Pool route does not contain this asset.');
  const out=await readContract<bigint>(route.pool,'estimate_swap',[uint(i,'u32'),uint(1-i,'u32'),uint(amount)]);
  if(out<=0n)throw new Error('Pool returned an empty quote.');return out;
}
export async function quoteOpen(ctx:MarginContext,owner:string,margin:MarketView,base:MarketView,shares:bigint,leverage:number,side:Side,slippageBps:number):Promise<OpenQuote> {
  if(margin.address===base.address)throw new Error('Choose two different assets.');
  if(!ctx.info.enabled_markets.includes(margin.address)||!ctx.info.enabled_markets.includes(base.address))throw new Error('Both markets must have leverage enabled.');
  if(margin.token.decimals!==7||base.token.decimals!==7)throw new Error('This margin version supports tokens with seven decimals.');
  const effective=effectiveLeverage(Number(ctx.info.cfg.max_leverage),(side==='Long'?base:margin).config.collateral_factor);
  if(!Number.isInteger(leverage)||leverage<2||leverage>Math.floor(effective))throw new Error(`Leverage must be an integer between 2 and ${Math.floor(effective)}.`);
  if(shares<=0n)throw new Error('Enter margin greater than zero.');
  if(network.useMocks)return {margin,base,side,shares,leverage,route:{pool:'mock',poolId:new Uint8Array(32),tokens:[margin.token.address,base.token.address]},minOut:shares*BigInt(leverage),expectedOut:shares*BigInt(leverage),feeShares:0n,closeFeeBps:0n,totalShares:shares,freeMargin:0n,maxLeverage:effective,slippageBps};
  const pairArgs=[addr(margin.token.address),addr(base.token.address),unitEnum(side)];
  const [pair,execution,fees,freeMargin,marginPrice,basePrice,route,exchangeRate,receiptBalance]=await Promise.all([
    read<{max_leverage:bigint}|undefined>(ctx,'get_perps_pair_config',pairArgs),read<ExecutionConfig|undefined>(ctx,'get_perps_pair_execution_config',pairArgs),
    read<{open_fee_ptokens:bigint;total_required_ptokens:bigint;close_fee_bps:bigint}>(ctx,'preview_open_fees_v3',[uint(shares),uint(leverage)]),read<bigint>(ctx,'get_margin_balance_ptokens',[addr(owner),addr(margin.token.address)]),
    readContract<[bigint,bigint]>(ctx.group.controller,'get_price_usd',[addr(margin.token.address)]),readContract<[bigint,bigint]>(ctx.group.controller,'get_price_usd',[addr(base.token.address)]),findRoute(ctx,margin.token.address,base.token.address),readContract<bigint>(margin.address,'get_exchange_rate'),readContract<bigint>(margin.address,'get_ptoken_balance',[addr(owner)]),
  ]);
  if(!pair||!execution)throw new Error('The owner must configure this margin pair before trading.');
  if(leverage>Number(pair.max_leverage))throw new Error('Leverage exceeds this pair limit.');
  if(!marginPrice||!basePrice||marginPrice[0]<=0n||basePrice[0]<=0n)throw new Error('A fresh oracle price is unavailable.');
  if(exchangeRate<=0n)throw new Error('Invalid margin exchange rate.');
  const underlying=shares*exchangeRate/SCALE;
  const trade=openTradeAmount(underlying,leverage,side,marginPrice,basePrice);
  const expectedOut=await poolQuote(route,side==='Long'?margin.token.address:base.token.address,trade);
  const userMin=minOutput(expectedOut,slippageBps),protocolMin=expectedOut*(SCALE-execution.open_slippage_scaled)/SCALE;
  const minOut=userMin>protocolMin?userMin:protocolMin;
  if(fees.total_required_ptokens>freeMargin+receiptBalance)throw new Error('Supply more margin collateral before opening this position.');
  return {margin:{...margin,exchangeRate,receiptBalance},base,side,shares,leverage,route,minOut,expectedOut,feeShares:fees.open_fee_ptokens,closeFeeBps:fees.close_fee_bps,totalShares:fees.total_required_ptokens,freeMargin,maxLeverage:Math.min(effective,Number(pair.max_leverage)),slippageBps};
}
export async function openPosition(ctx:MarginContext,quote:OpenQuote,signer:Signer,onProgress?:(p:Progress)=>void) {
  if(network.useMocks){const id=BigInt(Date.now()),positions=mockPositions(ctx,signer.address);positions.push({id,owner:signer.address,side:quote.side,collateral_asset:quote.base.token.address,debt_asset:quote.margin.token.address,collateral_ptokens:quote.shares*BigInt(quote.leverage),status:'Open',entry_price_scaled:1000000n,opened_at:BigInt(Math.floor(Date.now()/1000)),health:2500000n,debt:quote.shares,collateralUnderlying:quote.shares*BigInt(quote.leverage),liquidationPrice:0.5,perps:null,pendingOpen:null,execution:null,pendingClose:null});saveMock(ctx,signer.address,positions);onProgress?.({status:'success',message:'Demo position opened. No funds moved.'});return id;}
  if((await positions(ctx,signer.address)).some(p=>p.status==='PendingOpen'))throw new Error('Resume or cancel the existing pending open before creating another position.');
  // A stale review is re-quoted before any signature.
  const current=await quoteOpen(ctx,signer.address,quote.margin,quote.base,quote.shares,quote.leverage,quote.side,quote.slippageBps);
  if(current.route.pool!==quote.route.pool||Buffer.compare(Buffer.from(current.route.poolId),Buffer.from(quote.route.poolId))!==0)throw new Error('The approved pool route changed. Review again.');
  if(current.expectedOut<quote.minOut)throw new Error('Quote moved below your reviewed minimum. Review again.');
  if(current.totalShares>quote.totalShares)throw new Error('Fees changed. Review again.');
  let transferred=false;
  let fresh=current;
  if(current.freeMargin<current.totalShares){
    await write(ctx,'transfer_spot_to_margin',[addr(signer.address),addr(quote.margin.token.address),uint(current.totalShares-current.freeMargin)],signer,onProgress);
    transferred=true;
  }
  let result:TxResult<unknown>;
  try {
    // Transfer may take several ledgers. Re-read execution settings and quote now.
    if(transferred)fresh=await quoteOpen(ctx,signer.address,quote.margin,quote.base,quote.shares,quote.leverage,quote.side,quote.slippageBps);
    if(fresh.route.pool!==quote.route.pool||Buffer.compare(Buffer.from(fresh.route.poolId),Buffer.from(quote.route.poolId))!==0||fresh.totalShares>quote.totalShares)throw new Error('Route or fees changed. Review again.');
    const floor=openExecutionFloor(quote.minOut,fresh);
    result=await write(ctx,'begin_open_position_v3',[addr(signer.address),addr(quote.margin.token.address),addr(quote.base.token.address),uint(quote.shares),uint(quote.leverage),unitEnum(quote.side),xdr.ScVal.scvVec(quote.route.tokens.map(addr)),xdr.ScVal.scvBytes(Buffer.from(quote.route.poolId)),addr(quote.route.pool),uint(floor)],signer,onProgress);
  }catch(error){
    if(transferred&&error instanceof Error)error.message+=' The confirmed transfer remains recoverable: refresh positions first; if no pending open exists, use Return margin to supply below.';
    throw error;
  }
  const id=result.value;if(typeof id!=='bigint'||id<0n||id>18446744073709551615n)throw new Error('Open was submitted but its position ID could not be decoded. Refresh positions before retrying.');
  await resumeOpen(ctx,id,signer,onProgress);return id;
}
export async function resumeOpen(ctx:MarginContext,id:bigint,signer:Signer,onProgress?:(p:Progress)=>void) {
  const pending=await read<PendingOpen|undefined>(ctx,'get_pending_perps_open',[uint(id,'u64')]);
  if(!pending)throw new Error('No pending open found. Refresh positions.');
  const execution=await read<unknown>(ctx,'get_pending_perps_open_execution',[uint(id,'u64')]);
  if(!execution&&pending.expires_at<BigInt(Math.floor(Date.now()/1000)))throw new Error('This unswapped open expired. Cancel pending open to recover its margin.');
  if(!execution)await write(ctx,'swap_open_position_v3',[addr(signer.address),uint(id,'u64')],signer,onProgress);
  await write(ctx,'activate_open_position_v3',[addr(signer.address),uint(id,'u64')],signer,onProgress);
}
export async function cancelOpen(ctx:MarginContext,id:bigint,signer:Signer,onProgress?:(p:Progress)=>void) {
  if(await read(ctx,'get_pending_perps_open_execution',[uint(id,'u64')]))throw new Error('This open has already swapped. Resume activation to recover it.');
  return write(ctx,'cancel_pending_open_v3',[addr(signer.address),uint(id,'u64')],signer,onProgress);
}
export async function positions(ctx:MarginContext,owner:string):Promise<Position[]> {
  if(network.useMocks)return mockPositions(ctx,owner);
  const ids=await read<bigint[]>(ctx,'get_user_positions',[addr(owner)]);
  return (await Promise.all(ids.map(async id=>{
    const raw=await read<Omit<Position,'id'>|undefined>(ctx,'get_position',[uint(id,'u64')]);if(!raw)return null;
    const status=enumName(raw.status),side=enumName(raw.side) as Side;
    if(raw.owner!==owner)throw new Error('Position owner does not match the selected account.');
    if(!['Long','Short'].includes(side)||!['PendingOpen','Open','Closing','Closed','Liquidated'].includes(status))throw new Error('Unsupported position state.');
    if(status==='Closed')return null;
    const [perps,pendingOpen,execution,pendingClose]=await Promise.all([read<Perps|undefined>(ctx,'get_perps_position',[uint(id,'u64')]),read<PendingOpen|undefined>(ctx,'get_pending_perps_open',[uint(id,'u64')]),read<unknown>(ctx,'get_pending_perps_open_execution',[uint(id,'u64')]),read<PendingClose|undefined>(ctx,'get_pending_perps_close',[uint(id,'u64')])]);
    const collateral=ctx.markets.find(m=>m.token.address===raw.collateral_asset),debtMarket=ctx.markets.find(m=>m.token.address===raw.debt_asset);
    if(!collateral||!debtMarket)throw new Error('A position references a market outside this group.');
    const debt=await readContract<bigint>(debtMarket.address,'get_margin_borrow_balance',[uint(id,'u64')]);
    const collateralUnderlying=collateral?raw.collateral_ptokens*collateral.exchangeRate/SCALE:0n;
    const health=status==='Open'?await read<bigint>(ctx,'get_health_factor',[uint(id,'u64')]):null;
    let liquidationPrice:number|null=null;
    if(perps)liquidationPrice=liquidationPriceEstimate(side,collateralUnderlying,debt,perps.maintenance_margin_scaled);
    return {...raw,id,status,side,perps:perps||null,pendingOpen:pendingOpen||null,execution,pendingClose:pendingClose||null,health,debt,collateralUnderlying,liquidationPrice};
  }))).filter((p):p is Position=>p!==null);
}
export async function closePosition(ctx:MarginContext,position:Position,signer:Signer,slippageBps:number,onProgress?:(p:Progress)=>void) {
  if(network.useMocks){saveMock(ctx,signer.address,mockPositions(ctx,signer.address).filter(p=>p.id!==position.id));onProgress?.({status:'success',message:'Demo position closed.'});return;}
  if(position.owner!==signer.address||!['Open','Closing'].includes(position.status))throw new Error('This position cannot be closed by the selected wallet.');
  const id=position.id,p=position.perps;if(!p)throw new Error('Position route is unavailable. Refresh and retry.');
  const route:PoolRoute={pool:p.pool,poolId:p.pool_id,tokens:p.pool_tokens};
  const debtMarket=ctx.markets.find(m=>m.token.address===position.debt_asset);if(!debtMarket)throw new Error('Debt market is missing from this group.');
  const debt=await readContract<bigint>(debtMarket.address,'get_margin_borrow_balance',[uint(id,'u64')]);
  if(debt===0n){await write(ctx,'release_debt_free_position_v3',[addr(signer.address),uint(id,'u64')],signer,onProgress);return;}
  let pending=await read<PendingClose|undefined>(ctx,'get_pending_perps_close',[uint(id,'u64')]);
  const execution=await read<ExecutionConfig|undefined>(ctx,'get_perps_pair_execution_config',[addr(p.margin_asset),addr(p.base_asset),unitEnum(position.side)]);
  if(!execution)throw new Error('Pair execution settings are unavailable.');
  const safeMin=(quote:bigint)=>{const user=minOutput(quote,slippageBps),protocol=quote*(SCALE-execution.close_slippage_scaled)/SCALE;return user>protocol?user:protocol;};
  if(!pending){
    const fullQuote=await poolQuote(route,position.collateral_asset,position.collateralUnderlying);
    if(fullQuote<await closeDebtTarget(debtMarket,id))throw new Error('Pool proceeds cannot cover this position debt and interest buffer. No transaction was signed.');
    await write(ctx,'prepare_close_position_v3',[addr(signer.address),uint(id,'u64')],signer,onProgress);
    pending=await read<PendingClose|undefined>(ctx,'get_pending_perps_close',[uint(id,'u64')]);
    if(!pending)throw new Error('Close preparation is confirmed. Refresh to load its pending state before continuing.');
  }
  if(!closeHasSwapped(pending)&&pending.expires_at<BigInt(Math.floor(Date.now()/1000)))throw new Error('This unswapped close expired. Cancel it to recover collateral, then review a new close.');
  if(!closeHasSwapped(pending)&&pending.collateral_underlying===0n){
    await write(ctx,'withdraw_close_position_v3',[addr(signer.address),uint(id,'u64')],signer,onProgress);
    pending=await read<PendingClose|undefined>(ctx,'get_pending_perps_close',[uint(id,'u64')]);
    if(!pending)throw new Error('Close withdrawal confirmed. Refresh chain state before continuing.');
  }
  if(closeHasSwapped(pending)&&pending.received_debt_asset===0n)throw new Error('The swap has settled but some debt remains. Review an explicit wallet repayment before continuing.');
  if(!closeHasSwapped(pending)){
    if(pending.expires_at<BigInt(Math.floor(Date.now()/1000)))throw new Error('This unswapped close expired. Cancel it to recover collateral, then review a new close.');
    if(position.side==='Short'){
      const target=await closeDebtTarget(debtMarket,id);
      const input=await solveShortInput(pending.collateral_underlying,closeQuoteTarget(target,slippageBps,execution.close_slippage_scaled),n=>poolQuote(route,position.collateral_asset,n));
      const quote=await poolQuote(route,position.collateral_asset,input),floor=safeMin(quote),minOut=floor>target?floor:target;
      await write(ctx,'swap_close_short_position_v3',[addr(signer.address),uint(id,'u64'),uint(input),uint(minOut)],signer,onProgress);
    }else{
      const quote=await poolQuote(route,position.collateral_asset,pending.collateral_underlying),floor=safeMin(quote),target=await closeDebtTarget(debtMarket,id);
      if(quote<target)throw new Error('Pool quote no longer covers the debt. The close remains pending.');
      await write(ctx,'swap_close_position_v3',[addr(signer.address),uint(id,'u64'),uint(floor>target?floor:target)],signer,onProgress);
    }
  }
  await write(ctx,'finish_close_position_v3',[uint(id,'u64')],signer,onProgress);
  const remaining=await read<unknown>(ctx,'get_position',[uint(id,'u64')]);
  if(remaining)onProgress?.({status:'success',message:'Close transaction confirmed. Settlement remains pending; refresh and resume if needed.'});
}
export async function cancelClose(ctx:MarginContext,id:bigint,signer:Signer,onProgress?:(p:Progress)=>void) {
  const pending=await read<PendingClose|undefined>(ctx,'get_pending_perps_close',[uint(id,'u64')]);
  if(!pending||closeHasSwapped(pending))throw new Error('Only an unswapped pending close can be cancelled.');
  return write(ctx,'cancel_close_position_v3',[addr(signer.address),uint(id,'u64')],signer,onProgress);
}
export async function withdrawMargin(ctx:MarginContext,market:MarketView,signer:Signer,onProgress?:(p:Progress)=>void) {
  const free=await read<bigint>(ctx,'get_margin_balance_ptokens',[addr(signer.address),addr(market.token.address)]);
  if(free<=0n)throw new Error('No free margin available for this asset.');
  return write(ctx,'transfer_margin_to_spot',[addr(signer.address),addr(market.token.address),uint(free)],signer,onProgress);
}

/** Explicit bounded wallet repayment. Never invoked automatically by close. */
export async function repayResidual(ctx:MarginContext,position:Position,amount:bigint,signer:Signer,onProgress?:(p:Progress)=>void) {
  if(network.useMocks)throw new Error('The demo does not have residual settlement debt.');
  if(position.owner!==signer.address||amount<=0n)throw new Error('Invalid repayment request.');
  const pending=await read<PendingClose|undefined>(ctx,'get_pending_perps_close',[uint(position.id,'u64')]);
  if(!pending||!closeHasSwapped(pending))throw new Error('No swapped close needs repayment.');
  return write(ctx,'repay_margin_position_v3',[addr(signer.address),uint(position.id,'u64'),uint(amount)],signer,onProgress);
}
