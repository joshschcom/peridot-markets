import { Address, StrKey, scValToNative, xdr } from '@stellar/stellar-sdk';
import { getDeployments } from './network';
import { assertRpcNetwork, getRpc } from './rpc';

// Read the deployed factory's public storage until its registry getters are exposed.
// Reject schema changes rather than guessing whether a pool is eligible.
const fieldKey=(name:string,pool?:string)=>xdr.ScVal.scvVec([xdr.ScVal.scvSymbol(name),...(pool?[new Address(pool).toScVal()]:[])]);
const ledgerKey=(contract:string,key:xdr.ScVal)=>xdr.LedgerKey.contractData(new xdr.LedgerKeyContractData({contract:new Address(contract).toScAddress(),key,durability:xdr.ContractDataDurability.persistent}));
export interface MarginRegistry {router:string;enforced:boolean;factory:string}
export function decodeMarginRegistry(raw:xdr.ScVal,factory:string,marketFactory:string):MarginRegistry {
  if(raw.type!=='scvContractInstance'||!raw.instance.storage)throw new Error('Margin registry instance is unavailable.');
  const value=(name:string)=>raw.instance.storage!.find(e=>e.key.toXDR('base64')===fieldKey(name).toXDR('base64'))?.val;
  const router=value('Router'),enforced=value('RegistryEnforced'),market=value('MarketFactory');
  if(router?.type!=='scvAddress'||!StrKey.isValidContract(Address.fromScVal(router).toString())||enforced?.type!=='scvBool'||market?.type!=='scvAddress'||Address.fromScVal(market).toString()!==marketFactory)throw new Error('Margin registry configuration is invalid or belongs to another market factory.');
  return {router:Address.fromScVal(router).toString(),enforced:scValToNative(enforced),factory};
}
export async function loadMarginRegistry():Promise<MarginRegistry> {
  await assertRpcNetwork();
  const d=getDeployments();
  if(!StrKey.isValidContract(d.margin_factory||''))throw new Error('Margin factory is not configured.');
  const key=ledgerKey(d.margin_factory,xdr.ScVal.scvLedgerKeyContractInstance());
  const response=await getRpc().getLedgerEntries(key),entry=response.entries.find(e=>e.key.toXDR('base64')===key.toXDR('base64'));
  if(entry?.val.type!=='contractData')throw new Error('Margin registry instance is unavailable.');
  const registry=decodeMarginRegistry(entry.val.contractData.val,d.margin_factory,d.factory);
  const configured=d.external.aquarius_router;
  if(configured&&configured!==registry.router)throw new Error('Configured Aquarius router differs from the margin factory.');
  return registry;
}
export function poolEligibility(enforced:boolean,trusted?:xdr.ScVal,denied?:xdr.ScVal):boolean {
  for(const flag of [trusted,denied])if(flag&&flag.type!=='scvBool')throw new Error('Margin pool registry flag has an invalid schema.');
  return !Boolean(denied&&scValToNative(denied))&&(!enforced||Boolean(trusted&&scValToNative(trusted)));
}
export async function isMarginPoolUsable(registry:MarginRegistry,pool:string):Promise<boolean> {
  if(!StrKey.isValidContract(pool))return false;
  await assertRpcNetwork();
  const keys=['TrustedPool','DeniedPool'].map(name=>ledgerKey(registry.factory,fieldKey(name,pool)));
  const response=await getRpc().getLedgerEntries(...keys);
  const values=keys.map(key=>{
    const entry=response.entries.find(e=>e.key.toXDR('base64')===key.toXDR('base64'));
    if(!entry)return undefined;
    if(entry.val.type!=='contractData')throw new Error('Margin pool registry data is malformed.');
    return entry.val.contractData.val;
  });
  return poolEligibility(registry.enforced,values[0],values[1]);
}
