'use client';
import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { network, buildDefaultNetwork } from '@/lib/peridot/network';
import { NETWORK_URL_PARAM, storeNetworkChoice, type NetworkName } from '@/lib/peridot/network-select';
import { disconnectKit } from '@/wallet/kit';
import './network-switch.css';

const LABEL: Record<NetworkName, string> = { mainnet: 'Mainnet', testnet: 'Testnet' };
const NOTE: Record<NetworkName, string> = {
  mainnet: 'Real funds. Beta, unaudited contracts, caps apply.',
  testnet: 'Testnet uses free test tokens, launchpad demo lives here.',
};

/** Header network pill. The server and the first client render show the build default; the real choice appears after mount.
 * Switching stores the choice, disconnects the wallet and reloads so every module-level singleton restarts on the new network. */
export function NetworkSwitch({ where = 'header' }: { where?: 'header' | 'mobile-nav' }) {
  const [active, setActive] = useState<NetworkName>(buildDefaultNetwork);
  const [open, setOpen] = useState(false);
  const [top, setTop] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => { setActive(network.name); }, []);
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (root.current && !root.current.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    const close = () => setOpen(false);
    document.addEventListener('mousedown', away); document.addEventListener('keydown', esc); window.addEventListener('scroll', close, { passive: true });
    return () => { document.removeEventListener('mousedown', away); document.removeEventListener('keydown', esc); window.removeEventListener('scroll', close); };
  }, [open]);

  const choose = async (next: NetworkName) => {
    setOpen(false);
    if (next === network.name) return;
    // Never keep a signer for the wrong network: drop the wallet session before the reload (best effort).
    try { await Promise.race([disconnectKit(), new Promise(r => setTimeout(r, 1500))]); } catch { /* The reload also clears in-memory wallet state. */ }
    storeNetworkChoice(next);
    const url = new URL(window.location.href);
    url.searchParams.delete(NETWORK_URL_PARAM); // A stale ?network= would override the new choice.
    if (url.href === window.location.href) window.location.reload(); else window.location.assign(url.href);
  };

  return <div className={`network-switch in-${where}`} ref={root}>
    <button type="button" className={`network-pill ${active}`} aria-haspopup="menu" aria-expanded={open} aria-label={`Network: ${LABEL[active]}. Change network`} title="Change network" onClick={e => { setTop(e.currentTarget.getBoundingClientRect().bottom + 8); setOpen(o => !o); }}>
      <span className="live-dot" aria-hidden />{LABEL[active]}{active === 'testnet' && <span className="network-tag">TEST</span>}<ChevronDown size={12} aria-hidden />
    </button>
    {open && <div className="network-menu" role="menu" aria-label="Choose network" style={{ '--nm-top': `${top}px` } as React.CSSProperties}>
      {(['mainnet', 'testnet'] as const).map(n => <button key={n} type="button" role="menuitemradio" aria-checked={network.name === n} className={`network-option ${n}`} onClick={() => void choose(n)}>
        <span className="network-option-head"><span>{LABEL[n]}</span>{network.name === n && <Check size={14} aria-hidden />}</span>
        <span className="network-option-note">{NOTE[n]}</span>
      </button>)}
      <p className="network-menu-foot">Switching reloads the page and disconnects your wallet.</p>
    </div>}
  </div>;
}
