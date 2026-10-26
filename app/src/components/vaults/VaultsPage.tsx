'use client';
import { useEffect, useMemo, useState } from 'react';
import { Droplets, RefreshCw, Search, Vault } from 'lucide-react';
import { network } from '@/lib/peridot/network';
import { Badge, EmptyState, Notice, Skeleton, Tabs } from '@/components/ui/primitives';
import { Address } from '@/components/ui/Address';
import { VaultOptionList } from './VaultOptionList';
import { useAquariusPools } from './useAquariusPools';
import {
  applyPoolFilter, formatFee, formatUsd, isStablePair, isVaultEligible, pairLabel, vaultIneligibleReason, type AquariusPool, type PoolFilter, type PoolSource,
} from '@/lib/vaults/aquarius-pools';
import { CreateVault } from './CreateVault';
import { MyVaults } from './MyVaults';
import './vaults.css';

const SOURCE_LABEL: Record<PoolSource, string> = { chain: 'Aquarius router (on chain)', api: 'Aquarius API', registry: 'Verified pool list shipped with the app', demo: 'Demo data' };

export default function VaultsPage() {
  const { loading, result, reload } = useAquariusPools();
  const [filter, setFilter] = useState<PoolFilter>('all');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<AquariusPool | null>(null);
  const [refresh, setRefresh] = useState(0);
  const pools = useMemo(() => applyPoolFilter(result?.pools ?? [], filter, query), [result, filter, query]);
  const eligibleCount = (result?.pools ?? []).filter(isVaultEligible).length;
  const netLabel = network.useMocks ? 'Demo' : network.name === 'mainnet' ? 'Mainnet (read only)' : 'Testnet';

  return <div className="page">
    <div className="page-heading">
      <div style={{ minWidth: 0 }}>
        <p className="eyebrow">Vaults</p>
        <h1 className="vault-title">Where a market earns yield <Badge tone={network.name === 'mainnet' && !network.useMocks ? 'success' : 'info'}>{netLabel}</Badge></h1>
        <p className="lead">Every yield venue Peridot knows about, and a vault factory: design your own Aquarius ladder vault (or another strategy), tune it, and deploy it from this page. Blend and DeFindex markets are live. Zenex vaults are customizable here (testnet runs against a mock Zenex); XOXNO is listed so you can see what is planned.</p>
      </div>
    </div>

    <section className="card" aria-labelledby="venues-h">
      <div className="card-header"><div><h2 id="venues-h">Yield venues</h2><p>Pick one per market when you launch a group. Locked venues cannot be submitted.</p></div></div>
      <VaultOptionList ariaLabel="Yield venues" />
    </section>

    <section className="card" aria-labelledby="pools-h" aria-busy={loading}>
      <div className="card-header">
        <div><h2 id="pools-h">Aquarius pools with USDC</h2><p>Read only. The LP vault needs a concentrated liquidity pool, so only those can get a vault.</p></div>
        <button type="button" className="button secondary sm" onClick={reload} disabled={loading}><RefreshCw size={14} aria-hidden className={loading ? 'spin' : ''} /> Refresh</button>
      </div>
      <div className="vault-toolbar">
        <Tabs ariaLabel="Pool filter" value={filter} onChange={setFilter} items={[{ value: 'all', label: `All USDC pools (${result?.pools.length ?? 0})` }, { value: 'vault-eligible', label: `Vault eligible (${eligibleCount})` }]} />
        <label className="row" style={{ gap: 6 }}><Search size={14} aria-hidden /><span className="sr-only">Search pools</span><input type="search" aria-label="Search pools" placeholder="Search pair or address" value={query} onChange={e => setQuery(e.target.value)} /></label>
      </div>

      {result && <p className="vault-source" role="status">Source: <Badge tone={result.primary === 'demo' ? 'warn' : 'neutral'}>{SOURCE_LABEL[result.primary]}</Badge>{result.primary === 'chain' && <span>The API alone hides some live pools, so pools come from the router first.</span>}</p>}
      {result && result.warnings.length > 0 && <Notice tone="warn" role="alert" title="Some pool sources are unavailable"><ul style={{ margin: 0, paddingLeft: 18 }}>{result.warnings.map(w => <li key={w}>{w}</li>)}</ul><button type="button" className="button secondary sm" style={{ marginTop: 8 }} onClick={reload}>Try again</button></Notice>}

      {loading && !result ? <div aria-label="Loading pools" className="stack-sm">{[0, 1, 2, 3].map(i => <Skeleton key={i} height={44} style={{ borderRadius: 10 }} />)}</div>
        : pools.length === 0 ? <EmptyState icon={Droplets} title="No pools match" role="status"><p>{query ? 'Try a different search.' : 'No USDC pools were found for this filter.'}</p></EmptyState>
        : <div className="table-scroll"><table className="data-table pool-table">
          <thead><tr><th>Pair</th><th>Type</th><th>Fee</th><th title="Approximate: twice the USDC reserve">TVL (approx.)</th><th>Pool</th><th><span className="sr-only">Action</span></th></tr></thead>
          <tbody>{pools.map(pool => {
            const eligible = isVaultEligible(pool), isSel = selected?.address === pool.address;
            return <tr key={pool.address} className={isSel ? 'selected-row' : undefined} data-testid="pool-row">
              <td data-label="Pair" className="span"><span className="pool-pair"><span className="cell-main">{pairLabel(pool)}</span><span className="cell-sub">{isStablePair(pool) ? 'Stable pair' : 'Volatile pair'}</span></span></td>
              <td data-label="Type"><Badge tone={eligible ? 'accent' : 'neutral'}>{pool.type === 'concentrated' ? 'Concentrated' : pool.type === 'stable' ? 'Stable swap' : pool.type === 'constant_product' ? 'Constant product' : 'Unknown'}</Badge></td>
              <td data-label="Fee" className="num">{formatFee(pool.feeBps)}</td>
              <td data-label="TVL (approx.)" className="num">{formatUsd(pool.tvlUsd)}</td>
              <td data-label="Pool"><Address value={pool.address} label={`${pairLabel(pool)} pool address`} head={6} tail={6} /></td>
              <td className="actions span"><button type="button" className="button sm" disabled={!eligible} title={vaultIneligibleReason(pool) ?? undefined} aria-label={`Create a vault for ${pairLabel(pool)}`} onClick={() => { setSelected(pool); setTimeout(() => document.getElementById('create-vault')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50); }}>{eligible ? (isSel ? 'Selected' : 'Use in the form below') : 'Not eligible'}</button></td>
            </tr>;
          })}</tbody></table></div>}
    </section>

    <CreateVault pools={result?.pools ?? []} preset={selected} onCreated={() => setRefresh(n => n + 1)} />

    <MyVaults refreshKey={refresh} />
  </div>;
}

