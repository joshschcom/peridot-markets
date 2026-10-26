import '../lib/bootstrap';
import { dryStep, DEPLOYER, flushDry, dryRecords } from '../lib/report';
import { deployFile } from '../lib/bootstrap';
import { getGroup, getMarketConfig, listGroups, findReflectorFeed, encodeMarketConfig } from '../../src/lib/peridot/factory';
import { xdr, Address, scValToNative } from '@stellar/stellar-sdk';
import { getRpc } from '../../src/lib/peridot/rpc';
import { readMarket, lend, readRewards, claimRewards, addr, uint, unitEnum, type MarketView } from '../../src/lib/peridot/group-client';
import * as C from '../../src/lib/peridot/control-client';
import { marginContext, quoteOpen, openPosition, positions, withdrawMargin, closePosition } from '../../src/lib/peridot/margin';
import { marketDraftToConfig, newMarketDraft } from '../../src/lib/peridot/market-config';
import { getDeployments, network } from '../../src/lib/peridot/network';
import { readContract, submitContract } from '../../src/lib/peridot/rpc';
import { runNextLaunchStep, newLaunch, discoverMarginPools } from '../../src/lib/peridot/launch';
import { getTokenMetadata } from '../../src/lib/peridot/factory';
import { baseDraft, wizardMarket } from '../lib/flow';
import { writeFileSync } from 'node:fs';

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
const only = process.argv[2];
async function views(gid: number) {
  const group = await getGroup(gid); const out: MarketView[] = [];
  for (const m of group.markets) { out.push(await readMarket(group, m, await getMarketConfig(gid, m), DEPLOYER)); await sleep(300); }
  return { group, markets: out, by: Object.fromEntries(out.map(m => [m.token.symbol, m])) as Record<string, MarketView> };
}
async function main() {
  const d = getDeployments();
  console.log('network', network.name, network.rpcUrl, 'factory', d.factory);
  const snapshot: any = { ledgerNote: 'state snapshot of the deployer (public address) on mainnet at run time', groups: {} };
  for (const gid of [1, 2, 3]) {
    const { group, markets } = await views(gid);
    snapshot.groups[gid] = { name: group.name, owner: group.owner, ownerIsDeployer: group.owner === DEPLOYER, rewards: !!group.reward_distributor, margin: !!group.margin_controller,
      markets: markets.map(m => ({ symbol: m.token.symbol, supplied: String(m.supplied), borrowed: String(m.borrowed), liquidity: String(m.liquidity), walletBalance: String(m.walletBalance), needsTrustline: m.needsTrustline, receiptShares: String(m.receiptBalance), debt: String(m.debt), entered: m.entered, priceError: m.priceError, vaultError: m.vaultError, price: m.price ? { mode: m.price.mode, status: (m.price as any).status } : null })) };
  }
  writeFileSync(new URL('../out/mainnet-snapshot.json', import.meta.url), JSON.stringify(snapshot, null, 2));
  console.log(JSON.stringify(snapshot, null, 1));

  for (const [gid, label] of [[1, 'group1 Meridian'], [2, 'group2 Rewards'], [3, 'group3 BlendDemo']] as const) {
    if (only && only !== String(gid)) continue;
    const { group, markets, by } = await views(gid);
    for (const m of markets) {
      const sym = m.token.symbol;
      if (m.config.yield_route.tag !== 'None') {
        await dryStep(label, `boosted health cache age of ${sym} market (borrow/margin fail closed when > 300 s)`, async () => {
          const key = xdr.LedgerKey.contractData(new xdr.LedgerKeyContractData({ contract: new Address(m.address).toScAddress(), key: xdr.ScVal.scvVec([xdr.ScVal.scvSymbol('BoostedHealthCache')]), durability: xdr.ContractDataDurability.persistent }));
          const res = await getRpc().getLedgerEntries(key); const e = res.entries[0];
          if (!e || e.val.type !== 'contractData') { console.log('   no BoostedHealthCache entry'); return; }
          const v: any = scValToNative(e.val.contractData.val); const age = Math.floor(Date.now() / 1000) - Number(v.updated_at);
          console.log(`   ${label} ${sym}: cache underlying=${v.underlying} age=${age}s -> ${age > 300 ? 'STALE: borrow/margin open will fail until refresh_boosted_underlying()' : 'fresh'}`);
          dryRecords[dryRecords.length - 1] && 0;
        });
        await dryStep(label, `refresh_boosted_underlying ${sym} (permissionless; the fix for stale cache)`, s => submitContract({ contractId: m.address, method: 'refresh_boosted_underlying', args: [], signer: s }));
      }
      await dryStep(label, `enter_market ${sym} (Enable collateral)`, s => lend(group, m, 'Enable collateral', '0', s));
      await dryStep(label, `supply 1 ${sym}`, s => lend(group, m, 'Supply', '1', s));
      await dryStep(label, `withdraw 0.5 ${sym}`, s => lend(group, m, 'Withdraw', '0.5', s));
      await dryStep(label, `withdraw all ${sym}`, s => lend(group, m, 'Withdraw', '0', s, undefined, true));
    }
    if (gid === 1) {
      await dryStep(label, 'borrow 1 XLM against the deployer XLM deposit', s => lend(group, by.XLM, 'Borrow', '1', s));
      await dryStep(label, 'borrow 1 USDC (market has no liquidity)', s => lend(group, by.USDC, 'Borrow', '1', s));
      await dryStep(label, 'repay 1 XLM (no debt)', s => lend(group, by.XLM, 'Repay', '1', s));
      await dryStep(label, 'repay all XLM (no debt)', s => lend(group, by.XLM, 'Repay', '0', s, undefined, true));
    }
    if (gid === 2) {
      const r = await readRewards(group, DEPLOYER);
      console.log('rewards', r && { token: r.token.symbol, accrued: String(r.accrued), available: String(r.available) });
      await dryStep(label, `claim rewards (accrued ${r ? r.accrued : 'n/a'})`, s => claimRewards(group, s));
    }
  }
  if (!only || only === 'margin') {
    const { group, markets, by } = await views(1);
    const ctx = (await marginContext(group, markets))!;
    await dryStep('margin group1', 'marginContext (get_margin_status + effective_max_leverage)', async () => { console.log(JSON.stringify({ limits: ctx.limits, maxLev: String(ctx.info.cfg.max_leverage), enabled: ctx.info.enabled_markets.length }, null, 0)); });
    const shares = 5_000_000n * 1_000_000n / by.XLM.exchangeRate; // 0.5 XLM
    let quote: Awaited<ReturnType<typeof quoteOpen>> | undefined;
    await dryStep('margin group1', 'quoteOpen 0.5 XLM 2x long USDC (fees, pair config, prices, pool route, estimate_swap)', async () => { quote = await quoteOpen(ctx, DEPLOYER, by.XLM, by.USDC, shares, 2, 'Long', 100); console.log(JSON.stringify({ route: quote.route.pool, expectedOut: String(quote.expectedOut), minOut: String(quote.minOut), feeShares: String(quote.feeShares), total: String(quote.totalShares), free: String(quote.freeMargin), maxLev: quote.maxLeverage }, null, 0)); });
    if (quote) await dryStep('margin group1', 'openPosition stage 1: transfer_spot_to_margin (later stages cannot simulate without it)', s => openPosition(ctx, quote!, s));
    await dryStep('margin group1', 'positions() read for deployer', async () => { const p = await positions(ctx, DEPLOYER); console.log('positions', p.length); });
    await dryStep('margin group1', 'withdrawMargin (no free margin) -> expected client guard', s => withdrawMargin(ctx, by.XLM, s));
    // the stage after the transfer, simulated directly: expected to fail only because the free margin does not exist yet
    if (quote) await dryStep('margin group1', 'DIAG begin_open_position_v3 without prior transfer (expect insufficient margin balance)', s => submitContract({ contractId: ctx.info.controller, method: 'begin_open_position_v3', args: [addr(DEPLOYER), addr(by.XLM.token.address), addr(by.USDC.token.address), uint(quote!.shares), uint(2n), unitEnum('Long'), xdr.ScVal.scvVec(quote!.route.tokens.map(addr)), xdr.ScVal.scvBytes(quote!.route.poolId), addr(quote!.route.pool), uint(quote!.minOut)], signer: s }));
  }
  if (!only || only === 'control') {
    for (const gid of [1, 2, 3]) {
      const label = `control group${gid}`;
      let ctl: Awaited<ReturnType<typeof C.loadControl>> | undefined;
      await dryStep(label, 'loadControl (markets, pending, events history, margin, rewards)', async () => { ctl = await C.loadControl(gid); console.log(`   group ${gid}: markets=${ctl.markets.length} pending=${ctl.pending.length} history=${ctl.history.length} historyError=${ctl.historyError ?? ''} margin=${!!ctl.margin}`); });
      if (!ctl) continue;
      const m = ctl.markets[0];
      await dryStep(label, `update_rates ${m.token.symbol} (unchanged curve)`, s => C.updateRates(gid, m.address, m.config.rates, s));
      await dryStep(label, `update_idle_buffer ${m.token.symbol} (unchanged)`, s => C.updateBuffer(gid, m.address, m.config.idle_buffer_bps, s));
      await dryStep(label, `update_risk ${m.token.symbol} (supply cap +1)`, s => C.updateRisk(gid, m.address, { ...m.config, supply_cap: m.config.supply_cap + 10_000_000n }, s));
      await dryStep(label, `update_risk ${m.token.symbol} (CF -1pt -> staged)`, s => C.updateRisk(gid, m.address, { ...m.config, collateral_factor: m.config.collateral_factor - 10_000n }, s));
      await dryStep(label, `update_price ${m.token.symbol} (same approved tuple -> staged)`, s => C.updatePrice(gid, m.address, m.config.price, s));
      await dryStep(label, `pause_market ${m.token.symbol} (no-op false,false)`, s => C.pauseMarket(gid, m.address, false, false, s));
      await dryStep(label, 'apply_pending with nothing staged', s => C.applyPending(gid, undefined, s));
      if (ctl.group.margin_controller) {
        await dryStep(label, 'sync_pairs (syncLeverageLimits)', s => C.syncLeverageLimits(gid, s));
        await dryStep(label, 'update_margin (same config)', s => C.updateMargin(gid, ctl!.margin!.cfg, s));
        await dryStep(label, `set_market_margin ${m.token.symbol} true`, s => C.setMarketMargin(gid, m.address, true, s));
      }
      if (ctl.group.reward_distributor) {
        await dryStep(label, 'fund rewards 1 unit', s => C.fundRewards(gid, ctl!.group.reward_distributor!, 10_000_000n, s));
        await dryStep(label, 'set_reward_speeds (unchanged)', s => C.updateRewardSpeeds(gid, m.address, m.config.supply_reward_per_sec, m.config.borrow_reward_per_sec, s));
        await dryStep(label, 'withdraw_unallocated 0.1', s => C.withdrawRewards(gid, DEPLOYER, 1_000_000n, s));
      } else if (gid === 1) {
        await dryStep(label, 'set_rewards XLM (group 1 has none; would lock the market list)', s => C.setGroupRewards(gid, d.external.xlm as string, s));
      }
    }
    // group 1 stays open: third market (EURC) through the Control Panel path
    const eurc = 'CDTKPWPLOURQA2SGTKTUQOWRCBZEORB4BWBOMJ3D3ZTQQSGE5F6JBQLV';
    await dryStep('control group1', 'add_market EURC after launch (rent of a new market)', async s => {
      const cfg = marketDraftToConfig(await wizardMarket(eurc, { collateralFactor: '70', supplyCap: '1000', borrowCap: '500' }));
      return C.addControlMarket(1, cfg, { address: eurc, symbol: 'EURC', decimals: 7 }, s);
    });
    await dryStep('control group1', 'add duplicate XLM market after launch', async s => {
      const cfg = marketDraftToConfig(await wizardMarket(d.external.xlm as string, { collateralFactor: '70', supplyCap: '1000', borrowCap: '500' }));
      return C.addControlMarket(1, cfg, { address: d.external.xlm as string, symbol: 'XLM', decimals: 7 }, s);
    });
    await dryStep('control group1', 'add market with CF 90% (client guardrail)', async s => { const cfg = marketDraftToConfig(await wizardMarket(eurc, {})); return C.addControlMarket(1, { ...cfg, collateral_factor: 900_000n }, { address: eurc, symbol: 'EURC', decimals: 7 }, s); });
  }
  if (!only || only === 'launch') {
    // Launch wizard first transaction on mainnet (create_group) for the deployer: shows the rent cost a fresh creator would pay.
    const xlm = await wizardMarket(d.external.xlm as string, {});
    const draft = baseDraft('QaDryRun', [xlm]);
    await dryStep('launch wizard', 'create_group QaDryRun (first wizard tx; rent estimate)', async s => {
      const session = newLaunch(draft, DEPLOYER);
      await runNextLaunchStep(session, s);
    });
    await dryStep('launch wizard', 'discoverMarginPools XLM+USDC (router get_pools + registry)', async () => {
      const x = await wizardMarket(d.external.xlm as string, { marginEnabled: true }); const u = await wizardMarket(d.external.usdc as string, { marginEnabled: true });
      const pools = await discoverMarginPools([x, u]); console.log('   pools', JSON.stringify(pools.map(p => ({ pool: p.pool, id: p.poolId.slice(0, 10) }))));
    });
  }
  flushDry();
  console.log('mainnet dry run complete; submissions: 0 (sendTransaction is blocked by the harness guard)');
}
main().catch(e => { console.error('FATAL', e); flushDry(); process.exit(1); });
