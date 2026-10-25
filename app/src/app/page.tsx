import Link from 'next/link';
import { ArrowRight, ArrowUpRight, Coins, Layers3, Scale, SlidersHorizontal, Sprout, ShieldCheck } from 'lucide-react';
import { network } from '@/lib/peridot/network';
import { GroupCards } from '@/components/markets/GroupOverview';

export default function HomePage() {
  return <div className="home-page">
    <section className="hero">
      <p className="eyebrow"><span className="live-dot" aria-hidden /> Open money markets on Stellar</p>
      <h1>Any Stellar token gets its own <span>money market</span>.</h1>
      <p className="lead">Any Stellar token gets its own money market in a few transactions: lending, borrowing, leverage and rewards, with idle liquidity routed into the best yield on Stellar.</p>
      <div className="hero-actions">
        <Link className="button large" href="/launch">Launch a market <ArrowUpRight size={18} aria-hidden /></Link>
        <Link className="button large ghost" href="/groups">Explore groups <ArrowRight size={17} aria-hidden /></Link>
      </div>
      <div className="hero-facts">
        <span><ShieldCheck size={15} aria-hidden /> Audited Peridot core, 60 second timelocks</span>
        <span><Coins size={15} aria-hidden /> Reflector prices</span>
        <span><Sprout size={15} aria-hidden /> DeFindex and Blend yield routes</span>
        <span><Scale size={15} aria-hidden /> Aquarius pools for leverage</span>
      </div>
    </section>

    <section className="section" aria-labelledby="live-groups">
      <div className="section-head">
        <div><h2 id="live-groups">{network.useMocks ? 'Demo groups' : 'Live groups'}</h2><p>Isolated lending groups created through the factory. Each one has its own markets, prices, caps and owner.</p></div>
        <Link className="text-link" href="/groups">All groups <ArrowRight size={14} aria-hidden /></Link>
      </div>
      <GroupCards limit={3} />
      <p className="subtle" style={{ fontSize: 12 }}>Beta. New contracts are unaudited. Caps apply.{network.useMocks ? ' Demo balances are simulated and are not mainnet evidence.' : ''}</p>
    </section>

    <section className="section" aria-labelledby="how">
      <div className="section-head"><div><h2 id="how">One group, three transactions per market</h2><p>Create the group, add each market, activate it and attach its yield route. Rewards come last.</p></div></div>
      <div className="feature-grid">
        <article className="card feature"><span className="feature-icon"><Layers3 size={18} aria-hidden /></span><h3>Launch an isolated group</h3><p>Choose assets, collateral factors (max 75%) and caps. Each community keeps its lending risk in its own group with its own owner.</p></article>
        <article className="card feature"><span className="feature-icon"><Sprout size={18} aria-hidden /></span><h3>Put idle liquidity to work</h3><p>Keep 10% to 100% liquid for withdrawals and borrowing. The rest is routed into an allowlisted DeFindex vault or Blend fee vault.</p></article>
        <article className="card feature"><span className="feature-icon"><SlidersHorizontal size={18} aria-hidden /></span><h3>Keep control as you grow</h3><p>Adjust rates, caps, buffers, prices, pauses and leverage from the owner Control Panel. Sensitive changes wait 60 seconds.</p></article>
      </div>
    </section>

    <section className="section">
      <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 20, flexWrap: 'wrap', padding: 28 }}>
        <div>
          <p className="eyebrow">Composed with Stellar</p>
          <div className="partner-strip"><strong>Reflector</strong><i /><strong>DeFindex</strong><i /><strong>Blend</strong><i /><strong>Aquarius</strong><i /><span>Zenex and XOXNO on the roadmap</span></div>
        </div>
        <Link className="button" href="/about">How it works <ArrowRight size={16} aria-hidden /></Link>
      </div>
    </section>
  </div>;
}
