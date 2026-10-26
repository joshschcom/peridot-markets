'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { network } from '@/lib/peridot/network';
import { GroupCards, routeLabel, useGroupSummaries } from '@/components/markets/GroupOverview';
import { Skeleton } from '@/components/ui/primitives';
import { fmtCompact } from '@/components/ui/format';
import { getCurveState, listLaunches, listPlainTokens } from '@/lib/launchpad/client';
import { Phase } from '@/lib/launchpad/types';

type LaunchCounts = { total: number; graduated: number | null };

/** Curve launches plus simple tokens first, graduated count once every curve state has answered.
 * A failing plain-token list only lowers the total; a failing launch list degrades to "unavailable". */
function useLaunchpadCounts(): LaunchCounts | 'error' | null {
  const [state, setState] = useState<LaunchCounts | 'error' | null>(null);
  useEffect(() => {
    let alive = true;
    Promise.all([listLaunches(), listPlainTokens().catch(() => [])]).then(async ([curves, plain]) => {
      if (!alive) return;
      const total = curves.length + plain.length;
      setState({ total, graduated: null });
      const states = await Promise.allSettled(curves.map(l => getCurveState(l.curve)));
      if (!alive) return;
      const graduated = states.filter(s => s.status === 'fulfilled' && s.value.phase === Phase.Graduated).length;
      setState({ total, graduated });
    }).catch(() => { if (alive) setState('error'); });
    return () => { alive = false; };
  }, []);
  return state;
}

function Value({ ready, children, text = false }: { ready: boolean; children: React.ReactNode; text?: boolean }) {
  return <span className={`stat-value${text ? ' text' : ''}`}>{ready ? children : <Skeleton width={text ? 120 : 56} height={text ? 18 : 26} />}</span>;
}

export function LiveProof() {
  const { groups, loading, error } = useGroupSummaries();
  const launches = useLaunchpadCounts();
  const sourceLabel = network.useMocks ? 'Demo data' : network.name === 'mainnet' ? 'Live on Stellar mainnet' : 'Live on Stellar testnet';
  const sourceNote = network.useMocks
    ? 'Simulated in this browser for the demo. Not mainnet evidence.'
    : 'Read directly from the factory and market contracts on every visit. Nothing here is cached or estimated.';

  const marketCount = groups.reduce((n, s) => n + s.group.markets.length, 0);
  const leveraged = groups.filter(s => !!s.group.margin_controller).length;
  const loaded = groups.filter(s => s.markets !== null);
  const anyMarketsLoaded = loaded.length > 0;
  const allFailed = groups.length > 0 && loaded.length === groups.length && loaded.every(s => s.error);
  const supplied = new Map<string, { amount: bigint; decimals: number }>();
  const routes = new Set<string>();
  for (const s of loaded) for (const m of s.markets ?? []) {
    const cur = supplied.get(m.token.symbol) ?? { amount: 0n, decimals: m.token.decimals };
    supplied.set(m.token.symbol, { amount: cur.amount + m.supplied, decimals: cur.decimals });
    if (m.config.yield_route.tag !== 'None') routes.add(routeLabel(m.config.yield_route.tag));
  }
  const suppliedText = [...supplied.entries()].sort((a, b) => (b[1].amount > a[1].amount ? 1 : -1)).slice(0, 3).map(([sym, v]) => `${fmtCompact(v.amount, v.decimals)} ${sym}`).join(' · ');
  const pending = groups.length - loaded.length;

  return <section className="home-section" aria-labelledby="home-live">
    <div className="home-wrap home-proof">
      <div className="home-proof-card">
        <div className="home-proof-head">
          <div><h2 id="home-live"><span className="live-dot" aria-hidden /> {sourceLabel}</h2><p>{sourceNote}</p></div>
          <Link className="text-link" href="/groups">All groups <ArrowRight size={14} aria-hidden /></Link>
        </div>
        {error
          ? <p className="home-proof-note" role="status">Live figures are unavailable right now ({error}). The groups below load independently.</p>
          : <div className="home-proof-stats" aria-busy={loading || pending > 0}>
            <div className="stat"><span className="stat-label">Isolated groups</span><Value ready={!loading}>{groups.length}</Value><span className="stat-hint">{loading ? 'reading the factory' : `${leveraged} with leverage enabled`}</span></div>
            <div className="stat"><span className="stat-label">Markets</span><Value ready={!loading}>{marketCount}</Value><span className="stat-hint">across all groups</span></div>
            <div className="stat"><span className="stat-label">Supplied</span><Value ready={!loading && (anyMarketsLoaded || allFailed)} text>{allFailed ? 'unavailable' : suppliedText || 'nothing yet'}</Value><span className="stat-hint">{pending > 0 && anyMarketsLoaded ? `${pending} more loading` : 'totals per token, read from each market'}</span></div>
            <div className="stat"><span className="stat-label">Yield routes live</span><Value ready={!loading && (anyMarketsLoaded || allFailed)} text>{allFailed ? 'unavailable' : routes.size ? [...routes].join(' · ') : 'none attached'}</Value><span className="stat-hint">idle liquidity destinations</span></div>
            <div className="stat"><span className="stat-label">Launchpad tokens</span><Value ready={launches !== null} text={launches === 'error'}>{launches === 'error' ? 'unavailable' : launches?.total ?? 0}</Value><span className="stat-hint">{launches && launches !== 'error' ? launches.graduated === null ? 'counting graduations' : `${launches.graduated} graduated into a market` : 'testnet launchpad'}{launches && launches !== 'error' && !network.useMocks ? ' · testnet' : ''}</span></div>
          </div>}
      </div>
      <GroupCards limit={3} />
      <p className="home-proof-note">Beta. New contracts are unaudited. Caps apply.{network.useMocks ? ' Demo balances are simulated and are not mainnet evidence.' : ''}</p>
    </div>
  </section>;
}
