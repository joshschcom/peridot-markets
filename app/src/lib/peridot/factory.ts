import { Address, Asset, nativeToScVal, scValToNative, StrKey, xdr } from '@stellar/stellar-sdk';
import type { Group, MarketConfig, RateModel, PriceConfig, YieldRoute } from './types';
import { getDeployments, network } from './network';
import { readContract, readContractRaw, submitContract, type Signer, type TxProgress } from './rpc';
import { readMockState } from './mock';
export const scAddress=(value:string)=>new Address(value).toScVal();
export const scU32=(value:number)=>nativeToScVal(value,{type:'u32'});
export const scU128=(value:bigint)=>nativeToScVal(value,{type:'u128'});
export const scI128=(value:bigint)=>nativeToScVal(value,{type:'i128'});
export const scBool=(value:boolean)=>nativeToScVal(value,{type:'bool'});
export const scSymbol=(value:string)=>nativeToScVal(value,{type:'symbol'});
export const scMap=(values:Record<string,xdr.ScVal>)=>xdr.ScVal.scvMap(Object.entries(values).sort(([a],[b])=>a<b?-1:a>b?1:0).map(([key,val])=>new xdr.ScMapEntry({key:scSymbol(key),val})));
export const scEnum=(tag:string,value?:xdr.ScVal)=>xdr.ScVal.scvVec(value?[scSymbol(tag),value]:[scSymbol(tag)]);
export function encodeRates(r:RateModel):xdr.ScVal{return scMap({base:scU128(r.base),multiplier:scU128(r.multiplier),jump:scU128(r.jump),kink:scU128(r.kink)});}
export function encodePrice(p:PriceConfig):xdr.ScVal{
 if(p.tag!=='ReflectorOnly')throw new Error('This build supports Reflector pricing only.');
 const cfg=p.values[0];return scEnum(p.tag,scMap({oracle:scAddress(cfg.oracle),asset:scEnum(cfg.asset.tag,cfg.asset.tag==='Other'?scSymbol(cfg.asset.values[0]):scAddress(cfg.asset.values[0]))}));
}
export function encodeMarketConfig(c:MarketConfig):xdr.ScVal{
 let route:xdr.ScVal;
 if(c.yield_route.tag==='None')route=scEnum('None');
 else if(c.yield_route.tag==='Defindex')route=scEnum('Defindex',scMap({vault:scAddress(c.yield_route.values[0].vault)}));
 else if(c.yield_route.tag==='Blend')route=scEnum('Blend',scMap({fee_vault:scAddress(c.yield_route.values[0].fee_vault)}));
 else throw new Error('Yield route is not available in phase 1.');
 return scMap({token:scAddress(c.token),collateral_factor:scU128(c.collateral_factor),supply_cap:scU128(c.supply_cap),borrow_cap:scU128(c.borrow_cap),reserve_factor:scU128(c.reserve_factor),rates:encodeRates(c.rates),idle_buffer_bps:scU32(c.idle_buffer_bps),yield_route:route,price:encodePrice(c.price),margin_enabled:scBool(c.margin_enabled),supply_reward_per_sec:scU128(c.supply_reward_per_sec),borrow_reward_per_sec:scU128(c.borrow_reward_per_sec)});
}
/** SDK native decoding represents contract enums as arrays. */
export function normalizeContract<T>(value:unknown):T{
 if(Array.isArray(value)){
  const tags=['None','Defindex','Blend','Aquarius','Zenex','Xoxno','ReflectorOnly','ReflectorWithAquariusGuard','AquariusOnly','Stellar','Other','Audited','Custom','PeridotHosted','SelfHosted'];
  if(typeof value[0]==='string'&&tags.includes(value[0]))return {tag:value[0],values:value.length>1?value.slice(1).map(v=>normalizeContract(v)):undefined} as T;
  return value.map(v=>normalizeContract(v)) as T;
 }
 if(value&&typeof value==='object'&&!(value instanceof Uint8Array))return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,normalizeContract(v)])) as T;
 return value as T;
}
export async function getGroup(id:number):Promise<Group>{
 if(network.useMocks){const g=readMockState().groups.find(g=>g.id===id);if(!g)throw new Error('Group not found.');return g;}
 return normalizeContract(await readContract(getDeployments().factory,'get_group',[scU32(id)]));
}
export async function listGroups(start=0,limit=100):Promise<Group[]>{
 if(network.useMocks)return readMockState().groups.filter(g=>g.id>=start).slice(0,limit);
 return normalizeContract(await readContract(getDeployments().factory,'list_groups',[scU32(start),scU32(limit)]));
}
export async function getMarketConfig(id:number,market:string):Promise<MarketConfig>{
 if(network.useMocks){const cfg=readMockState().configs[`${id}:${market}`];if(!cfg)throw new Error('Market not found.');return cfg;}
 return normalizeContract(await readContract(getDeployments().factory,'get_market_config',[scU32(id),scAddress(market)]));
}
/** Only the network-derived native SAC has the canonical XLM display symbol. */
export function canonicalTokenSymbol(token:string,symbol:string):string {
 return token===Asset.native().contractId(network.passphrase)?'XLM':symbol;
}
export async function getTokenMetadata(token:string):Promise<{symbol:string;decimals:number}>{
 if(!StrKey.isValidContract(token))throw new Error('Enter a valid Stellar token contract address.');
 if(network.useMocks){const t=readMockState().tokens[token];if(!t)throw new Error('Demo mode supports the example XLM, USDC and EURC tokens.');return t;}
 return readTokenMetadata(token,readContract);
}
/** Token metadata must not depend on any account having a classic trustline. */
export async function readTokenMetadata(token:string,read:(contract:string,method:string)=>Promise<unknown>):Promise<{symbol:string;decimals:number}> {
 const [symbol,decimals]=await Promise.all([read(token,'symbol'),read(token,'decimals')]);
 if(typeof symbol!=='string'||!symbol)throw new Error('Token symbol is unavailable.');
 if(typeof decimals!=='number'||!Number.isInteger(decimals)||decimals<0||decimals>18)throw new Error('Unsupported token decimals.');
 return {symbol:canonicalTokenSymbol(token,symbol),decimals};
}

export async function writeFactory<T>(method:string,args:xdr.ScVal[],signer:Signer,onProgress?:(p:TxProgress)=>void){return submitContract<T>({contractId:getDeployments().factory,method,args,signer,onProgress});}
export async function findReflectorFeed(token:string,symbol:string):Promise<PriceConfig>{
 if(network.useMocks){const {MOCK_ORACLE}=await import('./mock');const price:PriceConfig={tag:'ReflectorOnly',values:[{oracle:MOCK_ORACLE,asset:{tag:'Other',values:[symbol]}}]};if(!await isPriceFeedAllowed(token,price))throw new Error('This token and price feed mapping is not approved by the factory.');return price;}
 const d=getDeployments();
 for(const [key,tag,asset] of [['reflector_stellar','Stellar',token],['reflector_external','Other',symbol]] as const){
  const oracle=d.external[key];if(typeof oracle!=='string'||!oracle)continue;
  // A self-reported symbol is only a candidate; the central tuple allowlist proves the mapping.
  if(!await isOracleAllowed(oracle))continue;
  const assets=normalizeContract<Array<{tag:string;values:readonly[string]}>>(await readContract(oracle,'assets'));
  if(assets.some(a=>a.tag===tag&&a.values[0]===asset)){
   const price:PriceConfig={tag:'ReflectorOnly',values:[{oracle,asset:{tag,values:[asset]}}]};
   if(await isPriceFeedAllowed(token,price))return price;
  }
 }
 throw new Error('This token is not covered by the configured Reflector feeds.');
}

export async function isOracleAllowed(oracle:string):Promise<boolean>{
 if(!StrKey.isValidContract(oracle))return false;
 if(network.useMocks){const {MOCK_ORACLE}=await import('./mock');return oracle===MOCK_ORACLE;}
 return readContract<boolean>(getDeployments().factory,'is_oracle_allowed',[scAddress(oracle)]);
}
export async function isYieldVaultAllowed(vault:string):Promise<boolean>{
 if(!StrKey.isValidContract(vault))return false;
 return network.useMocks?true:readContract<boolean>(getDeployments().factory,'is_yield_vault_allowed',[scAddress(vault)]);
}


/** Oracle approval alone never proves that its asset key prices this token. */
export async function isPriceFeedAllowed(token:string,price:PriceConfig):Promise<boolean> {
 if(!StrKey.isValidContract(token)||price.tag!=='ReflectorOnly')return false;
 const {oracle,asset}=price.values[0];
 if(!await isOracleAllowed(oracle))return false;
 if(network.useMocks){
  const {MOCK_USDC,MOCK_XLM,MOCK_EURC,MOCK_DEMO_TOKEN}=await import('./mock');
  const symbols:Record<string,string>={[MOCK_USDC]:'USDC',[MOCK_XLM]:'XLM',[MOCK_EURC]:'EURC',[MOCK_DEMO_TOKEN]:'PDEMO'};
  if(!symbols[token])return false;
  return asset.tag==='Stellar'?asset.values[0]===token:asset.tag==='Other'&&asset.values[0]===symbols[token];
 }
 const encodedAsset=scEnum(asset.tag,asset.tag==='Stellar'?scAddress(asset.values[0]):scSymbol(asset.values[0]));
 return readContract<boolean>(getDeployments().factory,'is_price_feed_allowed',[scAddress(token),scAddress(oracle),encodedAsset]);
}


function yieldStruct(raw:xdr.ScVal,fields:Record<string,string>):Record<string,xdr.ScVal> {
 if(raw.type!=='scvMap'||!raw.map)throw new Error('Yield venue returned a malformed contract record.');
 const result:Record<string,xdr.ScVal>={};
 for(const entry of raw.map){
  if(entry.key.type!=='scvSymbol')throw new Error('Yield venue returned a malformed contract record.');
  const name=scValToNative(entry.key) as string;
  if(name in result)throw new Error('Yield venue returned a duplicated contract field.');
  result[name]=entry.val;
 }
 for(const [name,type] of Object.entries(fields))if(result[name]?.type!==type)throw new Error(`Yield venue returned an invalid ${name} field.`);
 return result;
}
/** Validate the actual partner ABI that factory attachment and adapter construction consume. */
export async function validateYieldVenue(token:string,route:YieldRoute,read:(contract:string,method:string,args?:xdr.ScVal[])=>Promise<xdr.ScVal>):Promise<void> {
 if(route.tag==='None')return;
 if(route.tag==='Defindex'){
  const vault=route.values[0].vault;
  const [assets,amounts]=await Promise.all([read(vault,'get_assets'),read(vault,'get_asset_amounts_per_shares',[scI128(0n)])]);
  if(assets.type!=='scvVec'||!assets.vec||assets.vec.length!==1)throw new Error('DeFindex must manage exactly one underlying asset.');
  const asset=yieldStruct(assets.vec[0],{address:'scvAddress',strategies:'scvVec'});
  if(Address.fromScVal(asset.address).toString()!==token)throw new Error('The DeFindex underlying asset does not match this market token.');
  const strategies=asset.strategies;
  if(strategies.type!=='scvVec'||!strategies.vec)throw new Error('DeFindex strategy information is unavailable.');
  let active=false;
  for(const strategy of strategies.vec){
   const fields=yieldStruct(strategy,{address:'scvAddress',name:'scvString',paused:'scvBool'});
   if(scValToNative(fields.paused)===false)active=true;
  }
  if(!active)throw new Error('DeFindex needs at least one unpaused strategy.');
  if(amounts.type!=='scvVec'||!amounts.vec||amounts.vec.length!==1||amounts.vec[0].type!=='scvI128')throw new Error('DeFindex share conversion must return exactly one signed token amount.');
  return;
 }
 if(route.tag==='Blend'){
  const vault=route.values[0].fee_vault;
  const [pool,reserve]=await Promise.all([read(vault,'get_pool'),read(vault,'get_reserve_vault',[scAddress(token)])]);
  if(pool.type!=='scvAddress'||!StrKey.isValidContract(Address.fromScVal(pool).toString()))throw new Error('The Blend fee vault does not reference a valid pool contract.');
  yieldStruct(reserve,{accrued_fees:'scvI128',address:'scvAddress',b_rate:'scvI128',last_update_timestamp:'scvU64',total_b_tokens:'scvI128',total_shares:'scvI128'});
  return;
 }
 throw new Error('Yield route is not available in this phase.');
}
export async function validateYieldRoute(token:string,route:YieldRoute):Promise<void> {
 if(route.tag==='None')return;
 if(!StrKey.isValidContract(token))throw new Error('Enter a valid market token before configuring yield.');
 const vault=route.tag==='Defindex'?route.values[0].vault:route.tag==='Blend'?route.values[0].fee_vault:'';
 if(!vault||!await isYieldVaultAllowed(vault))throw new Error('The yield vault is not approved by this factory.');
 if(network.useMocks)return; // Demo venues do not claim a live partner configuration.
 await validateYieldVenue(token,route,readContractRaw);
}
