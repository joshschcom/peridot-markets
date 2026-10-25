import test from 'node:test';
import assert from 'node:assert/strict';
import {scheduledBudget,assertSustainableBudget,estimateRefreshBudget} from '../src/budget.mjs';

const config={maxFee24hStroops:10_000_000n,maxTransactionFeeStroops:1_000_000n};
test('three 120s refresh jobs cannot fit the default 1 XLM daily budget even at minimum fees',()=>{
 const budget=scheduledBudget(Array.from({length:3},()=>({intervalMs:120000,fee:10100n})),config);
 assert.equal(budget.scheduledTransactions,'2163');assert.equal(budget.absoluteMinimumStroops,'21846300');
 assert.equal(budget.sufficient,false);
 assert.throws(()=>assertSustainableBudget(budget,false),/cannot sustain/);
 assert.doesNotThrow(()=>assertSustainableBudget(budget,true));
 assert.equal(config.maxFee24hStroops,10_000_000n,'validation must never raise the spending limit');
});
test('budget uses each unsigned job quote and cadence, plus explicit planning headroom',async()=>{
 const calls=[];
 const budget=await estimateRefreshBudget({refreshClients:new Map([['a',{estimateFee:async method=>{calls.push(method);return 26000n;}}]]),
 interestClients:new Map([['b',{estimateFee:async method=>{calls.push(method);return 31000n;}}]]),
 settings:{refreshIntervalMs:120000,interestIntervalMs:180000},config:{...config,maxFee24hStroops:100_000_000n}});
 assert.deepEqual(calls,['refresh_boosted_underlying','update_interest']);
 assert.equal(budget.estimatedRefreshStroops,String(721n*26000n+481n*31000n));
 assert.equal(budget.requiredWithHeadroomStroops,String(((721n*26000n+481n*31000n)*125n+99n)/100n+1000000n));
 assert.doesNotThrow(()=>assertSustainableBudget(budget,false));
 const tooLarge=scheduledBudget([{intervalMs:120000,fee:1000001n}],{...config,maxFee24hStroops:10_000_000_000n});
 assert.equal(tooLarge.sufficient,false,'a single job must also fit the transaction cap');
});
