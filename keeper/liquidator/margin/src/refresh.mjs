/** Refresh only the factory-resolved group's boosted vaults, with serialized durable signing. */
async function refreshMarkets({ clients, status, dryRun, now = Date.now(), intervalMs }, method) {
  let hadFailure = false;
  for (const [market, client] of clients) {
    const previous = status[market];
    if (previous && now < previous.nextAttemptAt) continue;
    try {
      const result = await client.submit(method, []);
      status[market] = { lastRun: Date.now(), lastSuccess: dryRun ? null : Date.now(), dryRun, nextAttemptAt: now + intervalMs, failures: 0 };
    } catch (error) {
      const failures = (previous?.failures || 0) + 1;
      status[market] = { ...previous, lastRun: Date.now(), lastError: 'Refresh simulation or transaction failed', failures,
        nextAttemptAt: now + Math.min(intervalMs, 10000 * 2 ** Math.min(failures, 4)) };
      if (error.fatal) throw error;
      hadFailure = true;
    }
  }
  if (hadFailure) throw new Error('One or more boosted refreshes failed');
}

export const refreshBoostedMarkets = options => refreshMarkets(options, 'refresh_boosted_underlying');
export const refreshInterestMarkets = options => refreshMarkets(options, 'update_interest');
export function interestReady(markets, status, dryRun, now=Date.now()) {
  return markets.every(market=>{
    const job=status[market];
    return job && !job.failures && now-job.lastRun<=240000 && (dryRun ? job.dryRun===true : job.lastSuccess && now-job.lastSuccess<=240000);
  });
}
