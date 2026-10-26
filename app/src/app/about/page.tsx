import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, Coins, Gift, Sprout } from 'lucide-react';

export const metadata: Metadata = { title: 'How it works | Peridot Markets', description: 'How an isolated Peridot market group composes yield, prices and rewards, and which parts are audited prior work versus new hackathon contracts.' };

export default function AboutPage() {
  return <div className="page">
    <div className="page-heading"><div><p className="eyebrow">Peridot Markets</p><h1>One group. Three ways to compose.</h1><p className="lead">An isolated lending market connects to a yield venue, a price source and a funded reward token through shared interfaces.</p></div></div>
    <div className="feature-grid">
      <article className="card feature"><span className="feature-icon"><Sprout size={18} aria-hidden /></span><h3>Yield</h3><p>Keep a liquid buffer (10% to 100%). Route eligible idle deposits through the vault interface into allowlisted DeFindex vaults or Blend fee vaults.</p></article>
      <article className="card feature"><span className="feature-icon"><Coins size={18} aria-hidden /></span><h3>Prices</h3><p>Reflector feeds with an explicit token, oracle and asset mapping approved by the factory. Guardrails bound the risk a group owner can select.</p></article>
      <article className="card feature"><span className="feature-icon"><Gift size={18} aria-hidden /></span><h3>Rewards</h3><p>Fund a group reward token and choose emissions per market. Rewards are enabled last because they lock the market list.</p></article>
    </div>
    <section className="card">
      <div className="card-header"><div><h2>Prior work, clearly separated</h2><p>Core lending contracts are Peridot&apos;s audited contracts with one change for the hackathon: upgrade and admin-parameter timelocks shortened from 24h to 60s. New contracts are unaudited.</p></div></div>
      <div className="table-scroll"><table className="data-table"><thead><tr><th>Before HackMeridian</th><th>This build</th></tr></thead><tbody>
        <tr><td data-label="Before">Peridot lending, margin V3 and yield contracts</td><td data-label="This build">Factories and configurable isolated groups</td></tr>
        <tr><td data-label="Before">Peridot dashboard and V2 frontend references</td><td data-label="This build">Launch wizard and group-specific screens</td></tr>
        <tr><td data-label="Before">Lending and margin liquidator code</td><td data-label="This build">New group configuration and operations</td></tr>
      </tbody></table></div>
      <p className="subtle mt-4" style={{ fontSize: 12 }}>This table describes scope. Completed milestones require deployment and transaction evidence.</p>
    </section>
    <section className="card">
      <h2>Built to grow in phases</h2>
      <p className="muted">Phase 1 connects lending, rewards and optional margin with DeFindex and Blend routes. Later phases add Aquarius with a capped loss reserve, more price modes, Zenex, XOXNO and a hosted keeper service. Loss cover is limited to the reserve balance.</p>
      <Link className="button mt-2" href="/launch">Explore the launch wizard <ArrowRight size={16} aria-hidden /></Link>
    </section>
  </div>;
}
