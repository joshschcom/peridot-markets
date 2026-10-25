/** Presentational number formatting. Exact math stays in lib/peridot/amount.ts; these helpers only
 * shape already-computed values for display and never feed a transaction. */
import { formatAmount } from '@/lib/peridot/amount';

const groupFormatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: 20 });

/** Format a base-unit bigint with thousands separators and a bounded number of fraction digits. */
export function fmtAmount(value: bigint, decimals: number, maxFraction = 2): string {
  const exact = formatAmount(value, decimals);
  const [whole, fraction = ''] = exact.split('.');
  const neg = whole.startsWith('-');
  const digits = neg ? whole.slice(1) : whole;
  const grouped = groupFormatter.format(BigInt(digits || '0'));
  let frac = fraction.slice(0, maxFraction).replace(/0+$/, '');
  if (!frac && fraction && value !== 0n && BigInt(digits || '0') === 0n) {
    // Below the display precision: show the smallest representable step instead of a misleading 0.
    frac = ''.padEnd(Math.max(1, maxFraction - 1), '0') + '1';
    return `${neg ? '-' : ''}<0.${frac}`;
  }
  return `${neg ? '-' : ''}${grouped}${frac ? `.${frac}` : ''}`;
}

/** Compact display for large totals: 1.2K, 3.4M. Falls back to fmtAmount below 10,000. */
export function fmtCompact(value: bigint, decimals: number): string {
  const n = Number(formatAmount(value, decimals));
  if (!Number.isFinite(n)) return fmtAmount(value, decimals);
  const abs = Math.abs(n);
  if (abs < 10_000) return fmtAmount(value, decimals, abs < 1 ? 4 : 2);
  return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 2 }).format(n);
}

/** Percent with fixed decimals from a plain number (e.g. 12.345 -> "12.35%"). */
export function fmtPct(value: number, digits = 2): string {
  if (!Number.isFinite(value)) return 'n/a';
  return `${value.toFixed(digits)}%`;
}

/** 1e6-scaled contract percentage (e.g. collateral factor 700000n -> "70%"). */
export function fmtScaledPct(value: bigint, digits = 0): string {
  return `${(Number(value) / 10_000).toFixed(digits)}%`;
}

/** Basis points to percent. */
export function fmtBps(bps: number, digits = 0): string {
  return `${(bps / 100).toFixed(digits)}%`;
}

export function fmtNumber(value: number, digits = 2): string {
  if (!Number.isFinite(value)) return 'n/a';
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: digits, minimumFractionDigits: 0 }).format(value);
}

/** Truncate a Stellar address for display: CBGW...CQ7S */
export function shortAddress(address: string, head = 4, tail = 4): string {
  if (!address) return '';
  if (address.length <= head + tail + 1) return address;
  return `${address.slice(0, head)}...${address.slice(-tail)}`;
}

/** Days from a bigint balance and a per-second emission rate (both in base units). */
export function runwayDays(balance: bigint, perSecond: bigint): number | null {
  if (perSecond <= 0n) return null;
  return Number(balance * 1000n / (perSecond * 86_400n)) / 1000;
}

export function fmtDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0s';
  if (seconds < 90) return `${Math.ceil(seconds)}s`;
  const m = Math.floor(seconds / 60), s = Math.round(seconds % 60);
  if (m < 60) return s ? `${m}m ${s}s` : `${m}m`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

export function fmtDate(unixSeconds: number | bigint): string {
  const d = new Date(Number(unixSeconds) * 1000);
  if (Number.isNaN(d.getTime())) return 'Unknown';
  return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}
