'use client';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, RefreshCw } from 'lucide-react';
import { useWallet } from '@/lib/peridot/wallet';
import type { Signer, TxProgress } from '@/lib/peridot/rpc';
import { Badge, EmptyState, KeyValue, Meter, Notice, Skeleton, Stat } from '@/components/ui/primitives';
import { fmtAmount, fmtCompact, fmtDate } from '@/components/ui/format';
import { getCurveActivity, getCurveConfig, getCurveState, getGraduation, getGraduationCost, getGroupOwner, getTokenBalance, getTokenMeta, quoteToken, resolveLaunch, type GraduationCost, type TokenBalance, type TokenMeta } from '@/lib/launchpad/client';
import { FINE_SCALE, finePrice, fmtPrice, reserves } from '@/lib/launchpad/math';
import { GradStep, PRESETS, Phase, type CurveActivity, type CurveConfig, type CurveInfo, type Graduation, type LaunchInfo } from '@/lib/launchpad/types';
import { CurveChart } from './CurveChart';
import { GraduationPanel } from './GraduationPanel';
import { LpAddress, LpTxLink } from './LpAddress';
import { LaunchpadBadges, MainnetNotice, PhaseBadge, RiskNotice, TokenIcon, TxStatus, fmtIso } from './LaunchpadFrame';
import { TradePanel } from './TradePanel';

const readable = (e: unknown) => e instanceof Error ? e.message : String(e);

export default function TokenPage({ address }: { address: string }) {
  const wallet = useWallet();
  const [launch, setLaunch] = useState<LaunchInfo | null>(null);
  const [state, setState] = useState<CurveInfo | null>(null);
  const [config, setConfig] = useState<CurveConfig | null>(null);
  const [graduation, setGraduation] = useState<Graduation | null>(null);
  const [meta, setMeta] = useState<TokenMeta | null>(null);
  const [cost, setCost] = useState<GraduationCost | null>(null);
  const [costError, setCostError] = useState('');
  const [xlm, setXlm] = useState<TokenBalance | null>(null);
  const [token, setToken] = useState<TokenBalance | null>(null);
  const [aqua, setAqua] = useState<TokenBalance | null>(null);
  const [groupOwner, setGroupOwner] = useState<string | null>(null);
  const [activity, setActivity] = useState<CurveActivity | null>(null);
  const [activityError, setActivityError] = useState('');
  const [activityVersion, setActivityVersion] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<TxProgress | null>(null);
  const [hashes, setHashes] = useState<string[]>([]);
  const generation = useRef(0), flight = useRef(false);

  const refresh = useCallback(async () => {
    const version = ++generation.current;
    setRefreshing(true);
    try {
      const l = await resolveLaunch(address);
      const [s, c, g, m] = await Promise.all([getCurveState(l.curve), getCurveConfig(l.curve), getGraduation(l.curve), getTokenMeta(l.token).catch(() => ({ symbol: l.symbol, name: l.name, decimals: 7, metadataUri: '' }))]);
      if (version !== generation.current) return;
      setLaunch(l); setState(s); setConfig(c); setGraduation(g); setMeta(m); setLoading(false); setError('');
      const tasks: Promise<unknown>[] = [];
      if (wallet.address) {
        const owner = wallet.address;
        tasks.push(getTokenBalance(quoteToken(), owner).then(b => { if (version === generation.current) setXlm(b); }).catch(() => { if (version === generation.current) setXlm(null); }));
        tasks.push(getTokenBalance(l.token, owner).then(b => { if (version === generation.current) setToken(b); }).catch(() => { if (version === generation.current) setToken(null); }));
      } else { setXlm(null); setToken(null); }
      if (s.phase === Phase.Graduatable || s.phase === Phase.Graduating) {
        tasks.push(getGraduationCost(l.curve).then(async fee => {
          if (version !== generation.current) return;
          setCost(fee); setCostError('');
          if (wallet.address) { const balance = await getTokenBalance(fee.token, wallet.address).catch(() => null); if (version === generation.current) setAqua(balance); }
        }).catch(e => { if (version === generation.current) { setCost(null); setCostError(readable(e)); } }));
      } else { setCost(null); setAqua(null); }
      if (g && g.step === GradStep.Graduated) tasks.push(getGroupOwner(g.group_id).then(o => { if (version === generation.current) setGroupOwner(o); }).catch(() => { if (version === generation.current) setGroupOwner(null); }));
      await Promise.all(tasks);
    } catch (e) { if (version === generation.current) setError(readable(e)); }
    finally { if (version === generation.current) { setLoading(false); setRefreshing(false); } }
  }, [address, wallet.address]);
  const refreshRef = useRef(refresh); refreshRef.current = refresh;
  useEffect(() => { void refresh(); return () => { generation.current++; }; }, [refresh]);
  const curve = launch?.curve;
  useEffect(() => {
    if (!launch) return;
    let alive = true;
    setActivityError('');
    getCurveActivity(launch).then(a => { if (alive) setActivity(a); }).catch(e => { if (alive) setActivityError(readable(e)); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [curve, activityVersion]);

  const report = (p: TxProgress) => { setProgress(p); if (p.hash) setHashes(old => old.includes(p.hash!) ? old : [p.hash!, ...old].slice(0, 12)); };
  const run = async (task: () => Promise<unknown>) => {
    if (flight.current) return;
    flight.current = true; setBusy(true); setError(''); setProgress(null);
    try { await task(); await refreshRef.current(); setActivityVersion(v => v + 1); }
    catch (e) { setError(readable(e)); await refreshRef.current().catch(() => {}); setError(readable(e)); }
    finally { flight.current = false; setBusy(false); }
  };
  const signer = (): Signer => {
    if (!wallet.address) throw new Error('Connect your wallet first.');
    if (wallet.networkMismatch) throw new Error('Switch your wallet to testnet before signing.');
    return { address: wallet.address, signTransaction: wallet.signTransaction };
  };

  if (loading) return <div className="page" aria-busy="true"><div className="page-heading"><div style={{ display: 'grid', gap: 10, width: 'min(100%,460px)' }}><Skeleton width={160} height={12} /><Skeleton width={300} height={32} /><Skeleton width={360} height={14} /></div></div><section className="card" role="status"><div className="token-stats">{[0, 1, 2, 3].map(i => <div key={i} className="stack-sm"><Skeleton width={80} height={12} /><Skeleton width={120} height={22} /></div>)}</div><p className="sr-only">Loading token and curve state...</p></section><div className="two-col token-layout"><section className="card"><Skeleton height={240} /></section><aside className="card"><Skeleton height={200} /></aside></div></div>;
  if (!launch || !state || !config) return <div className="page"><EmptyState title="Token unavailable" role="alert" action={<div className="row"><button className="button" onClick={() => void refresh()}>Retry</button><Link className="button ghost" href="/tokens">All tokens</Link></div>}><p>{error || 'This token could not be loaded.'}</p><p className="subtle">Open a token by its token or curve contract address.</p></EmptyState></div>;

  const params = config.params;
  const price = finePrice(reserves(params, state.real_quote, state.sold));
  const marketCap = price * state.sold / FINE_SCALE;
  const fdv = price * (params.curve_supply + params.lp_supply) / FINE_SCALE;
  const preset = PRESETS.find(p => p.value === launch.preset);
  return <div className="page">
    <header className="page-heading">
      <div style={{ minWidth: 0 }}>
        <p className="eyebrow"><Link href="/tokens" className="row" style={{ gap: 6 }}><ArrowLeft size={12} aria-hidden />Launchpad token #{launch.id}</Link></p>
        <h1 className="lp-title"><TokenIcon symbol={launch.symbol} uri={meta?.metadataUri} large />{launch.name} <Badge>{launch.symbol}</Badge> <PhaseBadge phase={state.phase} /> <LaunchpadBadges /></h1>
        <div className="lp-meta">
          <span>Token <LpAddress value={launch.token} label="token address" /></span>
          <span>Curve <LpAddress value={launch.curve} label="curve address" /></span>
          <span>Creator <LpAddress value={launch.creator} label="creator address" /></span>
          <span>Launched {fmtDate(launch.created_at)}</span>
        </div>
      </div>
      <div className="page-actions"><button className="button secondary" onClick={() => void refresh()} disabled={busy || refreshing}><RefreshCw size={14} aria-hidden />Refresh</button></div>
    </header>
    <MainnetNotice />
    {refreshing && !busy && <Notice tone="info" role="status">Updating curve state and balances...</Notice>}
    {error && <Notice tone="danger" role="alert">{error}</Notice>}
    <TxStatus progress={progress} />
    <section className="card" aria-label="Curve statistics">
      <div className="token-stats">
        <Stat label="Price" value={fmtPrice(price)} unit="XLM" hint={`per ${launch.symbol}`} />
        <Stat label="Market cap" value={fmtCompact(marketCap, 7)} unit="XLM" hint={`FDV ${fmtCompact(fdv, 7)} XLM`} />
        <Stat label="Raised" value={fmtAmount(state.real_quote, 7, 2)} unit="XLM" hint={`Target ${fmtAmount(state.graduation_target, 7, 0)} XLM`} />
        <Stat label="Tokens sold" value={fmtCompact(state.sold, 7)} unit={launch.symbol} hint={`${fmtCompact(state.tokens_remaining, 7)} left on the curve`} />
      </div>
      <div className="mt-4"><Meter label={state.phase === Phase.Trading ? 'Progress to graduation' : state.phase === Phase.Graduated ? 'Graduated' : 'Target reached'} value={`${(state.progress_bps / 100).toFixed(1)}%`} pct={state.progress_bps / 100} tone={state.phase === Phase.Trading || state.phase === Phase.Graduated ? 'accent' : 'warn'} ariaLabel="Progress to the graduation target" /></div>
    </section>
    <div className={`two-col token-layout${state.phase === Phase.Trading || state.phase === Phase.Graduatable ? ' trade-first' : ''}`}>
      <div className="stack">
        {state.phase !== Phase.Trading && <GraduationPanel launch={launch} state={state} params={params} graduation={graduation} cost={cost} costError={costError} aqua={aqua} groupOwner={groupOwner} busy={busy} run={run} signer={signer} report={report} />}
        <section className="card"><CurveChart params={params} sold={state.sold} symbol={launch.symbol} /></section>
        <section className="card" aria-label="Recent trades">
          <div className="card-header"><div><h2>Recent trades</h2><p>Buys and sells decoded from the curve&apos;s contract events on testnet.</p></div>{activity?.partial && <Badge tone="warn">Older events not scanned</Badge>}</div>
          {!activity && !activityError ? <p role="status" className="muted">Loading trades...</p>
            : activityError ? <p className="muted">Recent trades unavailable: {activityError}</p>
            : activity && activity.trades.length === 0 ? <p className="muted">No trades yet.</p>
            : activity && <div className="table-scroll"><table className="data-table lp-trades"><thead><tr><th>Time</th><th>Side</th><th className="col-opt">Account</th><th>XLM</th><th>{launch.symbol}</th><th><span className="sr-only">Transaction</span></th></tr></thead><tbody>
              {activity.trades.slice(0, 25).map(t => <tr key={`${t.hash}-${t.ledger}-${t.kind}-${t.tokens}`}><td data-label="Time"><span className="cell-sub" style={{ marginTop: 0 }}>{fmtIso(t.at)}</span></td><td data-label="Side"><Badge tone={t.kind === 'buy' ? 'success' : 'warn'}>{t.kind === 'buy' ? 'Buy' : 'Sell'}</Badge>{t.clamped && <span className="cell-sub">Clamped at target</span>}</td><td data-label="Account" className="col-opt"><LpAddress value={t.user} label="trader address" /></td><td data-label="XLM" className="num">{fmtAmount(t.quote, 7, 2)}</td><td data-label={launch.symbol} className="num">{fmtCompact(t.tokens, 7)}</td><td className="actions"><LpTxLink hash={t.hash} ariaLabel="View trade transaction">View</LpTxLink></td></tr>)}
            </tbody></table></div>}
          {activity && activity.history.length > 0 && <div className="mt-4"><h3>Lifecycle events</h3><ul className="history">{activity.history.slice(0, 12).map(h => <li key={`${h.hash}-${h.name}-${h.ledger}`}><span className="row" style={{ gap: 8 }}><Badge>{h.name.replaceAll('_', ' ')}</Badge><span className="subtle" style={{ fontSize: 12 }}>{fmtIso(h.at)}</span></span><LpTxLink hash={h.hash}>View <ArrowRight size={12} aria-hidden /></LpTxLink></li>)}</ul></div>}
          <p className="subtle mt-4" style={{ fontSize: 12 }}>Holder counts need an indexer and are not shown.</p>
        </section>
      </div>
      <aside className="stack sticky-aside">
        <RiskNotice />
        <TradePanel launch={launch} state={state} params={params} xlm={xlm} token={token} busy={busy} run={run} signer={signer} report={report} />
        <section className="card" aria-label="About this launch">
          <div className="card-header" style={{ marginBottom: 10 }}><div><h2>About</h2><p>{meta?.name || launch.name} ({launch.symbol}), 7 decimals.</p></div></div>
          <KeyValue rows={[['Preset', preset ? `${preset.label}, ${fmtAmount(params.graduation_target, 7, 0)} XLM target` : `${fmtAmount(params.graduation_target, 7, 0)} XLM target`], ['Total supply', `${fmtCompact(params.curve_supply + params.lp_supply, 7)} ${launch.symbol}`], ['On the curve', `${fmtCompact(params.curve_supply, 7)} ${launch.symbol}`], ['Reserved for the pool', `${fmtCompact(params.lp_supply, 7)} ${launch.symbol}`], ['Trade fee', `${Number(params.trade_fee_bps) / 100}% of the XLM side`], ['Creator cap', `${Number(params.creator_cap_bps) / 100}% of the curve supply`], ...(meta?.metadataUri ? [['Image URI', <a key="uri" className="text-link wrap" href={meta.metadataUri} target="_blank" rel="noreferrer">{meta.metadataUri.length > 36 ? `${meta.metadataUri.slice(0, 36)}...` : meta.metadataUri}</a>] as [string, React.ReactNode]] : [])]} />
          <p className="subtle mt-4" style={{ fontSize: 12 }}>Fixed supply, no mint, no admin, no freeze on the token. Curve parameters are immutable. The launch factory admin can upgrade curve code (house rule), which is the one trust assumption.</p>
        </section>
      </aside>
    </div>
    {hashes.length > 0 && <section className="card"><h2>Transactions this session</h2><ul className="history">{hashes.map(hash => <li key={hash}><code className="wrap">{hash}</code><LpTxLink hash={hash}>View <ArrowRight size={12} aria-hidden /></LpTxLink></li>)}</ul></section>}
  </div>;
}
