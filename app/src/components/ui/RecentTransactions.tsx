'use client';
import { useEffect, useRef, useState } from 'react';
import { History } from 'lucide-react';
import { network } from '@/lib/peridot/network';
import { methodLabel, relativeTime, type RecentTx } from '@/lib/ui/recent-transactions';
import { Badge, type Tone } from './primitives';
import { TxLink } from './Address';
import { useRecentTransactions } from './Toast';
import './qol.css';

/* Header popover with the last 10 transaction hashes seen by this browser on the current network.
 * Loosely adapted from PeridotV2Full 86ae3795 components/steallar/TransactionStrip.tsx; the backend
 * query, demo rows and points are gone, the source is the local event bus and localStorage only. */
const statusCopy: Record<RecentTx['status'], { label: string; tone: Tone }> = {
  pending: { label: 'Pending', tone: 'info' },
  success: { label: 'Confirmed', tone: 'success' },
  failed: { label: 'Failed', tone: 'danger' },
  unknown: { label: 'Unconfirmed', tone: 'warn' },
};

export function RecentTransactions() {
  const { recent, clear } = useRecentTransactions();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent | TouchEvent) => { if (root.current && !root.current.contains(event.target as Node)) setOpen(false); };
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('touchstart', onPointer);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onPointer); document.removeEventListener('touchstart', onPointer); document.removeEventListener('keydown', onKey); };
  }, [open]);
  const pending = recent.filter(tx => tx.status === 'pending').length;
  const label = recent.length === 0 ? 'Recent transactions' : `Recent transactions (${recent.length}${pending ? `, ${pending} pending` : ''})`;
  return <div className="recent-tx" ref={root}>
    <button type="button" className="recent-tx-button" aria-label={label} title={label} aria-expanded={open} aria-haspopup="dialog" onClick={() => setOpen(value => !value)}>
      <History size={16} aria-hidden />
      {recent.length > 0 && <span className={`recent-tx-count${pending ? ' pending' : ''}`} aria-hidden>{recent.length}</span>}
    </button>
    {open && <div className="recent-tx-panel" role="dialog" aria-label="Recent transactions">
      <div className="recent-tx-head"><strong>Recent transactions</strong><span className="subtle" style={{ fontSize: 12 }}>{network.name}</span>{recent.length > 0 && <button type="button" className="button quiet sm" onClick={clear}>Clear</button>}</div>
      {recent.length === 0
        ? <p className="muted">No transactions from this browser on {network.name} yet. Submitted, confirmed and failed transactions appear here with explorer links.</p>
        : <ul className="recent-tx-list">{recent.map(tx => <li key={tx.hash}>
          <div><span className="cell-main">{methodLabel(tx.method)}</span><span className="recent-tx-sub"><Badge tone={statusCopy[tx.status].tone}>{statusCopy[tx.status].label}</Badge><span>{relativeTime(tx.at)}</span></span></div>
          <TxLink hash={tx.hash} ariaLabel={`View ${methodLabel(tx.method)} transaction in explorer`} />
        </li>)}</ul>}
    </div>}
  </div>;
}
