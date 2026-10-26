'use client';
import { useEffect, useId, useRef, useState } from 'react';
import { ShieldAlert } from 'lucide-react';
import { acknowledge, hasAcknowledged } from '@/lib/ui/risk-disclaimer';
import './qol.css';

/* One-time risk disclaimer. Adapted from PeridotV2Full 86ae3795 components/RiskDisclaimerModal.tsx:
 * same idea (modal, checkbox gate, localStorage flag) with the EVM wallet gate, click-outside and
 * Escape dismissal removed (acceptance is the only way out), a focus trap added and the text written
 * for Peridot Markets on Stellar. Renders nothing on the server and opens from an effect, so there is
 * no hydration mismatch. Storage key and version live in lib/ui/risk-disclaimer.ts. */
function storage(): Storage | null {
  try { return window.localStorage; } catch { return null; }
}

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function RiskDisclaimer() {
  const [open, setOpen] = useState(false);
  const [checked, setChecked] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useId(), descId = useId(), checkId = useId();

  useEffect(() => { if (!hasAcknowledged(storage())) setOpen(true); }, []);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const bodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialogRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      const dialog = dialogRef.current;
      if (!dialog) return;
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); return; }
      if (event.key !== 'Tab') return;
      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (focusable.length === 0) { event.preventDefault(); return; }
      const first = focusable[0], last = focusable[focusable.length - 1], current = document.activeElement;
      if (!dialog.contains(current)) { event.preventDefault(); first.focus(); return; }
      if (event.shiftKey && (current === first || current === dialog)) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && current === last) { event.preventDefault(); first.focus(); }
    };
    const onFocusIn = (event: FocusEvent) => {
      if (dialogRef.current && !dialogRef.current.contains(event.target as Node)) dialogRef.current.focus();
    };
    document.addEventListener('keydown', onKeyDown, true);
    document.addEventListener('focusin', onFocusIn);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      document.removeEventListener('focusin', onFocusIn);
      document.body.style.overflow = bodyOverflow;
      previous?.focus?.();
    };
  }, [open]);

  if (!open) return null;
  const accept = () => {
    if (!checked) return;
    acknowledge(storage()); // A storage failure only means the dialog returns on the next visit.
    setOpen(false);
  };

  return <div className="disclaimer-backdrop">
    <div ref={dialogRef} className="disclaimer" role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={descId} tabIndex={-1}>
      <header className="disclaimer-head">
        <span className="disclaimer-icon"><ShieldAlert size={20} aria-hidden /></span>
        <div><p className="eyebrow">Before you continue</p><h2 id={titleId}>Peridot Markets is a beta</h2></div>
      </header>
      <div className="disclaimer-body" id={descId} tabIndex={0} aria-label="Risk disclaimer text">
        <p>Please read this once. It explains what you are using and what can go wrong.</p>
        <h3>What this is</h3>
        <ul>
          <li><strong>Beta software.</strong> Peridot Markets runs on Stellar mainnet as a beta. The new contracts (market factory, margin, yield adapters and launchpad) are unaudited, and supply and borrow caps apply.</li>
          <li><strong>Audited core.</strong> The core lending contracts are Peridot&apos;s audited contracts. Owner and admin parameter changes wait behind 60 second timelocks.</li>
          <li><strong>Isolated groups.</strong> Each market group is isolated from the others. Its owner configures risk settings, price sources and yield routes. Check who owns a group before you use it.</li>
        </ul>
        <h3>What can go wrong</h3>
        <ul>
          <li><strong>Liquidation.</strong> A borrowing account can be liquidated when its debt exceeds the value of its enabled collateral times the collateral factor.</li>
          <li><strong>Leverage.</strong> A leveraged position can lose the whole margin. Fees and slippage reduce what comes back.</li>
          <li><strong>Prices, pools and routes.</strong> Price feeds can go stale, pools can move against you and yield routes can pause or lose value.</li>
          <li><strong>Launchpad tokens.</strong> Tokens launched on the testnet launchpad are experiments. They have no value and no promise of one.</li>
          <li><strong>Loss of funds.</strong> Smart contracts can contain bugs. You may lose some or all of the funds you use here.</li>
        </ul>
        <h3>Your responsibility</h3>
        <p>Nothing on this site is financial advice. Peridot Markets does not recommend any asset, group or strategy. You decide what to do, you review every transaction in your wallet before you sign it, and you should not use funds you cannot afford to lose.</p>
      </div>
      <footer className="disclaimer-foot">
        <label className="check" htmlFor={checkId}>
          <input id={checkId} type="checkbox" checked={checked} onChange={event => setChecked(event.target.checked)} />
          <span>I understand the risks and I accept them.</span>
        </label>
        <button type="button" className="button block" disabled={!checked} onClick={accept}>Accept and continue</button>
        <span className="field-hint">Shown once per browser. It returns when this text changes.</span>
      </footer>
    </div>
  </div>;
}
