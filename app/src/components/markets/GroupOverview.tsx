'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowRight, Gift, Layers3, Scale, Sprout } from 'lucide-react';
import { getMarketConfig, listGroups } from '@/lib/peridot/factory';
import { readMarketSummary, type MarketSummary } from '@/lib/peridot/group-client';
import { useWallet } from '@/lib/peridot/wallet';
import type { Group } from '@/lib/peridot/types';
import { Badge, Meter, Skeleton, EmptyState } from '@/components/ui/primitives';
import { fmtCompact, fmtPct } from '@/components/ui/format';
import { GroupAvatar } from '@/components/groups/GroupAvatar';

export interface GroupSummary { group: Group; markets: MarketSummary[] | null; error?: string }

/** Lists groups, then loads each group's market views in parallel so cards fill in progressively.
 * Uses only the existing read functions; one failing group does not hide the others. */
export function useGroupSummaries() {
  const [groups, setGroups] = useState<GroupSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    let alive = true;
    listGroups().then(list => {
      if (!alive) return;
      setGroups(list.map(group => ({ group, markets: null })));
      setLoading(false);
      list.forEach(group => {
        Promise.all(group.markets.map(m => getMarketConfig(group.id, m)))
          .then(configs => Promise.all(group.markets.map((m, i) => readMarketSummary(group, m, configs[i]))))
          .then(markets => { if (alive) setGroups(old => old.map(s => s.group.id === group.id ? { ...s, markets } : s)); })
          .catch(e => { if (alive) setGroups(old => old.map(s => s.group.id === group.id ? { ...s, markets: [], error: e instanceof Error ? e.message : String(e) } : s)); });
      });
    }).catch(e => { if (alive) { setError(e instanceof Error ? e.message : String(e)); setLoading(false); } });
    return () => { alive = false; };
  }, []);
  return { groups, loading, error };
}

export function routeLabel(tag: string): string {
  return tag === 'None' ? 'Kept in Peridot' : tag === 'Defindex' ? 'DeFindex' : tag;
}

export function GroupCard({ summary, owned }: { summary: GroupSummary; owned: boolean }) {
  const { group, markets, error } = summary;
  const routes = markets ? [...new Set(markets.map(m => m.config.yield_route.tag))] : [];
  return <article className="card group-card">
    <div className="group-card-top">
      <GroupAvatar groupId={group.id} name={group.name} size={36} />
      <h3><Link href={`/groups/${group.id}`}>{group.name}</Link></h3>
      {owned ? <Badge tone="accent">Your group</Badge> : <Badge>Group #{group.id}</Badge>}
    </div>
    <div className="chips">
      {group.margin_controller && <Badge tone="info" icon={Scale}>Leverage</Badge>}
      {group.reward_distributor && <Badge tone="warn" icon={Gift}>Rewards</Badge>}
      {routes.map(tag => <Badge key={tag} icon={tag === 'None' ? undefined : Sprout}>{routeLabel(tag)}</Badge>)}
      {!markets && <Skeleton width={90} height={22} style={{ borderRadius: 999 }} />}
    </div>
    <div className="stack-sm">
      {!markets && group.markets.map(m => <div key={m} className="stack-sm"><Skeleton width="60%" /><Skeleton height={6} /></div>)}
      {markets && markets.length === 0 && !error && <p className="muted">No markets activated yet.</p>}
      {error && <p className="muted">Market data unavailable: {error}</p>}
      {markets?.map(m => <Meter key={m.address} thin label={<><strong style={{ color: 'var(--text)' }}>{m.token.symbol}</strong> {fmtCompact(m.supplied, m.token.decimals)} supplied</>} value={<>{fmtCompact(m.borrowed, m.token.decimals)} borrowed ({fmtPct(m.utilization, 0)})</>} pct={m.utilization} ariaLabel={`${m.token.symbol} utilization`} />)}
    </div>
    <div className="group-card-foot">
      <span>{group.markets.length} {group.markets.length === 1 ? 'market' : 'markets'}{markets && markets.some(m => m.config.supply_reward_per_sec + m.config.borrow_reward_per_sec > 0n) ? ' with emissions' : ''}</span>
      <Link className="text-link" href={`/groups/${group.id}`}>Open group <ArrowRight size={14} aria-hidden /></Link>
    </div>
  </article>;
}

export function GroupCards({ query = '', limit }: { query?: string; limit?: number }) {
  const { address } = useWallet();
  const { groups, loading, error } = useGroupSummaries();
  if (loading) return <div className="grid-3" aria-busy="true" aria-label="Loading market groups">{[0, 1, 2].map(i => <div key={i} className="card group-card"><div className="group-card-top"><Skeleton width={36} height={36} /><Skeleton width={120} height={20} /></div><Skeleton height={22} width={160} style={{ borderRadius: 999 }} /><div className="stack-sm"><Skeleton width="70%" /><Skeleton height={6} /><Skeleton width="60%" /><Skeleton height={6} /></div><Skeleton width="50%" /></div>)}</div>;
  if (error) return <EmptyState icon={Layers3} title="Markets are not available right now" role="alert"><p>{error}</p><p className="subtle">A verified deployment manifest and a reachable RPC endpoint are required.</p></EmptyState>;
  const filtered = groups.filter(s => s.group.name.toLowerCase().includes(query.toLowerCase())).sort((a, b) => Number(b.group.owner === address) - Number(a.group.owner === address));
  const shown = limit ? filtered.slice(0, limit) : filtered;
  if (!shown.length) return <EmptyState icon={Layers3} title={query ? 'No matching groups' : 'Be the first to launch'} action={<Link href="/launch" className="button">Configure a group <ArrowRight size={16} aria-hidden /></Link>}><p>Create a group with the assets and parameters your community needs.</p></EmptyState>;
  return <div className="grid-3">{shown.map(s => <GroupCard key={s.group.id} summary={s} owned={s.group.owner === address} />)}</div>;
}
