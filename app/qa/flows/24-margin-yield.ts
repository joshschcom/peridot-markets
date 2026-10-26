import '../lib/bootstrap';
import { getOrCreateAccount, sleep } from '../lib/chain';
import { setOut, check, step } from '../lib/report';
import { loadState } from '../lib/flow';
import { getGroup, getMarketConfig } from '../../src/lib/peridot/factory';
import { readMarket, lend, type MarketView } from '../../src/lib/peridot/group-client';
import { marginContext, quoteOpen, openPosition, positions, closePosition, withdrawMargin } from '../../src/lib/peridot/margin';
import { submitContract } from '../../src/lib/peridot/rpc';
/** Margin open where the BORROWED asset's market is routed to DeFindex (this is mainnet group 1: XLM). */
setOut('testnet-margin-yield');
const F = 'D-margin/Z(DeFindex XLM)';
async function main() {
  const st = loadState(); const kp = await getOrCreateAccount('trader2'); const u = kp.publicKey(); const gid = st.Z.id;
  const group = await getGroup(gid);
  const load = async () => { const ms: MarketView[] = []; for (const m of group.markets) ms.push(await readMarket(group, m, await getMarketConfig(gid, m), u)); return { ms, by: Object.fromEntries(ms.map(m => [m.token.symbol, m])) as Record<string, MarketView> }; };
  let { ms, by } = await load();
  await step(F, 'supply 1000 XLM (routed to DeFindex)', kp, c => lend(group, by.XLM, 'Supply', '1000', c.signer, c.progress));
  console.log('waiting 330s so the boosted health cache is older than 5 minutes'); await sleep(330_000);
  ({ ms, by } = await load());
  const ctx = (await marginContext(group, ms))!;
  const shares = 1000_0000000n * 1000000n / by.XLM.exchangeRate / 10n;
  const quote = await quoteOpen(ctx, u, by.XLM, by.USDT, shares, 2, 'Long', 1000);
  const r1 = await step(F, 'openPosition with a STALE health cache (no refresh)', kp, c => openPosition(ctx, quote, c.signer, c.progress).then(id => ({ hash: '', value: id })));
  if (!r1.ok) {
    await step(F, 'permissionless refresh_boosted_underlying on the XLM market', kp, c => submitContract({ contractId: by.XLM.address, method: 'refresh_boosted_underlying', args: [], signer: c.signer, onProgress: c.progress }));
    ({ ms, by } = await load());
    const ctx2 = (await marginContext(group, ms))!;
    const q2 = await quoteOpen(ctx2, u, by.XLM, by.USDT, shares, 2, 'Long', 1000);
    const r2 = await step(F, 'openPosition immediately after refresh', kp, c => openPosition(ctx2, q2, c.signer, c.progress).then(id => ({ hash: '', value: id })));
    if (r2.ok) {
      const pos = (await positions(ctx2, u)).find(p => p.status === 'Open');
      if (pos) await step(F, 'closePosition (cache may be stale again: observe)', kp, c => closePosition(ctx2, pos, c.signer, 1000, c.progress).then(() => ({ hash: '' })));
    }
  } else {
    const pos = (await positions(ctx, u)).find(p => p.status === 'Open');
    await check(F, 'NOTE: open succeeded without refresh (transfer_spot_to_margin or begin_open refreshed the cache)', () => 'stale cache did not block margin open');
    if (pos) await step(F, 'closePosition', kp, c => closePosition(ctx, pos, c.signer, 1000, c.progress).then(() => ({ hash: '' })));
  }
  ({ ms, by } = await load()); const ctx3 = (await marginContext(group, ms))!;
  await step(F, 'withdrawMargin leftovers', kp, c => withdrawMargin(ctx3, by.XLM, c.signer, c.progress), { });
}
main().catch(e => { console.error('FATAL', e); process.exit(1); });
