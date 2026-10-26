'use client';
import { ExternalLink, FlaskConical } from 'lucide-react';
import { network } from '@/lib/peridot/network';
import type { TxProgress } from '@/lib/peridot/rpc';
import { Badge, Notice } from '@/components/ui/primitives';
import { TESTNET_APP_URL, launchpadMode } from '@/lib/launchpad/config';
import { phaseLabel } from '@/lib/launchpad/math';
import type { Phase } from '@/lib/launchpad/types';
import { LpTxLink } from './LpAddress';
import './launchpad.css';

/** Testnet badge on every launchpad page, plus the demo and read-only states. */
export function LaunchpadBadges() {
  const mode = launchpadMode();
  return <>
    <Badge tone="accent" icon={FlaskConical}>Testnet</Badge>
    {mode === 'mock' && <Badge tone="info">Demo</Badge>}
    {mode === 'live' && network.readOnly && <Badge>Read-only</Badge>}
  </>;
}

/** Shown when the app itself runs on mainnet: the launchpad data below is testnet data, read-only here. */
export function MainnetNotice() {
  if (launchpadMode() !== 'remote') return null;
  return <Notice tone="warn" role="note" title="The launchpad runs on testnet during the beta">
    <p>Mainnet launches need a legal review first. This page reads the Stellar testnet directly and cannot sign transactions. Use the testnet app to launch and trade test tokens.</p>
    {TESTNET_APP_URL
      ? <a className="button secondary sm" href={TESTNET_APP_URL} target="_blank" rel="noreferrer">Open the testnet app <ExternalLink size={13} aria-hidden /></a>
      : <><button type="button" className="button secondary sm" disabled>Open the testnet app</button><span className="subtle" style={{ display: 'block', marginTop: 6 }}>Set NEXT_PUBLIC_TESTNET_APP_URL to link the testnet deployment.</span></>}
  </Notice>;
}

export const RISK_COPY = 'New tokens are highly risky. Prices can go to zero. Peridot does not vet projects. Testnet only.';
export function RiskNotice() { return <Notice tone="danger" role="note">{RISK_COPY}</Notice>; }

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
