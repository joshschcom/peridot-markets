'use client';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { CheckCircle2, CircleAlert, Loader2, OctagonAlert, PenLine, X } from 'lucide-react';
import { emitTx, onTx, type TxEvent, type TxStatus } from '@/lib/ui-events';
import { describeTxError, looksRaw } from '@/lib/ui/humanize-tx-error';
import { loadRecent, methodLabel, saveRecent, statusFromTx, upsertRecent, type RecentTx } from '@/lib/ui/recent-transactions';
import { network } from '@/lib/peridot/network';
import { TxLink } from './Address';
import './qol.css';

/* Transaction toasts. Adapted from PeridotV2Full 86ae3795 components/steallar/TxToast.tsx (a single
 * terminal-only toast fed by window CustomEvents and framer-motion). Here: a stack fed by the typed
 * event bus in lib/ui-events.ts, every status from simulating to confirmed, CSS transitions only,
 * humanized failures with the raw error collapsed, and the same provider keeps the recent list. */

export type ToastTone = 'info' | 'success' | 'warn' | 'danger';
export interface Toast {
  id: string; tone: ToastTone; title: string; text?: string; hash?: string; raw?: string; status?: TxStatus;
  /** Sticky toasts stay until dismissed; others auto-dismiss after `ttl` ms (default 6000). */
  sticky?: boolean; ttl?: number; updatedAt: number;
}
export type ToastInput = Omit<Toast, 'id' | 'updatedAt'> & { id?: string };

interface ToastApi {
  toasts: Toast[];
  push(toast: ToastInput): string;
  update(id: string, patch: Partial<Omit<Toast, 'id'>>): void;
  dismiss(id: string): void;
  recent: RecentTx[];
  clearRecent(): void;
}
const ToastContext = createContext<ToastApi | null>(null);
let adHocCounter = 0;

function storage(): Storage | null { try { return window.localStorage; } catch { return null; } }

/** Map one progress event to toast content. Exported for tests and the dev harness. */
export function toastFromEvent(event: TxEvent): ToastInput {
  const action = methodLabel(event.method);
  switch (event.status) {
    case 'simulating': return { id: event.id, tone: 'info', status: event.status, sticky: true, title: `${action}: checking`, text: 'Simulating the transaction against the network.' };
    case 'signing': return { id: event.id, tone: 'info', status: event.status, sticky: true, title: `${action}: waiting for your signature`, text: 'Review and confirm the transaction in your wallet.' };
    case 'submitting': return { id: event.id, tone: 'info', status: event.status, sticky: true, hash: event.hash, title: `${action}: submitting`, text: 'Sending the signed transaction to the network.' };
    case 'confirming': return { id: event.id, tone: 'info', status: event.status, sticky: true, hash: event.hash, title: `${action}: confirming`, text: 'Waiting for the ledger to close. This usually takes a few seconds.' };
    case 'success': return { id: event.id, tone: 'success', status: event.status, hash: event.hash, title: `${action} confirmed`, text: event.message || 'The transaction is on chain.' };
    case 'unknown': return { id: event.id, tone: 'warn', status: event.status, sticky: true, hash: event.hash, title: `${action}: confirmation unavailable`, text: event.message || 'The transaction may still succeed. Check its status before trying again.' };
    case 'error': {
      const described = describeTxError(event.message || 'Transaction failed.');
      const showRaw = described.kind !== 'raw' || looksRaw(described.raw);
      return { id: event.id, tone: 'danger', status: event.status, sticky: true, hash: event.hash, title: `${action} failed`, text: showRaw && described.kind === 'raw' ? 'The transaction failed. The technical details below say why.' : described.text, raw: showRaw ? described.raw : undefined };
    }
  }
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [recent, setRecent] = useState<RecentTx[]>([]);
  const recentRef = useRef(recent);
  recentRef.current = recent;

  const upsert = useCallback((input: ToastInput): string => {
    const id = input.id ?? `toast-${++adHocCounter}`;
    setToasts(list => {
      const next: Toast = { ...input, id, updatedAt: Date.now() };
      return list.some(t => t.id === id) ? list.map(t => t.id === id ? next : t) : [...list, next].slice(-5);
    });
    return id;
  }, []);
  const update = useCallback((id: string, patch: Partial<Omit<Toast, 'id'>>) => {
    setToasts(list => list.map(t => t.id === id ? { ...t, ...patch, updatedAt: Date.now() } : t));
  }, []);
  const dismiss = useCallback((id: string) => setToasts(list => list.filter(t => t.id !== id)), []);
  const clearRecent = useCallback(() => { setRecent([]); saveRecent(storage(), network.name, []); }, []);

  useEffect(() => { setRecent(loadRecent(storage(), network.name)); }, []);
  useEffect(() => {
    const off = onTx(event => {
      upsert(toastFromEvent(event));
      const status = statusFromTx(event.status);
      if (event.hash && status) {
        const next = upsertRecent(recentRef.current, { hash: event.hash, status, at: event.at ?? Date.now(), method: event.method, contractId: event.contractId });
        recentRef.current = next;
        setRecent(next);
        saveRecent(storage(), network.name, next);
      }
    });
    // Dev and QA harness only: lets a browser console or Playwright script drive the toasts without a wallet.
    if (process.env.NODE_ENV !== 'production') (window as unknown as { __peridotEmitTx?: typeof emitTx }).__peridotEmitTx = emitTx;
    return off;
  }, [upsert]);

  const api = useMemo<ToastApi>(() => ({ toasts, push: upsert, update, dismiss, recent, clearRecent }), [toasts, upsert, update, dismiss, recent, clearRecent]);
  return <ToastContext.Provider value={api}>
    {children}
    <ToastViewport toasts={toasts} onDismiss={dismiss} />
  </ToastContext.Provider>;
}

export function useToast(): Pick<ToastApi, 'push' | 'update' | 'dismiss'> {
  const api = useContext(ToastContext);
  if (!api) throw new Error('useToast must be used inside ToastProvider.');
  return api;
}

export function useRecentTransactions(): { recent: RecentTx[]; clear: () => void } {
  const api = useContext(ToastContext);
  if (!api) throw new Error('useRecentTransactions must be used inside ToastProvider.');
  return { recent: api.recent, clear: api.clearRecent };
}

const icons: Record<ToastTone, ReactNode> = {
  info: <Loader2 size={18} className="spin" aria-hidden />,
  success: <CheckCircle2 size={18} aria-hidden />,
  warn: <CircleAlert size={18} aria-hidden />,
  danger: <OctagonAlert size={18} aria-hidden />,
};

function ToastViewport({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: string) => void }) {
  return <div className="toast-viewport" role="region" aria-live="polite" aria-label="Transaction updates">
    {toasts.map(toast => <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />)}
  </div>;
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
  useEffect(() => {
    if (toast.sticky) return;
    const timer = window.setTimeout(() => onDismiss(toast.id), toast.ttl ?? 6000);
    return () => window.clearTimeout(timer);
  }, [toast.id, toast.sticky, toast.ttl, toast.updatedAt, onDismiss]);
  const icon = toast.status === 'signing' ? <PenLine size={18} aria-hidden /> : icons[toast.tone];
  return <div className={`toast ${toast.tone}`} role="status" data-status={toast.status}>
    <span className="toast-icon">{icon}</span>
    <div className="toast-main">
      <p className="toast-title">{toast.title}</p>
      {toast.text && <p className="toast-text">{toast.text}</p>}
      {toast.hash && <div className="toast-meta"><TxLink hash={toast.hash}>View on stellar.expert</TxLink></div>}
      {toast.raw && <details><summary>Technical details</summary><pre>{toast.raw}</pre></details>}
    </div>
    <button type="button" className="icon-button toast-close" aria-label={`Dismiss ${toast.title}`} onClick={() => onDismiss(toast.id)}><X size={14} aria-hidden /></button>
  </div>;
}
