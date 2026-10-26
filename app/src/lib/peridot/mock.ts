import type { Group, MarketConfig } from './types';
import { network } from './network';
export interface MockEvent { timestamp: number; method: string; hash: string; detail: string }
export interface MockState { groups: Group[]; configs: Record<string, MarketConfig>; tokens: Record<string, {symbol:string;decimals:number}>; history: Record<string,MockEvent[]>; pending: Record<string,unknown>; nextId:number }
export const MOCK_OWNER = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF';
export const MOCK_USDC = 'CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75';
export const MOCK_EURC = 'CDTKPWPLOURQA2SGTKTUQOWRCBZEORB4BWBOMJ3D3ZTQQSGE5F6JBQLV';
export const MOCK_XLM = 'CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA';
/** Demo-only custom tokens for the "paste a token address" flow. PDEMO has a mock Reflector feed; NOFEED has none and shows the blocked path. */
export const MOCK_DEMO_TOKEN = 'CADQOBYHA4DQOBYHA4DQOBYHA4DQOBYHA4DQOBYHA4DQOBYHA4DQP5KR';
export const MOCK_NOFEED_TOKEN = 'CAEQSCIJBEEQSCIJBEEQSCIJBEEQSCIJBEEQSCIJBEEQSCIJBEEQTD2L';
export const MOCK_CUSTOM_TOKENS: Record<string, {symbol:string;decimals:number;name:string;totalSupply:bigint}> = {
 [MOCK_DEMO_TOKEN]:{symbol:'PDEMO',decimals:7,name:'Peridot Demo Token',totalSupply:10_000_000_000_000n},
 [MOCK_NOFEED_TOKEN]:{symbol:'NOFEED',decimals:7,name:'Unpriced Demo Token',totalSupply:2_500_000_000_000n},
};
export const MOCK_ORACLE = 'CAFJZQWSED6YAWZU3GWRTOCNPPCGBN32L7QV43XX5LZLFTK6JLN34DLN';
const key = `peridot:mock:v1:${network.name}`;
function initial():MockState {
 const config=(token:string,symbol:string):MarketConfig=>({token,collateral_factor:700000n,supply_cap:1000000000000n,borrow_cap:500000000000n,reserve_factor:100000n,rates:symbol==='XLM'?{base:0n,multiplier:0n,jump:0n,kink:0n}:{base:0n,multiplier:80000n,jump:2000000n,kink:900000n},idle_buffer_bps:2000,yield_route:{tag:'None',values:undefined},price:{tag:'ReflectorOnly',values:[{oracle:MOCK_ORACLE,asset:{tag:'Other',values:[symbol]}}]},margin_enabled:true,supply_reward_per_sec:0n,borrow_reward_per_sec:0n});
 return {groups:[{id:1,owner:MOCK_OWNER,name:'Meridian',controller:'mock-controller-1',price_router:'mock-router-1',reward_distributor:undefined,margin_controller:'mock-margin-1',markets:['mock-market-1-USDC','mock-market-1-XLM'],created_at:BigInt(Math.floor(Date.now()/1000)),keeper_mode:{tag:'None',values:undefined},keeper_paid_until:0n}],configs:{'1:mock-market-1-USDC':config(MOCK_USDC,'USDC'),'1:mock-market-1-XLM':config(MOCK_XLM,'XLM')},tokens:{[MOCK_USDC]:{symbol:'USDC',decimals:7},[MOCK_XLM]:{symbol:'XLM',decimals:7},[MOCK_EURC]:{symbol:'EURC',decimals:7},[MOCK_DEMO_TOKEN]:{symbol:'PDEMO',decimals:7},[MOCK_NOFEED_TOKEN]:{symbol:'NOFEED',decimals:7}},history:{},pending:{},nextId:2};
}
const replacer=(_key:string,value:unknown)=>typeof value==='bigint'?{__peridotBigint:value.toString()}:value;
const reviver=(_key:string,value:unknown)=>value && typeof value==='object' && '__peridotBigint' in value?BigInt((value as {__peridotBigint:string}).__peridotBigint):value;
let memory:MockState|undefined;
export function readMockState():MockState {
 if(!network.useMocks)throw new Error('Mock data is disabled.');
 if(typeof window==='undefined')return initial();
 try { const value=window.localStorage.getItem(key); if(value){const parsed=JSON.parse(value,reviver) as MockState;parsed.tokens[MOCK_EURC]={symbol:'EURC',decimals:7};parsed.tokens[MOCK_DEMO_TOKEN]={symbol:'PDEMO',decimals:7};parsed.tokens[MOCK_NOFEED_TOKEN]={symbol:'NOFEED',decimals:7};return parsed;} } catch { /* The demo can run in memory when storage is blocked. */ }
 return memory ??= initial();
}
export function mutateMockState<T>(fn:(state:MockState)=>T):T {
 const state=readMockState(); const result=fn(state); memory=state;
 try {window.localStorage.setItem(key,JSON.stringify(state,replacer));}catch{/* In-memory demo only. */}
 return result;
}
export function writeMockEvent(state:MockState,groupId:number,method:string,detail:string):string {
 const hash=`mock-${Date.now()}-${Math.random().toString(16).slice(2)}`;
 (state.history[String(groupId)]??=[]).unshift({timestamp:Math.floor(Date.now()/1000),method,hash,detail});return hash;
}

/** Mirror separate deployment and activation: pending markets are not listed in the group. */
export function mockCreateMarket(state:MockState,id:number,market:string,cfg:MarketConfig,metadata:{symbol:string;decimals:number}):void {
 const group=state.groups.find(g=>g.id===id);if(!group)throw new Error('Group not found.');
 if(group.reward_distributor)throw new Error('Markets cannot be added after group rewards are enabled.');
 const existing=Object.entries(state.configs).filter(([key])=>key.startsWith(`${id}:`));
 if(existing.length>=16)throw new Error('A group supports at most 16 markets.');
 if(existing.some(([,value])=>value.token===cfg.token))throw new Error('This token already has a market in the group.');
 if(cfg.supply_reward_per_sec!==0n||cfg.borrow_reward_per_sec!==0n)throw new Error('Creation reward speeds must be zero.');
 state.configs[`${id}:${market}`]=cfg;state.tokens[cfg.token]=metadata;
 state.pending[`market-record:${id}:${market}`]={active:false};
}
export function mockActivateMarket(state:MockState,id:number,market:string):void {
 const group=state.groups.find(g=>g.id===id);if(!group)throw new Error('Group not found.');
 if(group.reward_distributor)throw new Error('Markets cannot be activated after group rewards are enabled.');
 if(!state.configs[`${id}:${market}`])throw new Error('Market not found.');
 if(group.markets.includes(market))throw new Error('Market is already active.');
 group.markets.push(market);state.pending[`market-record:${id}:${market}`]={active:true};
}
