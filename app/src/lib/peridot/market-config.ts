import { StrKey } from '@stellar/stellar-sdk';
import { parseAmount, formatAmount } from './amount';
import type { MarketConfig, PriceConfig, RateModel } from './types';
export interface MarketDraft {
 token:string; symbol:string; decimals:number; collateralFactor:string; supplyCap:string; borrowCap:string; reserveFactor:string; idleBuffer:string;
 base:string; multiplier:string; jump:string; kink:string; supplyRewardsPerDay:string; borrowRewardsPerDay:string; routeAddress:string;
 route:'None'|'Defindex'|'Blend'; marginEnabled:boolean; price?:PriceConfig;
}
export const RATE_PRESETS = {Stable:{base:'0',multiplier:'8',jump:'200',kink:'90'},Volatile:{base:'1',multiplier:'18',jump:'400',kink:'80'},'Zero borrow rate':{base:'0',multiplier:'0',jump:'0',kink:'0'}} as const;
export function newMarketDraft():MarketDraft{return {token:'',symbol:'',decimals:7,collateralFactor:'70',supplyCap:'10000',borrowCap:'5000',reserveFactor:'10',idleBuffer:'20',...RATE_PRESETS.Stable,supplyRewardsPerDay:'0',borrowRewardsPerDay:'0',routeAddress:'',route:'None',marginEnabled:false};}
export function ratesFromDraft(d:MarketDraft):RateModel{return {base:parseAmount(d.base,4),multiplier:parseAmount(d.multiplier,4),jump:parseAmount(d.jump,4),kink:parseAmount(d.kink,4)};}
export function borrowApr(r:RateModel,utilizationPct:number):number{const u=BigInt(Math.round(utilizationPct*10000));const normal=r.base+(u<r.kink?u:r.kink)*r.multiplier/1000000n;return Number(normal+(u>r.kink?(u-r.kink)*r.jump/1000000n:0n))/10000;}
export function dailyToSpeed(amount:string,decimals:number):bigint{return parseAmount(amount,decimals)/86400n;}
export function validateMarketDraft(d:MarketDraft,rewardDecimals=7):string[]{
 const errors:string[]=[];
 if(!StrKey.isValidContract(d.token))errors.push('Enter a valid token contract address.');
 if(!d.symbol||!d.price)errors.push('Verify the token and its Reflector feed.');
 try{
  const cf=parseAmount(d.collateralFactor,4);if(cf<10000n||cf>750000n)errors.push('Collateral factor must be between 1% and 75%.');
  if(parseAmount(d.supplyCap,d.decimals)<=0n||parseAmount(d.borrowCap,d.decimals)<=0n)errors.push('Supply and borrow caps must be greater than zero.');
  if(parseAmount(d.reserveFactor,4)>500000n)errors.push('Reserve factor must be at most 50%.');
  const idle=parseAmount(d.idleBuffer,2);if(idle<1000n||idle>10000n)errors.push('Kept liquid must be between 10% and 100%.');
  const r=ratesFromDraft(d);if(r.base>10000000n||r.multiplier>10000000n||r.jump>10000000n||r.kink>1000000n)errors.push('Rate coefficients must be at most 1000%; kink must be at most 100%.');
  for(const daily of [d.supplyRewardsPerDay,d.borrowRewardsPerDay]){const speed=dailyToSpeed(daily,rewardDecimals);if(speed>1000000000000n)errors.push('Reward speed exceeds the protocol limit.');if(parseAmount(daily,rewardDecimals)>0n&&speed===0n)errors.push('Reward emission is too small to distribute each second.');}
 }catch(e){errors.push(e instanceof Error?e.message:'Enter valid amounts.');}
 if(d.marginEnabled&&d.decimals!==7)errors.push('Leverage requires a token with seven decimals.');
 if(d.route!=='None'&&!StrKey.isValidContract(d.routeAddress))errors.push('Enter a valid yield vault contract address.');
 return errors;
}
export function marketDraftToConfig(d:MarketDraft,rewardDecimals=7):MarketConfig{
 const errors=validateMarketDraft(d,rewardDecimals);if(errors.length)throw new Error(errors.join(' '));
 return {token:d.token,collateral_factor:parseAmount(d.collateralFactor,4),supply_cap:parseAmount(d.supplyCap,d.decimals),borrow_cap:parseAmount(d.borrowCap,d.decimals),reserve_factor:parseAmount(d.reserveFactor,4),rates:ratesFromDraft(d),idle_buffer_bps:Number(parseAmount(d.idleBuffer,2)),yield_route:d.route==='None'?{tag:'None',values:undefined}:d.route==='Defindex'?{tag:'Defindex',values:[{vault:d.routeAddress}]}:{tag:'Blend',values:[{fee_vault:d.routeAddress}]},price:d.price!,margin_enabled:d.marginEnabled,supply_reward_per_sec:dailyToSpeed(d.supplyRewardsPerDay,rewardDecimals),borrow_reward_per_sec:dailyToSpeed(d.borrowRewardsPerDay,rewardDecimals)};
}
export function draftFromConfig(c:MarketConfig,metadata:{symbol:string;decimals:number},rewardDecimals=7):MarketDraft{
 return {token:c.token,...metadata,collateralFactor:formatAmount(c.collateral_factor,4),supplyCap:formatAmount(c.supply_cap,metadata.decimals),borrowCap:formatAmount(c.borrow_cap,metadata.decimals),reserveFactor:formatAmount(c.reserve_factor,4),idleBuffer:formatAmount(BigInt(c.idle_buffer_bps),2),base:formatAmount(c.rates.base,4),multiplier:formatAmount(c.rates.multiplier,4),jump:formatAmount(c.rates.jump,4),kink:formatAmount(c.rates.kink,4),supplyRewardsPerDay:formatAmount(c.supply_reward_per_sec*86400n,rewardDecimals),borrowRewardsPerDay:formatAmount(c.borrow_reward_per_sec*86400n,rewardDecimals),route:c.yield_route.tag==='Defindex'?'Defindex':c.yield_route.tag==='Blend'?'Blend':'None',routeAddress:c.yield_route.tag==='Defindex'?c.yield_route.values[0].vault:c.yield_route.tag==='Blend'?c.yield_route.values[0].fee_vault:'',marginEnabled:c.margin_enabled,price:c.price};
}
