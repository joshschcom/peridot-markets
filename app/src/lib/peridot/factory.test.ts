import test from 'node:test';
import assert from 'node:assert/strict';
import { Asset, Networks, nativeToScVal, xdr } from '@stellar/stellar-sdk';
import { scAddress, scBool, scI128, scMap, scU128, canonicalTokenSymbol, readTokenMetadata, validateYieldVenue } from './factory';
import { MOCK_USDC, MOCK_XLM, MOCK_ORACLE, MOCK_OWNER } from './mock';
import type { YieldRoute } from './types';

const defindex:YieldRoute={tag:'Defindex',values:[{vault:MOCK_ORACLE}]};
const blend:YieldRoute={tag:'Blend',values:[{fee_vault:MOCK_ORACLE}]};
const strategy=(paused=false)=>scMap({address:scAddress(MOCK_ORACLE),name:nativeToScVal('Yield strategy',{type:'string'}),paused:scBool(paused)});
const assets=(token=MOCK_USDC,strategies=[strategy()])=>xdr.ScVal.scvVec([scMap({address:scAddress(token),strategies:xdr.ScVal.scvVec(strategies)})]);
const amount=xdr.ScVal.scvVec([scI128(0n)]);
const reserve=()=>scMap({accrued_fees:scI128(0n),address:scAddress(MOCK_USDC),b_rate:scI128(1n),last_update_timestamp:nativeToScVal(1n,{type:'u64'}),total_b_tokens:scI128(0n),total_shares:scI128(0n)});
function reader(responses:Record<string,xdr.ScVal|Error>,calls?:Array<{method:string;args:xdr.ScVal[]}>){
 return async(contract:string,method:string,args:xdr.ScVal[]=[])=>{
  assert.equal(contract,MOCK_ORACLE);
  calls?.push({method,args});
  const response=responses[method];if(response instanceof Error)throw response;
  assert.ok(response,`Unexpected read ${method}`);
  return xdr.ScVal.fromXDR(response.toXDR());
 };
}

test('DeFindex boundary accepts one matching asset with an active strategy and requests zero signed shares',async()=>{
 const calls:Array<{method:string;args:xdr.ScVal[]}>=[];
 await validateYieldVenue(MOCK_USDC,defindex,reader({get_assets:assets(MOCK_USDC,[strategy(true),strategy(false)]),get_asset_amounts_per_shares:amount},calls));
 const quote=calls.find(c=>c.method==='get_asset_amounts_per_shares')!;
 assert.equal(quote.args.length,1);assert.equal(quote.args[0].toXDR('base64'),scI128(0n).toXDR('base64'));
});

test('DeFindex rejects wrong underlying, multiple assets and fully paused or empty strategies',async()=>{
 for(const [response,message] of [
  [assets(MOCK_XLM),/does not match/],
  [xdr.ScVal.scvVec([assets().vec![0],assets(MOCK_XLM).vec![0]]),/exactly one/],
  [assets(MOCK_USDC,[strategy(true)]),/unpaused/],
  [assets(MOCK_USDC,[]),/unpaused/],
 ] as const)await assert.rejects(validateYieldVenue(MOCK_USDC,defindex,reader({get_assets:response,get_asset_amounts_per_shares:amount})),message);
});

test('DeFindex rejects ABI lookalikes, invalid amount vectors and failed reads',async()=>{
 const wrongAddress=scMap({address:nativeToScVal(MOCK_USDC,{type:'string'}),strategies:xdr.ScVal.scvVec([strategy()])});
 await assert.rejects(validateYieldVenue(MOCK_USDC,defindex,reader({get_assets:xdr.ScVal.scvVec([wrongAddress]),get_asset_amounts_per_shares:amount})),/address field/);
 const malformedStrategy=scMap({address:scAddress(MOCK_ORACLE),name:nativeToScVal('strategy',{type:'string'}),paused:nativeToScVal('false',{type:'string'})});
 await assert.rejects(validateYieldVenue(MOCK_USDC,defindex,reader({get_assets:assets(MOCK_USDC,[malformedStrategy]),get_asset_amounts_per_shares:amount})),/paused field/);
 for(const response of [xdr.ScVal.scvVec([]),xdr.ScVal.scvVec([scI128(0n),scI128(0n)]),xdr.ScVal.scvVec([scU128(0n)])])await assert.rejects(validateYieldVenue(MOCK_USDC,defindex,reader({get_assets:assets(),get_asset_amounts_per_shares:response})),/signed token amount/);
 await assert.rejects(validateYieldVenue(MOCK_USDC,defindex,reader({get_assets:new Error('RPC unavailable'),get_asset_amounts_per_shares:amount})),/RPC unavailable/);
});

test('Blend validates a pool contract and the enabled reserve using the actual token argument',async()=>{
 const calls:Array<{method:string;args:xdr.ScVal[]}>=[];
 await validateYieldVenue(MOCK_USDC,blend,reader({get_pool:scAddress(MOCK_XLM),get_reserve_vault:reserve()},calls));
 assert.equal(calls.find(c=>c.method==='get_reserve_vault')!.args[0].toXDR('base64'),scAddress(MOCK_USDC).toXDR('base64'));
 for(const pool of [scAddress(MOCK_OWNER),nativeToScVal(MOCK_XLM,{type:'string'})])await assert.rejects(validateYieldVenue(MOCK_USDC,blend,reader({get_pool:pool,get_reserve_vault:reserve()})),/valid pool contract/);
 await assert.rejects(validateYieldVenue(MOCK_USDC,blend,reader({get_pool:scAddress(MOCK_XLM),get_reserve_vault:new Error('ReserveNotEnabled')})),/ReserveNotEnabled/);
 await assert.rejects(validateYieldVenue(MOCK_USDC,blend,reader({get_pool:scAddress(MOCK_XLM),get_reserve_vault:scMap({address:scAddress(MOCK_USDC)})})),/invalid accrued_fees/);
});

test('no-yield configuration makes no partner calls',async()=>{
 await validateYieldVenue(MOCK_USDC,{tag:'None',values:undefined},async()=>{throw new Error('Unexpected partner read');});
});


test('token discovery succeeds without a dummy account trustline and never queries its balance',async()=>{
 const reads:string[]=[];
 const metadata=await readTokenMetadata(MOCK_USDC,async(contract,method)=>{
  assert.equal(contract,MOCK_USDC);reads.push(method);
  if(method==='symbol')return 'USDC';
  if(method==='decimals')return 7;
  throw new Error('Contract #13: trustline missing');
 });
 assert.deepEqual(metadata,{symbol:'USDC',decimals:7});
 assert.deepEqual(reads.sort(),['decimals','symbol']);
 await assert.rejects(readTokenMetadata(MOCK_USDC,async(_contract,method)=>method==='symbol'?'USDC':-1),/Unsupported/);
});


test('only the selected network native SAC is displayed as XLM',async()=>{
 const {network}=await import('./network');
 const native=Asset.native().contractId(network.passphrase);
 const otherNetwork=Asset.native().contractId(network.passphrase===Networks.PUBLIC?Networks.TESTNET:Networks.PUBLIC);
 assert.equal(canonicalTokenSymbol(native,'native'),'XLM');
 assert.equal(canonicalTokenSymbol(MOCK_USDC,'native'),'native','an unrelated token cannot gain the native display name from its symbol');
 assert.equal(canonicalTokenSymbol(otherNetwork,'native'),'native','another network native SAC is not this network native asset');
 assert.equal(canonicalTokenSymbol(MOCK_USDC,'USDC'),'USDC');
 assert.deepEqual(await readTokenMetadata(native,async(_contract,method)=>method==='symbol'?'native':7),{symbol:'XLM',decimals:7});
});
