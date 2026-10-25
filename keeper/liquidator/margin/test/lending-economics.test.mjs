import assert from 'node:assert/strict';
import test from 'node:test';
import {StrKey} from '@stellar/stellar-sdk';
import {lendingEconomics,assertLendingEconomics,lendingSettings} from '../src/lending.mjs';
const c=n=>StrKey.encodeContract(Buffer.alloc(32,n));
const debtMarket=c(1),collateralMarket=c(2),debtToken=c(3),collateralToken=c(4),router=c(5),recipient=c(6);
const policy={minProfitBps:100,costBufferUsdMicro:100000n};
function fixture({fee=0n,reserve=recipient,quoteDecimals=14,debtDecimals=6,collateralDecimals=7,netPrice=1n,stale=false,missing=false}={}){
 return async(id,method,args)=>{
  if(method==='get_underlying_token')return id===debtMarket?debtToken:collateralToken;
  if(method==='decimals')return id===router?quoteDecimals:id===debtToken?debtDecimals:collateralDecimals;
  if(method==='resolution')return 300;
  if(method==='check')return {status:missing?'unavailable':stale?'stale':'ok',timestamp:stale?1n:1000n,reflector_price:netPrice*10n**BigInt(quoteDecimals)};
  if(method==='get_liquidation_fee_scaled')return fee;
  if(method==='get_reserve_recipient')return reserve;
  if(method==='get_exchange_rate')return 1000000n;
  if(method==='preview_seize_ptokens')return 110n*10n**BigInt(collateralDecimals);
  throw new Error(`Unexpected read ${method}`);
 };
}
const input={repayMarket:debtMarket,collateralMarket,repayAmount:100000000n,priceRouter:router,settings:policy,now:1000};
test('real router decimal scale and differing token decimals produce exact net USD',async()=>{
 const value=await lendingEconomics({...input,read:fixture()});
 assert.equal(value.debtUsd,100n*10n**18n);assert.equal(value.netCollateralUsd,110n*10n**18n);
 assert.equal(value.requiredUsd,101100000000000000000n);assert.equal(value.profitable,true);
 assert.deepEqual(await lendingEconomics({...input,read:fixture({quoteDecimals:8})}),value);
});
test('protocol fee can turn a gross incentive into a loss and must stop live planning',async()=>{
 const value=await lendingEconomics({...input,read:fixture({fee:500000n})});
 assert.equal(value.netCollateralUsd,55n*10n**18n);assert.equal(value.profitable,false);
 await assert.rejects(assertLendingEconomics({...input,read:fixture({fee:500000n})}),/Net liquidation value/);
 assert.equal((await lendingEconomics({...input,read:fixture({fee:500000n,reserve:null})})).profitable,true);
});
test('missing, stale and malformed valuation data cannot produce a profitability approval',async()=>{
 for(const options of [{stale:true},{missing:true},{quoteDecimals:39},{debtDecimals:19},{netPrice:0n},{fee:500001n}])await assert.rejects(lendingEconomics({...input,read:fixture(options)}));
 await assert.rejects(lendingEconomics({...input,priceRouter:undefined,read:fixture()}),/router/);
 await assert.rejects(lendingEconomics({...input,settings:{minProfitBps:0,costBufferUsdMicro:0n},read:fixture()}),/profit and cost/);
});
test('configured cost margin rejects positive gross returns that cannot meet its budget',async()=>{
 await assert.rejects(assertLendingEconomics({...input,settings:{...policy,costBufferUsdMicro:10000000n},read:fixture()}),/Net liquidation value/);
 const group={markets:[debtMarket],factory:c(9),lendingController:c(10)};
 for(const env of [{LENDING_MIN_PROFIT_BPS:'0'},{LENDING_MIN_PROFIT_BPS:'10001'},{LENDING_COST_BUFFER_USD_MICRO:'-1'}])assert.throws(()=>lendingSettings(env,group,{network:'testnet',groupId:1}));
});
