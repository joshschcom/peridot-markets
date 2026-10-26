/** Recent transactions kept per network in localStorage for the header popover.
 *
 * Loosely follows PeridotV2Full 86ae3795 `components/steallar/TransactionStrip.tsx` (a backend-fed
 * activity strip). Here the source is the local transaction event bus only: no backend, no points. */
import type { TxStatus } from '../ui-events';

export type RecentStatus = 'pending' | 'success' | 'failed' | 'unknown';
export interface RecentTx { hash: string; status: RecentStatus; at: number; method?: string; contractId?: string }
export const RECENT_TX_LIMIT = 10;

export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export const recentTxKey = (networkName: string) => `peridot:recent-tx:${networkName}`;

export function statusFromTx(status: TxStatus): RecentStatus | null {
  switch (status) {
    case 'submitting': case 'confirming': return 'pending';
    case 'success': return 'success';
    case 'error': return 'failed';
    case 'unknown': return 'unknown';
    default: return null; // simulating and signing have no hash yet
  }
}

function isRecentTx(value: unknown): value is RecentTx {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return typeof v.hash === 'string' && v.hash.length > 0 && typeof v.at === 'number'
    && (v.status === 'pending' || v.status === 'success' || v.status === 'failed' || v.status === 'unknown');
}

export function loadRecent(storage: KeyValueStorage | null | undefined, networkName: string): RecentTx[] {
  if (!storage) return [];
  try {
    const parsed: unknown = JSON.parse(storage.getItem(recentTxKey(networkName)) || '[]');
    return Array.isArray(parsed) ? parsed.filter(isRecentTx).slice(0, RECENT_TX_LIMIT) : [];
  } catch { return []; }
}

export function saveRecent(storage: KeyValueStorage | null | undefined, networkName: string, list: RecentTx[]): boolean {
  if (!storage) return false;
  try {
    if (list.length === 0) storage.removeItem(recentTxKey(networkName));
    else storage.setItem(recentTxKey(networkName), JSON.stringify(list.slice(0, RECENT_TX_LIMIT)));
    return true;
  } catch { return false; }
}

/** Newest first, one entry per hash (the latest status wins), capped at RECENT_TX_LIMIT. */
export function upsertRecent(list: RecentTx[], entry: RecentTx): RecentTx[] {
  const existing = list.find(item => item.hash === entry.hash);
  const merged: RecentTx = existing ? { ...existing, ...entry, at: existing.at, method: entry.method ?? existing.method } : entry;
  return [merged, ...list.filter(item => item.hash !== entry.hash)].slice(0, RECENT_TX_LIMIT);
}

/** `open_position` -> `Open position`. */
export function methodLabel(method?: string): string {
  if (!method) return 'Transaction';
  const words = method.replace(/_/g, ' ').trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** Short relative time without timers: "just now", "4 min ago", "2 h ago", "3 d ago". */
export function relativeTime(at: number, now: number = Date.now()): string {
  const seconds = Math.max(0, Math.round((now - at) / 1000));
  if (seconds < 45) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return `${Math.round(hours / 24)} d ago`;
}
