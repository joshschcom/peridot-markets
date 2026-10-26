import Link from 'next/link';
import { ArrowRight, ArrowUpRight, BookOpen, Check, Coins, FileCode2, GitBranch, Layers3, Lock, Rocket, Scale, SearchX, ShieldCheck, SlidersHorizontal, Sprout, Unplug, Users, Waves } from 'lucide-react';
import { StepArt } from './StepArt';
import './home.css';

export const GITHUB_URL = 'https://github.com/joshschcom/peridot-markets';

/* ------------------------------------------------------------------ Hero */
export function Hero() {
  return <section className="home-hero" aria-labelledby="home-title">
    <div className="home-wrap">
      <div className="home-hero-grid">
        <div>
          <p className="eyebrow"><span className="live-dot" aria-hidden /> Lending and leverage on Stellar Soroban</p>
          <h1 id="home-title">Every Stellar project gets its own <em>isolated money market</em>.</h1>
          <p className="home-lead">Peridot Markets gives any project, even a token launched today, a lending group it owns: a guarded price feed, lending and borrowing, optional yield vaults and up to 5x leverage. If one market fails, only that group feels it.</p>
          <div className="home-cta">
            <Link className="button large" href="/groups">Explore markets <ArrowRight size={17} aria-hidden /></Link>
            <Link className="button large ghost" href="/launch-token">Launch a token <Rocket size={16} aria-hidden /></Link>
          </div>
          <p className="home-hero-note">Already have a token? <Link href="/launch">Launch its market</Link> in a few transactions. Mainnet beta, capped markets.</p>
          <div className="home-facts">
            <span><ShieldCheck size={15} aria-hidden /> Audited Peridot core</span>
            <span><Coins size={15} aria-hidden /> Reflector or Aquarius pricing with guards</span>
            <span><Sprout size={15} aria-hidden /> Blend and DeFindex vaults</span>
            <span><Scale size={15} aria-hidden /> Leverage per market</span>
          </div>
        </div>
        <GroupAnatomy />
      </div>
    </div>
  </section>;
}

/** One group, drawn with CSS boxes: what a project gets, and what stays outside its walls. */
function GroupAnatomy() {
  return <figure className="home-diagram" aria-label="Anatomy of one isolated market group: its own markets, price router, yield vault and leverage, separated from other groups">
    <div className="home-group ghost" aria-hidden>
      <div className="home-group-head"><strong><Layers3 size={14} /> Group 1 · Meridian</strong><span>USDC · XLM</span></div>
    </div>
    <div className="home-wall" aria-hidden>no shared risk</div>
    <div className="home-group">
      <div className="home-group-head"><strong><Layers3 size={15} aria-hidden /> Group · YOURTOKEN</strong><span>owner: your wallet</span></div>
      <div className="home-group-markets">
        <div className="home-market"><b>YTK <span>CF 50%</span></b><span>Supply cap 2M · borrow cap 200k</span><span>Price: Aquarius pool, step guard</span></div>
        <div className="home-market"><b>USDC <span>CF 75%</span></b><span>Stable rate curve, 20% liquid</span><span>Price: Reflector feed</span></div>
      </div>
      <div className="home-group-plugs">
        <div className="home-plug"><b>Yield vault</b>idle USDC routed to Blend</div>
        <div className="home-plug"><b>Leverage</b>3x long and short, YTK and USDC</div>
        <div className="home-plug"><b>Rewards</b>emissions paid in YTK</div>
      </div>
    </div>
    <div className="home-wall" aria-hidden>no shared risk</div>
    <div className="home-group ghost" aria-hidden>
      <div className="home-group-head"><strong><Layers3 size={14} /> Group 3 · BlendDemo</strong><span>XLM</span></div>
    </div>
    <figcaption className="home-diagram-caption">Each group has its own controller, price router, markets, caps and owner. Nothing is pooled with other groups.</figcaption>
  </figure>;
}

/* --------------------------------------------------------------- Problem */
const pains = [
  { icon: SearchX, title: 'No lending market', body: 'Holders cannot borrow against a new token or earn interest on it. Getting listed on a shared protocol means governance votes, risk reviews and audits before anyone even looks.' },
  { icon: Unplug, title: 'No trustworthy price', body: 'A fresh token has no oracle feed. Without a safe price there is no collateral value and no liquidation, so no lender will touch it.' },
  { icon: Waves, title: 'Shared pools share the damage', body: 'In one big pool every asset backs every loan. A single manipulated or illiquid token can leave bad debt for all depositors, so pools stay closed to new assets.' },
  { icon: Users, title: 'Nothing to offer holders', body: 'No leverage, no yield on idle deposits, no rewards paid in the project token. Launching the token is only half of the job.' },
];

export function Problem() {
  return <section className="home-section" aria-labelledby="home-problem">
    <div className="home-wrap">
      <div className="home-head">
        <p className="eyebrow">The problem for projects</p>
        <h2 id="home-problem">Launching a token is only half the job.</h2>
        <p>A new token on Stellar can trade on day one, but it cannot be lent, borrowed or used as collateral. And the usual fix, listing it in a shared pool, puts everyone else at risk.</p>
      </div>
      <div className="home-pain-grid">
        {pains.map(p => <article key={p.title} className="home-pain"><span className="home-icon" aria-hidden><p.icon size={18} /></span><h3>{p.title}</h3><p>{p.body}</p></article>)}
      </div>
      <SharedVsIsolated />
    </div>
  </section>;
}

function SharedVsIsolated() {
  return <div className="home-contrast" role="img" aria-label="A shared pool spreads one bad token's losses to every depositor; isolated groups keep the damage inside one group">
    <div className="home-pool">
      <div className="home-pool-title">Shared pool <small>one pool, every asset backs every loan</small></div>
      <div className="home-pool-box shared">
        <span className="home-chip">XLM</span><span className="home-chip">USDC</span><span className="home-chip bad">NEWTOKEN</span><span className="home-chip">EURC</span><span className="home-chip">AQUA</span><span className="home-chip">BLND</span>
      </div>
      <p className="home-pool-caption"><strong>One bad token, everyone pays.</strong> So shared pools list slowly, and new projects wait.</p>
    </div>
    <span className="home-contrast-vs" aria-hidden>VS</span>
    <div className="home-pool">
      <div className="home-pool-title">Isolated groups <small>Peridot Markets</small></div>
      <div className="home-cells">
        <div className="home-cell"><small>Group 1</small><span className="home-chip">USDC</span><span className="home-chip">XLM</span></div>
        <div className="home-cell bad"><small>Group 2 · contained</small><span className="home-chip bad">NEWTOKEN</span><span className="home-chip">XLM</span></div>
        <div className="home-cell"><small>Group 3</small><span className="home-chip">EURC</span><span className="home-chip">USDC</span></div>
      </div>
      <p className="home-pool-caption"><strong>Blast radius: one group.</strong> Depositors in other groups are never exposed, so any project can open a market today.</p>
    </div>
  </div>;
}

/* -------------------------------------------------------------- Solution */
const solutions = [
  { icon: Layers3, title: 'Isolated groups per project', body: 'Every group has its own controller, price router, markets and caps. Bad debt in one group never reaches another.', fine: ['CF capped at 75%', 'caps required'] },
  { icon: Coins, title: 'Oracle options with guards', body: 'Reflector feeds for listed assets. Tokens without a feed are priced from their Aquarius pool behind a depth floor and a 20% step guard. No admin fallback prices, ever.', fine: ['Reflector', 'Aquarius + step guard', 'CF 50% on pool prices'] },
  { icon: Sprout, title: 'Yield vaults for idle liquidity', body: 'Keep 10% to 100% liquid and route the rest into Blend or DeFindex vaults today. Aquarius LP vaults are next; XOXNO and Zenex are on the roadmap.', fine: ['Blend', 'DeFindex', 'Aquarius LP next'] },
  { icon: Scale, title: 'Leverage on any enabled market', body: 'The owner enables leverage per market through the margin factory: up to 5x per group, bounded by each market’s collateral factor, swapped through allowlisted Aquarius pools.', fine: ['1x to 5x per group', 'long and short'] },
  { icon: Rocket, title: 'Launchpad that graduates into a market', body: 'Launch a token on a bonding curve. When it reaches its target, anyone can graduate it: an Aquarius pool with permanently locked liquidity plus its own lending group, in six permissionless steps.', fine: ['Testnet beta', 'plain token and ICO next'] },
  { icon: ShieldCheck, title: 'Audited core, guardrails, timelocks', body: 'Lending contracts are Peridot’s audited core, with timelocks shortened from 24 h to 60 s for the hackathon. Owners act only through factory guardrails and every change is an on-chain event. New factory and adapter contracts are unaudited.', fine: ['60 s staged changes', 'event history'] },
];

export function Solution() {
  return <section className="home-section tinted" aria-labelledby="home-solution">
    <div className="home-wrap">
      <div className="home-head">
        <p className="eyebrow">The solution</p>
        <h2 id="home-solution">One isolated market group per project, plugged into Stellar&rsquo;s best venues.</h2>
        <p>Peridot gives each project a lending group it owns and configures, built from Peridot&rsquo;s audited core and connected to Stellar&rsquo;s yield and liquidity through one vault interface, one price router and one reward distributor.</p>
      </div>
      <div className="home-solution-grid">
        {solutions.map(s => <article key={s.title} className="home-solution">
          <span className="home-icon" aria-hidden><s.icon size={18} /></span>
          <h3>{s.title}</h3>
          <p>{s.body}</p>
          <div className="home-fine">{s.fine.map(f => <span key={f} className="badge">{f}</span>)}</div>
        </article>)}
      </div>
    </div>
  </section>;
}

/* ---------------------------------------------------------- How it works */
const steps = [
  { title: 'Bring or launch a token', body: 'Use any Stellar token with a Reflector feed, or launch one on the launchpad bonding curve and let it graduate into its own market.', fine: 'Curve presets: 25k, 85k or 250k XLM target' },
  { title: 'Create the group, add markets', body: 'One transaction per step: create the group, then deploy, activate and attach yield for each market. Set collateral factor, caps, reserve factor and a rate curve, 0% borrow included.', fine: 'CF up to 75% · 10% to 100% kept liquid' },
  { title: 'Plug in price, yield, leverage', body: 'Pick the price source per market, route idle liquidity into Blend or DeFindex, enable leverage where you want it, and fund rewards in your own token.', fine: 'Leverage 1x to 5x per group' },
  { title: 'Run it from the Control Panel', body: 'Adjust rates, caps, buffers and pauses. Risk and price changes stage for 60 seconds before they apply, and every change emits an event your community can audit.', fine: 'Staged changes · public history' },
];

export function HowItWorks() {
  return <section className="home-section" aria-labelledby="home-how">
    <div className="home-wrap">
      <div className="home-head">
        <p className="eyebrow">How it works</p>
        <h2 id="home-how">From token to money market in four steps.</h2>
        <p>Each step is a small, separately confirmed transaction inside factory guardrails, so a project can start with one market and grow later.</p>
      </div>
      <ol className="home-steps">
        {steps.map((s, i) => <li key={s.title} className="home-step">
          <span className="home-step-num" aria-hidden>{i + 1}</span>
          <div className="home-step-art" aria-hidden><StepArt step={i} /></div>
          <h3>{s.title}</h3>
          <p>{s.body}</p>
          <span className="home-fine">{s.fine}</span>
        </li>)}
      </ol>
      <div className="row"><Link className="text-link" href="/launch">Open the launch wizard <ArrowRight size={14} aria-hidden /></Link><span className="subtle" style={{ fontSize: 12 }}>· or read the <Link className="text-link" href="/about">architecture notes</Link></span></div>
    </div>
  </section>;
}

/* ------------------------------------------------------------- Audiences */
const forProjects = [
  ['Own the group', 'You hold the owner key; Peridot stays admin only inside published guardrails.'],
  ['Set your own terms', 'Collateral factor, caps, reserve factor, rate curve (0% allowed) and liquid buffer per market.'],
  ['Pay rewards in your token', 'Fund a distributor and set emissions per market; holders claim from the group page.'],
  ['Choose yield and leverage', 'Route idle deposits into Blend or DeFindex and enable up to 5x per market when you are ready.'],
  ['Grow later', 'Add markets after launch and change parameters from the Control Panel, with a 60 second stage on risk changes.'],
];
const forUsers = [
  ['Supply and earn', 'Lend into the groups you trust, with idle liquidity routed to the vault the owner chose.'],
  ['Borrow against collateral', 'Enable a market as collateral and borrow inside that group only.'],
  ['Trade with leverage', '2x to 5x long and short on enabled markets, with health, liquidation price and fees shown before you sign.'],
  ['Claim rewards', 'Emissions in the project’s token, paid from a publicly visible funded balance.'],
  ['See the boundaries', 'Every cap, price source, buffer and change is readable on chain. Your risk ends at the group you use.'],
];

export function Audiences() {
  return <section className="home-section tinted" aria-labelledby="home-who">
    <div className="home-wrap">
      <div className="home-head">
        <p className="eyebrow">Who it is for</p>
        <h2 id="home-who">Built for projects. Clear for their users.</h2>
      </div>
      <div className="home-audiences">
        <article className="home-audience">
          <span className="home-icon" aria-hidden><SlidersHorizontal size={18} /></span>
          <h3>For projects</h3>
          <p>A lending market on your terms, live in a few transactions, no listing vote.</p>
          <ul>{forProjects.map(([t, d]) => <li key={t}><Check size={15} aria-hidden /><span><strong>{t}.</strong> {d}</span></li>)}</ul>
          <Link className="button" href="/launch">Launch a market <ArrowRight size={16} aria-hidden /></Link>
        </article>
        <article className="home-audience">
          <span className="home-icon" aria-hidden><Users size={18} /></span>
          <h3>For users</h3>
          <p>Lend, borrow and trade with boundaries you can read before you sign.</p>
          <ul>{forUsers.map(([t, d]) => <li key={t}><Check size={15} aria-hidden /><span><strong>{t}.</strong> {d}</span></li>)}</ul>
          <Link className="button secondary" href="/groups">Explore markets <ArrowRight size={16} aria-hidden /></Link>
        </article>
      </div>
    </div>
  </section>;
}

/* --------------------------------------------------------------- Closing */
export function Closing() {
  return <section className="home-section" aria-labelledby="home-close">
    <div className="home-wrap">
      <div className="home-close">
        <p className="eyebrow">Get started</p>
        <h2 id="home-close">Give your token a market. Keep the risk inside it.</h2>
        <p>Explore the groups already live, or launch a token on the testnet launchpad and watch it graduate into its own lending market.</p>
        <div className="home-cta">
          <Link className="button large" href="/groups">Explore markets <ArrowRight size={17} aria-hidden /></Link>
          <Link className="button large ghost" href="/launch-token">Launch a token <Rocket size={16} aria-hidden /></Link>
          <Link className="button large quiet" href="/launch">Launch a market for an existing token</Link>
        </div>
        <div className="home-links">
          <Link href="/about"><BookOpen size={14} aria-hidden /> How it works and prior work</Link>
          <a href={GITHUB_URL} target="_blank" rel="noreferrer"><GitBranch size={14} aria-hidden /> GitHub: joshschcom/peridot-markets <ArrowUpRight size={12} aria-hidden /></a>
          <a href={`${GITHUB_URL}/blob/main/docs/SPECS.md`} target="_blank" rel="noreferrer"><FileCode2 size={14} aria-hidden /> Contract specs <ArrowUpRight size={12} aria-hidden /></a>
          <a href={`${GITHUB_URL}/blob/main/core/CORE_DIFF.md`} target="_blank" rel="noreferrer"><Lock size={14} aria-hidden /> Audited core and the 60 s timelock diff <ArrowUpRight size={12} aria-hidden /></a>
        </div>
        <p className="home-disclaimer">Beta. New factory, adapter and launchpad contracts are unaudited. Caps apply. The launchpad runs on testnet; public token offerings may require legal review. Blend, DeFindex, Aquarius, XOXNO and Zenex are venues Peridot routes into, not products of Peridot.</p>
      </div>
    </div>
  </section>;
}
