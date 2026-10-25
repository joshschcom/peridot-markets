'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowUpRight, ChevronDown, Eye, FlaskConical, ShieldAlert, Wallet } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { network } from '@/lib/peridot/network';
import { useWallet } from '@/lib/peridot/wallet';
import { reconcilePendingTransaction } from '@/lib/peridot/rpc';
import { ThemeToggle } from './ThemeToggle';

/* Presentation-only shell. Wallet, network and recovery behaviour are the same calls as
 * components/peridot/AppShell.tsx; only the markup, badges and theme toggle differ. */
const links = [
  { href: '/groups', label: 'Explore', match: (p: string) => p.startsWith('/groups') },
  { href: '/launch', label: 'Launch', match: (p: string) => p === '/launch' },
  { href: '/tokens', label: 'Launchpad', match: (p: string) => p.startsWith('/tokens') || p.startsWith('/token/') || p === '/launch-token' },
  { href: '/about', label: 'How it works', match: (p: string) => p === '/about' },
];

export function AppShell({ children }: { children: ReactNode }) {
  const wallet = useWallet();
  const path = usePathname();
  const [recovery, setRecovery] = useState('');
  const bannerText = network.useMocks ? 'Demo data. No funds move and no wallet signatures are requested.' : network.readOnly ? 'Read-only preview. Transactions are not enabled.' : 'Beta. New contracts are unaudited. Caps apply.';
  const BannerIcon = network.useMocks ? FlaskConical : network.readOnly ? Eye : ShieldAlert;
  const networkLabel = network.useMocks ? 'Demo' : network.name === 'mainnet' ? 'Mainnet beta' : 'Testnet';
  const nav = links.map(l => <Link key={l.href} className={l.match(path) ? 'active' : ''} href={l.href} aria-current={l.match(path) ? 'page' : undefined}>{l.label}</Link>);
  return <div className="shell">
    <div className={`network-banner${network.useMocks ? ' demo' : ''}`} role="note"><BannerIcon size={14} aria-hidden />{bannerText}</div>
    <header className="site-header">
      <div className="site-header-inner">
        <Link href="/" className="wordmark" aria-label="Peridot Markets home"><img src="/logo-optimized.svg" alt="" width="26" height="30" />peridot<span>markets</span></Link>
        <nav className="site-nav" aria-label="Main navigation">{nav}</nav>
        <div className="header-actions">
          <span className="badge accent" title={`Network: ${network.name}`}><span className="live-dot" aria-hidden />{networkLabel}</span>
          {!network.useMocks && <select aria-label="Wallet provider" value={wallet.walletId} disabled={wallet.isConnecting || !!wallet.address} onChange={e => wallet.selectWallet(e.target.value as 'albedo' | 'freighter')}><option value="albedo">Albedo</option><option value="freighter">Freighter</option></select>}
          <button className={`button wallet-button${wallet.address ? ' connected' : ''}`} disabled={wallet.isConnecting||!wallet.isReady} onClick={() => wallet.address ? wallet.disconnect() : void wallet.connect()}>
            <Wallet size={15} aria-hidden />
            {wallet.address ? network.useMocks ? 'Demo account' : `${wallet.address.slice(0, 4)}…${wallet.address.slice(-4)}` : wallet.isConnecting ? 'Connecting' : !wallet.isReady ? 'Loading wallet...' : 'Connect wallet'}
            {wallet.address && <ChevronDown size={13} aria-hidden />}
          </button>
          {wallet.isConnecting && <button className="button ghost" onClick={wallet.disconnect}>Cancel</button>}
          <ThemeToggle />
        </div>
      </div>
    </header>
    <nav className="mobile-nav" aria-label="Main navigation (mobile)">{nav}<span className="badge accent"><span className="live-dot" aria-hidden />{networkLabel}</span></nav>
    {(wallet.error || wallet.networkMismatch) && <div className="wallet-alert" role="alert">{wallet.error || `Switch your wallet to ${network.name} before signing.`}</div>}
    <main className="site-main">{children}</main>
    <footer className="site-footer">
      <div className="site-footer-inner">
        <span>Built on Stellar. Composed with Reflector, DeFindex, Blend and Aquarius.</span>
        <div>
          <Link href="/about">Prior work and architecture <ArrowUpRight size={13} aria-hidden /></Link>
          {wallet.address && !network.useMocks && <button onClick={() => void reconcilePendingTransaction(wallet.address!).then(s => setRecovery(`Previous transaction: ${s}. Refresh the current page before continuing.`)).catch(e => setRecovery(e.message))}>Check pending transaction</button>}
        </div>
        {recovery && <p role="status">{recovery}</p>}
        <p>Beta. New contracts are unaudited. Caps apply. Core lending contracts are Peridot&apos;s audited contracts with 60 second timelocks.</p>
      </div>
    </footer>
  </div>;
}
