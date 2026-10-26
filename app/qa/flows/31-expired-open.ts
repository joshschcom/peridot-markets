import '../lib/bootstrap';
import { getOrCreateAccount, addrV, i128, setupInvoke, sleep } from '../lib/chain';
import { setOut, check, step } from '../lib/report';
import { loadState, X } from '../lib/flow';
import { getGroup, getMarketConfig } from '../../src/lib/peridot/factory';
import { readMarket, lend, type MarketView } from '../../src/lib/peridot/group-client';
import { marginContext, quoteOpen, openPosition, resumeOpen, cancelOpen, positions, withdrawMargin } from '../../src/lib/peridot/margin';
import { network } from '../../src/lib/peridot/network';
import { keypairSigner } from '../lib/signer';
import { getRpc } from '../../src/lib/peridot/rpc';
/** E: expired pending open. Pending open TTL is 30 min: open, interrupt before the swap, wait past expires_at, then resume/cancel. */
setOut('testnet-expired-open');
const F = 'E-edge/expired-pending-open';
async function main() {
  const st = loadState(); const gid = st.X.id; const kp = await getOrCreateAccount('trader2'); const u = kp.publicKey();
  const group = await getGroup(gid);
  const load = async () => { const ms: MarketView[] = []; for (const m of group.markets) ms.push(await readMarket(group, m, await getMarketConfig(gid, m), u)); return ms; };
  let ms = await load(); let by = Object.fromEntries(ms.map(m => [m.token.symbol, m])) as Record<string, MarketView>;
  await step(F, 'enter_market XLM', kp, c => lend(group, by.XLM, 'Enable collateral', '0', c.signer, c.progress));
  ms = await load(); by = Object.fromEntries(ms.map(m => [m.token.symbol, m]));
  await step(F, 'supply 300 XLM', kp, c => lend(group, by.XLM, 'Supply', '300', c.signer, c.progress));
  await step(F, 'enter_market USDT', kp, c => lend(group, by.USDT, 'Enable collateral', '0', c.signer, c.progress));
  ms = await load(); by = Object.fromEntries(ms.map(m => [m.token.symbol, m]));
  const ctx = (await marginContext(group, ms))!;
  const shares = 1000_0000000n * 1000000n / by.XLM.exchangeRate / 10n; // 100 XLM
  const q = await quoteOpen(ctx, u, by.XLM, by.USDT, shares, 2, 'Long', 1000);
  let n = 0; const real = keypairSigner(kp, network.passphrase);
  const sig = { address: u, signTransaction: async (x: string) => { n++; if (n === 3) throw new Error('User closed wallet popup at signature 3'); return real.signTransaction(x); } };
  await step(F, 'open interrupted before swap (pending open left)', kp, c => openPosition(ctx, q, sig as any, c.progress), { expectFail: /User closed wallet popup/ });
  const pos = await positions(ctx, u); const p = pos.find(x => x.status === 'PendingOpen');
  if (!p) { await check(F, 'pending open exists', () => { throw new Error('none'); }); return; }
  const exp = Number(p.pendingOpen!.expires_at);
  await check(F, 'pending open expires_at recorded', () => `expires_at=${exp} ttl_left=${exp - Math.floor(Date.now() / 1000)}s`);
  const wait = exp - Math.floor(Date.now() / 1000) + 45;
  console.log(`sleeping ${wait}s until after expiry`); await sleep(wait * 1000);
  await step(F, 'resumeOpen on expired unswapped open -> app refuses with recovery text', kp, c => resumeOpen(ctx, p.id, c.signer, c.progress).then(() => ({ hash: '' })), { expectFail: /expired/ });
  await step(F, 'raw swap_open_position_v3 on expired open (chain behaviour)', kp, async c => {
    const { submitContract } = await import('../../src/lib/peridot/rpc'); const { addr, uint } = await import('../../src/lib/peridot/group-client');
    return submitContract({ contractId: ctx.info.controller, method: 'swap_open_position_v3', args: [addr(u), uint(p.id, 'u64')], signer: c.signer, onProgress: c.progress });
  }, { expectFail: /.*/ });
  await step(F, 'cancelOpen recovers margin of expired open', kp, c => cancelOpen(ctx, p.id, c.signer, c.progress));
  const after = await positions(ctx, u);
  await check(F, 'assert no pending open after cancel', () => { if (after.some(x => x.id === p.id && x.status === 'PendingOpen')) throw new Error('still pending'); });
  await step(F, 'withdrawMargin returns funds to supply', kp, c => withdrawMargin(ctx, by.XLM, c.signer, c.progress));
}
main().catch(e => { console.error('FATAL', e); process.exit(1); });
