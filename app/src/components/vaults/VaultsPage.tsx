'use client';
import { useEffect, useMemo, useState } from 'react';
import { Droplets, RefreshCw, Search, Vault } from 'lucide-react';
import { getDeployments, network } from '@/lib/peridot/network';
import { APPROVAL_COPY } from '@/lib/vaults/registry';
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
  const ext = useMemo(() => { try { return getDeployments().external as Record<string, unknown>; } catch { return {} as Record<string, unknown>; } }, []);
  const usdc = typeof ext.usdc === 'string' ? ext.usdc : '', xlm = typeof ext.xlm === 'string' ? ext.xlm : '';

  return <div className="page">
    <div className="page-heading">
      <div style={{ minWidth: 0 }}>
        <p className="eyebrow">Vaults</p>
        <h1 className="vault-title">Where a market earns yield <Badge tone={network.name === 'mainnet' && !network.useMocks ? 'success' : 'info'}>{netLabel}</Badge></h1>
        <p className="lead">Every yield venue a Peridot market can route into, with its rate, and a vault factory: design your own Aquarius ladder vault, Zenex perps vault (USDC, async withdrawals) or XOXNO lending vault, tune it, deploy it from this page, and attach it to a market once Peridot allow-lists it. Blend and the fixed DeFindex vaults (XLM, USDC, EURC) need no vault of your own.</p>
      </div>
    </div>

    <section className="card" aria-labelledby="venues-h">
      <div className="card-header"><div><h2 id="venues-h">Yield venues</h2><p>Pick one per market when you launch a group. Rates: APY is computed from on-chain reads with the formula in the tooltip; APR est. uses an approximate input; n/a says why. Locked venues say why they cannot be chosen on {network.name}.</p></div></div>
      <VaultOptionList ariaLabel="Yield venues" rateFor={o => o.id === 'idle' ? undefined : o.id === 'xoxno' ? { token: xlm } : o.id === 'blend' || o.id === 'defindex' ? { token: usdc } : {}} />
      <p className="subtle" style={{ fontSize: 12, marginTop: 10 }}>Keep in Peridot pays each market&apos;s own supply rate (borrow APR times utilization, less the reserve factor), shown on the group pages. Blend and DeFindex rates above are for USDC; XOXNO is for XLM (hub 1); Aquarius uses the USDC/EURC concentrated pool as the example. The add-market step shows the rate for the token you pick.</p>
    </section>

    <section className="card" aria-labelledby="attach-h">
      <div className="card-header"><div><h2 id="attach-h">From a created vault to a market</h2><p>Your own vaults plug into a market through the same route as a DeFindex vault. Three steps, two of them yours.</p></div></div>
      <ol className="plan-list">
        <li><span><span className="plan-title">Create the vault below</span><span className="plan-detail">The vault factory deploys it with your limits. Zenex vaults take USDC only and exits from Zenex wait at least an hour; XOXNO vaults supply one asset; the Aquarius ladder spans concentrated ranges of one pool.</span></span><Badge tone="accent">You</Badge></li>
        <li><span><span className="plan-title">Peridot allow-lists it</span><span className="plan-detail">{APPROVAL_COPY} The add-market step shows &quot;Approved by Peridot&quot; in green or &quot;Needs Peridot approval&quot; in amber for the vault you pick.</span></span><Badge tone="neutral">Peridot admin</Badge></li>
        <li><span><span className="plan-title">Add the market with the vault</span><span className="plan-detail">In the launch wizard or the group control panel pick the venue in step 4 and choose your vault; add_market carries the vault address and attach_yield wires it. Zenex vaults then need one bind_market call with the market&apos;s receipt vault.</span></span><Badge tone="accent">You</Badge></li>
      </ol>
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

