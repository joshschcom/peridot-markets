'use client';
import { useState, type ReactNode } from 'react';
import { Check, Copy, ExternalLink } from 'lucide-react';
import { network, transactionUrl } from '@/lib/peridot/network';
import { shortAddress } from './format';

function explorerUrl(value: string): string | null {
  if (/^C[A-Z2-7]{55}$/.test(value)) return `${network.explorerUrl}/contract/${value}`;
  if (/^G[A-Z2-7]{55}$/.test(value)) return `${network.explorerUrl}/account/${value}`;
  return null;
}

/** Truncated address with copy-to-clipboard and an explorer link for real Stellar keys. */
export function Address({ value, label = 'address', head = 4, tail = 4, explorer = true, className = '' }: { value: string; label?: string; head?: number; tail?: number; explorer?: boolean; className?: string }) {
  const [copied, setCopied] = useState(false);
  const url = explorer ? explorerUrl(value) : null;
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

/** Explorer link for a transaction hash. Demo hashes have no explorer page and render as plain text. */
export function TxLink({ hash, children, className = 'text-link', ariaLabel }: { hash: string; children?: ReactNode; className?: string; ariaLabel?: string }) {
  if (!hash) return null;
  if (hash.startsWith('mock-')) return <span className="subtle">Demo step</span>;
  return <a className={className} href={transactionUrl(hash)} target="_blank" rel="noreferrer" aria-label={ariaLabel}>{children ?? <>{shortAddress(hash, 6, 4)}<ExternalLink size={12} aria-hidden /></>}</a>;
}
