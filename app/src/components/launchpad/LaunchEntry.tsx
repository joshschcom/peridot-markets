'use client';
import Link from 'next/link';
import { useState } from 'react';
import { ArrowRight, Coins, Handshake, TrendingUp } from 'lucide-react';
import { Badge } from '@/components/ui/primitives';
import LaunchTokenForm from './LaunchTokenForm';
import IcoForm from './IcoForm';
import SimpleTokenForm from './SimpleTokenForm';
import { icoAvailable } from '@/lib/launchpad/config';
import { LaunchpadBadges, MainnetNotice, RiskNotice } from './LaunchpadFrame';

type Mode = 'choose' | 'simple' | 'curve' | 'ico';

/** Choose a simple token, bonding curve or fixed-price ICO. */
export default function LaunchEntry() {
  const [mode, setMode] = useState<Mode>('choose');
  const choose = (next: Mode) => { setMode(next); window.scrollTo(0, 0); };
  if (mode === 'ico') return <IcoForm onBack={() => choose('choose')} />;
  if (mode === 'simple') return <SimpleTokenForm onBack={() => choose('choose')} />;
  if (mode === 'curve') return <LaunchTokenForm onBack={() => choose('choose')} />;
  return <div className="page launch-page">
    <div className="page-heading">
      <div style={{ minWidth: 0 }}>
        <p className="eyebrow"><Link href="/tokens" className="row" style={{ gap: 6 }}>Launchpad</Link></p>
        <h1 className="lp-title">Launch a token <LaunchpadBadges /></h1>
        <p className="lead">Pick how you want to start. A plain token costs only the network fee. A bonding curve gives your token a price from day one and a lending market once it graduates.</p>
      </div>
    </div>
    <MainnetNotice />
    <div className="launch-choice-grid" role="group" aria-label="Launch type">
      <button type="button" className="launch-choice" onClick={() => choose('simple')} aria-label="Simple token (no curve, no ICO)">
        <span className="launch-choice-icon" aria-hidden><Coins size={22} /></span>
        <strong>Simple token (no curve, no ICO)</strong>
        <span className="muted">Just a token. One transaction mints the whole supply to you.</span><dl className="launch-choice-facts"><dt>Price</dt><dd>No price. Nothing is for sale.</dd><dt>Who can buy</dt><dd>Nobody, until you share or list the token.</dd><dt>You pay</dt><dd>Network fees only.</dd><dt>At the end</dt><dd>The whole supply is in your wallet from the start.</dd></dl>
        <span className="row" style={{ gap: 8 }}><Badge tone="accent">1 transaction</Badge><Badge>No launch fee</Badge></span>
        <span className="launch-choice-go">Create a simple token <ArrowRight size={15} aria-hidden /></span>
      </button>
      <button type="button" className="launch-choice" onClick={() => choose('curve')} aria-label="Bonding curve launch">
        <span className="launch-choice-icon" aria-hidden><TrendingUp size={22} /></span>
        <strong>Bonding curve launch</strong>
        <span className="muted">A live market from day one. The price moves with demand.</span><dl className="launch-choice-facts"><dt>Price</dt><dd>Rises automatically as people buy.</dd><dt>Who can buy</dt><dd>Anyone, from the first block.</dd><dt>You pay</dt><dd>Network fees. An optional first buy.</dd><dt>At the end</dt><dd>At the target it becomes a Peridot lending market.</dd></dl>
        <span className="row" style={{ gap: 8 }}><Badge tone="accent">1 transaction</Badge><Badge>Graduates to a market</Badge></span>
        <span className="launch-choice-go">Set up a curve launch <ArrowRight size={15} aria-hidden /></span>
      </button>
      <button type="button" className="launch-choice" onClick={() => choose('ico')} disabled={!icoAvailable()} aria-label="ICO fixed price sale">
        <span className="launch-choice-icon" aria-hidden><Handshake size={22} /></span>
        <strong>ICO (fixed price sale)</strong>
        <span className="muted">A fixed price, a minimum goal and a maximum raise.</span><dl className="launch-choice-facts"><dt>Price</dt><dd>Fixed by you.</dd><dt>Who can buy</dt><dd>Anyone, during a set time window.</dd><dt>You pay</dt><dd>Network fees.</dd><dt>At the end</dt><dd>Soft cap reached: buyers claim tokens. Soft cap missed: full refunds. Hard cap limits the raise.</dd></dl>
        <span className="row" style={{ gap: 8 }}><Badge tone="accent">Fixed price</Badge><Badge>Refund if it fails</Badge></span><span className="launch-choice-go">{icoAvailable() ? 'Set up an ICO' : 'Not live on this network yet'} <ArrowRight size={15} aria-hidden /></span>
      </button>
    </div>
    <RiskNotice />
  </div>;
}
