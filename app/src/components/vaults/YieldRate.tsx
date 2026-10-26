'use client';
import { useEffect, useState } from 'react';
import { Skeleton, Tooltip } from '@/components/ui/primitives';
import { fmtRate, type YieldQuote } from '@/lib/vaults/apy';
import { quoteVenue } from '@/lib/vaults/yield-client';
import type { VaultId } from '@/lib/vaults/registry';
import './vaults.css';

export interface YieldRateProps {
  venue: VaultId;
  token?: string;
  vault?: string;
  pool?: string;
  /** Pure quote computed by the caller (for example from a draft rate curve) instead of a chain read. */
  quote?: YieldQuote;
  /** Show the facts list under the number. */
  facts?: boolean;
}

export type QuoteState = { status: 'loading' } | { status: 'ready'; quote: YieldQuote } | { status: 'error'; message: string };

export function useYieldQuote(venue: VaultId, opts: { token?: string; vault?: string; pool?: string }, enabled = true): QuoteState {
  const [state, setState] = useState<QuoteState>({ status: 'loading' });
  const { token, vault, pool } = opts;
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    setState({ status: 'loading' });
    quoteVenue(venue, { token, vault, pool }).then(quote => { if (!cancelled) setState({ status: 'ready', quote }); }).catch(e => { if (!cancelled) setState({ status: 'error', message: e instanceof Error ? e.message : 'Rate could not be read.' }); });
    return () => { cancelled = true; };
  }, [venue, token, vault, pool, enabled]);
  return state;
}

/** APY / APR est. / n/a with the formula in a tooltip. Loading and failure states are explicit; numbers are never invented. */
export function YieldRate({ venue, token, vault, pool, quote, facts }: YieldRateProps) {
  const live = useYieldQuote(venue, { token, vault, pool }, !quote);
  const state: QuoteState = quote ? { status: 'ready', quote } : live;
  if (state.status === 'loading') return <span className="yield-rate" data-testid={`yield-${venue}`} aria-busy="true"><Skeleton width={64} height={16} /><span className="yield-label">reading rate</span></span>;
  if (state.status === 'error') return <span className="yield-rate na" data-testid={`yield-${venue}`}><span className="yield-value">n/a</span><span className="yield-label">rate unavailable<Tooltip text={`The read failed: ${state.message}`} label="Why the rate is unavailable" /></span></span>;
  const q = state.quote;
  const tone = q.kind === 'na' ? 'na' : q.kind === 'apr-est' ? 'est' : 'live';
  return <span className={`yield-rate ${tone}`} data-testid={`yield-${venue}`}>
    <span className="yield-value num">{fmtRate(q)}</span>
    <span className="yield-label">{q.kind === 'na' ? (q.reason ? 'n/a' : q.label) : q.label}<Tooltip text={<span>{q.kind === 'na' && q.reason ? <><strong>Why no rate:</strong> {q.reason} </> : null}<strong>How it is computed:</strong> {q.formula}{q.facts.length > 0 && <> <strong>Inputs:</strong> {q.facts.map(([k, v]) => `${k}: ${v}`).join('; ')}.</>}</span>} label={`How the ${q.label} is computed`} /></span>
    {facts && q.facts.length > 0 && <span className="yield-facts">{q.facts.map(([k, v]) => <span key={k}><span className="muted">{k}</span> {v}</span>)}</span>}
  </span>;
}
