'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowRight, Plus, Rocket } from 'lucide-react';
import { useWallet } from '@/lib/peridot/wallet';
import { Badge, EmptyState, Meter, Skeleton, Stat, Tabs } from '@/components/ui/primitives';
import { fmtAmount, fmtCompact, fmtDate } from '@/components/ui/format';
import { getCurveConfig, getCurveState, listLaunches, listPlainTokens } from '@/lib/launchpad/client';
import { isLaunchpadMainnet, launchpadCanSign, launchpadNetworkLabel } from '@/lib/launchpad/config';
import { FINE_SCALE, finePrice, fmtPrice, reservesFromState } from '@/lib/launchpad/math';
import { Phase, type CurveConfig, type CurveInfo, type LaunchInfo, type PlainTokenInfo } from '@/lib/launchpad/types';
import { LpAddress } from './LpAddress';
import { LaunchpadBadges, MainnetNotice, PhaseBadge, riskCopy, TokenIcon, TypeBadge } from './LaunchpadFrame';

export interface TokenSummary { launch: LaunchInfo; state: CurveInfo | null; config: CurveConfig | null; error?: string }
type Filter = 'all' | 'new' | 'graduated' | 'plain';

/** Lists launches, then fills each card with its curve state in parallel so one failing curve hides nothing else. */
export function useTokenSummaries() {
  const [tokens, setTokens] = useState<TokenSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    let alive = true;
    listLaunches().then(list => {
      if (!alive) return;
      const sorted = [...list].sort((a, b) => b.id - a.id);
      setTokens(sorted.map(launch => ({ launch, state: null, config: null })));
      setLoading(false);
      sorted.forEach(launch => {
        Promise.all([getCurveState(launch.curve), getCurveConfig(launch.curve)])
          .then(([state, config]) => { if (alive) setTokens(old => old.map(t => t.launch.id === launch.id ? { ...t, state, config } : t)); })
          .catch(e => { if (alive) setTokens(old => old.map(t => t.launch.id === launch.id ? { ...t, error: e instanceof Error ? e.message : String(e) } : t)); });
      });
    }).catch(e => { if (alive) { setError(e instanceof Error ? e.message : String(e)); setLoading(false); } });
    return () => { alive = false; };
  }, []);
  return { tokens, loading, error };
}

export function TokenCard({ summary, mine }: { summary: TokenSummary; mine: boolean }) {
  const { launch, state, config, error } = summary;
  const price = state ? finePrice(reservesFromState(state)) : null;
  const marketCap = price !== null && state ? price * state.sold / FINE_SCALE : null;
  const fdv = price !== null && config ? price * (config.params.curve_supply + config.params.lp_supply) / FINE_SCALE : null;
  const pct = state ? state.progress_bps / 100 : 0;
  return <article className="card group-card token-card" aria-label={`${launch.name} (${launch.symbol})`}>
    <div className="token-card-top">
      <TokenIcon symbol={launch.symbol} />
      <div style={{ minWidth: 0 }}><h3><Link href={`/token/${launch.token}`}>{launch.name}</Link></h3><span className="subtle" style={{ fontSize: 12 }}>{launch.symbol}{mine ? ' · your launch' : ''}</span></div>
      <TypeBadge type="curve" />
      {state ? <PhaseBadge phase={state.phase} /> : error ? <Badge tone="danger">Unavailable</Badge> : <Skeleton width={72} height={22} style={{ borderRadius: 999 }} />}
    </div>
    {error && <p className="muted" style={{ fontSize: 13 }}>Curve data unavailable: {error}</p>}
    {!error && <div className="token-card-stats">
      <Stat label="Price" value={price !== null ? fmtPrice(price) : <Skeleton width={90} height={18} />} unit={price !== null ? 'XLM' : undefined} />
      <Stat label="Market cap" value={marketCap !== null ? fmtCompact(marketCap, 7) : <Skeleton width={70} height={18} />} unit={marketCap !== null ? 'XLM' : undefined} hint={fdv !== null ? `FDV ${fmtCompact(fdv, 7)} XLM` : undefined} />
    </div>}
    {state ? <Meter thin label={state.phase === Phase.Trading ? 'Progress to graduation' : state.phase === Phase.Graduated ? 'Graduated' : 'Target reached'} value={`${fmtAmount(state.real_quote, 7, 0)} / ${fmtAmount(state.graduation_target, 7, 0)} XLM`} pct={pct} tone={state.phase === Phase.Graduated ? 'accent' : state.phase === Phase.Trading ? 'accent' : 'warn'} ariaLabel={`${launch.symbol} progress to the graduation target`} /> : !error && <div className="stack-sm"><Skeleton width="60%" /><Skeleton height={6} /></div>}
    <div className="group-card-foot">
      <span className="row" style={{ gap: 6 }}>Creator <LpAddress value={launch.creator} label="creator address" /></span>
      <span>{fmtDate(launch.created_at)}</span>
      <Link className="text-link" href={`/token/${launch.token}`}>Open token <ArrowRight size={14} aria-hidden /></Link>
    </div>
  </article>;
}

export function PlainTokenCard({ info, mine }: { info: PlainTokenInfo; mine: boolean }) {
  return <article className="card group-card token-card" aria-label={`${info.name} (${info.symbol}), simple token`}>
    <div className="token-card-top">
      <TokenIcon symbol={info.symbol} />
      <div style={{ minWidth: 0 }}><h3><Link href={`/token/${info.token}`}>{info.name}</Link></h3><span className="subtle" style={{ fontSize: 12 }}>{info.symbol}{mine ? ' · your token' : ''}</span></div>
      <TypeBadge type="simple" />
    </div>
    <div className="token-card-stats">
      <Stat label="Supply" value={fmtCompact(info.supply, 7)} unit={info.symbol} />
      <Stat label="Market" value="None yet" hint="No curve, no ICO" />
    </div>
    <div className="group-card-foot">
      <span className="row" style={{ gap: 6 }}>Creator <LpAddress value={info.creator} label="creator address" /></span>
      <span>{fmtDate(info.created_at)}</span>
      <Link className="text-link" href={`/token/${info.token}`}>Open token <ArrowRight size={14} aria-hidden /></Link>
    </div>
  </article>;
}

export function TokenList() {
  const { address } = useWallet();
  const { tokens, loading, error } = useTokenSummaries();
  const [plain, setPlain] = useState<PlainTokenInfo[]>([]);
  useEffect(() => { let alive = true; listPlainTokens().then(list => { if (alive) setPlain([...list].sort((a, b) => b.id - a.id)); }).catch(() => {}); return () => { alive = false; }; }, []);
  const [filter, setFilter] = useState<Filter>('all');
  const showCurve = filter !== 'plain';
  const showPlain = filter === 'all' || filter === 'plain';
  const visible = !showCurve ? [] : tokens.filter(t => filter === 'all' ? true : filter === 'graduated' ? t.state?.phase === Phase.Graduated : t.state ? t.state.phase !== Phase.Graduated : true);
  const counts = { all: tokens.length + plain.length, plain: plain.length, new: tokens.filter(t => t.state && t.state.phase !== Phase.Graduated).length, graduated: tokens.filter(t => t.state?.phase === Phase.Graduated).length };
  return <div className="page">
    <div className="page-heading">
      <div style={{ minWidth: 0 }}>
        <p className="eyebrow">Launchpad</p>
        <h1 className="lp-title">{isLaunchpadMainnet() ? 'Launchpad tokens' : 'Test tokens'} <LaunchpadBadges /></h1>
        <p className="lead">Tokens launched on a bonding curve, plus simple tokens with no curve. When a curve raises its target, anyone can graduate it into an Aquarius pool with locked liquidity and its own lending market.</p>
      </div>
      <div className="page-actions">{launchpadCanSign() ? <Link className="button" href="/launch-token"><Plus size={16} aria-hidden /> Launch a token</Link> : <Link className="button secondary" href="/launch-token">How launching works</Link>}</div>
    </div>
    <MainnetNotice />
    <div className="row between">
      <Tabs ariaLabel="Filter tokens" value={filter} onChange={setFilter} items={[{ value: 'all', label: `All (${counts.all})` }, { value: 'new', label: `New (${counts.new})` }, { value: 'graduated', label: `Graduated (${counts.graduated})` }, { value: 'plain', label: `Simple (${counts.plain})` }]} />
      <span className="subtle" style={{ fontSize: 12 }}>{riskCopy()}</span>
    </div>
    {loading ? <div className="grid-3" aria-busy="true" aria-label="Loading tokens">{[0, 1, 2].map(i => <div key={i} className="card token-card"><div className="token-card-top"><Skeleton width={40} height={40} style={{ borderRadius: 12 }} /><Skeleton width={140} height={20} /></div><div className="token-card-stats"><Skeleton height={34} /><Skeleton height={34} /></div><Skeleton height={6} /><Skeleton width="50%" /></div>)}</div>
      : error ? <EmptyState icon={Rocket} title="Tokens are not available right now" role="alert"><p>{error}</p><p className="subtle">The launchpad reads the Stellar {launchpadNetworkLabel()}. Check the RPC endpoint and retry.</p></EmptyState>
      : visible.length === 0 && !(showPlain && plain.length > 0) ? <EmptyState icon={Rocket} title={filter === 'plain' ? 'No simple tokens yet' : filter === 'graduated' ? 'No graduated tokens yet' : filter === 'new' ? 'No tokens on the curve right now' : 'No tokens launched yet'} action={launchpadCanSign() ? <Link href="/launch-token" className="button">{isLaunchpadMainnet() ? 'Launch a token' : 'Launch a test token'} <ArrowRight size={16} aria-hidden /></Link> : undefined}><p>{filter === 'graduated' ? 'A token graduates once its curve reaches the target and the six graduation steps have run.' : isLaunchpadMainnet() ? 'Launch the first token with your own XLM. Public token offerings may require legal review.' : 'Launch your own test token on testnet. Public token offerings may require legal review.'}</p></EmptyState>
      : <div className="grid-3">{showPlain && plain.map(p => <PlainTokenCard key={`plain-${p.id}`} info={p} mine={p.creator === address} />)}{visible.map(t => <TokenCard key={t.launch.id} summary={t} mine={t.launch.creator === address} />)}</div>}
  </div>;
}
