import { requireSafe } from './safety.mjs';

const DAY_MS=86_400_000n;
const ceilDiv=(n,d)=>(n+d-1n)/d;

/** Padded simulation fees are journal reservations, not expected refunded costs. */
export function scheduledBudget(jobs, config) {
  let daily=0n, absoluteMinimum=0n, transactions=0n, maxJobFee=0n;
  for (const job of jobs) {
    requireSafe(Number.isSafeInteger(job.intervalMs)&&job.intervalMs>0, 'Invalid scheduled job interval');
    requireSafe(typeof job.fee==='bigint'&&job.fee>=10100n, 'Invalid scheduled job fee estimate');
    // Include the immediate startup run in addition to a full day's schedule.
    const count=ceilDiv(DAY_MS,BigInt(job.intervalMs))+1n;
    transactions+=count;daily+=count*job.fee;absoluteMinimum+=count*10100n;
    if(job.fee>maxJobFee)maxJobFee=job.fee;
  }
  // Separate explicit planning headroom for fee variation plus one maximum-fee operation.
  const required=ceilDiv(daily*125n,100n)+config.maxTransactionFeeStroops;
  return {jobCount:jobs.length,scheduledTransactions:transactions.toString(),
    absoluteMinimumStroops:absoluteMinimum.toString(),estimatedRefreshStroops:daily.toString(),
    requiredWithHeadroomStroops:required.toString(),maxJobFeeStroops:maxJobFee.toString(),
    configured24hStroops:config.maxFee24hStroops.toString(),
    sufficient:config.maxFee24hStroops>=required&&config.maxTransactionFeeStroops>=maxJobFee,
    basis:'unsigned startup simulations, padded reservations, 25% planning headroom plus one max-fee operation'};
}

export function assertSustainableBudget(budget, dryRun) {
  if(dryRun)return;
  requireSafe(budget.sufficient, `Configured fee limits cannot sustain scheduled refreshes; review requiredWithHeadroomStroops=${budget.requiredWithHeadroomStroops} and maxJobFeeStroops=${budget.maxJobFeeStroops}. No budget was changed.`);
}

export async function estimateRefreshBudget({refreshClients,interestClients,settings,config}) {
  const jobs=[];
  for(const client of refreshClients.values())jobs.push({fee:await client.estimateFee('refresh_boosted_underlying'),intervalMs:settings.refreshIntervalMs});
  for(const client of interestClients.values())jobs.push({fee:await client.estimateFee('update_interest'),intervalMs:settings.interestIntervalMs});
  return scheduledBudget(jobs,config);
}
