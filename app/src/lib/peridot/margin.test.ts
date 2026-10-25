import test from 'node:test';
import assert from 'node:assert/strict';
import { Address, xdr } from '@stellar/stellar-sdk';
import { closeAccrualApr, accruedCloseTarget, closeQuoteTarget, ConfirmedStageError, decodeDebtAccrualState, decodeMarginPoolRegistry, openExecutionFloor, bufferedDebt, closeHasSwapped, effectiveLeverage, liquidationPriceEstimate, minOutput, openTradeAmount, solveShortInput } from './margin';

test('a close with spent proceeds and residual debt is still marked swapped',()=>{
  assert.equal(closeHasSwapped({received_debt_asset:0n,debt_amount:100n}),true);
  assert.equal(closeHasSwapped({received_debt_asset:100n,debt_amount:100n}),true);
  assert.equal(closeHasSwapped({received_debt_asset:0n,debt_amount:0n}),false);
});

test('open sizing uses the same intermediate flooring as V3 core',()=>{
  assert.equal(openTradeAmount(7n,2,'Long',[2n,3n],[3n,2n]),13n);
  assert.equal(openTradeAmount(7n,2,'Short',[2n,3n],[3n,2n]),5n);
  assert.throws(()=>openTradeAmount(7n,1,'Long',[2n,3n],[3n,2n]),/Invalid/);
});

test('short liquidation maintenance uses debt notional, not a long approximation',()=>{
  assert.equal(liquidationPriceEstimate('Short',120n,100n,100000n),120/110);
  assert.equal(liquidationPriceEstimate('Long',120n,100n,100000n),100/108);
  assert.equal(liquidationPriceEstimate('Short',120n,0n,100000n),null);
});

test('short close purchases only enough debt asset and retains exact large integer precision',async()=>{
  assert.equal(await solveShortInput(1000n,101n,async n=>n*2n),51n);
  const target=900719925474099399n;
  assert.equal(await solveShortInput(target,target,async n=>n*2n),(target+1n)/2n);
  await assert.rejects(solveShortInput(10n,21n,async n=>n*2n),/cannot cover/);
});

test('debt floor rounds up and slippage cannot exceed the factory guardrail',()=>{
  assert.equal(bufferedDebt(1n),2n);
  assert.equal(bufferedDebt(10000n),10010n);
  assert.equal(minOutput(10001n,100),9900n);
  assert.throws(()=>minOutput(100n,1001),/Slippage/);
  assert.equal(effectiveLeverage(5,750000n),4);
});


test('raw pool maps preserve binary IDs through SDK17 XDR roundtrip',()=>{
  const bytes=Uint8Array.from({length:32},(_,i)=>i%2?0xff:0xfe);
  const pool=Address.contract(new Uint8Array(32).fill(9)).toString();
  const value=xdr.ScVal.scvMap([new xdr.ScMapEntry({key:xdr.ScVal.scvBytes(bytes),val:new Address(pool).toScVal()})]);
  const raw=xdr.ScVal.fromXDR(value.toXDR());
  assert.deepEqual(decodeMarginPoolRegistry(raw),[{poolId:bytes,pool}]);
  assert.throws(()=>decodeMarginPoolRegistry(xdr.ScVal.scvVec([])),/Unexpected/);
  assert.throws(()=>decodeMarginPoolRegistry(xdr.ScVal.scvMap([new xdr.ScMapEntry({key:xdr.ScVal.scvBytes(new Uint8Array(31)),val:new Address(pool).toScVal()})])),/Invalid/);
});

test('close target includes stale-index interest, rounding and bounded signing headroom',()=>{
  const debt=1_000_000_000_000n,apr=272000n,elapsed=86400n;
  const target=accruedCloseTarget(debt,apr,100n,100n+elapsed);
  const contractDebt=debt+debt*apr*elapsed/(1_000_000n*31_536_000n);
  assert.ok(target>bufferedDebt(contractDebt));
  assert.ok(target<bufferedDebt(debt*101n/100n));
  assert.throws(()=>accruedCloseTarget(debt,10_000_000n,0n,31_536_000n),/10%/);
  assert.throws(()=>accruedCloseTarget(debt,apr,100n,99n),/Invalid/);
  assert.throws(()=>accruedCloseTarget(debt,10_000_001n,0n,1n),/Invalid/);
});

test('short sizing covers padded debt even at the user or stricter protocol slippage floor',async()=>{
  const target=accruedCloseTarget(1_000_000n,272000n,0n,3600n);
  const required=closeQuoteTarget(target,100,5000n);
  const input=await solveShortInput(target,required,async n=>n*2n);
  const quote=input*2n;
  assert.ok(quote*995000n/1000000n>=target);
  assert.equal(closeQuoteTarget(101n,0,5000n),101n);
  assert.throws(()=>closeQuoteTarget(target,1001,5000n),/Slippage/);
});

test('open floor increases after favorable movement and never weakens the reviewed floor',()=>{
  assert.equal(openExecutionFloor(990n,{minOut:1089n,expectedOut:1100n}),1089n);
  assert.equal(openExecutionFloor(990n,{minOut:985n,expectedOut:995n}),990n);
  assert.throws(()=>openExecutionFloor(990n,{minOut:980n,expectedOut:989n}),/reviewed minimum/);
});

test('next-ledger failure preserves the confirmed receipt and returned position id',()=>{
  const receipt={hash:'confirmed-hash',value:42n,ledger:123};
  const error=new ConfirmedStageError('begin_open_position_v3',receipt);
  assert.equal(error.receipt,receipt);
  assert.match(error.message,/Position #42/);
  assert.match(error.message,/confirmed-hash/);
  assert.match(new ConfirmedStageError('transfer_spot_to_margin',receipt).message,/free margin/);
});


test('debt storage schema rejects missing and malformed state instead of defaulting to zero',()=>{
  const snapshot={principal:90071992547409931n,interest_index:1_000_000_000_000_000_000n};
  const state=[123n,272000n,undefined,1_200_000_000_000_000_000n,snapshot];
  assert.equal(decodeDebtAccrualState(state).debt,snapshot.principal*12n/10n);
  assert.throws(()=>decodeDebtAccrualState([undefined,...state.slice(1)]),/unavailable/);
  assert.throws(()=>decodeDebtAccrualState([...state.slice(0,4),{...snapshot,interest_index:0n}]),/unavailable/);
  assert.throws(()=>decodeDebtAccrualState([123n,272000n,{},state[3],snapshot]),/unavailable/);
});


test('factory-valid curves above the core ceiling at full utilization still permit safe close quotes',()=>{
  // All components satisfy factory bounds. At 1% utilization APR is 110%,
  // while the unused full-utilization endpoint is 1100% (above the core 1000% cap).
  const base=1_000_000n,multiplier=10_000_000n,jump=10_000_000n,kink=800_000n;
  const modelMaximum=base+kink*multiplier/1_000_000n+(1_000_000n-kink)*jump/1_000_000n;
  const currentRate=base+10_000n*multiplier/1_000_000n;
  const debt=1_000_000_000_000n,elapsed=3600n;
  const target=accruedCloseTarget(debt,closeAccrualApr(modelMaximum,base),0n,elapsed);
  const onChainDebt=debt+debt*currentRate*elapsed/(1_000_000n*31_536_000n);
  assert.ok(target>bufferedDebt(onChainDebt));
  assert.equal(closeAccrualApr(modelMaximum,base),10_000_000n);
  assert.equal(closeAccrualApr(100n,200n),200n);
  assert.throws(()=>closeAccrualApr(-1n,0n),/Invalid/);
  assert.throws(()=>closeAccrualApr(100n,10_000_001n),/Invalid/);
});
