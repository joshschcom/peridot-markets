import '../lib/bootstrap';
import { getOrCreateAccount, invokeRead, addrV } from '../lib/chain';
import { setOut, check, step } from '../lib/report';
import { loadState } from '../lib/flow';
import { getGroup, getMarketConfig } from '../../src/lib/peridot/factory';
import { readMarket, lend } from '../../src/lib/peridot/group-client';
setOut('testnet-yield');
async function main() {
  const st = loadState(); const user = await getOrCreateAccount('user'); const u = user.publicKey(); const gid = st.W.id; const F = 'B-group/W(DeFindex)';
  const group = await getGroup(gid); const m = group.markets[0]; const cfg = await getMarketConfig(gid, m);
  let v = await readMarket(group, m, cfg, u);
  await check(F, 'market view shows DeFindex vault state', () => `route=${cfg.yield_route.tag} vault=${v.vault ? JSON.stringify({ kind: v.vault.kind, shares: String(v.vault.total_shares), value: String(v.vault.total_value) }) : 'null'} vaultError=${v.vaultError ?? ''} priceError=${v.priceError ?? ''}`);
  await step(F, 'enter_market', user, c => lend(group, v, 'Enable collateral', '0', c.signer, c.progress));
  v = await readMarket(group, m, cfg, u);
  await step(F, 'supply 200 XLM (80% should route to DeFindex)', user, c => lend(group, v, 'Supply', '200', c.signer, c.progress));
  v = await readMarket(group, m, cfg, u);
  await check(F, 'assert market views after supply (vault holds shares, wallet decreased)', () => `liquidity=${v.liquidity} supplied=${v.supplied} vault=${v.vault ? String(v.vault.total_value) : 'null'} err=${v.vaultError ?? ''}`);
  await step(F, 'withdraw 50 XLM', user, c => lend(group, v, 'Withdraw', '50', c.signer, c.progress));
  v = await readMarket(group, m, cfg, u);
  await step(F, 'withdraw all', user, c => lend(group, v, 'Withdraw', '0', c.signer, c.progress, true));
  v = await readMarket(group, m, cfg, u);
  await check(F, 'assert shares zero', () => { if (v.receiptBalance !== 0n) throw new Error('shares ' + v.receiptBalance); });
}
main().catch(e => { console.error('FATAL', e); process.exit(1); });
