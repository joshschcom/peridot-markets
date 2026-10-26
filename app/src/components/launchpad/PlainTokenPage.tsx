'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowLeft, Lightbulb } from 'lucide-react';
import { useWallet } from '@/lib/peridot/wallet';
import { Badge, KeyValue, Notice, Stat } from '@/components/ui/primitives';
import { fmtAmount, fmtDate } from '@/components/ui/format';
import { getTokenBalance, getTokenMeta, type TokenBalance, type TokenMeta } from '@/lib/launchpad/client';
import type { PlainTokenInfo } from '@/lib/launchpad/types';
import { LpAddress } from './LpAddress';
import { LaunchpadBadges, MainnetNotice, RiskNotice, TokenIcon, TypeBadge } from './LaunchpadFrame';

/** Token page for a simple (no curve) token: facts, the wallet balance and a hint about a later Peridot market. */
export default function PlainTokenPage({ info }: { info: PlainTokenInfo }) {
  const wallet = useWallet();
  const [balance, setBalance] = useState<TokenBalance | null>(null);
  const [meta, setMeta] = useState<TokenMeta | null>(null);
  useEffect(() => { getTokenMeta(info.token).then(setMeta).catch(() => setMeta(null)); }, [info.token]);
  useEffect(() => {
    if (!wallet.address) { setBalance(null); return; }
    let alive = true;
    getTokenBalance(info.token, wallet.address).then(b => { if (alive) setBalance(b); }).catch(() => { if (alive) setBalance(null); });
    return () => { alive = false; };
  }, [info.token, wallet.address]);
  return <div className="page">
    <header className="page-heading">
      <div style={{ minWidth: 0 }}>
        <p className="eyebrow"><Link href="/tokens" className="row" style={{ gap: 6 }}><ArrowLeft size={12} aria-hidden />Simple token #{info.id}</Link></p>
        <h1 className="lp-title"><TokenIcon symbol={info.symbol} uri={meta?.metadataUri} large />{info.name} <Badge>{info.symbol}</Badge> <TypeBadge type="simple" /> <LaunchpadBadges /></h1>
        <div className="lp-meta"><span>Token <LpAddress value={info.token} label="token address" /></span><span>Creator <LpAddress value={info.creator} label="creator address" /></span><span>Created {fmtDate(info.created_at)}</span></div>
      </div>
    </header>
    <MainnetNotice />
    <section className="card" aria-label="Token facts">
      <div className="token-stats">
        <Stat label="Total supply" value={fmtAmount(info.supply, 7, 0)} unit={info.symbol} hint="Fixed, nobody can mint more" />
        <Stat label="Decimals" value="7" />
        <Stat label="Type" value="Simple token" hint="No curve, no ICO" />
        <Stat label="Your balance" value={balance ? fmtAmount(balance.balance, 7, 2) : wallet.address ? '...' : 'Connect wallet'} unit={balance ? info.symbol : undefined} />
      </div>
    </section>
    <div className="two-col token-layout">
      <div className="stack">
        <Notice tone="info" role="note" title="Later: add a Peridot market"><p>This token has no price yet. When you want it to be lendable, seed an Aquarius pool for it and add it to a Peridot market group, so it can be supplied and borrowed. Its 7 decimals already fit the market rules.</p></Notice>
        <section className="card"><div className="card-header"><div><h2>Why no chart?</h2><p>A simple token has no curve and no built-in market, so there is no price to chart until it trades somewhere.</p></div><Lightbulb size={18} aria-hidden /></div></section>
      </div>
      <aside className="stack sticky-aside">
        <RiskNotice />
        <section className="card" aria-label="About this token"><div className="card-header" style={{ marginBottom: 10 }}><div><h2>About</h2><p>{info.name} ({info.symbol}), 7 decimals.</p></div></div>
          <KeyValue rows={[['Total supply', `${fmtAmount(info.supply, 7, 0)} ${info.symbol}`], ['Minted to', <LpAddress key="c" value={info.creator} label="creator address" />], ['Mint, admin, freeze', 'None']]} />
          <p className="subtle mt-4" style={{ fontSize: 12 }}>The whole supply was minted to the creator when the token was created. The token contract is immutable.</p>
        </section>
      </aside>
    </div>
  </div>;
}
