import '../lib/bootstrap';
import { getOrCreateAccount, sleep } from '../lib/chain';
import { setOut, check, step } from '../lib/report';
import { loadState } from '../lib/flow';
import { getGroup, getMarketConfig } from '../../src/lib/peridot/factory';
import { readMarket, lend, addr } from '../../src/lib/peridot/group-client';
import { readContract, submitContract } from '../../src/lib/peridot/rpc';
/**
 * Hypothesis from mainnet dry run: on a DeFindex-routed market, borrow() fails closed ("boosted health cache stale", 5 min)
 * unless someone called the permissionless refresh_boosted_underlying() recently. The app never calls it.
 */
setOut('testnet-yield-borrow-stale');
const F = 'B-group/W(DeFindex) borrow staleness';
async function main() {
  const st = loadState(); const user = await getOrCreateAccount('user'); const u = user.publicKey(); const gid = st.W.id;
  const group = await getGroup(gid); const m = group.markets[0]; const cfg = await getMarketConfig(gid, m);
  let v = await readMarket(group, m, cfg, u);
  await step(F, 'supply 200 XLM (refreshes the health cache)', user, c => lend(group, v, 'Supply', '200', c.signer, c.progress));
  v = await readMarket(group, m, cfg, u);
  await step(F, 'borrow 5 XLM immediately after supply (cache fresh)', user, c => lend(group, v, 'Borrow', '5', c.signer, c.progress));
  console.log('waiting 330s so the 5-minute boosted health cache expires'); await sleep(330_000);
  v = await readMarket(group, m, cfg, u);
  await step(F, 'borrow 5 XLM after 5.5 minutes of inactivity -> expected to fail (stale cache)', user, c => lend(group, v, 'Borrow', '5', c.signer, c.progress), { expectFail: /.*/ });
  await step(F, 'permissionless refresh_boosted_underlying()', user, c => submitContract({ contractId: m, method: 'refresh_boosted_underlying', args: [], signer: c.signer, onProgress: c.progress }));
  v = await readMarket(group, m, cfg, u);
  await step(F, 'borrow 5 XLM right after the refresh -> should succeed', user, c => lend(group, v, 'Borrow', '5', c.signer, c.progress));
  v = await readMarket(group, m, cfg, u);
  await step(F, 'repay all', user, c => lend(group, v, 'Repay', '0', c.signer, c.progress, true));
  v = await readMarket(group, m, cfg, u);
  await step(F, 'withdraw all', user, c => lend(group, v, 'Withdraw', '0', c.signer, c.progress, true));
}
main().catch(e => { console.error('FATAL', e); process.exit(1); });
