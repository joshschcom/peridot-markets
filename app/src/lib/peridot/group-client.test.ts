import test from 'node:test';
import assert from 'node:assert/strict';

process.env.NEXT_PUBLIC_USE_MOCKS = 'true';
process.env.NEXT_PUBLIC_NETWORK = 'testnet';
class MemoryStorage {
  private values = new Map<string,string>();
  getItem(key:string) { return this.values.get(key) ?? null; }
  setItem(key:string,value:string) { this.values.set(key,value); }
  removeItem(key:string) { this.values.delete(key); }
}
const storage = new MemoryStorage();
Object.defineProperty(globalThis,'localStorage',{value:storage,configurable:true});
Object.defineProperty(globalThis,'window',{value:{localStorage:storage},configurable:true});
const load=async()=>{
  const client=await import('./group-client');
  const factory=await import('./factory');
  const mocks=await import('./mock');
  const group=await factory.getGroup(1);
  const signer={address:mocks.MOCK_OWNER,signTransaction:async()=>{throw new Error('Demo must not sign.');}};
  const usdc=await client.readMarket(group,group.markets[0],await factory.getMarketConfig(1,group.markets[0]),signer.address);
  const xlm=await client.readMarket(group,group.markets[1],await factory.getMarketConfig(1,group.markets[1]),signer.address);
  return {...client,group,signer,usdc,xlm};
};

test('demo metadata identifies real contract-address tokens correctly',async()=>{
  const {usdc,xlm}=await load();
  assert.equal(usdc.token.symbol,'USDC');
  assert.equal(xlm.token.symbol,'XLM');
});

test('supply in one market backs borrowing in another; full repayment and withdrawal accept blank amount',async()=>{
  const c=await load();
  await c.lend(c.group,c.usdc,'Supply','100',c.signer);
  await c.lend(c.group,c.usdc,'Enable collateral','',c.signer);
  await assert.rejects(c.lend(c.group,c.xlm,'Borrow','50',c.signer),/Enable this market/);
  await c.lend(c.group,c.xlm,'Enable collateral','',c.signer);
  await c.lend(c.group,c.xlm,'Borrow','50',c.signer);
  assert.equal(c.mockAccount(c.group,c.xlm.address,c.signer.address).debt,'500000000');
  await assert.rejects(c.lend(c.group,c.usdc,'Withdraw','',c.signer,undefined,true),/enough collateral/);
  assert.equal(c.mockAccount(c.group,c.usdc.address,c.signer.address).supplied,'1000000000');
  await c.lend(c.group,c.xlm,'Repay','',c.signer,undefined,true);
  assert.equal(c.mockAccount(c.group,c.xlm.address,c.signer.address).debt,'0');
  await c.lend(c.group,c.usdc,'Withdraw','',c.signer,undefined,true);
  assert.equal(c.mockAccount(c.group,c.usdc.address,c.signer.address).supplied,'0');
});

test('borrow power is checked before a demo mutation is saved',async()=>{
  const c=await load();
  await assert.rejects(c.lend(c.group,c.xlm,'Borrow','1',c.signer),/enough collateral/);
  assert.equal(c.mockAccount(c.group,c.xlm.address,c.signer.address).debt,'0');
});

test('rate display clamps utilization at core maximum and preserves reserve deduction',async()=>{
  const c=await load();
  const rates=c.rateApr(c.usdc.config,0n,100n,20n);
  assert.equal(rates.utilization,100);
  assert.equal(rates.borrowApr,27.2);
  assert.equal(rates.supplyApr,24.48);
});


test('missing SAC trustline becomes a specific zero balance state without hiding unrelated read failures',async()=>{
 const {readWalletTokenBalance,isMissingTrustlineError}=await import('./group-client');
 const {MOCK_USDC,MOCK_XLM,MOCK_OWNER}=await import('./mock');
 const missing=new Error(`Unable to read balance: HostError: Error(Contract, #13)\nEvent log (newest first):\n0: [Diagnostic Event] contract:${MOCK_USDC}, topics:[error, Error(Contract, #13)], data:["trustline entry is missing for account", ${MOCK_OWNER}]`);
 const [usdc,xlm]=await Promise.all([
  readWalletTokenBalance(MOCK_USDC,MOCK_OWNER,async()=>{throw missing;}),
  readWalletTokenBalance(MOCK_XLM,MOCK_OWNER,async()=>123n),
 ]);
 assert.deepEqual(usdc,{balance:0n,needsTrustline:true});
 assert.deepEqual(xlm,{balance:123n,needsTrustline:false});
 assert.deepEqual(await readWalletTokenBalance(MOCK_USDC,MOCK_OWNER,async()=>0n),{balance:0n,needsTrustline:false});
 assert.equal(isMissingTrustlineError(missing,MOCK_XLM,MOCK_OWNER),false,'a different token diagnostic must propagate');
 assert.equal(isMissingTrustlineError(missing,MOCK_USDC,'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5'),false,'a different account diagnostic must propagate');
 for(const error of [new Error('RPC unavailable'),new Error('HostError: Error(Contract, #13)'),new Error('trustline entry is missing for account')])await assert.rejects(readWalletTokenBalance(MOCK_USDC,MOCK_OWNER,async()=>{throw error;}),candidate=>candidate===error);
 await assert.rejects(readWalletTokenBalance(MOCK_XLM,MOCK_OWNER,async()=>{throw missing;}),candidate=>candidate===missing);
});

test('missing trustline blocks token movements but still allows market entry and another market',async()=>{
 const c=await load();const missing={...c.usdc,needsTrustline:true};
 for(const action of ['Supply','Withdraw','Borrow','Repay'] as const)await assert.rejects(c.lend(c.group,missing,action,'1',c.signer),/trustline with your wallet/);
 await c.lend(c.group,missing,'Enable collateral','',c.signer);
 assert.equal(c.mockAccount(c.group,c.usdc.address,c.signer.address).entered,true);
 await c.lend(c.group,c.xlm,'Supply','1',c.signer);
 assert.equal(c.mockAccount(c.group,c.xlm.address,c.signer.address).supplied,'10000000');
});


test('reward-bearing supply requires entry before changing a balance',async()=>{
 const c=await load();const group={...c.group,id:987,reward_distributor:'mock-distributor'};
 await assert.rejects(c.lend(group,c.usdc,'Supply','1',c.signer),/Enable this market before supplying/);
 assert.equal(c.mockAccount(group,c.usdc.address,c.signer.address).supplied,'0');
});
