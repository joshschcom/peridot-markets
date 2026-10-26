import '../lib/bootstrap';
import { getOrCreateAccount, invokeRead, addrV, sleep } from '../lib/chain';
import { setOut, check, step } from '../lib/report';
import { loadState, X } from '../lib/flow';
import { getGroup, getMarketConfig } from '../../src/lib/peridot/factory';
import { readMarket, lend, addr, uint, type MarketView } from '../../src/lib/peridot/group-client';
import { marginContext, quoteOpen, openPosition, resumeOpen, cancelOpen, closePosition, positions, withdrawMargin, type MarginContext, type Position } from '../../src/lib/peridot/margin';
import { readContract } from '../../src/lib/peridot/rpc';
import { network } from '../../src/lib/peridot/network';
import { keypairSigner } from '../lib/signer';

setOut('testnet-margin');
const F = 'D-margin/X';
const which = process.argv[2] || 'all';
async function ctxFor(gid: number, who: string) {
  const group = await getGroup(gid);
  const markets: MarketView[] = [];
  for (const m of group.markets) markets.push(await readMarket(group, m, await getMarketConfig(gid, m), who));
  const ctx = (await marginContext(group, markets))!;
  return { group, markets, ctx, by: Object.fromEntries(markets.map(m => [m.token.symbol, m])) as Record<string, MarketView> };
}
/** Throws on the N-th sign request: simulates the user closing the wallet popup mid-sequence. */
function failingSigner(kp: any, failAt: number, passphrase: string) {
  let n = 0; const real = keypairSigner(kp, passphrase);
  return { address: real.address, signTransaction: async (x: string) => { n++; if (n === failAt) throw new Error(`User closed wallet popup at signature ${n}`); return real.signTransaction(x); } };
}
async function main() {
  const st = loadState(); const user = await getOrCreateAccount('user'); const u = user.publicKey(); const gid = st.X.id;
  let { group, ctx, by, markets } = await ctxFor(gid, u);
  await check(F, 'marginContext: status, effective leverage per market', () => `enabled=${ctx.info.enabled_markets.length} limits=${JSON.stringify(ctx.limits)} maxLev=${ctx.info.cfg.max_leverage} slippage=${ctx.info.cfg.max_slippage}`);
  const marginAsset = by.XLM, baseAsset = by.USDT;
  await check(F, 'pair config exists for (XLM,USDT,Long) after launch (sync_pairs/set_market_margin)', async () => {
    const pair = await readContract<any>(ctx.info.controller, 'get_perps_pair_config', [addr(marginAsset.token.address), addr(baseAsset.token.address), (await import('../../src/lib/peridot/group-client')).unitEnum('Long')]);
    const ex = await readContract<any>(ctx.info.controller, 'get_perps_pair_execution_config', [addr(marginAsset.token.address), addr(baseAsset.token.address), (await import('../../src/lib/peridot/group-client')).unitEnum('Long')]);
    if (!pair || !ex) throw new Error(`pair=${JSON.stringify(pair, (k, v) => typeof v === 'bigint' ? v.toString() : v)} exec=${JSON.stringify(ex, (k, v) => typeof v === 'bigint' ? v.toString() : v)}`);
    return `pair max_leverage=${pair.max_leverage} open_slip=${ex.open_slippage_scaled} close_slip=${ex.close_slippage_scaled} max_open_dev=${ex.max_open_deviation_scaled}`;
  });
  const sharesFor = (xlm: string) => BigInt(Math.round(Number(xlm) * 1e7)) * 1000000n / marginAsset.exchangeRate;
  // ---- negative quotes the UI promises to refuse
  await step(F, 'quote: leverage 1x refused', user, async () => quoteOpen(ctx, u, marginAsset, baseAsset, sharesFor('100'), 1, 'Long', 100), { expectFail: /Leverage must be an integer between 2/ });
  await step(F, 'quote: leverage 9x refused', user, async () => quoteOpen(ctx, u, marginAsset, baseAsset, sharesFor('100'), 9, 'Long', 100), { expectFail: /Leverage must be an integer between 2/ });
  await step(F, 'quote: same asset refused', user, async () => quoteOpen(ctx, u, marginAsset, marginAsset, sharesFor('100'), 2, 'Long', 100), { expectFail: /two different assets/ });
  await step(F, 'quote: margin larger than supplied balance refused', user, async () => quoteOpen(ctx, u, marginAsset, baseAsset, sharesFor('900000'), 2, 'Long', 100), { expectFail: /Supply more margin/ });
  // ---- quote for real
  const q = await step(F, 'quoteOpen 100 XLM 2x long USDT, slippage 10%', user, async () => quoteOpen(ctx, u, marginAsset, baseAsset, sharesFor('100'), 2, 'Long', 1000));
  if (q.ok) await check(F, 'quote contents', () => { const x = q.value!; return `route=${x.route.pool} expectedOut=${x.expectedOut} minOut=${x.minOut} feeShares=${x.feeShares} total=${x.totalShares} free=${x.freeMargin} maxLev=${x.maxLeverage} closeFeeBps=${x.closeFeeBps}`; });
  if (!q.ok) { console.log('cannot continue margin'); return; }
  const quote = q.value!;
  const pre = { shares: marginAsset.receiptBalance };
  // ---- M1: full open
  const open = await step(F, 'openPosition (fee quote, transfer, begin_open, swap, activate)', user, c => openPosition(ctx, quote, c.signer, c.progress).then(id => ({ hash: '', value: id })));
  let pos: Position[] = [];
  if (open.ok) {
    pos = await positions(ctx, u);
    await check(F, 'assert position Open with debt>0, collateral>0, perps set', () => { const p = pos.find(x => x.id === (open.value as any).value); if (!p) throw new Error('position missing: ' + JSON.stringify(pos.map(x => x.status))); if (p.status !== 'Open' || p.debt <= 0n || p.collateralUnderlying <= 0n || !p.perps) throw new Error(`state ${p.status} debt ${p.debt} coll ${p.collateralUnderlying}`); return `#${p.id} ${p.side} health=${p.health} debt=${p.debt} collateral=${p.collateralUnderlying} liqPrice=${p.liquidationPrice}`; });
  }
  // ---- M1 close
  const pOpen = pos.find(p => p.status === 'Open');
  if (pOpen) {
    const cl = await step(F, 'closePosition (prepare, swap, finish)', user, c => closePosition(ctx, pOpen, c.signer, 1000, c.progress).then(() => ({ hash: '' })));
    pos = await positions(ctx, u);
    await check(F, 'assert position gone after close', () => { if (pos.some(p => p.id === pOpen.id)) throw new Error('still listed: ' + JSON.stringify(pos.filter(p => p.id === pOpen.id).map(p => p.status))); });
    const free = await readContract<bigint>(ctx.info.controller, 'get_margin_balance_ptokens', [addr(u), addr(marginAsset.token.address)]);
    await check(F, 'free margin remaining after close (returned to margin account)', () => `free margin ptokens XLM=${free}`);
    if (free > 0n) await step(F, 'withdrawMargin: return free margin to supply', user, c => withdrawMargin(ctx, marginAsset, c.signer, c.progress));
  }
  // ---- M2: interrupted open, then resume (pending-open recovery)
  ({ ctx, by } = await ctxFor(gid, u));
  const q2 = await quoteOpen(ctx, u, by.XLM, by.USDT, sharesFor('50'), 2, 'Long', 1000);
  const i2 = await step(F, 'interrupted open: wallet popup closed at signature 3 (swap) -> leaves pending open', user, c => openPosition(ctx, q2, failingSigner(user, 3, network.passphrase) as any, c.progress), { expectFail: /User closed wallet popup/ });
  pos = await positions(ctx, u);
  const pend = pos.find(p => p.status === 'PendingOpen');
  await check(F, 'assert a PendingOpen position exists after interruption', () => { if (!pend) throw new Error('no pending open: ' + JSON.stringify(pos.map(p => p.status))); return `#${pend.id} expires_at=${pend.pendingOpen?.expires_at} (now ${Math.floor(Date.now() / 1000)}) ttl=${Number(pend.pendingOpen?.expires_at) - Math.floor(Date.now() / 1000)}s`; });
  if (pend) {
    await step(F, 'second open while a pending open exists is refused', user, c => openPosition(ctx, q2, c.signer, c.progress), { expectFail: /Resume or cancel the existing pending open/ });
    await step(F, 'resumeOpen (swap + activate)', user, c => resumeOpen(ctx, pend.id, c.signer, c.progress).then(() => ({ hash: '' })));
    pos = await positions(ctx, u);
    await check(F, 'assert resumed position is Open', () => { const p = pos.find(x => x.id === pend.id); if (!p || p.status !== 'Open') throw new Error('status ' + p?.status); return `health ${p.health}`; });
    const p2 = pos.find(x => x.id === pend.id)!;
    await step(F, 'close resumed position', user, c => closePosition(ctx, p2, c.signer, 1000, c.progress).then(() => ({ hash: '' })));
  }
  // ---- M3: interrupted open then cancel
  ({ ctx, by } = await ctxFor(gid, u));
  const q3 = await quoteOpen(ctx, u, by.XLM, by.USDT, sharesFor('50'), 2, 'Long', 1000);
  await step(F, 'interrupted open #2 (signature 3)', user, c => openPosition(ctx, q3, failingSigner(user, 3, network.passphrase) as any, c.progress), { expectFail: /User closed wallet popup/ });
  pos = await positions(ctx, u);
  const pend3 = pos.find(p => p.status === 'PendingOpen');
  if (pend3) {
    await step(F, 'cancelOpen recovers margin', user, c => cancelOpen(ctx, pend3.id, c.signer, c.progress));
    pos = await positions(ctx, u);
    await check(F, 'assert pending open gone after cancel', () => { if (pos.some(p => p.id === pend3.id && p.status === 'PendingOpen')) throw new Error('still pending'); });
    const free = await readContract<bigint>(ctx.info.controller, 'get_margin_balance_ptokens', [addr(u), addr(by.XLM.token.address)]);
    if (free > 0n) await step(F, 'withdrawMargin after cancel', user, c => withdrawMargin(ctx, by.XLM, c.signer, c.progress));
  } else await check(F, 'interrupted open #2 produced pending open', () => { throw new Error('no pending'); });
  // ---- M4: interrupted AFTER transfer only (signature 2): free margin stranded, "Return margin" recovery
  ({ ctx, by } = await ctxFor(gid, u));
  const q4 = await quoteOpen(ctx, u, by.XLM, by.USDT, sharesFor('50'), 2, 'Long', 1000);
  await step(F, 'interrupted open #3 (signature 2: after transfer_spot_to_margin, before begin_open)', user, c => openPosition(ctx, q4, failingSigner(user, 2, network.passphrase) as any, c.progress), { expectFail: /User closed wallet popup/ });
  const free4 = await readContract<bigint>(ctx.info.controller, 'get_margin_balance_ptokens', [addr(u), addr(by.XLM.token.address)]);
  await check(F, 'assert funds are stranded as free margin after transfer-only interruption', () => { if (free4 <= 0n) throw new Error('no free margin'); return `free margin ptokens=${free4}`; });
  if (free4 > 0n) await step(F, 'withdrawMargin returns stranded margin to supply', user, c => withdrawMargin(ctx, by.XLM, c.signer, c.progress));
  console.log('margin flows done');
}
main().catch(e => { console.error('FATAL', e); process.exit(1); });
