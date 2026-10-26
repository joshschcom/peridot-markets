import '../lib/bootstrap';
import { getOrCreateAccount, invokeRead, addrV, i128, sleep } from '../lib/chain';
import { setOut, check, step } from '../lib/report';
import { loadState, wizardMarket, X } from '../lib/flow';
import { getGroup, getMarketConfig, findReflectorFeed, encodeMarketConfig } from '../../src/lib/peridot/factory';
import { readMarket, lend, addr, uint } from '../../src/lib/peridot/group-client';
import * as C from '../../src/lib/peridot/control-client';
import { marketDraftToConfig } from '../../src/lib/peridot/market-config';
import { getDeployments } from '../../src/lib/peridot/network';
import { submitContract, readContract } from '../../src/lib/peridot/rpc';
import { scU128, scU32 } from '../../src/lib/peridot/factory';

setOut('testnet-control');
const now = () => Math.floor(Date.now() / 1000);
const big = (_k: string, v: unknown) => typeof v === 'bigint' ? v.toString() : v;
async function waitUntil(ts: number) { const w = ts - now() + 6; if (w > 0) { console.log(`   waiting ${w}s for the 60s delay`); await sleep(w * 1000); } }
async function main() {
  const st = loadState(); const owner = await getOrCreateAccount('owner'); const o = owner.publicKey();
  const Y = st.Y.id, Xg = st.X.id; const F = 'C-control';
  const ym = st.Y.markets['0'] as string;
  // ---------- read
  let ctl = await C.loadControl(Y);
  await check(F + '/Y', 'loadControl returns markets, no pending, history', () => `markets=${ctl.markets.length} pending=${ctl.pending.length} history=${ctl.history.length} err=${ctl.historyError ?? ''}`);
  // ---------- immediate settings
  const cfg0 = ctl.markets[0].config;
  await step(F + '/Y', 'update_rates (immediate)', owner, c => C.updateRates(Y, ym, { base: 10000n, multiplier: 90000n, jump: 2000000n, kink: 800000n }, c.signer, c.progress));
  await check(F + '/Y', 'assert rates stored', async () => { const c = await getMarketConfig(Y, ym); if (c.rates.multiplier !== 90000n || c.rates.base !== 10000n) throw new Error(JSON.stringify(c.rates, big)); });
  await step(F + '/Y', 'update_idle_buffer 35% (immediate)', owner, c => C.updateBuffer(Y, ym, 3500, c.signer, c.progress));
  await check(F + '/Y', 'assert idle buffer stored', async () => { const c = await getMarketConfig(Y, ym); if (c.idle_buffer_bps !== 3500) throw new Error(String(c.idle_buffer_bps)); });
  await step(F + '/Y', 'update_idle_buffer 5% -> guardrail (client)', owner, c => C.updateBuffer(Y, ym, 500, c.signer, c.progress), { expectFail: /between 10% and 100%/ });
  await step(F + '/Y', 'DIAG raw update_idle_buffer 5% (chain guardrail)', owner, c => submitContract({ contractId: getDeployments().factory, method: 'update_idle_buffer', args: [addr(o), scU32(Y), addr(ym), scU32(500)], signer: c.signer, onProgress: c.progress }), { expectFail: /.*/ });
  await step(F + '/Y', 'update_rates 5000% -> client guardrail', owner, c => C.updateRates(Y, ym, { base: 0n, multiplier: 99999999n, jump: 0n, kink: 0n }, c.signer, c.progress), { expectFail: /Rate inputs must be/ });
  // ---------- staged CF
  await step(F + '/Y', 'update_risk CF 70% -> 60%, caps 400/150 (CF staged)', owner, c => C.updateRisk(Y, ym, { ...cfg0, collateral_factor: 600000n, supply_cap: 400_0000000n, borrow_cap: 150_0000000n }, c.signer, c.progress));
  ctl = await C.loadControl(Y);
  const risk = ctl.pending.find(p => p.kind === 'risk');
  await check(F + '/Y', 'pending risk visible, caps applied immediately, CF still 70%', () => { if (!risk) throw new Error('no pending risk: ' + JSON.stringify(ctl.pending, big)); const m = ctl.markets[0].config; if (m.collateral_factor !== 700000n) throw new Error('CF changed early ' + m.collateral_factor); if (m.supply_cap !== 400_0000000n) throw new Error('caps not immediate ' + m.supply_cap); return `executeAfter=${risk.executeAfter} in ${risk.executeAfter - now()}s`; });
  await step(F + '/Y', 'apply_pending immediately -> must be refused (60s delay)', owner, c => C.applyPending(Y, risk, c.signer, c.progress), { expectFail: /60-second delay/ });
  await step(F + '/Y', 'DIAG raw apply_pending before delay (chain behaviour)', owner, c => submitContract({ contractId: getDeployments().factory, method: 'apply_pending', args: [addr(o), scU32(Y), addr(ym)], signer: c.signer, onProgress: c.progress }), { expectFail: /.*/ });
  if (risk) await waitUntil(risk.executeAfter);
  ctl = await C.loadControl(Y); const risk2 = ctl.pending.find(p => p.kind === 'risk');
  await step(F + '/Y', 'apply_pending after delay (no margin => no sync_pairs)', owner, c => C.applyPending(Y, risk2, c.signer, c.progress));
  await check(F + '/Y', 'assert CF now 60% and nothing pending', async () => { const c = await getMarketConfig(Y, ym); const l = await C.loadControl(Y); if (c.collateral_factor !== 600000n || l.pending.length) throw new Error(`CF ${c.collateral_factor} pending ${l.pending.length}`); });
  // ---------- guardrails (client AND chain)
  const cur = (await getMarketConfig(Y, ym));
  await step(F + '/Y', 'update_risk CF 90% -> client guardrail', owner, c => C.updateRisk(Y, ym, { ...cur, collateral_factor: 900000n }, c.signer, c.progress), { expectFail: /between 1% and 75%/ });
  await step(F + '/Y', 'DIAG raw update_risk CF 90% (chain guardrail)', owner, c => submitContract({ contractId: getDeployments().factory, method: 'update_risk', args: [addr(o), scU32(Y), addr(ym), scU128(900000n), scU128(cur.supply_cap), scU128(cur.borrow_cap), scU128(cur.reserve_factor)], signer: c.signer, onProgress: c.progress }), { expectFail: /.*/ });
  await step(F + '/Y', 'update_risk zero supply cap -> client guardrail', owner, c => C.updateRisk(Y, ym, { ...cur, supply_cap: 0n }, c.signer, c.progress), { expectFail: /greater than zero/ });
  await step(F + '/Y', 'DIAG raw update_risk zero supply cap (chain)', owner, c => submitContract({ contractId: getDeployments().factory, method: 'update_risk', args: [addr(o), scU32(Y), addr(ym), scU128(cur.collateral_factor), scU128(0n), scU128(cur.borrow_cap), scU128(cur.reserve_factor)], signer: c.signer, onProgress: c.progress }), { expectFail: /.*/ });
  await step(F + '/Y', 'DIAG raw update_risk reserve factor 60% (chain)', owner, c => submitContract({ contractId: getDeployments().factory, method: 'update_risk', args: [addr(o), scU32(Y), addr(ym), scU128(cur.collateral_factor), scU128(cur.supply_cap), scU128(cur.borrow_cap), scU128(600000n)], signer: c.signer, onProgress: c.progress }), { expectFail: /.*/ });
  // ---------- staged price
  const price = await findReflectorFeed(X.xlm, 'XLM');
  await step(F + '/Y', 'update_price (staged, same approved tuple)', owner, c => C.updatePrice(Y, ym, price, c.signer, c.progress));
  ctl = await C.loadControl(Y); const pp = ctl.pending.find(p => p.kind === 'price');
  await check(F + '/Y', 'pending price visible', () => { if (!pp) throw new Error('no pending price'); return `executeAfter=${pp.executeAfter}`; });
  await step(F + '/Y', 'update_price to a mapping the factory has not approved (USDT feed on XLM market)', owner, async c => C.updatePrice(Y, ym, await findReflectorFeed(X.usdt_mock, 'USDT'), c.signer, c.progress), { expectFail: /not bound to this token/ });
  if (pp) await waitUntil(pp.executeAfter);
  ctl = await C.loadControl(Y);
  await step(F + '/Y', 'apply_pending (price)', owner, c => C.applyPending(Y, ctl.pending.find(p => p.kind === 'price'), c.signer, c.progress));
  // ---------- pause
  await step(F + '/Y', 'pause_market deposits', owner, c => C.pauseMarket(Y, ym, true, false, c.signer, c.progress));
  const user = await getOrCreateAccount('user');
  {
    const g = await getGroup(Y); const v = await readMarket(g, ym, await getMarketConfig(Y, ym), user.publicKey());
    await step(F + '/Y', 'user supply while deposits paused -> chain rejects', user, c => lend(g, v, 'Supply', '1', c.signer, c.progress), { expectFail: /.*/ });
  }
  await step(F + '/Y', 'unpause market', owner, c => C.pauseMarket(Y, ym, false, false, c.signer, c.progress));
  await check(F + '/Y', 'assert pause flags cleared', async () => { const l = await C.loadControl(Y); if (l.markets[0].depositPaused || l.markets[0].borrowPaused) throw new Error('still paused'); });
  // ---------- caps (group page behaviour at the cap)
  {
    const g = await getGroup(Y); const v = await readMarket(g, ym, await getMarketConfig(Y, ym), user.publicKey());
    await step(F + '/Y', 'user supplies 401 XLM into a 400 XLM supply cap -> rejected', user, c => lend(g, v, 'Supply', '401', c.signer, c.progress), { expectFail: /.*/ });
    await step(F + '/Y', 'user supplies 200 XLM within cap', user, c => lend(g, v, 'Supply', '200', c.signer, c.progress));
  }
  // ---------- add market after launch (rewards still off in Y)
  const usdtDraft = await wizardMarket(X.usdt_mock, { collateralFactor: '70', supplyCap: '10000', borrowCap: '5000' });
  const usdtCfg = marketDraftToConfig(usdtDraft);
  const add = await step(F + '/Y', 'add_market USDT after launch', owner, c => C.addControlMarket(Y, usdtCfg, { address: X.usdt_mock, symbol: 'USDT', decimals: 7 }, c.signer, c.progress));
  const newMarket = add.value?.value as string | undefined;
  if (newMarket) {
    await step(F + '/Y', 'activate_market USDT', owner, c => C.activateControlMarket(Y, newMarket, c.signer, c.progress));
    await step(F + '/Y', 'attach_yield on a market with route None -> refused', owner, c => C.attachMarketYield(Y, newMarket, c.signer, c.progress), { expectFail: /no yield route/ });
    await step(F + '/Y', 'finishMarketAddition', owner, async () => { await C.finishMarketAddition(Y, o); return { hash: '' }; });
  }
  await step(F + '/Y', 'add duplicate token (XLM again) -> should be refused', owner, async c => { const dup = marketDraftToConfig(await wizardMarket(X.xlm)); return C.addControlMarket(Y, dup, { address: X.xlm, symbol: 'XLM', decimals: 7 }, c.signer, c.progress); }, { expectFail: /.*/ });
  await check(F + '/Y', 'assert group Y now has exactly 2 markets', async () => { const g = await getGroup(Y); if (g.markets.length !== 2) throw new Error('markets ' + g.markets.length); });
  // ---------- rewards LAST, then markets are locked
  await step(F + '/Y', 'set_rewards (USDT) after markets', owner, c => C.setGroupRewards(Y, X.usdt_mock, c.signer, c.progress));
  const gY = await getGroup(Y);
  if (gY.reward_distributor) {
    await step(F + '/Y', 'fund rewards 500 USDT', owner, c => C.fundRewards(Y, gY.reward_distributor!, 500_0000000n, c.signer, c.progress));
    for (const m of gY.markets) await step(F + '/Y', `set_reward_speeds ${m.slice(0, 6)}`, owner, c => C.updateRewardSpeeds(Y, m, 1000n, 500n, c.signer, c.progress));
    await step(F + '/Y', 'withdraw_unallocated rewards 10 USDT', owner, c => C.withdrawRewards(Y, o, 10_0000000n, c.signer, c.progress));
  }
  const lateCfg = marketDraftToConfig(await wizardMarket(X.usdt_mock));
  await step(F + '/Y', 'add market after rewards enabled -> client refuses', owner, c => C.addControlMarket(Y, lateCfg, { address: X.usdt_mock, symbol: 'USDT', decimals: 7 }, c.signer, c.progress), { expectFail: /after group rewards are enabled/ });
  await step(F + '/X', 'add market to rewards group X -> client refuses', owner, c => C.addControlMarket(Xg, lateCfg, { address: X.usdt_mock, symbol: 'USDT', decimals: 7 }, c.signer, c.progress), { expectFail: /after group rewards are enabled/ });
  await step(F + '/X', 'DIAG raw add_market on rewards group X (chain enforcement)', owner, c => submitContract({ contractId: getDeployments().factory, method: 'add_market', args: [addr(o), scU32(Xg), encodeMarketConfig({ ...lateCfg, token: X.xlm })], signer: c.signer, onProgress: c.progress }), { expectFail: /.*/ });
  // ---------- ownership transfer (known disabled)
  await step(F + '/X', 'transfer_ownership (live) -> app declines', owner, c => C.transferOwnership(Xg, X.usdt_mock.replace(/^C/, 'G'), c.signer, c.progress), { expectFail: /.*/ });
  console.log('control (non-margin) done');
}
main().catch(e => { console.error('FATAL', e); process.exit(1); });
