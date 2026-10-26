'use client';
import { useEffect, useMemo, useState } from 'react';
import { Droplets, RefreshCw, Search, Vault } from 'lucide-react';
import { network } from '@/lib/peridot/network';
import { emitTx } from '@/lib/ui-events';
import { Badge, EmptyState, Notice, Skeleton, Tabs } from '@/components/ui/primitives';
import { Address } from '@/components/ui/Address';
import { VaultOptionList } from './VaultOptionList';
import { useAquariusPools } from './useAquariusPools';
import {
  applyPoolFilter, formatFee, formatUsd, isStablePair, isVaultEligible, pairLabel, vaultIneligibleReason, type AquariusPool, type PoolFilter, type PoolSource,
} from '@/lib/vaults/aquarius-pools';
import {
  FACTORY_SUPPORTS_AQUARIUS_ROUTE, MIN_IDLE_BUFFER_PCT, buildVaultPlan, defaultRange, demoVaultFromPlan, describeRange, loadDemoVaults, missingSteps, runDemoPlan, saveDemoVault,
  type DemoVault, type KeyValueStore,
} from '@/lib/vaults/vault-plan';
import './vaults.css';

const SOURCE_LABEL: Record<PoolSource, string> = { chain: 'Aquarius router (on chain)', api: 'Aquarius API', registry: 'Verified pool list shipped with the app', demo: 'Demo data' };
function store(): KeyValueStore | null { try { return window.localStorage; } catch { return null; } }

export default function VaultsPage() {
  const { loading, result, reload } = useAquariusPools();
  const [filter, setFilter] = useState<PoolFilter>('all');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<AquariusPool | null>(null);
  const [demoVaults, setDemoVaults] = useState<DemoVault[]>([]);
  useEffect(() => { setDemoVaults(loadDemoVaults(store(), network.name)); }, []);
  const pools = useMemo(() => applyPoolFilter(result?.pools ?? [], filter, query), [result, filter, query]);
  const eligibleCount = (result?.pools ?? []).filter(isVaultEligible).length;
  const netLabel = network.useMocks ? 'Demo' : network.name === 'mainnet' ? 'Mainnet (read only)' : 'Testnet';

  return <div className="page">
    <div className="page-heading">
      <div style={{ minWidth: 0 }}>
        <p className="eyebrow">Vaults</p>
        <h1 className="vault-title">Where a market earns yield <Badge tone={network.name === 'mainnet' && !network.useMocks ? 'success' : 'info'}>{netLabel}</Badge></h1>
        <p className="lead">Every yield venue Peridot knows about, and the Aquarius pools you could build a vault on. Blend and DeFindex are live. Aquarius has a guided demo. XOXNO and Zenex are listed so you can see what is planned.</p>
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
              <td className="actions span"><button type="button" className="button sm" disabled={!eligible} title={vaultIneligibleReason(pool) ?? undefined} aria-label={`Create a vault for ${pairLabel(pool)}`} onClick={() => { setSelected(pool); setTimeout(() => document.getElementById('create-vault')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50); }}>{eligible ? (isSel ? 'Selected' : 'Create a vault for me') : 'Not eligible'}</button></td>
            </tr>;
          })}</tbody></table></div>}
    </section>

    {selected && <CreateVaultPanel key={selected.address} pool={selected} onCreated={vault => setDemoVaults(saveDemoVault(store(), vault))} onClose={() => setSelected(null)} />}

    <section className="card" aria-labelledby="mine-h">
      <div className="card-header"><div><h2 id="mine-h">Your demo vaults</h2><p>Saved in this browser only. They are not contracts.</p></div></div>
      {demoVaults.length === 0 ? <EmptyState icon={Vault} title="No demo vaults yet" role="status"><p>Choose a concentrated pool above and press Create a vault for me.</p></EmptyState>
        : <div className="demo-vault-list">{demoVaults.map(v => <article key={v.id} className="card inset" data-testid="demo-vault">
          <div className="row between"><strong>{v.pair} LP vault</strong><Badge tone="warn">Demo, not deployed</Badge></div>
          <p className="muted" style={{ margin: '6px 0 0', fontSize: 13 }}>Underlying {v.underlyingSymbol} · {v.range} · cap {v.supplyCap} · {v.idleBufferPct}% kept liquid · reserve takes {v.reserveCutBps / 100}% of harvests</p>
          <p className="subtle" style={{ margin: '4px 0 0', fontSize: 12 }}>Created {new Date(v.createdAt).toLocaleString()} · pool <Address value={v.pool} label="pool address" head={6} tail={6} /></p>
        </article>)}</div>}
    </section>
  </div>;
}

function CreateVaultPanel({ pool, onCreated, onClose }: { pool: AquariusPool; onCreated: (v: DemoVault) => void; onClose: () => void }) {
  const [supplyCap, setSupplyCap] = useState('10000');
  const [idle, setIdle] = useState(String(MIN_IDLE_BUFFER_PCT));
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(0);
  const [finished, setFinished] = useState<DemoVault | null>(null);
  const [error, setError] = useState('');
  const range = defaultRange(pool);
  const plan = useMemo(() => buildVaultPlan({ pool, net: network.name, supplyCap, idleBufferPct: Number(idle), range }), [pool, supplyCap, idle, range]);
  const missing = missingSteps(plan);

  async function create() {
    setError(''); setDone(0); setFinished(null); setRunning(true);
    try {
      let n = 0;
      const txs = await runDemoPlan(plan, e => { emitTx({ id: e.id, status: e.status, method: e.method, message: e.message }); if (e.status === 'success') setDone(++n); });
      const vault = demoVaultFromPlan(plan, pool, network.name, txs);
      onCreated(vault); setFinished(vault);
    } catch (e) { setError(e instanceof Error ? e.message : 'The demo could not be completed.'); }
    finally { setRunning(false); }
  }

  return <section className="card vault-create" id="create-vault" aria-labelledby="create-h">
    <div className="card-header"><div><h2 id="create-h">Create a vault for {pairLabel(pool)}</h2><p>A USDC market whose idle liquidity is deployed into this concentrated Aquarius pool.</p></div><button type="button" className="button quiet sm" onClick={onClose}>Close</button></div>
    <Notice tone="warn" role="note" title={FACTORY_SUPPORTS_AQUARIUS_ROUTE ? 'Ready' : 'Demo flow: nothing is deployed'}>
      <p>The market factory cannot create an Aquarius-backed market yet ({missing.map(s => s.method).join(', ')} are missing). This walks the exact plan and saves a demo record in your browser. No wallet signature is requested and no transaction is sent. The contract spec is in docs/ui/VAULTS-UI.md.</p>
      {network.name === 'mainnet' && !network.useMocks && <p>Mainnet is read only in this app, so the demo is the only option here.</p>}
    </Notice>
    <div className="field-grid">
      <div className="field"><label htmlFor="vault-cap">Supply cap (USDC)</label><input id="vault-cap" inputMode="decimal" value={supplyCap} disabled={running} onChange={e => setSupplyCap(e.target.value.trim())} /><span className="field-hint">Required. Deposits above the cap are rejected.</span></div>
      <div className="field"><label htmlFor="vault-idle">Kept liquid (%)</label><input id="vault-idle" inputMode="decimal" value={idle} disabled={running} onChange={e => setIdle(e.target.value.trim())} /><span className="field-hint">At least {MIN_IDLE_BUFFER_PCT}%, so withdrawals do not depend on the pool.</span></div>
    </div>
    <p className="muted" style={{ fontSize: 13, margin: 0 }}>Range: <strong>{describeRange(plan.range)}</strong> · loss reserve takes {plan.reserveCutBps / 100}% of harvested rewards up to {plan.reserveCapBps / 100}% of deposits · underlying {plan.underlyingSymbol}{isStablePair(pool) ? '' : ' · volatile pair: impermanent loss is likely'}</p>
    {plan.errors.length > 0 && <Notice tone="danger" role="alert"><ul style={{ margin: 0, paddingLeft: 18 }}>{plan.errors.map(e => <li key={e}>{e}</li>)}</ul></Notice>}
    <ol className="plan-list" aria-label="Vault creation plan">{plan.steps.map((s, i) => <li key={s.id} className={i < done ? 'done' : i === done && running ? 'active' : undefined}>
      <span><span className="plan-title">{s.title}</span><span className="plan-detail">{s.detail}</span></span>
      <Badge tone={s.existsToday ? 'success' : 'warn'}>{s.existsToday ? 'Contract exists' : 'Contract missing'}</Badge>
    </li>)}</ol>
    {error && <Notice tone="danger" role="alert">{error}</Notice>}
    {finished && <Notice tone="success" role="status" title="Demo vault saved">Saved to "Your demo vaults" below. Nothing was sent on chain.</Notice>}
    <div className="row">
      <button type="button" className="button" disabled={!plan.ok || running} onClick={() => void create()}>{running ? `Creating demo vault (${done}/${plan.steps.length})` : 'Create demo vault'}</button>
      <span className="subtle" style={{ fontSize: 12 }}>Demo only. Vault shares can lose value; concentrated liquidity can suffer impermanent loss.</span>
    </div>
  </section>;
}
