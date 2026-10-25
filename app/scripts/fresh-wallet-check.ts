/** Public-data preflight only. No private keys, signatures or transaction submissions.
 * From app/: NEXT_PUBLIC_MAINNET_RPC_URL=https://mainnet.sorobanrpc.com \
 * node --import tsx scripts/fresh-wallet-check.ts --account G...
 */
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Account, Address, BASE_FEE, Contract, Networks, StrKey, TransactionBuilder, nativeToScVal, rpc, scValToNative, xdr } from '@stellar/stellar-sdk';

type Group={id:number;name:string;owner:string;controller:string;markets:string[];reward_distributor?:string; margin_controller?:string};
type Manifest={network:string;factory:string;external:{xlm:string};demo:{group_id:number;rewards_group_id:number;blend_group_id:number}};
const usage='Usage: node --import tsx scripts/fresh-wallet-check.ts --account G...\nSet NEXT_PUBLIC_MAINNET_RPC_URL to an HTTPS mainnet RPC. Public addresses only; this never signs or submits.';
async function main(){
 const args=process.argv.slice(2);
 if(args.length===1&&args[0]==='--help'){console.log(usage);return;}
 if(args.length!==2||args[0]!=='--account'||!StrKey.isValidEd25519PublicKey(args[1]))throw new Error(usage);
 const account=args[1],endpoint=process.env.NEXT_PUBLIC_MAINNET_RPC_URL;
 if(!endpoint||new URL(endpoint).protocol!=='https:')throw new Error('Set an HTTPS NEXT_PUBLIC_MAINNET_RPC_URL.');
 const manifest=JSON.parse(await readFile(resolve(__dirname,'../../deployments/mainnet.json'),'utf8')) as Manifest;
 if(manifest.network!=='mainnet'||!StrKey.isValidContract(manifest.factory))throw new Error('A verified mainnet manifest is required.');
 const client=new rpc.Server(endpoint);
 if((await client.getNetwork()).passphrase!==Networks.PUBLIC)throw new Error('RPC network is not Stellar mainnet.');
 const ledger=await client.getLatestLedger();
 const key=xdr.LedgerKey.account(new xdr.LedgerKeyAccount({accountId:xdr.PublicKey.publicKeyTypeEd25519(StrKey.decodeEd25519PublicKey(account))}));
 const result=await client.getLedgerEntries(key),entry=result.entries[0]?.val;
 if(!entry){console.log(JSON.stringify({readOnly:true,network:'mainnet',ledger:ledger.sequence,account,accountExists:false,acceptanceComplete:false,next:'Fund this fresh account with the approved amount, then rerun. No transaction was submitted.'},null,2));process.exitCode=2;return;}
 if(entry.type!=='account')throw new Error('RPC returned an unexpected account entry.');
 const address=(value:string)=>new Address(value).toScVal();
 const u32=(value:number)=>nativeToScVal(value,{type:'u32'});
 async function read<T>(contract:string,method:string,params:xdr.ScVal[]=[]):Promise<T>{
  if(!StrKey.isValidContract(contract))throw new Error(`Invalid contract for ${method}.`);
  const tx=new TransactionBuilder(new Account(account,'0'),{fee:BASE_FEE,networkPassphrase:Networks.PUBLIC})
   .addOperation(new Contract(contract).call(method,...params)).setTimeout(120).build();
  const response=await client.simulateTransaction(tx);
  if(!rpc.Api.isSimulationSuccess(response)||!response.result)throw new Error(`${method}: ${'error' in response?response.error:'Missing simulation result'}`);
  return scValToNative(response.result.retval) as T;
 }
 const prerequisites:string[]=[],groups=[];
 const groupIds=[manifest.demo.group_id,manifest.demo.rewards_group_id,manifest.demo.blend_group_id];
 if(groupIds.some(id=>!Number.isSafeInteger(id)||id<0))throw new Error('Manifest must identify Meridian, Rewards and BlendDemo groups.');
 for(const id of groupIds){
  const group=await read<Group>(manifest.factory,'get_group',[u32(id)]);
  const entered=await read<string[]>(group.controller,'get_user_markets',[address(account)]);
  const markets=[];
  for(const market of group.markets){
   const token=await read<string>(manifest.factory,'market_token',[u32(id),address(market)]);
   const [symbol,decimals,liquidity,receiptShares,debt]=await Promise.all([
    read<string>(token,'symbol'),read<number>(token,'decimals'),read<bigint>(market,'get_available_liquidity'),
    read<bigint>(market,'get_ptoken_balance',[address(account)]),read<bigint>(market,'get_user_borrow_balance',[address(account)]),
   ]);
   let balance=0n,needsTrustline=false;
   try{balance=await read<bigint>(token,'balance',[address(account)]);}
   catch(error){
    const message=error instanceof Error?error.message:'';
    if(message.includes('Error(Contract, #13)')&&message.includes(`contract:${token},`)&&new RegExp(`"trustline entry is missing for account"\\s*,\\s*${account}\\s*\\]`).test(message))needsTrustline=true;
    else throw error;
   }
   const label=token===manifest.external.xlm?'XLM':symbol;
   if(needsTrustline)prerequisites.push(`Group ${id} ${label}: authorize the required asset trustline with Albedo before token movements.`);
   if(!entered.includes(market))prerequisites.push(`Group ${id} ${label}: confirm enter_market before borrowing${group.reward_distributor?' or supplying for rewards':''}.`);
   if(liquidity===0n)prerequisites.push(`Group ${id} ${label}: borrowed-market liquidity is zero; an approved supply is needed before borrowing it.`);
   markets.push({market,token,symbol:label,decimals,walletBalance:balance,needsTrustline,entered:entered.includes(market),receiptShares,debt,availableLiquidity:liquidity});
  }
  const rewards=group.reward_distributor?{
   distributor:group.reward_distributor,
   accrued:await read<bigint>(group.controller,'get_accrued',[address(account)]),
   available:await read<bigint>(group.reward_distributor,'balance_available'),
  }:null;
  groups.push({id,name:group.name,controller:group.controller,owner:group.owner,isOwner:group.owner===account,marginController:group.margin_controller??null,rewards,markets});
 }
 console.log(JSON.stringify({readOnly:true,network:'mainnet',ledger:ledger.sequence,account,accountExists:true,
  nativeBalanceStroops:entry.account.balance,nativeBalanceIsNotSpendableBudget:true,freshAccountClaimVerified:false,
  acceptanceComplete:false,groups,prerequisites,remainingWalletChecks:[
   'Use a fresh account and browser profile; confirm the displayed network and reject a deliberate wrong-network request.',
   'Create a group, deploy/activate/attach each market, and preserve confirmed receipts when a signature is rejected.',
   'Enter reward and borrowed markets first; supply, borrow, repay and withdraw with approved tiny amounts.',
   'Enable rewards last in the new group; claim funded rewards in group 2. Keep group 1 without rewards for the add-market demo.',
   'Owner controls require the owner wallet: add a market, change immediate settings, stage CF/price for 60s, apply, then sync_pairs for margin groups.',
   'Open and close a tiny 2x margin position only after account margin and borrowed-market liquidity checks pass.',
   'Record every confirmed hash and before/after balances in docs/DEMO.md. This read-only report does not establish any of these flows.',
  ]},(_,value)=>typeof value==='bigint'?value.toString():value,2));
}
void main().catch(error=>{console.error(error instanceof Error?error.message:String(error));process.exitCode=1;});
