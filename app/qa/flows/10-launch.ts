import '../lib/bootstrap';
import { Keypair } from '@stellar/stellar-sdk';
import { getOrCreateAccount, invokeRead, setupInvoke, addrV, i128, sleep } from '../lib/chain';
import { setOut, check, step } from '../lib/report';
import { baseDraft, wizardMarket, runLaunch, patchState, loadState, X } from '../lib/flow';
import { discoverMarginPools, verifyRewardToken, validateLaunch } from '../../src/lib/peridot/launch';
import { getGroup, getMarketConfig } from '../../src/lib/peridot/factory';
import { readContract } from '../../src/lib/peridot/rpc';
import { dailyToSpeed } from '../../src/lib/peridot/market-config';
import { writeFileSync } from 'node:fs';

setOut('testnet-launch');
const which = process.argv[2] || 'all';

async function groupX(owner: Keypair) {
  // Full wizard path: two markets, leverage, rewards last.
  const xlm = await wizardMarket(X.xlm, { collateralFactor: '70', supplyCap: '1000000', borrowCap: '500000', marginEnabled: true, supplyRewardsPerDay: '100', borrowRewardsPerDay: '50' });
  const usdt = await wizardMarket(X.usdt_mock, { collateralFactor: '75', supplyCap: '1000000', borrowCap: '500000', marginEnabled: true, supplyRewardsPerDay: '100', borrowRewardsPerDay: '50' });
  const meta = await verifyRewardToken(X.usdt_mock);
  const draft = baseDraft('QaFull', [xlm, usdt], { marginEnabled: true, maxLeverage: '3', slippage: '10', liquidationIncentive: '108', liquidationFee: '0', rewardsEnabled: true, rewardToken: X.usdt_mock, rewardSymbol: meta.symbol, rewardDecimals: meta.decimals, rewardFunding: '1000' });
  await check('A-launch/X', 'validateLaunch before pool discovery lists the missing pool route', () => { const e = validateLaunch(draft); if (!e.some(m => /pool route/i.test(m))) throw new Error('no pool error: ' + e.join('|')); return e.join(' | '); });
  const pools = await discoverMarginPools(draft.markets);
  await check('A-launch/X', 'discoverMarginPools finds verified XLM/USDT pool', () => { if (!pools.length) throw new Error('none'); return JSON.stringify(pools.map(p => ({ pool: p.pool, poolId: p.poolId.slice(0, 12) }))); });
  draft.marginPools = pools;
  const s = await runLaunch('A-launch/X', draft, owner);
  if (s?.completed) {
    patchState(st => { st.X = { id: s.groupId, markets: s.markets, name: 'QaFull', distributor: s.receipts.find(r => r.step === 'rewards')?.value }; });
  }
  return s;
}
async function groupY(owner: Keypair) {
  // Start with XLM only, small caps (for cap tests). No margin, no rewards. USDT is added later from the Control Panel.
  const xlm = await wizardMarket(X.xlm, { collateralFactor: '70', supplyCap: '300', borrowCap: '100', idleBuffer: '20' });
  const draft = baseDraft('QaControl', [xlm]);
  const s = await runLaunch('A-launch/Y', draft, owner);
  if (s?.completed) patchState(st => { st.Y = { id: s.groupId, markets: s.markets, name: 'QaControl' }; });
  return s;
}
async function groupW(owner: Keypair) {
  // DeFindex route (testnet allowlisted XLM vault).
  const xlm = await wizardMarket(X.xlm, { route: 'Defindex', routeAddress: 'CCLV4H7WTLJQ7ATLHBBQV2WW3OINF3FOY5XZ7VPHZO7NH3D2ZS4GFSF6', supplyCap: '100000', borrowCap: '50000' });
  const s = await runLaunch('A-launch/W', baseDraft('QaYield', [xlm]), owner);
  if (s?.completed) patchState(st => { st.W = { id: s.groupId, markets: s.markets, name: 'QaYield' }; });
  return s;
}
async function groupZ(owner: Keypair) {
  // DeFindex-routed XLM + plain USDT with leverage: tests margin open on a boosted (yield-routed) borrowed market.
  const xlm = await wizardMarket(X.xlm, { route: 'Defindex', routeAddress: 'CCLV4H7WTLJQ7ATLHBBQV2WW3OINF3FOY5XZ7VPHZO7NH3D2ZS4GFSF6', collateralFactor: '70', supplyCap: '1000000', borrowCap: '500000', marginEnabled: true });
  const usdt = await wizardMarket(X.usdt_mock, { collateralFactor: '75', supplyCap: '1000000', borrowCap: '500000', marginEnabled: true });
  const draft = baseDraft('QaYieldMargin', [xlm, usdt], { marginEnabled: true, maxLeverage: '3', slippage: '10' });
  draft.marginPools = await discoverMarginPools(draft.markets);
  const s = await runLaunch('A-launch/Z', draft, owner);
  if (s?.completed) patchState(st => { st.Z = { id: s.groupId, markets: s.markets, name: 'QaYieldMargin' }; });
  return s;
}
async function validations(owner: Keypair) {
  const xlm = await wizardMarket(X.xlm);
  const usdt = await wizardMarket(X.usdt_mock);
  await check('E-edge', 'launch: duplicate token market rejected by wizard validation', () => { const e = validateLaunch(baseDraft('Dup', [xlm, { ...xlm }])); if (!e.some(x => /only one market/.test(x))) throw new Error('not rejected: ' + e.join('|')); return e.join(' | '); });
  await check('E-edge', 'launch: bad group name rejected', () => { const e = validateLaunch(baseDraft('bad name!', [xlm])); if (!e.length) throw new Error('accepted'); return e[0]; });
  await check('E-edge', 'launch: CF 90% rejected by wizard validation', () => { const e = validateLaunch(baseDraft('G', [{ ...xlm, collateralFactor: '90' }])); if (!e.some(x => /Collateral factor/.test(x))) throw new Error('not rejected: ' + e.join('|')); return e[0]; });
  await check('E-edge', 'launch: zero caps rejected by wizard validation', () => { const e = validateLaunch(baseDraft('G', [{ ...xlm, supplyCap: '0' }])); if (!e.some(x => /caps/.test(x))) throw new Error('not rejected'); return e[0]; });
  await check('E-edge', 'launch: leverage with one market rejected', () => { const e = validateLaunch(baseDraft('G', [{ ...xlm, marginEnabled: true }], { marginEnabled: true })); if (!e.some(x => /two/.test(x))) throw new Error('not rejected: ' + e.join('|')); return e.join(' | '); });
  await check('E-edge', 'launch: rewards token that is not a contract rejected', () => { const e = validateLaunch(baseDraft('G', [xlm], { rewardsEnabled: true, rewardToken: 'GABC', rewardSymbol: '' })); if (!e.some(x => /reward token/i.test(x))) throw new Error('not rejected'); return e[0]; });
  await check('E-edge', 'launch: unapproved token/feed mapping rejected (testnet USDC has no Reflector mapping)', async () => { await wizardMarket(X.usdc); }, { expectFail: /not covered by the configured Reflector/ });
  await check('E-edge', 'launch: 17 markets rejected', () => { const e = validateLaunch(baseDraft('G', Array.from({ length: 17 }, (_, i) => ({ ...xlm, token: i % 2 ? X.xlm : X.usdt_mock })))); if (!e.some(x => /at most 16/.test(x))) throw new Error('not rejected'); return 'ok'; });
}
async function main() {
  if (which === 'Z') { await groupZ(await getOrCreateAccount('trader2')); console.log(JSON.stringify(loadState().Z)); return; }
  const owner = await getOrCreateAccount('owner');
  if (which === 'validate' || which === 'all') await validations(owner);
  if (which === 'X' || which === 'all') await groupX(owner);
  if (which === 'Y' || which === 'all') await groupY(owner);
  if (which === 'W' || which === 'all') await groupW(owner);
  console.log(JSON.stringify(loadState(), null, 2));
}
main().catch(e => { console.error('FATAL', e); process.exit(1); });
