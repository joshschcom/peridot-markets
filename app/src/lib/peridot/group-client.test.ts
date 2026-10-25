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
