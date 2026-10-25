'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Gift, RefreshCw, Scale, Settings2, Sprout, Wallet, X } from 'lucide-react';
import { getGroup, getMarketConfig } from '@/lib/peridot/factory';
import { useWallet } from '@/lib/peridot/wallet';
import { network } from '@/lib/peridot/network';
import { formatAmount, parseAmount } from '@/lib/peridot/amount';
import type { Group } from '@/lib/peridot/types';
import { readMarket, readRewards, claimRewards, lend, type MarketView, type LendingAction, type Progress } from '@/lib/peridot/group-client';
import { marginContext, positions, quoteOpen, openPosition, closePosition, resumeOpen, cancelOpen, cancelClose, withdrawMargin, repayResidual, closeHasSwapped, effectiveLeverage, type MarginContext, type Position, type OpenQuote, type Side } from '@/lib/peridot/margin';
import { Badge, EmptyState, KeyValue, Meter, Notice, Skeleton, Stat, Tabs, Tooltip } from '@/components/ui/primitives';
import { Address, TxLink } from '@/components/ui/Address';
import { fmtAmount, fmtCompact, fmtDate, fmtPct, fmtScaledPct } from '@/components/ui/format';
import { RateCurveChart } from '@/components/charts/RateCurveChart';
import { PayoffChart } from '@/components/charts/PayoffChart';
import { RunwayBar } from '@/components/charts/RunwayBar';
import { HealthGauge } from '@/components/charts/HealthGauge';
import { routeLabel } from '@/components/markets/GroupOverview';
const readable=(e:unknown)=>e instanceof Error?e.message:String(e);
const quantity=(amount:bigint,decimals:number)=>formatAmount(amount,decimals);
const priceTone=(status?:string)=>status==='ok'?'success':status==='stale'||status==='deviation'?'warn':'danger';
const capPct=(used:bigint,cap:bigint)=>cap>0n?Number(used*10000n/cap)/100:0;
const progressCopy:Record<Progress['status'],string>={simulating:'Checking the transaction...',signing:'Confirm the transaction in your wallet.',submitting:'Submitting transaction...',confirming:'Waiting for confirmation...',success:'Transaction confirmed.',unknown:'Confirmation unavailable. Check the hash before retrying.',error:'Transaction failed.'};
export default function GroupDashboard({id}:{id:string}) {
  const wallet=useWallet();
  const [group,setGroup]=useState<Group|null>(null),[markets,setMarkets]=useState<MarketView[]>([]),[rewards,setRewards]=useState<Awaited<ReturnType<typeof readRewards>>>(null);
  const [margin,setMargin]=useState<MarginContext|null>(null),[positionList,setPositionList]=useState<Position[]>([]);
  const [loading,setLoading]=useState(true),[error,setError]=useState(''),[busy,setBusy]=useState(false),[progress,setProgress]=useState<Progress|null>(null),[hashes,setHashes]=useState<string[]>([]);
  const [active,setActive]=useState<string|null>(null),[action,setAction]=useState<LendingAction>('Supply'),[amount,setAmount]=useState(''),[useAll,setUseAll]=useState(false),[tab,setTab]=useState<'markets'|'leverage'>('markets');
  const [marginMarket,setMarginMarket]=useState(''),[baseMarket,setBaseMarket]=useState(''),[marginAmount,setMarginAmount]=useState(''),[side,setSide]=useState<Side>('Long'),[leverage,setLeverage]=useState(2),[slippage,setSlippage]=useState('1'),[review,setReview]=useState<OpenQuote|null>(null);
  const [closeReview,setCloseReview]=useState<Position|null>(null);
  const [residualAmount,setResidualAmount]=useState('');
  const flight=useRef(false),generation=useRef(0);
  const refresh=useCallback(async()=>{
    const version=++generation.current;
    try {
      if(!/^\d+$/.test(id)||Number(id)>4294967295)throw new Error('Invalid group ID.');
      const g=await getGroup(Number(id));
      const configs=await Promise.all(g.markets.map(m=>getMarketConfig(g.id,m)));
      const views=await Promise.all(g.markets.map((m,i)=>readMarket(g,m,configs[i],wallet.address)));
      const [r,ctx]=await Promise.all([readRewards(g,wallet.address),marginContext(g,views)]);
      const p=ctx&&wallet.address?await positions(ctx,wallet.address):[];
      if(version!==generation.current)return;
      setGroup(g);setMarkets(views);setRewards(r);setMargin(ctx);setPositionList(p);
      const eligible=views.filter(m=>ctx?.info.enabled_markets.includes(m.address));
      setMarginMarket(old=>eligible.some(m=>m.address===old)?old:eligible[0]?.address||'');
      setBaseMarket(old=>eligible.some(m=>m.address===old)?old:eligible[1]?.address||'');setError('');
    }catch(e){if(version===generation.current)setError(readable(e));}finally{if(version===generation.current)setLoading(false);}
  },[id,wallet.address]);
  useEffect(()=>{void refresh();return()=>{generation.current++;};},[refresh]);
  useEffect(()=>{setReview(null);setCloseReview(null);},[wallet.address,id,marginAmount,marginMarket,baseMarket,side,leverage,slippage]);
  const report=(p:Progress)=>{setProgress(p);if(p.hash)setHashes(old=>old.includes(p.hash!)?old:[p.hash!,...old].slice(0,12));};
  const run=async(task:()=>Promise<unknown>,clearReview=true)=>{
    if(flight.current)return;
    flight.current=true;setBusy(true);setError('');setProgress(null);
    try{await task();if(clearReview){setReview(null);setCloseReview(null);}await refresh();}catch(e){setError(readable(e));await refresh().catch(()=>{});setError(readable(e));}finally{flight.current=false;setBusy(false);}
  };
  const signer=()=>{if(!wallet.address)throw new Error('Connect your wallet first.');if(wallet.networkMismatch)throw new Error('Switch your wallet to the selected app network.');return {address:wallet.address,signTransaction:wallet.signTransaction};};
  const selected=markets.find(m=>m.address===active),disabled=busy||!wallet.address||wallet.networkMismatch||network.readOnly;
  const needsMarketEntry=!!selected&&!selected.entered&&(action==='Borrow'||action==='Supply'&&!!group?.reward_distributor);
  const mAsset=markets.find(m=>m.address===marginMarket),bAsset=markets.find(m=>m.address===baseMarket);
  const maxLeverage=margin&&mAsset&&bAsset?Math.floor(margin.limits?.[(side==='Long'?bAsset:mAsset).address]??effectiveLeverage(Number(margin.info.cfg.max_leverage),(side==='Long'?bAsset:mAsset).config.collateral_factor)):2;
  if(loading)return <div className="page" aria-busy="true"><div className="page-heading"><div style={{display:'grid',gap:10,width:'min(100%,420px)'}}><Skeleton width={160} height={12}/><Skeleton width={260} height={32}/><Skeleton width={320} height={14}/></div></div><section className="card" role="status"><Skeleton width={120} height={20}/><div className="stack-sm mt-4">{[0,1].map(i=><div key={i} className="stack-sm"><Skeleton height={16}/><Skeleton height={6}/></div>)}</div><p className="sr-only">Loading group and market balances...</p></section></div>;
  if(!group)return <div className="page"><EmptyState title="Group unavailable" role="alert" action={<div className="row"><button className="button" onClick={()=>void refresh()}>Retry</button><Link className="button ghost" href="/groups">All groups</Link></div>}><p>{error||'This group could not be loaded.'}</p></EmptyState></div>;
  // Display-only derivations.
  const held=markets.filter(m=>m.receiptBalance>0n||m.debt>0n);
  const routes=[...new Set(markets.map(m=>m.config.yield_route.tag))];
  const emissionsPerSecond=markets.reduce((sum,m)=>sum+m.config.supply_reward_per_sec+m.config.borrow_reward_per_sec,0n);
  const collateralAsset=side==='Long'?bAsset:mAsset;
  const mmRaw=margin?.status?.maintenance_margin;
  const maintenanceKnown=typeof mmRaw==='bigint'&&mmRaw>0n&&mmRaw<1_000_000n;
  const maintenance=maintenanceKnown?Number(mmRaw)/1e6:collateralAsset?1-Number(collateralAsset.config.collateral_factor)/1e6:null;
  const cfBound=collateralAsset?1/(1-Number(collateralAsset.config.collateral_factor)/1e6):null;
  const marginNumber=(()=>{const n=Number(marginAmount);return Number.isFinite(n)&&n>0?n:0;})();
  const progressTone=progress?.status==='success'?'success':progress?.status==='error'?'danger':progress?.status==='unknown'?'warn':'info';
  return <div className="page group-dashboard">
    <header className="page-heading">
      <div style={{minWidth:0}}>
        <p className="eyebrow">Isolated market group #{group.id}</p>
        <h1>{group.name}</h1>
        <div className="row" style={{marginTop:6}}>
          {group.margin_controller&&<Badge tone="info" icon={Scale}>Leverage</Badge>}
          {group.reward_distributor&&<Badge tone="warn" icon={Gift}>Rewards</Badge>}
          {routes.map(tag=><Badge key={tag} icon={tag==='None'?undefined:Sprout}>{routeLabel(tag)}</Badge>)}
          <span className="subtle" style={{fontSize:12,display:'inline-flex',alignItems:'center',gap:6}}>Owner <Address value={group.owner} label="owner address"/></span>
        </div>
      </div>
      <div className="page-actions"><button className="button secondary" onClick={()=>void refresh()} disabled={busy}><RefreshCw size={14} aria-hidden/>Refresh</button>{wallet.address===group.owner&&<Link className="button secondary" href={`/groups/${group.id}/control`}><Settings2 size={14} aria-hidden/>Control Panel</Link>}</div>
    </header>
    {network.useMocks&&<Notice tone="info" role="note">Demo mode. Balances and actions are simulated. Each market action advances one second of demo rewards.</Notice>}
    {error&&<Notice tone="danger" role="alert">{error}</Notice>}
    {progress&&<Notice tone={progressTone} role="status">{progress.message||progressCopy[progress.status]}</Notice>}
    {!wallet.address&&<section className="card" style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:16,flexWrap:'wrap'}}><div className="row"><Wallet size={18} aria-hidden style={{color:'var(--accent-text)'}}/><p style={{margin:0}}>Connect your wallet to see your balances and use these markets.</p></div><button className="button" onClick={()=>void wallet.connect()} disabled={wallet.isConnecting}>Connect wallet</button></section>}
    {markets.filter(m=>m.needsTrustline).map(m=><Notice key={m.address} tone="warn" role="status">Add a {m.token.symbol} trustline with your wallet before receiving or using this asset, then refresh balances. Other markets and market entry remain available.</Notice>)}
    <Tabs ariaLabel="Group sections" value={tab} onChange={setTab} items={[{value:'markets',label:'Markets and rewards'},{value:'leverage',label:'Leverage'}]}/>
    {tab==='markets'?<>
      {wallet.address&&<section className="card">
        <div className="card-header"><div><h2>Your position</h2><p>Balances in this group for the connected wallet.</p></div>{positionList.length>0&&<Badge tone="info" icon={Scale}>{positionList.length} leveraged {positionList.length===1?'position':'positions'}</Badge>}</div>
        {held.length===0?<p className="muted">No supplied or borrowed balances yet. Choose a market below to supply.</p>:<div className="stat-grid">{held.map(m=><Stat key={m.address} label={`${m.token.symbol} supplied`} value={fmtAmount(m.receiptBalance*m.exchangeRate/1000000n,m.token.decimals,4)} hint={<>{m.debt>0n?`${fmtAmount(m.debt,m.token.decimals,4)} borrowed`:'No debt'}{' · '}{m.entered?'Collateral enabled':'Not enabled as collateral'}</>}/>)}</div>}
        <p className="subtle mt-4" style={{fontSize:12}}>Health: the controller checks borrowing power before every transaction. A lending account becomes liquidatable when its debt exceeds the value of enabled collateral times the collateral factor. Leveraged positions show their own health factor on the Leverage tab.</p>
      </section>}
      <div className={selected?'two-col manage-layout':''}>
        <section className="card">
          <div className="card-header"><div><h2>Markets</h2><p>APR is an indicative annual quote from the configured interest curve and current accounting. Strategy yield is shown separately when available.</p></div></div>
          <div className="table-scroll"><table className="data-table markets-table"><thead><tr><th>Asset</th><th>Supply APR</th><th>Borrow APR</th><th>Utilization and caps</th><th className="col-opt">Collateral factor</th><th className="col-opt">Yield route</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>{markets.map(m=><tr key={m.address}>
            <td data-label="Asset"><span className="cell-main">{m.token.symbol}</span><span className="cell-sub">{fmtCompact(m.supplied,m.token.decimals)} supplied{' · '}{fmtCompact(m.borrowed,m.token.decimals)} borrowed</span><span className="cell-sub"><Badge tone={priceTone(m.price?.status)}>Price {m.price?.status||'unavailable'}</Badge></span></td>
            <td data-label="Supply APR"><span className="cell-main num">{fmtPct(m.supplyApr)}</span><span className="cell-sub">{rewards?`+ ${fmtAmount((m.config.supply_reward_per_sec+m.config.borrow_reward_per_sec)*86400n,rewards.token.decimals)} ${rewards.token.symbol}/day rewards`:'No rewards'}</span></td>
            <td data-label="Borrow APR"><span className="cell-main num">{fmtPct(m.borrowApr)}</span>{m.borrowApr===0&&m.config.rates.jump===0n&&<span className="cell-sub">Zero borrow rate</span>}</td>
            <td data-label="Utilization and caps" className="span cell-meters"><Meter thin label="Utilization" value={fmtPct(m.utilization,1)} pct={m.utilization} ariaLabel={`${m.token.symbol} utilization`}/><Meter thin label="Supply cap" value={`${fmtPct(capPct(m.supplied,m.config.supply_cap),0)} of ${fmtCompact(m.config.supply_cap,m.token.decimals)}`} pct={capPct(m.supplied,m.config.supply_cap)} ariaLabel={`${m.token.symbol} supply cap usage`}/><Meter thin label="Borrow cap" value={`${fmtPct(capPct(m.borrowed,m.config.borrow_cap),0)} of ${fmtCompact(m.config.borrow_cap,m.token.decimals)}`} pct={capPct(m.borrowed,m.config.borrow_cap)} ariaLabel={`${m.token.symbol} borrow cap usage`}/></td>
            <td data-label="Collateral factor" className="col-opt"><span className="num">{fmtScaledPct(m.config.collateral_factor)}</span></td>
            <td data-label="Yield route" className="span col-opt"><span className="row" style={{gap:6}}><Badge icon={m.config.yield_route.tag==='None'?undefined:Sprout}>{routeLabel(m.config.yield_route.tag)}</Badge><Tooltip label="About the liquid buffer" text={`${m.config.idle_buffer_bps/100}% of deposits stay liquid in the market for withdrawals and borrowing. ${m.config.yield_route.tag==='None'?'Nothing is routed out of the market.':`The remaining ${100-m.config.idle_buffer_bps/100}% can be routed into the ${routeLabel(m.config.yield_route.tag)} vault and is pulled back when liquidity is needed.`}`}/></span><span className="cell-sub">{m.config.idle_buffer_bps/100}% liquid buffer{m.vault&&m.vault.apy_hint_bps>0?` · ${(m.vault.apy_hint_bps/100).toFixed(2)}% indicative APY`:m.config.yield_route.tag!=='None'?' · Route APY unavailable':''}</span></td>
            <td className="actions"><button className="button secondary sm" onClick={()=>{setActive(m.address);setAmount('');setUseAll(false);}}>Manage {m.token.symbol}</button></td>
          </tr>)}</tbody></table></div>
          {rewards&&<p className="subtle mt-4" style={{fontSize:12}}>Reward APR unavailable without a reward price.</p>}
        </section>
        {selected&&<aside className="card manage-panel" aria-label={`${selected.token.symbol} market actions`}>
          <div className="card-header"><div><h2>{selected.token.symbol}</h2><p className="row" style={{gap:6}}>Market <Address value={selected.address} label="market address"/></p></div><button className="button quiet sm" onClick={()=>setActive(null)} aria-label={`Close ${selected.token.symbol} panel`}><X size={14} aria-hidden/>Close</button></div>
          <div className="stat-grid" style={{gridTemplateColumns:'repeat(3,minmax(0,1fr))'}}><Stat label="Your supply" value={fmtAmount(selected.receiptBalance*selected.exchangeRate/1000000n,selected.token.decimals,4)}/><Stat label="Your debt" value={fmtAmount(selected.debt,selected.token.decimals,4)}/><Stat label="Wallet balance" value={fmtAmount(selected.walletBalance,selected.token.decimals,4)}/></div>
          <div className="divider"/>
          <Tabs block ariaLabel="Market action" value={action} onChange={a=>{setAction(a);setUseAll(false);}} items={(['Supply','Withdraw','Borrow','Repay'] as const).map(a=>({value:a,label:a}))}/>
          <ol className="step-list" aria-label="Steps">
            <li className={selected.entered?'done':needsMarketEntry?'current':''}><span className="step-dot" aria-hidden>{selected.entered?'✓':'1'}</span><div><strong>Enable market</strong><span>{selected.entered?'Enabled as collateral in this group. ':'Enable this market before borrowing its asset, earning group rewards or using its supply as collateral. '}Collateral factor: {Number(selected.config.collateral_factor)/10000}%.</span>{!selected.entered&&<button className="button secondary sm mt-2" disabled={disabled} onClick={()=>void run(()=>lend(group,selected,'Enable collateral','',signer(),report))}>Enable market</button>}</div></li>
            <li className={selected.entered||!needsMarketEntry?'current':''}><span className="step-dot" aria-hidden>2</span><div><strong>{action} {selected.token.symbol}</strong><span>{action==='Withdraw'?'Receipt shares are converted using the current exchange rate. The amount received may change as interest accrues.':action==='Borrow'?'Your enabled collateral supports borrowing only within this group. Interest accrues on the debt.':action==='Repay'?'Repayment transfers this asset from your connected wallet.':'Your deposit earns the market rate. Idle liquidity follows the owner’s chosen route.'}</span></div></li>
          </ol>
          {needsMarketEntry&&<Notice tone="warn" role="status">{action==='Borrow'?`Enable the ${selected.token.symbol} market before borrowing this asset. Enable your collateral markets too.`:`Enable the ${selected.token.symbol} market before supplying so this deposit can earn group rewards.`} Use Enable market above, confirm that separate transaction, then return to {action.toLowerCase()}.</Notice>}
          <form className="stack" onSubmit={e=>{e.preventDefault();if(needsMarketEntry){setError('Enable this market and wait for confirmation before continuing.');return;}void run(()=>lend(group,selected,action,amount,signer(),report,useAll));}}>
            <div className="field"><label htmlFor="market-amount">{action} amount in {selected.token.symbol}</label><div className="amount-row"><input id="market-amount" value={amount} inputMode="decimal" required={!useAll} disabled={useAll} onChange={e=>setAmount(e.target.value)} placeholder="0.00"/>{action!=='Borrow'&&<button type="button" className="button ghost sm" disabled={useAll} onClick={()=>setAmount(quantity(action==='Supply'?selected.walletBalance:action==='Withdraw'?selected.receiptBalance*selected.exchangeRate/1000000n:selected.debt,selected.token.decimals))}>Max</button>}</div></div>
            {(action==='Withdraw'||action==='Repay')&&<label className="check"><input type="checkbox" checked={useAll} onChange={e=>setUseAll(e.target.checked)}/>{action==='Withdraw'?'Withdraw all receipt shares':'Repay the full accrued debt'}</label>}
            <button className="button block" disabled={disabled||selected.needsTrustline||needsMarketEntry}>{busy?'Working...':`${action} ${selected.token.symbol}`}</button>
          </form>
          <div className="divider"/>
          <RateCurveChart rates={selected.config.rates} reserveFactor={selected.config.reserve_factor} utilization={selected.utilization} height={180}/>
          <div className="divider"/>
          <h3>Price and yield route</h3>
          <KeyValue rows={[['Price status',<Badge key="p" tone={priceTone(selected.price?.status)}>{selected.price?.status||'Unavailable'}</Badge>],...(selected.price?[['Last update',fmtDate(selected.price.timestamp)] as [string,string]]:[]),['Yield route',routeLabel(selected.config.yield_route.tag)],['Liquid buffer',`${selected.config.idle_buffer_bps/100}%`],...(selected.vault?[[selected.vault.kind,`${fmtAmount(selected.vault.total_value,selected.token.decimals,4)} ${selected.token.symbol} in the strategy${selected.vault.paused?' (paused)':''}`] as [string,string]]:[])]}/>
          {selected.priceError&&<p className="subtle" style={{fontSize:12}}>Price check unavailable. Transaction simulation still enforces contract pricing.</p>}
          {selected.vaultError&&<p className="subtle" style={{fontSize:12}}>Strategy details are currently unavailable.</p>}
        </aside>}
      </div>
      <section className="card">
        <div className="card-header"><div><h2>Rewards</h2><p>{rewards?`Group rewards are paid in ${rewards.token.symbol} from a funded distributor.`:'This group has no reward token configured.'}</p></div>{rewards&&<Badge tone="warn" icon={Gift}>{rewards.token.symbol}</Badge>}</div>
        {rewards&&<div className="grid-2">
          <div className="stack">
            <div className="stat-grid"><Stat label="Accrued rewards" value={fmtAmount(rewards.accrued,rewards.token.decimals,4)} unit={rewards.token.symbol}/><Stat label="Distributor funding" value={fmtAmount(rewards.available,rewards.token.decimals,4)} unit={rewards.token.symbol}/></div>
            <p className="muted" style={{fontSize:13}}>Enable each market before supplying to earn its rewards. Enabling a market is a separate wallet transaction. Accrual updates when you interact with enabled markets. If funding runs out, unpaid accrued rewards remain claimable after replenishment.</p>
            <div><button className="button" disabled={disabled||markets.some(m=>m.token.address===rewards.token.address&&m.needsTrustline)} onClick={()=>void run(()=>claimRewards(group,signer(),report))}>Claim rewards</button></div>
          </div>
          <div className="stack">
            <RunwayBar balance={rewards.available} perSecond={emissionsPerSecond} decimals={rewards.token.decimals} symbol={rewards.token.symbol}/>
            <table className="data-table"><thead><tr><th>Market</th><th>Supply rewards</th><th>Borrow rewards</th></tr></thead><tbody>{markets.map(m=><tr key={m.address}><td data-label="Market"><span className="cell-main">{m.token.symbol}</span></td><td data-label="Supply rewards"><span className="num">{fmtAmount(m.config.supply_reward_per_sec*86400n,rewards.token.decimals)}</span> <span className="subtle">{rewards.token.symbol}/day</span></td><td data-label="Borrow rewards"><span className="num">{fmtAmount(m.config.borrow_reward_per_sec*86400n,rewards.token.decimals)}</span> <span className="subtle">{rewards.token.symbol}/day</span></td></tr>)}</tbody></table>
          </div>
        </div>}
      </section>
    </>:<section className="card">
      <div className="card-header"><div><h2>Leverage</h2><p>Open long or short positions using supplied assets as margin. Positions can be liquidated when their health falls below 1.0.</p></div>{margin&&<Badge tone="info" icon={Scale}>Group max {margin.info.cfg.max_leverage.toString()}x</Badge>}</div>
      {!margin?<p className="muted">Leverage has not been enabled for this group.</p>:<div className="stack">
        {margin.status&&!margin.status.incentive_applied&&<Notice tone="warn" role="status">A group liquidation-incentive change is pending. Current lending incentive: {Number(margin.status.applied_liquidation_incentive)/10000}%. Owner apply time: {new Date(Number(margin.status.incentive_apply_after)*1000).toLocaleString()}. Margin pairs use their configured incentive immediately.</Notice>}
        {margin.info.enabled_markets.length<2&&<Notice tone="warn" role="status">The owner must enable at least two approved markets and a pool route before new positions can open.</Notice>}
        <div className="two-col leverage-layout">
          <form className="stack" onSubmit={e=>{e.preventDefault();void run(async()=>{if(!mAsset||!bAsset)throw new Error('Choose margin and base markets.');const q=await quoteOpen(margin,signer().address,mAsset,bAsset,parseAmount(marginAmount,mAsset.token.decimals)*1000000n/mAsset.exchangeRate,leverage,side,Math.round(Number(slippage)*100));setReview(q);},false);}}>
            <div className="field-grid">
              <div className="field"><label htmlFor="lev-margin">Margin asset</label><select id="lev-margin" value={marginMarket} onChange={e=>setMarginMarket(e.target.value)}>{markets.filter(m=>margin.info.enabled_markets.includes(m.address)).map(m=><option key={m.address} value={m.address}>{m.token.symbol}</option>)}</select></div>
              <div className="field"><label htmlFor="lev-base">Base asset</label><select id="lev-base" value={baseMarket} onChange={e=>setBaseMarket(e.target.value)}>{markets.filter(m=>margin.info.enabled_markets.includes(m.address)).map(m=><option key={m.address} value={m.address}>{m.token.symbol}</option>)}</select></div>
            </div>
            <div className="field"><span>Direction</span><div className="tabs block" role="group" aria-label="Direction">{(['Long','Short'] as Side[]).map(s=><button type="button" key={s} className={side===s?'selected':''} aria-pressed={side===s} onClick={()=>setSide(s)}>{s}</button>)}</div></div>
            <div className="field"><label htmlFor="lev-amount">Margin amount</label><input id="lev-amount" required inputMode="decimal" value={marginAmount} onChange={e=>setMarginAmount(e.target.value)} placeholder="Supply this asset first"/><span>{mAsset?`${fmtAmount(mAsset.receiptBalance*mAsset.exchangeRate/1000000n,mAsset.token.decimals,4)} ${mAsset.token.symbol} supplied and available as margin.`:''}</span></div>
            <div className="field"><span>Leverage</span><div className="lev-select" role="group" aria-label="Leverage multiplier">{Array.from({length:Math.max(0,maxLeverage-1)},(_,i)=>i+2).map(n=><button type="button" key={n} className={leverage===n?'selected':''} aria-pressed={leverage===n} onClick={()=>setLeverage(n)}>{n}x</button>)}{maxLeverage<2&&<span className="subtle">No leverage available for this pair yet.</span>}</div><span>Effective maximum for {collateralAsset?.token.symbol||'this collateral'}: {maxLeverage}x{margin.info.cfg.max_leverage?` (group limit ${margin.info.cfg.max_leverage.toString()}x`:''}{cfBound?`, collateral factor bound ${cfBound.toFixed(1)}x`:''}{collateralAsset?.config.price.tag==='AquariusOnly'?', 2x cap for pool-priced tokens':''}{margin.info.cfg.max_leverage?')':''}.</span></div>
            <div className="field"><label htmlFor="lev-slippage">Maximum slippage (%)</label><input id="lev-slippage" required type="number" min="0" max="10" step="0.1" value={slippage} onChange={e=>setSlippage(e.target.value)}/><span>Group limit {Number(margin.info.cfg.max_slippage)/10000}%. The stricter of your setting and the group limit applies.</span></div>
            <button className="button" disabled={disabled||maxLeverage<2||margin.info.enabled_markets.length<2}>Review position</button>
          </form>
          <div className="stack">
            <PayoffChart margin={marginNumber} leverage={leverage} side={side} symbol={mAsset?.token.symbol||''} maintenance={maintenance} estimated={!maintenanceKnown}/>
            <div className="card inset">
              <h3>Fees and slippage</h3>
              {review?<KeyValue rows={[['Margin',`${fmtAmount(review.shares*review.margin.exchangeRate/1000000n,review.margin.token.decimals,4)} ${review.margin.token.symbol}`],['Opening fee',`${fmtAmount(review.feeShares*review.margin.exchangeRate/1000000n,review.margin.token.decimals,4)} ${review.margin.token.symbol}`],['Closing fee',`${Number(review.closeFeeBps)/100}% of execution notional`],['Expected swap output',`${fmtAmount(review.expectedOut,review.side==='Long'?review.base.token.decimals:review.margin.token.decimals,4)} ${review.side==='Long'?review.base.token.symbol:review.margin.token.symbol}`],['Minimum swap output',`${fmtAmount(review.minOut,review.side==='Long'?review.base.token.decimals:review.margin.token.decimals,4)} ${review.side==='Long'?review.base.token.symbol:review.margin.token.symbol}`],['Slippage',`${review.slippageBps/100}%`],['Pool route',review.route.pool.startsWith('C')?<Address key="pool" value={review.route.pool} label="pool address"/>:review.route.pool]]}/>:<KeyValue rows={[['Opening fee','Quoted on review'],['Closing fee','Quoted on review'],['Your slippage',`${slippage||'0'}%`],['Group slippage limit',`${Number(margin.info.cfg.max_slippage)/10000}%`],['Liquidation incentive',`${Number(margin.info.cfg.liquidation_incentive)/10000}%`]]}/>}
            </div>
          </div>
        </div>
        {review&&<div className="card inset review-card"><h3>Review {review.leverage}x {review.side.toLowerCase()}</h3><p>Margin: {quantity(review.shares*review.margin.exchangeRate/1000000n,review.margin.token.decimals)} {review.margin.token.symbol}. Opening fee: {quantity(review.feeShares*review.margin.exchangeRate/1000000n,review.margin.token.decimals)} {review.margin.token.symbol}. Closing fee: {Number(review.closeFeeBps)/100}% of execution notional.</p><p>Minimum swap output: {quantity(review.minOut,review.side==='Long'?review.base.token.decimals:review.margin.token.decimals)} {review.side==='Long'?review.base.token.symbol:review.margin.token.symbol}.</p><p className="muted">You will confirm each stage in your wallet. If interrupted, refresh and resume the pending position below.</p><button className="button" disabled={disabled} onClick={()=>void run(()=>openPosition(margin,review,signer(),report))}>Confirm and open</button></div>}
        <div>
          <h3>Your positions</h3>
          {positionList.length===0?<p className="muted">No open or pending positions for this wallet.</p>:<div className="grid-2">{positionList.map(p=><article className="card inset position-card" key={p.id.toString()}>
            <div className="card-header" style={{marginBottom:8}}><div><h4 style={{margin:0}}>#{p.id.toString()} {'·'} {p.side}</h4><p>{markets.find(m=>m.token.address===p.collateral_asset)?.token.symbol||'Collateral'} collateral, {markets.find(m=>m.token.address===p.debt_asset)?.token.symbol||'debt'} debt</p></div><Badge tone={p.status==='Open'?'success':p.status==='Liquidated'?'danger':'warn'}>{p.status}</Badge></div>
            <HealthGauge health={p.health}/>
            <KeyValue rows={[['Estimated liquidation price',p.liquidationPrice===null?'Unavailable':`${p.liquidationPrice.toPrecision(5)} ${markets.find(m=>m.token.address===p.perps?.margin_asset)?.token.symbol||''} per base token`],['Collateral',`${fmtAmount(p.collateralUnderlying,markets.find(m=>m.token.address===p.collateral_asset)?.token.decimals||7,4)} ${markets.find(m=>m.token.address===p.collateral_asset)?.token.symbol||''}`],['Debt',`${fmtAmount(p.debt,markets.find(m=>m.token.address===p.debt_asset)?.token.decimals||7,4)} ${markets.find(m=>m.token.address===p.debt_asset)?.token.symbol||''}`]]}/>
            <div className="row" style={{marginTop:12}}>{p.status==='PendingOpen'?<><button className="button" disabled={disabled} onClick={()=>void run(()=>resumeOpen(margin,p.id,signer(),report))}>Resume open</button>{!p.execution&&<button className="button secondary" disabled={disabled} onClick={()=>void run(()=>cancelOpen(margin,p.id,signer(),report))}>Cancel pending open</button>}</>:<button className="button" disabled={disabled||!['Open','Closing'].includes(p.status)} onClick={()=>{setCloseReview(p);setResidualAmount('');}}>{p.pendingClose?'Resume close':'Review close'}</button>}{p.pendingClose&&!closeHasSwapped(p.pendingClose)&&<button className="button secondary" disabled={disabled} onClick={()=>void run(()=>cancelClose(margin,p.id,signer(),report))}>Cancel unswapped close</button>}</div>
          </article>)}</div>}
        </div>
        {closeReview&&<div className="card inset"><h3>Close position #{closeReview.id.toString()}</h3><p>Swap position collateral to repay its debt. Maximum slippage: {slippage}%. Remaining funds return to your free margin balance.</p><p className="muted">The close reserves up to 10% additional debt headroom for accrued interest and signing time. Unspent collateral returns to free margin. No additional wallet repayment is automatic. Each stage requires a wallet confirmation.</p><div className="row"><button className="button" disabled={disabled} onClick={()=>void run(()=>closePosition(margin,closeReview,signer(),Math.round(Number(slippage)*100),report))}>Confirm close</button><button className="button secondary" onClick={()=>setCloseReview(null)}>Cancel</button></div>{closeReview.pendingClose&&closeHasSwapped(closeReview.pendingClose)&&closeReview.pendingClose.received_debt_asset===0n&&<div className="mt-4"><h4>Review residual repayment</h4><p>The close has already swapped. Remaining debt: {quantity(closeReview.debt,markets.find(m=>m.token.address===closeReview.debt_asset)?.token.decimals||7)} {markets.find(m=>m.token.address===closeReview.debt_asset)?.token.symbol}. This optional action spends tokens from your wallet. Interest accrued during repayment can leave a small remaining balance. Refresh and review the debt after each payment.</p><div className="field"><label htmlFor="residual-amount">Maximum repayment amount</label><input id="residual-amount" inputMode="decimal" value={residualAmount} onChange={e=>setResidualAmount(e.target.value)}/></div><button className="button secondary mt-2" disabled={disabled||!residualAmount||markets.some(m=>m.token.address===closeReview.debt_asset&&m.needsTrustline)} onClick={()=>void run(()=>repayResidual(margin,closeReview,parseAmount(residualAmount,markets.find(m=>m.token.address===closeReview.debt_asset)?.token.decimals||7),signer(),report))}>Confirm wallet repayment</button></div>}</div>}
        {!network.useMocks&&<div><h3>Recover free margin</h3><p className="muted">Move unused or settled margin shares back to your supply balance, then withdraw them from the Markets tab.</p><div className="row">{markets.filter(m=>margin.info.enabled_markets.includes(m.address)).map(m=><button key={m.address} className="button secondary" disabled={disabled} onClick={()=>void run(()=>withdrawMargin(margin,m,signer(),report))}>Return {m.token.symbol} margin to supply</button>)}</div></div>}
      </div>}
    </section>}
    {hashes.length>0&&<section className="card"><h2>Transactions this session</h2><ul className="history">{hashes.map(hash=><li key={hash}><code className="wrap">{hash}</code><TxLink hash={hash}>View <ArrowRight size={12} aria-hidden/></TxLink></li>)}</ul></section>}
  </div>;
}
