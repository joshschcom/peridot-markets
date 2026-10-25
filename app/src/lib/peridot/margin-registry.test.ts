import test from 'node:test';
import assert from 'node:assert/strict';
import { xdr } from '@stellar/stellar-sdk';
import { decodeMarginRegistry, poolEligibility } from './margin-registry';
import { scAddress, scMap, scBool } from './factory';
import { MOCK_USDC, MOCK_XLM, MOCK_ORACLE, MOCK_OWNER } from './mock';
const instance=(router:xdr.ScVal=xdr.ScVal.scvVoid(),market=MOCK_USDC,enforced:xdr.ScVal=xdr.ScVal.scvVoid())=>xdr.ScVal.scvContractInstance(new xdr.ScContractInstance({executable:xdr.ContractExecutable.contractExecutableStellarAsset(),storage:[['Router',router],['MarketFactory',scAddress(market)],['RegistryEnforced',enforced]].map(([name,val])=>new xdr.ScMapEntry({key:xdr.ScVal.scvVec([xdr.ScVal.scvSymbol(name as string)]),val:val as xdr.ScVal}))}));
test('registry requires its exact router, boolean policy and market factory',()=>{
 const raw=instance(scAddress(MOCK_XLM),MOCK_USDC,scBool(true));
 assert.deepEqual(decodeMarginRegistry(xdr.ScVal.fromXDR(raw.toXDR()),MOCK_ORACLE,MOCK_USDC),{router:MOCK_XLM,enforced:true,factory:MOCK_ORACLE});
 for(const value of [instance(),instance(scAddress(MOCK_OWNER),MOCK_USDC,scBool(true)),instance(scAddress(MOCK_XLM),MOCK_XLM,scBool(true)),scMap({})])assert.throws(()=>decodeMarginRegistry(value,MOCK_ORACLE,MOCK_USDC),/registry/);
});
test('denial wins over trust and registry policy; malformed flags never allow a pool',()=>{
 assert.equal(poolEligibility(true,scBool(true)),true);
 assert.equal(poolEligibility(true),false);
 assert.equal(poolEligibility(false),true);
 for(const enforced of [true,false])assert.equal(poolEligibility(enforced,scBool(true),scBool(true)),false);
 assert.throws(()=>poolEligibility(false,scAddress(MOCK_XLM)),/schema/);
});
