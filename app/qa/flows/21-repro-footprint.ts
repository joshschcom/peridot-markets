import '../lib/bootstrap';
import { getOrCreateAccount } from '../lib/chain';
import { setOut, step } from '../lib/report';
import { loadState } from '../lib/flow';
import { getGroup, getMarketConfig } from '../../src/lib/peridot/factory';
import { readMarket, lend, claimRewards } from '../../src/lib/peridot/group-client';
/**
 * Reproduction: right after a confirmed transaction that touched a reward-bearing market,
 * the next simulation (same ledger close time) records the reward SupplyIndex entry read-only,
 * but execution one ledger later writes it -> "storage exceeded_limit ... outside of the footprint", tx FAILS on chain.
 */
setOut('testnet-repro-footprint');
async function main() {
  const st = loadState(); const user = await getOrCreateAccount('user');
  const F = 'B-group/repro-footprint';
  const gid = st.X.id; const group = await getGroup(gid);
  const m = group.markets[0]; const cfg = await getMarketConfig(gid, m);
  for (let i = 0; i < 6; i++) {
    const v = await readMarket(group, m, cfg, user.publicKey());
    await step(F, `rapid supply #${i + 1} (reward group, no wait between txs)`, user, c => lend(group, v, 'Supply', '1', c.signer, c.progress));
  }
  // control: group without rewards
  const gy = await getGroup(st.Y.id); const my = gy.markets[0]; const cy = await getMarketConfig(st.Y.id, my);
  for (let i = 0; i < 4; i++) {
    const v = await readMarket(gy, my, cy, user.publicKey());
    await step(F, `control rapid supply #${i + 1} (group without rewards)`, user, c => lend(gy, v, 'Supply', '1', c.signer, c.progress));
  }
}
main().catch(e => { console.error('FATAL', e); process.exit(1); });
