import '../lib/bootstrap';
import { getOrCreateAccount, sleep, invokeRead } from '../lib/chain';
import { setOut, check, step } from '../lib/report';
import { loadState, X } from '../lib/flow';
import { getGroup, getMarketConfig } from '../../src/lib/peridot/factory';
import * as C from '../../src/lib/peridot/control-client';
import { readContract } from '../../src/lib/peridot/rpc';
import { getDeployments } from '../../src/lib/peridot/network';
import { addr, uint } from '../../src/lib/peridot/group-client';

setOut('testnet-control-margin');
const now = () => Math.floor(Date.now() / 1000);
const big = (_k: string, v: unknown) => typeof v === 'bigint' ? v.toString() : v;
async function waitUntil(ts: number) { const w = ts - now() + 6; if (w > 0) { console.log(`   waiting ${w}s`); await sleep(w * 1000); } }
async function main() {
  const st = loadState(); const owner = await getOrCreateAccount('owner'); const o = owner.publicKey(); const G = st.X.id; const F = 'C-control/X(margin)';
  let ctl = await C.loadControl(G);
  const usdt = ctl.markets.find(m => m.token.symbol === 'USDT')!;
  await check(F, 'loadControl margin section', () => `margin enabled_markets=${ctl.margin?.enabled_markets.length} incentive_applied=${ctl.margin?.incentive_applied} pools=${ctl.margin?.pools?.length}`);
  const pairsCap = async () => { const m = await readContract<any>(ctl.margin!.controller, 'get_perps_pair_config', [addr(ctl.markets[0].token.address), addr(usdt.token.address), (await import('../../src/lib/peridot/group-client')).unitEnum('Long')]); return m ? Number(m.max_leverage) : null; };
  const before = await pairsCap();
  // CF 75 -> 50 on USDT (the pair limit is min(group max, 1/(1-CF)) of the COLLATERAL (base) market): 75% => 3x (cap 3), 50% => 2x
  await step(F, 'update_risk USDT CF 75% -> 50% (staged)', owner, c => C.updateRisk(G, usdt.address, { ...usdt.config, collateral_factor: 500000n }, c.signer, c.progress));
  ctl = await C.loadControl(G); const p = ctl.pending.find(x => x.kind === 'risk' && x.market === usdt.address);
  if (p) await waitUntil(p.executeAfter);
  ctl = await C.loadControl(G);
  const stageProgress: string[] = [];
  await step(F, 'applyPending (apply_pending then separate sync_pairs, as the UI does)', owner, c => C.applyPending(G, ctl.pending.find(x => x.kind === 'risk'), c.signer, pr => { stageProgress.push(pr.status); c.progress(pr); }));
  await check(F, 'assert pair-sync state cleared and group CF applied', async () => { const l = await C.loadControl(G); const m = l.markets.find(x => x.token.symbol === 'USDT')!; if (m.config.collateral_factor !== 500000n) throw new Error('CF ' + m.config.collateral_factor); if (l.pairSync) throw new Error('pairSync left: ' + JSON.stringify(l.pairSync)); return `CF ${m.config.collateral_factor}; pair max_leverage before=${before} after=${await pairsCap()}`; });
  await check(F, 'effective_max_leverage on factory reflects new CF', async () => { const v = await readContract<bigint>(getDeployments().margin_factory, 'effective_max_leverage', [uint(G, 'u32'), addr(usdt.address)]); return `effective(USDT market)=${v}`; });
  // restore CF
  ctl = await C.loadControl(G);
  await step(F, 'update_risk USDT CF 50% -> 75% (restore, staged)', owner, c => C.updateRisk(G, usdt.address, { ...ctl.markets.find(x => x.token.symbol === 'USDT')!.config, collateral_factor: 750000n }, c.signer, c.progress));
  ctl = await C.loadControl(G); const p2 = ctl.pending.find(x => x.kind === 'risk'); if (p2) await waitUntil(p2.executeAfter);
  await step(F, 'applyPending restore', owner, c => C.applyPending(G, p2, c.signer, c.progress));
  // margin group settings
  ctl = await C.loadControl(G); const cfg = ctl.margin!.cfg;
  await step(F, 'updateMargin: staged incentive 108% -> 105%', owner, c => C.updateMargin(G, { ...cfg, liquidation_incentive: 1050000n }, c.signer, c.progress));
  ctl = await C.loadControl(G); const mp = ctl.pending.find(x => x.kind === 'margin');
  await check(F, 'pending margin incentive visible', () => { if (!mp) throw new Error('none: ' + JSON.stringify(ctl.margin, big)); return `eta in ${mp.executeAfter - now()}s`; });
  await step(F, 'apply margin incentive before delay -> refused', owner, c => C.applyPending(G, mp, c.signer, c.progress), { expectFail: /60-second|did not|unchanged|already|delay/i });
  if (mp) await waitUntil(mp.executeAfter);
  ctl = await C.loadControl(G);
  await step(F, 'apply margin incentive after delay', owner, c => C.applyPending(G, ctl.pending.find(x => x.kind === 'margin'), c.signer, c.progress));
  await check(F, 'assert incentive applied = 105%', async () => { const l = await C.loadControl(G); if (!l.margin?.incentive_applied || l.margin.applied_liquidation_incentive !== 1050000n) throw new Error(JSON.stringify(l.margin, big)); });
  await step(F, 'updateMargin: restore 108%', owner, c => C.updateMargin(G, { ...cfg, liquidation_incentive: 1080000n }, c.signer, c.progress));
  ctl = await C.loadControl(G); const mp2 = ctl.pending.find(x => x.kind === 'margin'); if (mp2) { await waitUntil(mp2.executeAfter); await step(F, 'apply restore', owner, c => C.applyPending(G, mp2, c.signer, c.progress)); }
  await step(F, 'updateMargin: leverage 7x -> client guardrail', owner, c => C.updateMargin(G, { ...cfg, max_leverage: 7n }, c.signer, c.progress), { expectFail: /between 1x and 5x/ });
  await step(F, 'updateMargin: incentive 120% -> client guardrail', owner, c => C.updateMargin(G, { ...cfg, liquidation_incentive: 1200000n }, c.signer, c.progress), { expectFail: /between 102% and 110%/ });
  await step(F, 'set_market_margin USDT off', owner, c => C.setMarketMargin(G, usdt.address, false, c.signer, c.progress));
  await step(F, 'set_market_margin USDT on', owner, c => C.setMarketMargin(G, usdt.address, true, c.signer, c.progress));
  await step(F, 'set_pool_allowed(false) -> app refuses (admin only)', owner, c => C.setPoolAllowed(G, X.xlm_usdt_pool, false, c.signer, c.progress), { expectFail: /Only Peridot admin/ });
  await step(F, 'syncLeverageLimits manual', owner, c => C.syncLeverageLimits(G, c.signer, c.progress));
  const invalid = (await getOrCreateAccount('user')).publicKey();
  await step(F, 'transfer_ownership to a valid G address -> app declines (needs 2 signatures)', owner, c => C.transferOwnership(G, invalid, c.signer, c.progress), { expectFail: /both owners/ });
}
main().catch(e => { console.error('FATAL', e); process.exit(1); });
