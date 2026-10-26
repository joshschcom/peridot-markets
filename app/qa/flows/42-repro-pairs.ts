import '../lib/bootstrap';
import { getOrCreateAccount, sleep } from '../lib/chain';
import { setOut, check, step } from '../lib/report';
import { loadState } from '../lib/flow';
import * as C from '../../src/lib/peridot/control-client';
import { readContract } from '../../src/lib/peridot/rpc';
import { getDeployments } from '../../src/lib/peridot/network';
import { addr, uint, unitEnum } from '../../src/lib/peridot/group-client';
setOut('testnet-repro-pairs');
const big = (_k: string, v: unknown) => typeof v === 'bigint' ? v.toString() : v;
const now = () => Math.floor(Date.now() / 1000);
async function main() {
  const st = loadState(); const owner = await getOrCreateAccount('owner'); const G = st.X.id; const F = 'C-control/repro-pair-limits';
  let ctl = await C.loadControl(G); const x = ctl.markets.find(m => m.token.symbol === 'XLM')!, u = ctl.markets.find(m => m.token.symbol === 'USDT')!;
  const dump = async (label: string) => {
    const out: any = {};
    for (const [a, b] of [[x, u], [u, x]] as const) for (const side of ['Long', 'Short']) {
      const pc = await readContract<any>(ctl.margin!.controller, 'get_perps_pair_config', [addr(a.token.address), addr(b.token.address), unitEnum(side)]);
      out[`${a.token.symbol}/${b.token.symbol}/${side}`] = pc ? Number(pc.max_leverage) : null;
    }
    out.effective_XLM = Number(await readContract<bigint>(getDeployments().margin_factory, 'effective_max_leverage', [uint(G, 'u32'), addr(x.address)]));
    out.effective_USDT = Number(await readContract<bigint>(getDeployments().margin_factory, 'effective_max_leverage', [uint(G, 'u32'), addr(u.address)]));
    return `${label}: ${JSON.stringify(out)}`;
  };
  await check(F, 'pair limits at CF(USDT)=75% / CF(XLM)=70%', () => dump('start'));
  await step(F, 'update_risk USDT CF -> 40% (staged)', owner, c => C.updateRisk(G, u.address, { ...u.config, collateral_factor: 400000n }, c.signer, c.progress));
  ctl = await C.loadControl(G); const p = ctl.pending.find(q => q.kind === 'risk' && q.market === u.address)!; await sleep((p.executeAfter - now() + 6) * 1000);
  ctl = await C.loadControl(G);
  await step(F, 'applyPending (+sync_pairs)', owner, c => C.applyPending(G, ctl.pending.find(q => q.kind === 'risk'), c.signer, c.progress));
  await check(F, 'pair limits after apply + sync (expect USDT-collateral pair <= 1x/2x)', () => dump('after CF 40%'));
  await step(F, 'syncLeverageLimits again', owner, c => C.syncLeverageLimits(G, c.signer, c.progress));
  await check(F, 'pair limits after second sync', () => dump('after 2nd sync'));
  // restore
  ctl = await C.loadControl(G);
  await step(F, 'restore CF 75% (staged)', owner, c => C.updateRisk(G, u.address, { ...ctl.markets.find(m => m.token.symbol === 'USDT')!.config, collateral_factor: 750000n }, c.signer, c.progress));
  ctl = await C.loadControl(G); const p2 = ctl.pending.find(q => q.kind === 'risk')!; await sleep((p2.executeAfter - now() + 6) * 1000);
  ctl = await C.loadControl(G);
  await step(F, 'apply restore', owner, c => C.applyPending(G, ctl.pending.find(q => q.kind === 'risk'), c.signer, c.progress));
  await check(F, 'pair limits after restore', () => dump('restored'));
}
main().catch(e => { console.error('FATAL', e); process.exit(1); });
