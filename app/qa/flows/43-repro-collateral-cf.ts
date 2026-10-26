import '../lib/bootstrap';
import { xdr } from '@stellar/stellar-sdk';
import { getOrCreateAccount, sleep } from '../lib/chain';
import { setOut, check, step } from '../lib/report';
import { loadState, X } from '../lib/flow';
import { getGroup, getMarketConfig } from '../../src/lib/peridot/factory';
import * as C from '../../src/lib/peridot/control-client';
import { readContract, submitContract } from '../../src/lib/peridot/rpc';
import { addr, uint, unitEnum, readMarket, type MarketView } from '../../src/lib/peridot/group-client';
import { marginContext, positions, closePosition, resumeOpen, cancelOpen, withdrawMargin } from '../../src/lib/peridot/margin';
/** Does the chain let a Long (collateral = base asset, here USDT) open above the collateral factor limit after the owner lowers USDT's CF? */
setOut('testnet-repro-collateral-cf');
const now = () => Math.floor(Date.now() / 1000);
async function main() {
  const st = loadState(); const owner = await getOrCreateAccount('owner'); const user = await getOrCreateAccount('user'); const u = user.publicKey(); const G = st.X.id; const F = 'D-margin/repro-collateral-cf';
  let ctl = await C.loadControl(G); const usdt = ctl.markets.find(m => m.token.symbol === 'USDT')!;
  await step(F, 'owner: USDT CF -> 40% staged', owner, c => C.updateRisk(G, usdt.address, { ...usdt.config, collateral_factor: 400000n }, c.signer, c.progress));
  ctl = await C.loadControl(G); const p = ctl.pending.find(q => q.kind === 'risk')!; await sleep((p.executeAfter - now() + 6) * 1000);
  ctl = await C.loadControl(G);
  await step(F, 'owner: apply + sync_pairs', owner, c => C.applyPending(G, ctl.pending.find(q => q.kind === 'risk'), c.signer, c.progress));
  const group = await getGroup(G); const markets: MarketView[] = [];
  for (const m of group.markets) markets.push(await readMarket(group, m, await getMarketConfig(G, m), u));
  const ctx = (await marginContext(group, markets))!; const by = Object.fromEntries(markets.map(m => [m.token.symbol, m])) as Record<string, MarketView>;
  await check(F, 'app view: effective leverage for Long with USDT collateral', () => `limits=${JSON.stringify(ctx.limits)}`);
  const shares = 500000000n; // 50 XLM
  const free = await readContract<bigint>(ctx.info.controller, 'get_margin_balance_ptokens', [addr(u), addr(by.XLM.token.address)]);
  if (free < shares) await step(F, 'raw transfer_spot_to_margin 50 XLM shares', user, c => submitContract({ contractId: ctx.info.controller, method: 'transfer_spot_to_margin', args: [addr(u), addr(by.XLM.token.address), uint(shares - free)], signer: c.signer, onProgress: c.progress }));
  const toks = [X.xlm, X.usdt_mock];
  const est = await readContract<bigint>(X.xlm_usdt_pool, 'estimate_swap', [uint(0, 'u32'), uint(1, 'u32'), uint(shares * 3n * by.XLM.exchangeRate / 1000000n)]);
  const minOut = est * 95n / 100n;
  const open = await step(F, 'raw begin_open_position_v3 3x Long (collateral USDT at CF 40%) bypassing the app quote guard', user, c => submitContract({ contractId: ctx.info.controller, method: 'begin_open_position_v3', args: [addr(u), addr(X.xlm), addr(X.usdt_mock), uint(shares), uint(3n), unitEnum('Long'), xdr.ScVal.scvVec(toks.map(addr)), xdr.ScVal.scvBytes(Buffer.from(X.xlm_usdt_pool_id, 'hex')), addr(X.xlm_usdt_pool), uint(minOut)], signer: c.signer, onProgress: c.progress }));
  if (open.ok) {
    const id = (open.value as any).value as bigint;
    await step(F, 'raw swap_open_position_v3', user, c => submitContract({ contractId: ctx.info.controller, method: 'swap_open_position_v3', args: [addr(u), uint(id, 'u64')], signer: c.signer, onProgress: c.progress }));
    const act = await step(F, 'raw activate_open_position_v3 (does the chain reject an under-collateralised long?)', user, c => submitContract({ contractId: ctx.info.controller, method: 'activate_open_position_v3', args: [addr(u), uint(id, 'u64')], signer: c.signer, onProgress: c.progress }));
    const pos = await positions(ctx, u);
    await check(F, 'position state after activation', () => JSON.stringify(pos.filter(x => x.id === id).map(x => ({ status: x.status, health: String(x.health), debt: String(x.debt), coll: String(x.collateralUnderlying) }))));
    const cur = pos.find(x => x.id === id && x.status === 'Open');
    if (cur) await step(F, 'cleanup: close via app', user, c => closePosition(ctx, cur, c.signer, 1000, c.progress).then(() => ({ hash: '' })));
    else { const pend = pos.find(x => x.id === id && x.status === 'PendingOpen'); if (pend) await step(F, 'cleanup: resume', user, c => resumeOpen(ctx, id, c.signer, c.progress).then(() => ({ hash: '' }))); }
  }
  const fr = await readContract<bigint>(ctx.info.controller, 'get_margin_balance_ptokens', [addr(u), addr(by.XLM.token.address)]);
  if (fr > 0n) await step(F, 'cleanup: return free margin', user, c => withdrawMargin(ctx, by.XLM, c.signer, c.progress));
  ctl = await C.loadControl(G);
  await step(F, 'owner: restore USDT CF 75% (staged)', owner, c => C.updateRisk(G, usdt.address, { ...ctl.markets.find(m => m.token.symbol === 'USDT')!.config, collateral_factor: 750000n }, c.signer, c.progress));
  ctl = await C.loadControl(G); const p2 = ctl.pending.find(q => q.kind === 'risk')!; await sleep((p2.executeAfter - now() + 6) * 1000);
  ctl = await C.loadControl(G);
  await step(F, 'owner: apply restore', owner, c => C.applyPending(G, ctl.pending.find(q => q.kind === 'risk'), c.signer, c.progress));
}
main().catch(e => { console.error('FATAL', e); process.exit(1); });
