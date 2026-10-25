'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowUpRight, ChevronDown, CircleDot, Wallet } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { network } from '@/lib/peridot/network';
import { useWallet } from '@/lib/peridot/wallet';
import { reconcilePendingTransaction } from '@/lib/peridot/rpc';

export function AppShell({ children }: { children: ReactNode }) {
  const wallet = useWallet();
  const path = usePathname();
  const [recovery, setRecovery] = useState('');
  return <>
    <div className="network-banner"><span className="live-dot" />{network.useMocks ? 'Demo data. No funds move and no wallet signatures are requested.' : network.readOnly ? 'Read-only preview. Transactions are not enabled.' : 'Beta. New contracts are unaudited. Caps apply.'}</div>
    <header className="site-header">
      <Link href="/" className="wordmark" aria-label="Peridot Markets home"><img src="/logo-optimized.svg" alt="" width="28" height="32" /> peridot<span>markets</span></Link>
      <nav aria-label="Main navigation"><Link className={path.startsWith('/groups') ? 'active' : ''} href="/groups">Explore</Link><Link className={path === '/launch' ? 'active' : ''} href="/launch">Launch</Link><Link className={path === '/about' ? 'active' : ''} href="/about">How it works</Link></nav>
      <div className="header-actions"><span className="network-label"><CircleDot size={12}/>{network.name}{network.useMocks ? ' demo' : ''}</span>{!network.useMocks&&<select aria-label="Wallet provider" value={wallet.walletId} disabled={wallet.isConnecting||!!wallet.address} onChange={e=>wallet.selectWallet(e.target.value as 'albedo'|'freighter')} style={{background:'var(--surface)',color:'inherit',border:'1px solid var(--border)',borderRadius:8,padding:'8px 6px',maxWidth:100}}><option value="albedo">Albedo</option><option value="freighter">Freighter</option></select>}<button className="button wallet-button" disabled={wallet.isConnecting} onClick={() => wallet.address ? wallet.disconnect() : void wallet.connect()}><Wallet size={15}/>{wallet.address ? network.useMocks ? 'Demo account' : `${wallet.address.slice(0,4)}…${wallet.address.slice(-4)}` : wallet.isConnecting ? 'Connecting' : 'Connect wallet'}{wallet.address && <ChevronDown size={13}/>}</button>{wallet.isConnecting&&<button className="button ghost" onClick={wallet.disconnect}>Cancel</button>}</div>
    </header>
    {(wallet.error || wallet.networkMismatch) && <div className="wallet-alert" role="alert">{wallet.error || `Switch your wallet to ${network.name} before signing.`}</div>}
    <main className="site-main">{children}</main>
    <footer className="site-footer"><span>Built on Stellar. Composed with its ecosystem.</span><div><Link href="/about">Prior work & architecture <ArrowUpRight size={13}/></Link>{wallet.address && !network.useMocks && <button onClick={() => void reconcilePendingTransaction(wallet.address!).then(s => setRecovery(`Previous transaction: ${s}. Refresh the current page before continuing.`)).catch(e => setRecovery(e.message))}>Check pending transaction</button>}</div>{recovery && <p role="status">{recovery}</p>}</footer>
  </>;
}
