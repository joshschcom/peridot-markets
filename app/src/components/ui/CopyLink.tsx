'use client';
import { useState } from 'react';
import { Check, Link2 } from 'lucide-react';
import { network } from '@/lib/peridot/network';
import { shareUrl } from '@/lib/ui/share-url';

/** "Copy link" button for sharing a page. Falls back silently when the clipboard is blocked. */
export function CopyLink({ label = 'Copy link', className = 'button secondary' }: { label?: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl(window.location.origin, window.location.pathname, network.name, network.useMocks));
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch { /* Clipboard access can be denied; the address bar still has the link. */ }
  };
  return <button type="button" className={className} onClick={copy} aria-live="polite" aria-label={copied ? 'Link copied' : `${label} to this page`}>
    {copied ? <Check size={14} aria-hidden /> : <Link2 size={14} aria-hidden />}{copied ? 'Copied' : label}
  </button>;
}
