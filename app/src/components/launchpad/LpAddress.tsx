'use client';
import { useState, type ReactNode } from 'react';
import { Check, Copy, ExternalLink } from 'lucide-react';
import { shortAddress } from '@/components/ui/format';
import { lpAccountUrl, lpTxUrl } from '@/lib/launchpad/config';

/** Same markup as components/ui/Address, but linked to the explorer of the network the launchpad is
 * pointed at (testnet in demo mode). Demo ids (`mock-...`) render as plain text. */
export function LpAddress({ value, label = 'address', head = 4, tail = 4, className = '' }: { value: string; label?: string; head?: number; tail?: number; className?: string }) {
  const [copied, setCopied] = useState(false);
  const url = lpAccountUrl(value);
  const copy = async () => {
    try { await navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1500); }
    catch { /* Clipboard access can be denied; the full value remains in the title attribute. */ }
  };
  return <span className={`address ${className}`.trim()} title={value}>
    <span className="address-text">{shortAddress(value, head, tail)}</span>
    <button type="button" className="icon-button" aria-label={copied ? `Copied ${label}` : `Copy ${label}`} onClick={copy}>{copied ? <Check size={13} aria-hidden /> : <Copy size={13} aria-hidden />}</button>
    {url && <a className="icon-button" href={url} target="_blank" rel="noreferrer" aria-label={`View ${label} in explorer`}><ExternalLink size={13} aria-hidden /></a>}
  </span>;
}

export function LpTxLink({ hash, children, className = 'text-link', ariaLabel }: { hash: string; children?: ReactNode; className?: string; ariaLabel?: string }) {
  if (!hash) return null;
  if (hash.startsWith('mock-')) return <span className="subtle">Demo step</span>;
  return <a className={className} href={lpTxUrl(hash)} target="_blank" rel="noreferrer" aria-label={ariaLabel}>{children ?? <>{shortAddress(hash, 6, 4)}<ExternalLink size={12} aria-hidden /></>}</a>;
}
