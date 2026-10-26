'use client';
import Link from 'next/link';
import { ArrowRight, Droplets, ExternalLink, Landmark, Lock } from 'lucide-react';
import { useWallet } from '@/lib/peridot/wallet';
import { network } from '@/lib/peridot/network';
import type { Signer, TxProgress } from '@/lib/peridot/rpc';
import { Badge, KeyValue, Notice, Stat, Stepper } from '@/components/ui/primitives';
import { fmtAmount, fmtCompact } from '@/components/ui/format';
import { claimGroup, graduate, type GraduationCost, type TokenBalance } from '@/lib/launchpad/client';
import { MAINNET_GRADUATION_AQUA, isLaunchpadMainnet, launchpadMode, launchpadNetworkLabel, launchpadSwapUrl } from '@/lib/launchpad/config';
import { GRAD_STEPS } from '@/lib/launchpad/math';
import { GradStep, Phase, type CurveInfo, type CurveParams, type Graduation, type LaunchInfo } from '@/lib/launchpad/types';
import { LpAddress } from './LpAddress';

export const DEAD_ADDRESS = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF';
export interface GraduationPanelProps {
  launch: LaunchInfo; state: CurveInfo; params: CurveParams; graduation: Graduation | null;
  cost: GraduationCost | null; costError: string; aqua: TokenBalance | null; groupOwner: string | null;
  busy: boolean; run: (task: () => Promise<unknown>) => Promise<void>; signer: () => Signer; report: (p: TxProgress) => void;
}

/** Mainnet: graduation step 1 is paid in AQUA, which most wallets do not hold. Shown before the step is reachable. */
export function AquaRequirement({ cost }: { cost: GraduationCost | null }) {
  const amount = cost ? fmtAmount(cost.amount, 7, 0) : fmtAmount(BigInt(MAINNET_GRADUATION_AQUA) * 10_000_000n, 7, 0);
  const code = cost?.code ?? 'AQUA';
  return <p>Graduation step 1 is paid in {code}: <strong>{amount} {code}</strong> (read live from the curve), plus the network fee. The payer needs an {code} trustline{cost?.issuer ? <> (issuer <LpAddress value={cost.issuer} label="AQUA issuer" head={6} tail={6} />)</> : ''} and that balance. Buy {code} with XLM on Aquarius: <a className="text-link" href={launchpadSwapUrl()} target="_blank" rel="noreferrer">Get AQUA on Aquarius <ExternalLink size={12} aria-hidden /></a>. Anyone can pay it, not only the creator.</p>;
}
/** Mainnet only: a graduated token whose raise is below the price router's 500 USD per pool side floor gets a supply-only market. */
export const ROUTER_FLOOR_NOTE = 'A 500 XLM raise is below the price router\'s 500 USD per pool side floor, so a token that graduates from the Fast preset gets a supply-only lending market until its Aquarius pool is deeper.';
export function belowRouterFloor(params: CurveParams): boolean { return params.graduation_target <= 1_000n * 10_000_000n; }

/** What graduation will do, shown while the curve is still trading. */
export function GraduationPreview({ params, symbol }: { params: CurveParams; symbol: string }) {
  return <section className="card">
    <div className="card-header"><div><h2>At graduation</h2><p>Once {fmtAmount(params.graduation_target, 7, 0)} XLM has been raised, buys stop and anyone can run six permissionless steps.</p></div></div>
    <ol className="step-list" aria-label="Graduation steps">
      {GRAD_STEPS.map(s => <li key={s.step}><span className="step-dot" aria-hidden>{s.step}</span><div><strong>{s.title}</strong><span>{s.detail}</span></div></li>)}
    </ol>
    <p className="subtle mt-4" style={{ fontSize: 12 }}>The pool receives all raised XLM plus {fmtCompact(params.lp_supply, 7)} {symbol}; its LP shares are locked for good. Unsold curve tokens are burned.</p>
    {isLaunchpadMainnet() && <Notice tone="info" role="note" title="Before you graduate this token"><AquaRequirement cost={null} /></Notice>}
    {isLaunchpadMainnet() && belowRouterFloor(params) && <Notice tone="warn" role="note">{ROUTER_FLOOR_NOTE}</Notice>}
  </section>;
}

export function GraduationPanel({ launch, state, params, graduation, cost, costError, aqua, groupOwner, busy, run, signer, report }: GraduationPanelProps) {
  const wallet = useWallet();
  const mode = launchpadMode();
  const signingBlocked = mode === 'live' && network.readOnly ? 'This preview is read-only. Transactions are not enabled.' : !wallet.address ? 'Connect your wallet to run this step.' : wallet.networkMismatch ? `Switch your wallet to ${launchpadNetworkLabel()} before signing.` : null;
  if (state.phase === Phase.Trading) return <GraduationPreview params={params} symbol={launch.symbol} />;

  if (state.phase === Phase.Graduated && graduation) {
    const claimable = !graduation.claimed && !!wallet.address && wallet.address === launch.creator;
    const groupHref = `/groups/${graduation.group_id}`;
    return <section className="card grad-panel" aria-label="Graduation">
      <div className="card-header"><div><h2>Graduated</h2><p>The curve seeded an Aquarius pool and created the token&apos;s own lending market.</p></div><Badge tone="success">Complete</Badge></div>
      <div className="stack">
        <div className="lock-note"><Lock size={16} aria-hidden /><div><strong>Liquidity locked permanently.</strong> Every LP share went to the all-zero account <LpAddress value={DEAD_ADDRESS} label="lock account" />, which has no private key, so nobody can withdraw the pool&apos;s liquidity. Aquarius router upgrades and pool kill switches are third-party keys outside Peridot&apos;s control.</div></div>
        <div className="grid-2">
          <div className="card inset" style={{ padding: 14 }}>
            <h3 className="row" style={{ gap: 8 }}><Droplets size={16} aria-hidden style={{ color: 'var(--accent-text)' }} />Aquarius pool</h3>
            <KeyValue rows={[['Pool', <LpAddress key="pool" value={graduation.pool} label="pool address" />], ['Seeded', `${fmtAmount(graduation.quote_in_pool, 7, 2)} XLM + ${fmtCompact(graduation.token_in_pool, 7)} ${launch.symbol}`], ['LP shares locked', fmtAmount(graduation.lp_shares_burned, 7, 2)], ['Unsold tokens burned', `${fmtCompact(graduation.unsold_burned, 7)} ${launch.symbol}`], ['Share token', <LpAddress key="share" value={graduation.share_token} label="share token address" />], ['Fee tier', '0.30%']]} />
          </div>
          <div className="card inset" style={{ padding: 14 }}>
            <h3 className="row" style={{ gap: 8 }}><Landmark size={16} aria-hidden style={{ color: 'var(--accent-text)' }} />Lending market live</h3>
            <KeyValue rows={[['Group', `#${graduation.group_id} on the ${launchpadNetworkLabel()} market factory`], ['XLM market', graduation.quote_market ? <LpAddress key="qm" value={graduation.quote_market} label="XLM market address" /> : 'n/a'], [`${launch.symbol} market`, graduation.token_market ? <LpAddress key="tm" value={graduation.token_market} label={`${launch.symbol} market address`} /> : 'n/a'], ['Price source', `Aquarius pool, 25% collateral factor`], ['Owner', groupOwner ? (groupOwner === launch.creator ? 'The creator' : groupOwner === launch.curve ? 'The curve, until the creator claims it' : <LpAddress key="owner" value={groupOwner} label="group owner" />) : graduation.claimed ? 'The creator' : 'The curve, until the creator claims it']]} />
            <div className="row" style={{ marginTop: 12 }}>
              {groupHref ? <Link className="button" href={groupHref}>Open lending market <ArrowRight size={14} aria-hidden /></Link> : <span className="subtle" style={{ fontSize: 12 }}>Group #{graduation.group_id} lives on {launchpadNetworkLabel()}.</span>}
              {claimable && <button type="button" className="button secondary" disabled={busy || !!signingBlocked} onClick={() => void run(() => claimGroup(signer(), launch.curve, report))}>{busy ? 'Working...' : 'Claim your group'}</button>}
            </div>
            {claimable && signingBlocked && <p className="subtle" style={{ fontSize: 12, marginTop: 8 }}>{signingBlocked}</p>}
            {!graduation.claimed && !claimable && <p className="subtle" style={{ fontSize: 12, marginTop: 8 }}>The creator can take ownership with claim_group. Until then the curve owns the group and nobody can change it.</p>}
            {graduation.claimed && <p className="subtle" style={{ fontSize: 12, marginTop: 8 }}>The creator claimed the group and can manage it from its Control Panel.</p>}
          </div>
        </div>
        {mode !== 'mock' && !isLaunchpadMainnet() && <Notice tone="info" role="note">Group pages read the network-selected market factory. On a testnet build the group link works once the testnet manifest is synced into the app.</Notice>}
      </div>
    </section>;
  }

  // Graduatable or Graduating: drive the six steps.
  const done = graduation?.step ?? GradStep.NotStarted;
  const next = GRAD_STEPS[done] ?? GRAD_STEPS[GRAD_STEPS.length - 1];
  const needsFee = done === GradStep.NotStarted;
  const feeText = cost ? `${fmtAmount(cost.amount, 7, 2)} ${cost.code}` : null;
  const feeBlocked = !needsFee ? null
    : costError ? `The pool creation fee could not be read: ${costError}`
    : !cost ? 'Reading the pool creation fee...'
    : !wallet.address ? null
    : !aqua ? `Reading your ${cost.code} balance...`
    : aqua.needsTrustline ? `Your account has no ${cost.code} trustline. Add one in your wallet${cost.issuer ? ` for ${cost.code} issued by ${cost.issuer.slice(0, 6)}...${cost.issuer.slice(-6)}` : ''}, get ${feeText}, then refresh.`
    : aqua.balance < cost.amount ? `You hold ${fmtAmount(aqua.balance, 7, 2)} ${cost.code}; this step needs ${feeText}.`
    : null;
  const blocked = signingBlocked || feeBlocked;
  return <section className="card grad-panel" aria-label="Graduation">
    <div className="card-header"><div><h2>{state.phase === Phase.Graduatable ? 'Ready to graduate' : 'Graduation in progress'}</h2><p>{state.phase === Phase.Graduatable ? `The curve raised ${fmtAmount(state.real_quote, 7, 2)} XLM. Buys are closed; sells stay open until the first step runs.` : 'Trading is closed. Anyone can run the remaining steps.'}</p></div><Badge tone={state.phase === Phase.Graduatable ? 'warn' : 'info'}>{done} of 6 steps</Badge></div>
    <div className="stack">
      <Stepper ariaLabel="Graduation steps" steps={GRAD_STEPS.map(s => s.short)} current={Math.min(done, 5)} onSelect={() => {}} disabled />
      <div className="grad-facts">
        <Stat label="XLM into the pool" value={fmtAmount(state.real_quote, 7, 2)} unit="XLM" />
        <Stat label={`${launch.symbol} into the pool`} value={fmtCompact(params.lp_supply, 7)} unit={launch.symbol} />
        <Stat label="Pool creation fee" value={feeText ?? (costError ? 'n/a' : '...')} hint={needsFee ? 'Paid by whoever runs step 1; unspent fee is refunded' : 'Paid in step 1'} />
      </div>
      <div className="grad-next">
        <p className="kicker" style={{ margin: 0 }}>Next step {done + 1} of 6</p>
        <h3>{next.title}</h3>
        <p className="muted" style={{ margin: 0, fontSize: 13 }}>{next.detail}</p>
        {needsFee && <Notice tone="info" role="note">
          {isLaunchpadMainnet()
            ? <AquaRequirement cost={cost} />
            : <p>The payer needs an {cost?.code ?? 'AQUA'} trustline and {feeText ?? 'the fee'} on testnet. Add the trustline in your wallet{cost?.issuer ? <> (issuer <LpAddress value={cost.issuer} label="AQUA issuer" head={6} tail={6} />)</> : ''}, then swap a little XLM to {cost?.code ?? 'AQUA'} on Aquarius testnet: about 50 XLM gave 1,660 AQUA in the demo run. <a className="text-link" href={launchpadSwapUrl()} target="_blank" rel="noreferrer">Aquarius testnet swap <ExternalLink size={12} aria-hidden /></a></p>}
          {wallet.address && aqua && !aqua.needsTrustline && <p style={{ margin: 0 }}>Your balance: {fmtAmount(aqua.balance, 7, 2)} {cost?.code ?? 'AQUA'}.</p>}
        </Notice>}
        {blocked && <Notice tone="warn" role="status">{blocked}</Notice>}
        <div><button type="button" className="button" disabled={busy || !!blocked} onClick={() => void run(() => graduate(signer(), launch.curve, report))}>{busy ? 'Working...' : `Run step ${done + 1}: ${next.short}`}</button></div>
      </div>
      <p className="subtle" style={{ fontSize: 12, margin: 0 }}>Each step is one permissionless transaction. A failed step leaves the previous one intact and can be retried. Only step 1 moves {cost?.code ?? 'AQUA'}; the others only pay the network fee.</p>
    </div>
  </section>;
}
