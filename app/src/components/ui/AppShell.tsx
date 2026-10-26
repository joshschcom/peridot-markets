'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowUpRight, BookOpen, ChevronDown, Eye, FileCode2, FlaskConical, GitBranch, Search, ShieldAlert, Wallet } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { getDeployments, network } from '@/lib/peridot/network';
import { useWallet } from '@/lib/peridot/wallet';
import { shortAddress, walletInfo } from '@/wallet/catalog';
import { reconcilePendingTransaction } from '@/lib/peridot/rpc';
import { ThemeToggle } from './ThemeToggle';
import { RecentTransactions } from './RecentTransactions';
import { NetworkSwitch } from './NetworkSwitch';

export const GITHUB_URL = 'https://github.com/joshschcom/peridot-markets';
/** Factory contract explorer link for the active network; demo mode has no manifest and shows nothing. */
function factoryExplorerUrl(): string | null {
  if (network.useMocks) return null;
  try { return `${network.explorerUrl}/contract/${getDeployments().factory}`; } catch { return null; }
}

/* Presentation-only shell. Wallet, network and recovery behaviour are the same calls as
 * components/peridot/AppShell.tsx; only the markup, badges and theme toggle differ. */
const links = [
  { href: '/groups', label: 'Explore', match: (p: string) => p.startsWith('/groups') },
  { href: '/launch', label: 'Launch', match: (p: string) => p === '/launch' },
  { href: '/vaults', label: 'Vaults', match: (p: string) => p.startsWith('/vaults') },
  { href: '/tokens', label: 'Launchpad', match: (p: string) => p.startsWith('/tokens') || p.startsWith('/token/') || p === '/launch-token' },
  { href: '/about', label: 'How it works', match: (p: string) => p === '/about' },
];

export function AppShell({ children }: { children: ReactNode }) {
  const wallet = useWallet();
  const path = usePathname();
  const [recovery, setRecovery] = useState('');
  const bannerText = network.useMocks ? 'Demo data. No funds move and no wallet signatures are requested.' : network.readOnly ? 'Read-only preview. Transactions are not enabled.' : 'Beta. New contracts are unaudited. Caps apply.';
  const BannerIcon = network.useMocks ? FlaskConical : network.readOnly ? Eye : ShieldAlert;
  const nav = links.map(l => <Link key={l.href} className={l.match(path) ? 'active' : ''} href={l.href} aria-current={l.match(path) ? 'page' : undefined}>{l.label}</Link>);
  return <div className="shell">
    <div className={`network-banner${network.useMocks ? ' demo' : ''}`} role="note"><BannerIcon size={14} aria-hidden />{bannerText}</div>
    <header className="site-header">
      <div className="site-header-inner">
        <Link href="/" className="wordmark" aria-label="SuperMarkets home"><img src="/logo-optimized.svg" alt="" width="26" height="30" />Super<span>Markets</span></Link>
        <nav className="site-nav" aria-label="Main navigation">{nav}</nav>
        <div className="header-actions">
          <NetworkSwitch />
          <button className={`button wallet-button${wallet.address ? ' connected' : ''}`} disabled={wallet.isConnecting||(!wallet.isReady&&!wallet.error)} onClick={wallet.openModal} aria-haspopup="dialog">
            <Wallet size={15} aria-hidden />
            {wallet.address ? network.useMocks ? 'Demo account' : <><span className="wallet-name">{walletInfo(wallet.walletId)?.name} </span>{shortAddress(wallet.address)}</> : wallet.isConnecting ? 'Connecting' : !wallet.isReady && !wallet.error ? 'Loading wallet...' : 'Connect wallet'}
            {wallet.address && <ChevronDown size={13} aria-hidden />}
          </button>
          {wallet.isConnecting && <button className="button ghost" onClick={wallet.disconnect}>Cancel</button>}
          <ThemeToggle />
          <RecentTransactions />
        </div>
      </div>
    </header>
    <nav className="mobile-nav" aria-label="Main navigation (mobile)"><div className="mobile-nav-links">{nav}</div><NetworkSwitch where="mobile-nav" /></nav>
    {(wallet.error || wallet.networkMismatch) && <div className="wallet-alert" role="alert">{wallet.error || `Switch your wallet to ${network.name} before signing, then return to this page. If this message stays, disconnect and connect again.`}</div>}
    <main className="site-main" id="main-content" tabIndex={-1}>{children}</main>
    <footer className="site-footer">
      <div className="site-footer-inner">
        <div className="site-footer-cols">
          <div className="site-footer-col">
            <strong>SuperMarkets</strong>
            <span>Isolated money markets by Peridot. Built on Stellar, composed with Reflector, DeFindex, Blend and Aquarius.</span>
            <span className="site-footer-net"><span className={`live-dot${network.name === 'testnet' ? ' testnet' : ''}`} aria-hidden />{network.useMocks ? 'Demo data' : network.name === 'mainnet' ? 'Stellar mainnet, beta' : 'Stellar testnet'}</span>
          </div>
          <nav className="site-footer-col" aria-label="Product">
            <strong>Product</strong>
            <Link href="/groups">Explore groups</Link>
            <Link href="/launch">Launch a market</Link>
            <Link href="/tokens">Launchpad</Link>
            <Link href="/vaults">Vaults</Link>
          </nav>
          <nav className="site-footer-col" aria-label="Documentation">
            <strong>Learn</strong>
            <Link href="/about"><BookOpen size={13} aria-hidden /> How it works</Link>
            <a href={`${GITHUB_URL}/blob/main/docs/ARCHITECTURE.md`} target="_blank" rel="noreferrer"><FileCode2 size={13} aria-hidden /> Architecture <ArrowUpRight size={12} aria-hidden /></a>
            <a href={`${GITHUB_URL}/blob/main/docs/SPECS.md`} target="_blank" rel="noreferrer"><FileCode2 size={13} aria-hidden /> Contract specs <ArrowUpRight size={12} aria-hidden /></a>
            <a href={GITHUB_URL} target="_blank" rel="noreferrer"><GitBranch size={13} aria-hidden /> GitHub <ArrowUpRight size={12} aria-hidden /></a>
          </nav>
          <div className="site-footer-col">
            <strong>On chain</strong>
            {factoryExplorerUrl() ? <a href={factoryExplorerUrl()!} target="_blank" rel="noreferrer"><Search size={13} aria-hidden /> Factory on stellar.expert <ArrowUpRight size={12} aria-hidden /></a> : <span>Demo mode: no contracts are called.</span>}
            {wallet.address && !network.useMocks && <button onClick={() => void reconcilePendingTransaction(wallet.address!).then(s => setRecovery(`Previous transaction: ${s}. Refresh the current page before continuing.`)).catch(e => setRecovery(e.message))}>Check pending transaction</button>}
            {recovery && <p role="status">{recovery}</p>}
          </div>
        </div>
        <p>Beta. New contracts are unaudited. Caps apply. Core lending contracts are Peridot&apos;s audited contracts with 60 second timelocks. Blend, DeFindex, Aquarius and Reflector are venues Peridot routes into, not products of Peridot.</p>
      </div>
    </footer>
  </div>;
}
