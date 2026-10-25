'use client';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, CheckCircle2, ExternalLink, Layers3, Plus, Trash2 } from 'lucide-react';
import MarketConfigEditor from '@/components/markets/MarketConfigEditor';
import { formatAmount, parseAmount } from '@/lib/peridot/amount';
import { isMarginAvailable, network, transactionUrl } from '@/lib/peridot/network';
import { useWallet } from '@/lib/peridot/wallet';
import { dailyToSpeed, newMarketDraft, RATE_PRESETS, type MarketDraft } from '@/lib/peridot/market-config';
import { MOCK_ORACLE, MOCK_USDC, MOCK_XLM } from '@/lib/peridot/mock';
import { clearCompletedLaunch, discoverMarginPools, launchScope, launchSteps, loadLaunch, newLaunch, recoverLaunchStep, runNextLaunchStep, saveLaunch, validateLaunch, verifyRewardToken, type LaunchDraft, type LaunchSession } from '@/lib/peridot/launch';
import { GUARDRAILS } from '@/lib/peridot/types';
import type { TxProgress } from '@/lib/peridot/rpc';
import './launch.css';

function initialDraft():LaunchDraft {
  const market=(token:string,symbol:string):MarketDraft=>({...newMarketDraft(),token,symbol,decimals:7,price:{tag:'ReflectorOnly',values:[{oracle:MOCK_ORACLE,asset:{tag:'Other',values:[symbol]}}]},...(symbol==='XLM'?RATE_PRESETS['Zero borrow rate']:RATE_PRESETS.Stable)});
  return {name:'Meridian',description:'',markets:network.useMocks?[market(MOCK_USDC,'USDC'),market(MOCK_XLM,'XLM')]:[newMarketDraft()],rewardsEnabled:false,rewardToken:'',rewardSymbol:'',rewardDecimals:7,rewardFunding:'100',marginEnabled:false,maxLeverage:'3',slippage:'1',liquidationIncentive:'108',liquidationFee:'0',marginPools:[]};
}
const stageNames=['Group','Markets','Leverage','Rewards','Review'];
export default function LaunchWizard(){
 const wallet=useWallet();
 const [draft,setDraft]=useState<LaunchDraft>(initialDraft);
 const [stage,setStage]=useState(0);
 const [session,setSession]=useState<LaunchSession|null>(null);
 const [error,setError]=useState('');
 const [busy,setBusy]=useState(false);
 const [progress,setProgress]=useState<TxProgress|null>(null);
 const [checkingReward,setCheckingReward]=useState(false);
 const [checkingPools,setCheckingPools]=useState(false);
 const [storageLoaded,setStorageLoaded]=useState(false);
 const currentWallet=useRef(wallet.address);currentWallet.current=wallet.address;
 const loadedScope=useRef('');
 useEffect(()=>{
  setStorageLoaded(false);
  if(!wallet.address){loadedScope.current='';setSession(null);setStorageLoaded(true);return;}
  try {
   const scope=launchScope(wallet.address);
   if(loadedScope.current===scope){setStorageLoaded(true);return;}
   const stored=loadLaunch(scope);loadedScope.current=scope;
   if(stored){setSession(stored);setDraft(stored.draft);setStage(4);}
   else {setSession(null);setDraft(initialDraft());setStage(0);}
   setError('');
  }catch(e){setError(e instanceof Error?e.message:'Saved launch could not be loaded.');}
  setStorageLoaded(true);
 },[wallet.address]);
 const frozen=!!session;
 const errors=useMemo(()=>validateLaunch(draft),[draft]);
 const steps=useMemo(()=>{try{return launchSteps(draft);}catch{return [];}},[draft]);
 const set=<K extends keyof LaunchDraft>(key:K,value:LaunchDraft[K])=>{if(!frozen)setDraft(d=>({...d,[key]:value}));};
 const updateMarket=(index:number,market:MarketDraft)=>setDraft(d=>({...d,markets:d.markets.map((m,i)=>i===index?market:m),marginPools:d.markets[index].token!==market.token||d.markets[index].marginEnabled!==market.marginEnabled?[]:d.marginPools}));
 const field=(key:'maxLeverage'|'slippage'|'liquidationIncentive'|'liquidationFee'|'rewardFunding',label:string)=><label className="field">{label}<input inputMode="decimal" disabled={frozen} value={draft[key]} onChange={e=>set(key,e.target.value)}/></label>;
 async function verifyRewards(){const token=draft.rewardToken;setCheckingReward(true);setError('');try{const meta=await verifyRewardToken(token);setDraft(d=>d.rewardToken===token?{...d,rewardSymbol:meta.symbol,rewardDecimals:meta.decimals}:d);}catch(e){setError(e instanceof Error?e.message:'Reward token could not be verified.');}finally{setCheckingReward(false);}}
 async function discoverPools(){setCheckingPools(true);setError('');try{const fingerprint=draft.markets.filter(m=>m.marginEnabled).map(m=>m.token).join(':');const marginPools=await discoverMarginPools(draft.markets);setDraft(d=>d.markets.filter(m=>m.marginEnabled).map(m=>m.token).join(':')===fingerprint?{...d,marginPools}:d);}catch(e){setError(e instanceof Error?e.message:'Pool discovery failed.');}finally{setCheckingPools(false);}}
 let runway='Set emissions to estimate reward runway.';
 if(draft.rewardsEnabled&&draft.rewardSymbol){try{const perSecond=draft.markets.reduce((sum,m)=>sum+dailyToSpeed(m.supplyRewardsPerDay,draft.rewardDecimals)+dailyToSpeed(m.borrowRewardsPerDay,draft.rewardDecimals),0n);if(perSecond>0n){const days=parseAmount(draft.rewardFunding,draft.rewardDecimals)*100n/(perSecond*86400n);runway=`Estimated runway: ${formatAmount(days,2)} days at the selected emission speeds.`;}}catch{runway='Enter valid funding and emission amounts to estimate runway.';}}
 async function launch(){
  if(!wallet.address||busy)return;
  const owner=wallet.address,signer={address:owner,signTransaction:wallet.signTransaction};
  setBusy(true);setError('');
  let active:LaunchSession|undefined;
  try {
   active=session||newLaunch(draft,owner);
   saveLaunch(active);setSession(active);
   if(active.pending)throw new Error('Check the pending transaction before continuing.');
   while(!active.completed){
    if(currentWallet.current!==owner)throw new Error('Wallet account changed. Reconnect the launch owner to continue.');
    active=await runNextLaunchStep(active,signer,setProgress);setSession(active);
   }
  }catch(e){
   setError(e instanceof Error?e.message:'Launch stopped.');
   try{if(active){const saved=loadLaunch(active.scope);if(saved)setSession(saved);}}catch{/* Preserve current session when storage is unavailable. */}
  }finally{setBusy(false);}
 }
 async function recover(){
  if(!session||!wallet.address||busy)return;
  setBusy(true);setError('');
  try{const updated=await recoverLaunchStep(session,{address:wallet.address,signTransaction:wallet.signTransaction});setSession(updated);setProgress(null);}
  catch(e){setError(e instanceof Error?e.message:'Recovery check failed.');}
  finally{setBusy(false);}
 }
 function startAnother(){if(!session?.completed)return;try{clearCompletedLaunch(session.scope);setSession(null);setDraft(initialDraft());setStage(0);setProgress(null);setError('');}catch(e){setError(e instanceof Error?e.message:'Could not start another launch.');}}
 return <div className="page launch-page"><div className="page-heading"><div><p className="eyebrow">YOUR MARKET, YOUR PARAMETERS</p><h1>Launch a market group</h1><p className="muted">Choose your assets. Put each market to work in its own way.</p></div><span className="pill">{network.useMocks?'Demo launch':network.name}</span></div>
  <ol className="launch-steps" aria-label="Launch configuration steps">{stageNames.map((name,i)=><li key={name}><button type="button" disabled={busy} aria-current={i===stage?'step':undefined} className={i===stage?'selected':i<stage?'visited':''} onClick={()=>setStage(i)}><span>{i<stage?<Check size={14}/>:i+1}</span>{name}</button></li>)}</ol>
  {session&&!session.completed&&<div className="status launch-resume" role="status">Saved launch in progress{session.groupId!==undefined?` for group #${session.groupId}`:''}. Configuration is locked so retries use the exact reviewed parameters.</div>}
  {error&&<div className="status launch-error" role="alert">{error}</div>}
  <div className="launch-layout"><section className="panel launch-content">
   {stage===0&&<><p className="eyebrow">STEP 01</p><h2>Name your group</h2><p className="muted">Your group is an isolated lending environment, with its own markets and risk parameters.</p><label className="field">Group name<input maxLength={32} value={draft.name} disabled={frozen} onChange={e=>set('name',e.target.value)} placeholder="Meridian"/><span>Use letters, numbers and underscores. Maximum 32 characters.</span></label><label className="field" style={{marginTop:20}}>Description (optional)<textarea value={draft.description} disabled={frozen} rows={3} maxLength={240} onChange={e=>set('description',e.target.value)} placeholder="A lending market for your community"/><span>Saved in this browser’s launch record. The current factory stores the group name onchain.</span></label></>}
   {stage===1&&<><p className="eyebrow">STEP 02</p><h2>Configure each market</h2><p className="muted">Verify a token and its approved price mapping, then choose rates, limits and a yield route. Each market deploys, activates and attaches its yield route in separate confirmed transactions.</p><div className="launch-markets">{draft.markets.map((market,index)=><details key={index} className="launch-market" open={index===0||!market.symbol}><summary><span className="launch-market-number">{index+1}</span><strong>{market.symbol||'New market'}</strong><span className="muted">{market.route==='None'?'Keep in Peridot':market.route}</span></summary><div className="launch-market-body"><MarketConfigEditor value={market} onChange={m=>updateMarket(index,m)} rewardsEnabled={draft.rewardsEnabled} rewardDecimals={draft.rewardDecimals} disabled={frozen}/>{draft.markets.length>1&&<button className="button ghost remove-market" disabled={frozen} onClick={()=>set('markets',draft.markets.filter((_,i)=>i!==index))}><Trash2 size={14}/>Remove market</button>}</div></details>)}</div><button className="button secondary" disabled={frozen||draft.markets.length>=16} onClick={()=>set('markets',[...draft.markets,newMarketDraft()])}><Plus size={15}/>Add another market</button></>}
   {stage===3&&<><p className="eyebrow">STEP 04</p><h2>Reward your community</h2><p className="muted">Choose one reward token for the group and set independent supply and borrow emissions.</p><label className="launch-toggle"><input type="checkbox" checked={draft.rewardsEnabled} disabled={frozen} onChange={e=>set('rewardsEnabled',e.target.checked)}/><span>Enable group rewards</span></label>{draft.rewardsEnabled&&<><div className="status">Rewards are enabled last, after all markets and optional leverage are ready. The reward token cannot be changed, and enabling rewards permanently locks this group’s market list. Include every intended market before launch.</div><label className="field" style={{marginTop:20}}>Reward token contract<input value={draft.rewardToken} disabled={frozen} placeholder="C..." onChange={e=>setDraft(d=>({...d,rewardToken:e.target.value.trim(),rewardSymbol:''}))}/></label>{network.useMocks&&<button className="button secondary" disabled={frozen} style={{marginTop:10}} onClick={()=>setDraft(d=>({...d,rewardToken:MOCK_USDC,rewardSymbol:'USDC',rewardDecimals:7}))}>Use demo USDC rewards</button>}<button className="button secondary" style={{margin:'10px 0 20px'}} disabled={frozen||checkingReward||!draft.rewardToken} onClick={verifyRewards}>{checkingReward?'Checking reward token...':'Verify reward token'}</button>{draft.rewardSymbol&&<p className="muted">{draft.rewardSymbol} · {draft.rewardDecimals} decimals</p>}{field('rewardFunding',`Fund now (${draft.rewardSymbol||'reward tokens'})`)}<p className="muted">Funding transfers your tokens into the group’s reward distributor.</p>{draft.markets.map((market,index)=><div className="launch-emissions" key={index}><h3>{market.symbol||`Market ${index+1}`}</h3><div className="field-grid"><label className="field">Supply rewards per day<input disabled={frozen} inputMode="decimal" value={market.supplyRewardsPerDay} onChange={e=>updateMarket(index,{...market,supplyRewardsPerDay:e.target.value})}/></label><label className="field">Borrow rewards per day<input disabled={frozen} inputMode="decimal" value={market.borrowRewardsPerDay} onChange={e=>updateMarket(index,{...market,borrowRewardsPerDay:e.target.value})}/></label></div></div>)}<p className="status">{runway} Emissions are rounded down to whole token units per second.</p></>}</>}
   {stage===2&&<><p className="eyebrow">STEP 03</p><h2>Add optional leverage</h2><p className="muted">Select eligible markets and set group limits. Trading also requires verified pool routes and funded market liquidity.</p><label className="launch-toggle"><input type="checkbox" disabled={frozen||!isMarginAvailable()} checked={draft.marginEnabled} onChange={e=>setDraft(d=>({...d,marginEnabled:e.target.checked,marginPools:[],markets:d.markets.map(m=>({...m,marginEnabled:e.target.checked&&m.decimals===7}))}))}/><span>Enable leverage for this group</span></label>{!isMarginAvailable()&&<p className="muted">Leverage is not deployed on this network yet. Lending groups can launch without it.</p>}{draft.marginEnabled&&<><div className="field-grid">{field('maxLeverage',`Maximum leverage (1x to ${GUARDRAILS.MAX_GROUP_LEVERAGE}x)`)}{field('slippage',`Maximum slippage (up to ${Number(GUARDRAILS.MAX_SLIPPAGE)/10000}%)`)}{field('liquidationIncentive',`Liquidation incentive (${Number(GUARDRAILS.MIN_LIQUIDATION_INCENTIVE)/10000}% to ${Number(GUARDRAILS.MAX_LIQUIDATION_INCENTIVE)/10000}%)`)}{field('liquidationFee','Protocol liquidation fee (max 50%)')}</div><div className="launch-margin-assets">{draft.markets.map((m,i)=>{const cf=Number(m.collateralFactor)/100;const maximum=Math.floor(Math.min(Number(draft.maxLeverage)||1,cf<1?1/(1-cf):1));return <label key={i} className="launch-toggle"><input type="checkbox" disabled={frozen||m.decimals!==7} checked={m.marginEnabled} onChange={e=>updateMarket(i,{...m,marginEnabled:e.target.checked})}/><span>{m.symbol||`Market ${i+1}`}<small className="muted">{m.decimals===7?`Estimated maximum ${maximum}x from collateral limits; the factory confirms the final limit`:'Leverage requires seven-decimal tokens'}</small></span></label>;})}</div><button className="button secondary" disabled={frozen||checkingPools} onClick={discoverPools}>{checkingPools?'Checking pool routes...':'Discover and verify pool routes'}</button>{(draft.marginPools||[]).map(pool=><div className="status" key={pool.pool} style={{marginTop:12}}><strong>{network.useMocks?'Demo pool route':'Verified Aquarius pool'}</strong><code style={{display:'block'}}>{pool.pool}</code><small>Pool ID: {pool.poolId}</small></div>)}<p className="status">The audited V3 controller uses staged trading transactions. Launch includes pool permissions, market activation and the 60-second staged incentive application.</p></>}</>}
   {stage===4&&<><p className="eyebrow">STEP 05</p><h2>{session?.completed?'Your group is ready':'Review and launch'}</h2>{session?.completed?<div className="launch-success"><CheckCircle2 size={42}/><h3>{draft.name}</h3><p>{network.useMocks?'Your demo group has been created. No funds moved.':'Every launch transaction has confirmed onchain.'}</p><Link className="button" href={`/groups/${session.groupId}`}>Open group #{session.groupId}<ArrowRight size={16}/></Link><button className="button secondary" onClick={startAnother}>Configure another group</button></div>:<><p className="muted">Review every value. Each live transaction is simulated, signed in your wallet and confirmed before the next begins.</p>{draft.rewardsEnabled&&<p className="status">Final step: enable rewards and permanently lock the market list. To add more markets later, turn rewards off before launching.</p>}<div className="launch-review"><div><span>Group</span><strong>{draft.name}</strong></div><div><span>Rewards</span><strong>{draft.rewardsEnabled?`${draft.rewardFunding} ${draft.rewardSymbol||'unverified token'}`:'None'}</strong></div><div><span>Leverage</span><strong>{draft.marginEnabled?`${draft.maxLeverage}x maximum`:'Disabled'}</strong></div></div><div className="table-scroll"><table><thead><tr><th>Market</th><th>Collateral</th><th>Caps: supply / borrow</th><th>Liquid</th><th>Route</th></tr></thead><tbody>{draft.markets.map((m,i)=><tr key={i}><td>{m.symbol||'Unverified'}</td><td>{m.collateralFactor}%</td><td>{m.supplyCap} / {m.borrowCap}</td><td>{m.idleBuffer}%</td><td>{m.route==='None'?'Peridot':m.route}</td></tr>)}</tbody></table></div>{errors.length>0&&!session&&<div className="status launch-error"><strong>Finish these details before launching</strong><ul>{errors.map((e,i)=><li key={i}>{e}</li>)}</ul></div>}</>}
    <ol className="transaction-list">{steps.map(step=>{const receipt=session?.receipts.find(r=>r.step===step.id);const pending=session?.pending?.step===step.id;return <li key={step.id} className={receipt?'confirmed':pending?'pending':''}><span className="transaction-marker">{receipt?<Check size={14}/>:pending?'•':'○'}</span><div><strong>{step.label}</strong>{pending&&<small>{progress?.status||session?.pending?.status}</small>}{receipt&&<small>{network.useMocks?'Demo step saved':'Confirmed'}</small>}</div>{receipt?.hash&&!receipt.hash.startsWith('mock-')&&<a href={transactionUrl(receipt.hash)} target="_blank" rel="noreferrer" aria-label={`View ${step.label} transaction`}><ExternalLink size={15}/></a>}{pending&&session?.pending?.hash&&!session.pending.hash.startsWith('mock-')&&<a href={transactionUrl(session.pending.hash)} target="_blank" rel="noreferrer">View transaction</a>}</li>;})}</ol>
    {!session?.completed&&<div className="launch-submit">{session?.pending?<><p className="muted">A saved step needs a status check. It will not be repeated while its outcome is unknown.</p><button className="button" disabled={busy||!wallet.address} onClick={recover}>{busy?'Checking...':'Check pending transaction'}</button></>:!wallet.address?<button className="button" onClick={()=>void wallet.connect()}>Connect wallet to launch</button>:<button className="button large" disabled={network.readOnly||busy||!storageLoaded||wallet.networkMismatch||(!session&&errors.length>0)} onClick={launch}>{busy?`${progress?.status||'Preparing'}...`:session?'Continue saved launch':network.useMocks?'Create demo group':'Launch group'}<ArrowRight size={17}/></button>}{progress?.message&&<p role="status" className="muted">{progress.message}</p>}</div>}</>}
   {stage<4&&<div className="launch-navigation"><button className="button ghost" disabled={stage===0||busy} onClick={()=>setStage(s=>s-1)}><ArrowLeft size={15}/>Back</button><button className="button" onClick={()=>setStage(s=>s+1)}>Continue<ArrowRight size={15}/></button></div>}
  </section><aside className="launch-summary panel"><Layers3 size={23}/><p className="eyebrow">YOUR GROUP AT A GLANCE</p><h3>{draft.name||'New group'}</h3><div><span>Markets</span><strong>{draft.markets.length}</strong></div><div><span>Network</span><strong>{network.name}{network.useMocks?' demo':''}</strong></div><div><span>Rewards</span><strong>{draft.rewardsEnabled?draft.rewardSymbol||'Choose token':'None'}</strong></div><div><span>Leverage</span><strong>{draft.marginEnabled?`${draft.maxLeverage}x`:'Off'}</strong></div><hr/><p className="muted">You can update parameters in the owner Control Panel. More markets can be added only while group rewards are disabled.</p><p className="muted">New contracts are unaudited. Caps apply.</p></aside></div>
 </div>;
}
