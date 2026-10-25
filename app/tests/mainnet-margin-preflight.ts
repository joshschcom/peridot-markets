/** Read-only mainnet margin check. No key loading, signing or transaction submission.
 * Run from app/: NEXT_PUBLIC_MAINNET_RPC_URL=https://mainnet.sorobanrpc.com \
 *   node --import tsx tests/mainnet-margin-preflight.ts [--account G...]
 * Exit 0: topology verified; this is not evidence that an open/close transaction succeeds.
 */
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Account, Address, BASE_FEE, Contract, Networks, StrKey, TransactionBuilder, nativeToScVal, rpc, scValToNative, xdr } from '@stellar/stellar-sdk';

type Group = { id:number; controller:string; margin_controller?:string; markets:string[] };
type Margin = { controller:string; swap_adapter:string; enabled_markets:string[]; cfg:{max_leverage:bigint} };
const POOL='CBBMQBNHB2FYVZYV7VNHOJHUMTFJLR4PUMRVQYNW6RHIKZO2NQMIBUCV';
const POOL_ID='24f9c991c44acf33fff5f44031c40385d235dc212d7379e824ba3db1c35371f3';
async function main() {
const args=process.argv.slice(2);
if(args.length && (args.length!==2||args[0]!=='--account'||!StrKey.isValidEd25519PublicKey(args[1])))throw new Error('Usage: mainnet-margin-preflight.ts [--account G...]. Public account addresses only.');
const owner=args[1];
const rpcUrl=process.env.NEXT_PUBLIC_MAINNET_RPC_URL;
if(!rpcUrl||new URL(rpcUrl).protocol!=='https:')throw new Error('Set an HTTPS NEXT_PUBLIC_MAINNET_RPC_URL.');
const manifest=JSON.parse(await readFile(resolve(__dirname,'../../deployments/mainnet.json'),'utf8'));
if(manifest.network!=='mainnet'||!StrKey.isValidContract(manifest.factory)||!StrKey.isValidContract(manifest.margin_factory))throw new Error('A complete mainnet factory manifest is required.');
const client=new rpc.Server(rpcUrl);
if((await client.getNetwork()).passphrase!==Networks.PUBLIC)throw new Error('RPC is not Stellar public network.');
const address=(s:string)=>new Address(s).toScVal();
const integer=(n:number|bigint,type:'u32'|'u64'|'u128'='u128')=>nativeToScVal(n,{type});
async function read<T>(contract:string,method:string,params:xdr.ScVal[]=[]):Promise<T> {
  const tx=new TransactionBuilder(new Account('GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF','0'),{fee:BASE_FEE,networkPassphrase:Networks.PUBLIC}).addOperation(new Contract(contract).call(method,...params)).setTimeout(120).build();
  const result=await client.simulateTransaction(tx);
  if(!rpc.Api.isSimulationSuccess(result)||!result.result)throw new Error(`${method} read failed: ${'error' in result?result.error:'missing result'}`);
  return scValToNative(result.result.retval) as T;
}
const groupId=manifest.demo.group_id;
const [group,margin]=await Promise.all([
  read<Group>(manifest.factory,'get_group',[integer(groupId,'u32')]),
  read<Margin|undefined>(manifest.margin_factory,'get_margin',[integer(groupId,'u32')]),
]);
if(!margin||margin.controller!==group.margin_controller||margin.controller!==manifest.demo.margin_controller)throw new Error('Margin controller differs between factory, group and deployment manifest.');
const [poolAllowed,bindingAllowed,tokens,positionCounter]=await Promise.all([
  read<boolean>(margin.swap_adapter,'is_pool_allowed',[address(POOL)]),
  read<boolean>(margin.swap_adapter,'is_pool_binding_allowed',[xdr.ScVal.scvBytes(Buffer.from(POOL_ID,'hex')),address(POOL)]),
  read<string[]>(POOL,'get_tokens'),
  read<bigint>(margin.controller,'get_position_counter'),
]);
if(!poolAllowed||!bindingAllowed||tokens.length!==2)throw new Error('Expected two-token pool and its binding are not enabled.');
const markets=[];
for(const market of group.markets){
  const token=await read<string>(manifest.factory,'market_token',[integer(groupId,'u32'),address(market)]);
  const [rawSymbol,supplied,liquid,leverage,rate]=await Promise.all([
    read<string>(token,'symbol'),read<bigint>(market,'get_total_underlying'),read<bigint>(market,'get_available_liquidity'),
    read<bigint>(manifest.margin_factory,'effective_max_leverage',[integer(groupId,'u32'),address(market)]),read<bigint>(market,'get_exchange_rate'),
  ]);
  const wallet:Record<string,unknown>={};
  if(owner){
    const [receiptShares,freeMarginShares,positionIds]=await Promise.all([
      read<bigint>(market,'get_ptoken_balance',[address(owner)]),
      read<bigint>(margin.controller,'get_margin_balance_ptokens',[address(owner),address(token)]),
      read<bigint[]>(margin.controller,'get_user_positions',[address(owner)]),
    ]);
    let walletUnderlyingBalance:bigint|null=null,needsTrustline=false;
    try{walletUnderlyingBalance=await read<bigint>(token,'balance',[address(owner)]);}
    catch(error){
      const message=error instanceof Error?error.message:'';
      if(message.includes('Error(Contract, #13)')&&message.includes('trustline entry is missing for account')&&message.includes(token)&&message.includes(owner)){walletUnderlyingBalance=0n;needsTrustline=true;}
      else throw error;
    }
    Object.assign(wallet,{receiptShares,freeMarginShares,availableMarginUnderlying:(receiptShares+freeMarginShares)*rate/1_000_000n,walletUnderlyingBalance,needsTrustline,positionIds});
  }
  markets.push({market,token,symbol:token===manifest.external.xlm?'XLM':rawSymbol,marginEnabled:margin.enabled_markets.includes(market),poolContainsToken:tokens.includes(token),effectiveMaxLeverage:leverage,supplied,availableLiquidity:liquid,...wallet});
}
const pairs=[];
for(const source of markets)for(const base of markets){
  if(source.market===base.market||!source.marginEnabled||!base.marginEnabled)continue;
  for(const side of ['Long','Short']){
    const pairArgs=[address(source.token),address(base.token),xdr.ScVal.scvVec([xdr.ScVal.scvSymbol(side)])];
    const [config,execution]=await Promise.all([
      read<{max_leverage:bigint}|undefined>(margin.controller,'get_perps_pair_config',pairArgs),
      read<{open_slippage_scaled:bigint;close_slippage_scaled:bigint}|undefined>(margin.controller,'get_perps_pair_execution_config',pairArgs),
    ]);
    const collateral=side==='Long'?base:source;
    const debt=side==='Long'?source:base;
    pairs.push({margin:source.symbol,base:base.symbol,side,configured:!!config&&!!execution,twoTimesAllowed:!!config&&config.max_leverage>=2n&&collateral.effectiveMaxLeverage>=2n,borrowedMarket:debt.market,borrowedLiquidity:debt.availableLiquidity,execution});
  }
}
const issues:string[]=[];
if(!manifest.external.aquarius_router)issues.push('App route discovery is blocked: external.aquarius_router is absent from the deployment manifest.');
if(markets.filter(m=>m.marginEnabled&&m.poolContainsToken).length<2)issues.push('Fewer than two enabled pool-connected margin markets.');
if(!pairs.some(p=>p.twoTimesAllowed&&p.configured&&p.borrowedLiquidity>0n))issues.push('No configured 2x direction currently has positive borrowed-market liquidity. Supply approved liquidity before opening.');
if(!owner)issues.push('No public wallet supplied. Account funding, receipt shares, free margin and existing position IDs were not checked.');
console.log(JSON.stringify({readOnly:true,network:'mainnet',ledger:(await client.getLatestLedger()).sequence,groupId,controller:margin.controller,swapAdapter:margin.swap_adapter,pool:POOL,poolId:POOL_ID,poolAllowed,bindingAllowed,positionCounter,account:owner??null,markets,pairs,issues,transactionEvidence:false,note:'Read-only configuration and liquidity snapshot. Amount-specific simulation, wallet review and confirmations are still required; no existing position is assumed absent.'},(_,v)=>typeof v==='bigint'?v.toString():v,2));

}
void main().catch(error=>{console.error(error instanceof Error?error.message:String(error));process.exitCode=1;});
