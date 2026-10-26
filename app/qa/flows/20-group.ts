import '../lib/bootstrap';
import { Keypair } from '@stellar/stellar-sdk';
import { getOrCreateAccount, invokeRead, setupInvoke, addrV, i128, sleep } from '../lib/chain';
import { setOut, check, step } from '../lib/report';
import { loadState, X } from '../lib/flow';
import { getGroup, getMarketConfig } from '../../src/lib/peridot/factory';
import { readMarket, lend, readRewards, claimRewards, addr, uint, type MarketView } from '../../src/lib/peridot/group-client';
import { readContract, submitContract } from '../../src/lib/peridot/rpc';
import { network } from '../../src/lib/peridot/network';
import { keypairSigner } from '../lib/signer';

setOut('testnet-group');
const fmt = (v: bigint, d = 7) => (Number(v) / 10 ** d).toString();

async function views(gid: number, owner: string | null) {
  const group = await getGroup(gid);
  const out: Record<string, MarketView> = {};
  for (const m of group.markets) { const cfg = await getMarketConfig(gid, m); const v = await readMarket(group, m, cfg, owner); out[v.token.symbol] = v; }
  return { group, v: out };
}
async function main() {
  const st = loadState();
  const owner = await getOrCreateAccount('owner');
  const user = await getOrCreateAccount('user');
  const gid: number = st.X.id;
  const F = 'B-group/X';
  // --- setup (harness, not app): user needs mock USDT
  await setupInvoke(user, X.usdt_mock, 'mint', [addrV(user.publicKey()), i128(5000_0000000n)]);

  // ---- Owner seeds liquidity, exercising the "enter market first" ordering in a rewards group
  let { group, v } = await views(gid, owner.publicKey());
  await check(F, 'page read: group has rewards + margin + 2 markets', () => { if (!group.reward_distributor || !group.margin_controller || group.markets.length !== 2) throw new Error(JSON.stringify(group)); return `${group.name} ${group.markets.length} markets`; });
  await step(F, 'owner supply XLM before enter_market (rewards group) -> client must say enable first', owner, c => lend(group, v.XLM, 'Supply', '5000', c.signer, c.progress), { expectFail: /Enable this market before supplying/ });
  await step(F, 'owner enter_market XLM', owner, c => lend(group, v.XLM, 'Enable collateral', '0', c.signer, c.progress));
  ({ group, v } = await views(gid, owner.publicKey()));
  await check(F, 'assert entered XLM', () => { if (!v.XLM.entered) throw new Error('not entered'); });
  await step(F, 'owner supply 5000 XLM', owner, c => lend(group, v.XLM, 'Supply', '5000', c.signer, c.progress));
  await step(F, 'owner enter_market USDT', owner, c => lend(group, v.USDT, 'Enable collateral', '0', c.signer, c.progress));
  ({ group, v } = await views(gid, owner.publicKey()));
  await step(F, 'owner supply 20000 USDT', owner, c => lend(group, v.USDT, 'Supply', '20000', c.signer, c.progress));
  ({ group, v } = await views(gid, owner.publicKey()));
  await check(F, 'assert market liquidity after seed (XLM 5000, USDT 20000)', () => { if (v.XLM.liquidity < 4999_0000000n || v.USDT.liquidity < 19999_0000000n) throw new Error(`liq ${v.XLM.liquidity} ${v.USDT.liquidity}`); return `XLM ${fmt(v.XLM.liquidity)} USDT ${fmt(v.USDT.liquidity)} supplied ${fmt(v.XLM.supplied)}/${fmt(v.USDT.supplied)}`; });

  // ---- User B
  ({ group, v } = await views(gid, user.publicKey()));
  const u = user.publicKey();
  await step(F, 'user supply XLM before enter_market -> must be blocked', user, c => lend(group, v.XLM, 'Supply', '1000', c.signer, c.progress), { expectFail: /Enable this market before supplying/ });
  // Is the client guard only advisory? Ask the chain directly (bypass client).
  await step(F, 'DIAG user raw deposit() without enter_market (chain behaviour, bypasses client guard)', user, c => submitContract({ contractId: v.XLM.address, method: 'deposit', args: [addr(u), uint(10_0000000n)], signer: c.signer, onProgress: c.progress }));
  await step(F, 'user enter_market XLM', user, c => lend(group, v.XLM, 'Enable collateral', '0', c.signer, c.progress));
  ({ group, v } = await views(gid, u));
  const xlmBefore = v.XLM.walletBalance, sharesBefore = v.XLM.receiptBalance;
  await step(F, 'user supply 1000 XLM', user, c => lend(group, v.XLM, 'Supply', '1000', c.signer, c.progress));
  ({ group, v } = await views(gid, u));
  await check(F, 'assert wallet -1000 XLM (minus fee) and shares increased', () => { const d = xlmBefore - v.XLM.walletBalance; if (d < 1000_0000000n || d > 1001_0000000n || v.XLM.receiptBalance <= sharesBefore) throw new Error(`delta ${d} shares ${v.XLM.receiptBalance}`); return `wallet -${fmt(d)} shares ${v.XLM.receiptBalance} rate ${v.XLM.exchangeRate}`; });
  await step(F, 'user borrow USDT before enter_market(USDT) -> client must block', user, c => lend(group, v.USDT, 'Borrow', '100', c.signer, c.progress), { expectFail: /Enable this market before borrowing/ });
  // Does the chain agree? preview_borrow_max for a market the user has not entered
  await check(F, 'DIAG preview_borrow_max(USDT) before entering USDT', async () => { try { const m = await readContract<bigint>(group.controller, 'preview_borrow_max', [addr(u), addr(v.USDT.address)]); return `chain says max borrow ${fmt(m)} USDT (client blocks anyway)`; } catch (e) { return 'chain error: ' + (e as Error).message.slice(0, 200); } });
  await step(F, 'user enter_market USDT', user, c => lend(group, v.USDT, 'Enable collateral', '0', c.signer, c.progress));
  ({ group, v } = await views(gid, u));
  const maxBorrow = await readContract<bigint>(group.controller, 'preview_borrow_max', [addr(u), addr(v.USDT.address)]);
  await check(F, 'preview_borrow_max sane vs collateral (1000 XLM * $0.168 * 70% ~ 117 USD)', () => { const usd = Number(maxBorrow) / 1e7; if (usd < 50 || usd > 200) throw new Error('max borrow ' + usd); return `max borrow ${usd} USDT`; });
  await step(F, 'user borrow over max (client guard)', user, c => lend(group, v.USDT, 'Borrow', String(Number(maxBorrow) / 1e7 + 50), c.signer, c.progress), { expectFail: /exceeds your available borrow power/ });
  await step(F, 'DIAG raw borrow over max (chain error text)', user, c => submitContract({ contractId: v.USDT.address, method: 'borrow', args: [addr(u), uint(maxBorrow + 500_0000000n)], signer: c.signer, onProgress: c.progress }), { expectFail: /.*/ });
  const usdtBefore = v.USDT.walletBalance;
  await step(F, 'user borrow 60 USDT', user, c => lend(group, v.USDT, 'Borrow', '60', c.signer, c.progress));
  ({ group, v } = await views(gid, u));
  await check(F, 'assert debt ~60 USDT and wallet +60', () => { if (v.USDT.debt < 60_0000000n || v.USDT.debt > 60_1000000n || v.USDT.walletBalance - usdtBefore !== 60_0000000n) throw new Error(`debt ${v.USDT.debt} wallet delta ${v.USDT.walletBalance - usdtBefore}`); return `debt ${fmt(v.USDT.debt)}`; });
  await step(F, 'user withdraw 900 XLM while borrowing -> must be blocked', user, c => lend(group, v.XLM, 'Withdraw', '900', c.signer, c.progress), { expectFail: /exceeds your available collateral/ });
  await step(F, 'user repay 20 USDT', user, c => lend(group, v.USDT, 'Repay', '20', c.signer, c.progress));
  ({ group, v } = await views(gid, u));
  await check(F, 'assert debt reduced to ~40', () => { if (v.USDT.debt < 39_9000000n || v.USDT.debt > 40_1000000n) throw new Error('debt ' + v.USDT.debt); return fmt(v.USDT.debt); });
  await step(F, 'user repay more than wallet balance -> blocked', user, c => lend(group, v.USDT, 'Repay', String(Number(v.USDT.walletBalance) / 1e7 + 1), c.signer, c.progress), { expectFail: /exceeds your wallet balance/ });
  await step(F, 'user supply 500 USDT (second market, reward-bearing)', user, c => lend(group, v.USDT, 'Supply', '500', c.signer, c.progress));
  await step(F, 'user supply more than wallet XLM -> blocked', user, c => lend(group, v.XLM, 'Supply', '999999', c.signer, c.progress), { expectFail: /exceeds your wallet balance/ });
  ({ group, v } = await views(gid, u));
  await step(F, 'user repay all (repay_max)', user, c => lend(group, v.USDT, 'Repay', '0', c.signer, c.progress, true));
  ({ group, v } = await views(gid, u));
  await check(F, 'assert debt == 0 after repay_max', () => { if (v.USDT.debt !== 0n) throw new Error('debt left ' + v.USDT.debt); });
  // rewards
  await sleep(20000);
  const r = await readRewards(group, u);
  await check(F, 'rewards accrued > 0 after supplying/borrowing in reward markets', () => { if (!r || r.accrued <= 0n) throw new Error('accrued ' + r?.accrued); return `accrued ${r!.accrued} ${r!.token.symbol}, distributor available ${r!.available}`; });
  const rewardBefore = await invokeRead<bigint>(X.usdt_mock, 'balance', [addrV(u)]);
  await step(F, 'user claim rewards', user, c => claimRewards(group, c.signer, c.progress));
  const rewardAfter = await invokeRead<bigint>(X.usdt_mock, 'balance', [addrV(u)]);
  await check(F, 'assert claim paid out reward token', () => { if (rewardAfter <= rewardBefore) throw new Error(`before ${rewardBefore} after ${rewardAfter}`); return `+${rewardAfter - rewardBefore} base units`; });
  await step(F, 'user withdraw 100 XLM (partial, exchange-rate conversion)', user, c => lend(group, v.XLM, 'Withdraw', '100', c.signer, c.progress));
  ({ group, v } = await views(gid, u));
  await step(F, 'user withdraw all USDT', user, c => lend(group, v.USDT, 'Withdraw', '0', c.signer, c.progress, true));
  ({ group, v } = await views(gid, u));
  await check(F, 'assert USDT shares 0 after withdraw all', () => { if (v.USDT.receiptBalance !== 0n) throw new Error('shares ' + v.USDT.receiptBalance); });
  // rejected transaction in wallet
  await step(F, 'wallet REJECTS signature: app surfaces error and leaves no pending tx', user, async c => {
    const rej = { address: u, signTransaction: async () => { throw new Error('User declined access'); } };
    try { await lend(group, v.XLM, 'Supply', '1', rej, c.progress); } finally { const p = (globalThis as any).localStorage.getItem(`peridot:pending:${network.name}:${u}`); if (p) throw new Error('pending record left behind: ' + p); }
  }, { expectFail: /User declined access/ });
  await step(F, 'after rejection a new action still works (lock released)', user, c => lend(group, v.XLM, 'Supply', '1', c.signer, c.progress));
  console.log('done group flows');
}
main().catch(e => { console.error('FATAL', e); process.exit(1); });
