'use client';
import { AlertTriangle, FlaskConical } from 'lucide-react';
import { network } from '@/lib/peridot/network';
import type { TxProgress } from '@/lib/peridot/rpc';
import { Badge, Notice } from '@/components/ui/primitives';
import { MAINNET_ICO_FEE_ESTIMATE_XLM, MAINNET_LAUNCH_FEE_ESTIMATE_XLM, MAINNET_PLAIN_FEE_ESTIMATE_XLM, isLaunchpadMainnet, launchpadMode } from '@/lib/launchpad/config';
import { fmtAmount } from '@/components/ui/format';
import { phaseLabel } from '@/lib/launchpad/math';
import type { Phase } from '@/lib/launchpad/types';
import { LpTxLink } from './LpAddress';
import './launchpad.css';

/** Network badge on every launchpad page, plus the demo and read-only states. */
export function LaunchpadBadges() {
  const mode = launchpadMode();
  return <>
    {isLaunchpadMainnet() ? <Badge tone="warn" icon={AlertTriangle}>Mainnet beta</Badge> : <Badge tone="accent" icon={FlaskConical}>Testnet</Badge>}
    {mode === 'mock' && <Badge tone="info">Demo</Badge>}
    {mode === 'live' && network.readOnly && <Badge>Read-only</Badge>}
  </>;
}

/** Mainnet only: the launchpad spends real XLM and runs new, unaudited contracts. Renders nothing on testnet or in demo mode. */
export function MainnetNotice({ compact = false }: { compact?: boolean }) {
  if (!isLaunchpadMainnet()) return null;
  return <Notice tone="warn" role="note" title="Mainnet beta: real XLM, unaudited contracts">
    <p>{compact ? 'The launchpad contracts are new and unaudited. Trades and launches here use real XLM.' : 'The launchpad contracts are new and unaudited beta software. Every launch, buy and sell on this page spends real XLM and can lose all of it. Never commit more than you can afford to lose.'}</p>
  </Notice>;
}

/** Mainnet only: the XLM this signature costs, before the wallet opens. `buy` is the creator buy in stroops (0n for none). */
export function MainnetCost({ buy, kind }: { buy: bigint; kind: 'curve' | 'plain' | 'ico' }) {
  if (!isLaunchpadMainnet()) return null;
  const fee = kind === 'curve' ? MAINNET_LAUNCH_FEE_ESTIMATE_XLM : kind === 'ico' ? MAINNET_ICO_FEE_ESTIMATE_XLM : MAINNET_PLAIN_FEE_ESTIMATE_XLM;
  const feeStroops = BigInt(Math.round(fee * 10_000_000));
  return <Notice tone="warn" role="status" title="What this costs in real XLM">
    <ul className="muted" style={{ paddingLeft: 16, display: 'grid', gap: 2 }}>
      {kind === 'curve' && <li>Creator buy: <strong>{fmtAmount(buy, 7, 2)} XLM</strong>{buy === 0n ? ' (none)' : ' (paid into the curve in the same transaction)'}</li>}
      <li>Network fee and Soroban rent: about <strong>{fee} XLM</strong> (the exact fee shows in your wallet)</li>
      <li>Launch fee: none (the factory charges no launch fee)</li>
      <li>Total: about <strong>{fmtAmount(buy + feeStroops, 7, 2)} XLM</strong>. Keep a little extra XLM for your account reserve.</li>
    </ul>
  </Notice>;
}

export type TokenType = 'simple' | 'curve' | 'ico';
const TYPE_LABEL: Record<TokenType, string> = { simple: 'Simple', curve: 'Curve', ico: 'ICO' };
const TYPE_HINT: Record<TokenType, string> = { simple: 'Simple token: no sale, whole supply went to the creator', curve: 'Bonding curve token: price rises as people buy', ico: 'ICO token: fixed price sale' };
/** Small badge that says how a token was launched, shown on every token card and token page. */
export function TypeBadge({ type }: { type: TokenType }) {
  return <span title={TYPE_HINT[type]} data-token-type={type}><Badge tone={type === 'curve' ? 'accent' : type === 'ico' ? 'warn' : 'info'}>{TYPE_LABEL[type]}</Badge></span>;
}

export const RISK_COPY = 'New tokens are highly risky. Prices can go to zero. Peridot does not vet projects. Testnet only.';
export const RISK_COPY_MAINNET = 'New tokens are highly risky. Prices can go to zero. Peridot does not vet projects. This is mainnet: you can lose real funds.';
/** Risk line for the active network. */
export function riskCopy(): string { return isLaunchpadMainnet() ? RISK_COPY_MAINNET : RISK_COPY; }
export function RiskNotice() { return <Notice tone="danger" role="note">{riskCopy()}</Notice>; }

export const progressCopy: Record<TxProgress['status'], string> = {
  simulating: 'Checking the transaction...',
  signing: 'Confirm the transaction in your wallet.',
  submitting: 'Submitting transaction...',
  confirming: 'Waiting for confirmation...',
  success: 'Transaction confirmed.',
  unknown: 'Confirmation unavailable. Check the hash before retrying.',
  error: 'Transaction failed.',
};
export function TxStatus({ progress }: { progress: TxProgress | null }) {
  if (!progress) return null;
  const tone = progress.status === 'success' ? 'success' : progress.status === 'error' ? 'danger' : progress.status === 'unknown' ? 'warn' : 'info';
  return <Notice tone={tone} role="status" live="polite">
    {progress.message || progressCopy[progress.status]}
    {progress.hash && !progress.hash.startsWith('mock-') && <> <LpTxLink hash={progress.hash}>View transaction</LpTxLink></>}
  </Notice>;
}

export function PhaseBadge({ phase }: { phase: Phase | number }) {
  const tone = phase === 0 ? 'accent' : phase === 1 ? 'warn' : phase === 3 ? 'info' : phase === 2 ? 'success' : 'neutral';
  return <Badge tone={tone}>{phaseLabel(phase)}</Badge>;
}

export function TokenIcon({ symbol, uri, large = false }: { symbol: string; uri?: string; large?: boolean }) {
  const safe = uri && /^https?:\/\//.test(uri) ? uri : '';
  return <span className={`token-icon${large ? ' large' : ''}`} aria-hidden>{safe ? <img src={safe} alt="" /> : symbol.slice(0, 2).toUpperCase()}</span>;
}

export function fmtIso(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}
