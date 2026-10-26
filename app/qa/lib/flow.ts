import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { QA, TESTNET_EXTERNAL as X } from './bootstrap';
import { Keypair } from '@stellar/stellar-sdk';
import { step, check, type Ctx } from './report';
import { findReflectorFeed, getTokenMetadata } from '../../src/lib/peridot/factory';
import { newMarketDraft, type MarketDraft } from '../../src/lib/peridot/market-config';
import { launchSteps, launchScope, loadLaunch, newLaunch, runNextLaunchStep, recoverLaunchStep, discoverMarginPools, verifyRewardToken, clearCompletedLaunch, type LaunchDraft, type LaunchSession } from '../../src/lib/peridot/launch';

const STATE = resolve(QA, 'out/state.json');
export function loadState(): any { return existsSync(STATE) ? JSON.parse(readFileSync(STATE, 'utf8')) : {}; }
export function saveState(s: any) { writeFileSync(STATE, JSON.stringify(s, null, 2)); }
export function patchState(p: (s: any) => void) { const s = loadState(); p(s); saveState(s); return s; }

/** What the wizard's "Verify token" button does: token metadata + approved Reflector mapping. */
export async function wizardMarket(token: string, over: Partial<MarketDraft> = {}): Promise<MarketDraft> {
  const meta = await getTokenMetadata(token);
  const price = await findReflectorFeed(token, meta.symbol);
  return { ...newMarketDraft(), token, ...meta, price, ...over };
}
export function baseDraft(name: string, markets: MarketDraft[], over: Partial<LaunchDraft> = {}): LaunchDraft {
  return { name, description: '', markets, rewardsEnabled: false, rewardToken: '', rewardSymbol: '', rewardDecimals: 7, rewardFunding: '100',
    marginEnabled: false, maxLeverage: '3', slippage: '1', liquidationIncentive: '108', liquidationFee: '0', marginPools: [], ...over };
}
/** Drives the saved-session state machine exactly like the wizard's "Launch" button (one recorded step per tx). */
export async function runLaunch(flow: string, draft: LaunchDraft, kp: Keypair): Promise<LaunchSession | null> {
  const owner = kp.publicKey();
  const scope = launchScope(owner);
  let session = loadLaunch(scope);
  if (session?.completed) { clearCompletedLaunch(scope); session = null; }
  if (!session) {
    try { session = newLaunch(draft, owner); } catch (e) { await check(flow, 'newLaunch validation', () => { throw e; }); return null; }
  }
  for (let guard = 0; guard < 60 && !session!.completed; guard++) {
    if (session!.pending) {
      const rec = await step(flow, `recover pending ${session!.pending.step}`, kp, async () => { session = await recoverLaunchStep(session!, (await import('./signer')).keypairSigner(kp, (await import('../../src/lib/peridot/network')).network.passphrase)); return { hash: '' }; });
      if (!rec.ok) return session;
      continue;
    }
    const next = launchSteps(session!.draft).find(s => !session!.receipts.some(r => r.step === s.id))!;
    const r = await step(flow, `launch:${next.id} (${next.label})`, kp, async (c: Ctx) => {
      session = await runNextLaunchStep(session!, c.signer, c.progress);
      const rc = session.receipts[session.receipts.length - 1];
      return { hash: rc?.hash || '', value: rc?.value };
    }, { retries: 1 });
    if (!r.ok) { session = loadLaunch(scope) ?? session; return session; }
  }
  return session;
}
export async function launchedMarkets(s: LaunchSession) { return s.markets; }
export { X };
