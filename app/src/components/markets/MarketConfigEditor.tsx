'use client';
import { useId, useRef, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { findReflectorFeed, getTokenMetadata } from '@/lib/peridot/factory';
import { borrowApr, RATE_PRESETS, ratesFromDraft, type MarketDraft } from '@/lib/peridot/market-config';
import { network } from '@/lib/peridot/network';
import { GUARDRAILS } from '@/lib/peridot/types';
import { Badge, Notice } from '@/components/ui/primitives';
import { Address } from '@/components/ui/Address';
import { RateCurveChart } from '@/components/charts/RateCurveChart';
import { fmtPct } from '@/components/ui/format';
import { TokenCombobox } from '@/components/vaults/TokenCombobox';
import { useAssetCatalog } from '@/components/vaults/useAssetCatalog';
import { TokenIntakePanel } from '@/components/vaults/TokenIntakePanel';
import { inspectToken, type Inspection } from '@/lib/vaults/token-intake-client';
import { feedLabel } from '@/lib/vaults/price-sources';
import VaultStep from '@/components/vaults/VaultStep';
import { defaultDefindexVault } from '@/lib/vaults/defindex-defaults';
export interface MarketConfigEditorProps {value:MarketDraft;onChange:(value:MarketDraft)=>void;rewardsEnabled?:boolean;rewardDecimals?:number;disabled?:boolean}
export default function MarketConfigEditor({value,onChange,rewardsEnabled=false,disabled=false}:MarketConfigEditorProps){
 const id=useId();const latest=useRef(value);latest.current=value;const [checking,setChecking]=useState(false);const [inspection,setInspection]=useState<Inspection|null>(null);const [error,setError]=useState('');
 const catalog=useAssetCatalog();
 const set=(key:keyof MarketDraft,v:unknown)=>onChange({...value,[key]:v});
 const field=(key:keyof MarketDraft,label:string,hint?:string)=> <div className="field" key={key}><label htmlFor={`${id}-${key}`}>{label}</label><input id={`${id}-${key}`} inputMode="decimal" value={String(value[key]??'')} onChange={e=>set(key,e.target.value)} disabled={disabled}/>{hint&&<span className="field-hint">{hint}</span>}</div>;
 async function verify(raw?:string){const input=(raw??latest.current.token).trim();setChecking(true);setError('');try{const result=await inspectToken(input);if(raw!==undefined||latest.current.token.trim()===input||result.parsed.kind==='classic'){onChange({...latest.current,token:result.info.address,symbol:result.info.symbol,decimals:result.info.decimals,price:result.price,routeAddress:'',marginEnabled:result.info.decimals===7?latest.current.marginEnabled:false});}setInspection(result);}catch(e){setInspection(null);setError(e instanceof Error?e.message:'Unable to verify token.');}finally{setChecking(false);}}
 const vaultHint=(symbol:string,token:string)=>{const parts=['Keep in Peridot is always available.'];const d=defaultDefindexVault(network.name,token);parts.push(d?`The Peridot ${d.symbol} DeFindex vault is the fixed default for this token.`:`No DeFindex vault exists for ${symbol||'this token'} (XLM, USDC and EURC only).`);parts.push('Blend needs a fee vault reserve for this exact token, checked at launch. Your own Aquarius ladder, Zenex or XOXNO vault (created on the Vaults page) can be attached in step 4 once Peridot allow-lists it.');return parts.join(' ');};
 let curve:Array<{utilization:number;apr:number}>=[];let rates:ReturnType<typeof ratesFromDraft>|null=null;try{const r=ratesFromDraft(value);rates=r;curve=Array.from({length:21},(_,i)=>({utilization:i*5,apr:borrowApr(r,i*5)}));}catch{/* Invalid input is handled on review. */}
 let reserve=100_000n;try{reserve=BigInt(Math.round(Number(value.reserveFactor)*10_000));if(reserve<0n)reserve=0n;}catch{/* Fallback to a 10% reserve for the preview only. */}
 const Step=({n,title,summary}:{n:number;title:string;summary?:string})=><div className="editor-step-head"><span className="step-dot" aria-hidden>{n}</span><div><h3>{title}</h3>{summary&&<p className="muted" style={{fontSize:12,margin:0}}>{summary}</p>}</div></div>;
 return <div className="market-config-editor editor">
  <section className="editor-step">
   <Step n={1} title="Token and price" summary="Verify the token and its approved Reflector mapping (DEX oracle for Stellar tokens, CEX/FX oracle for listed symbols). No fallback price is set."/>
   <TokenCombobox id={id} label="Token" assets={catalog.assets} value={value.token} disabled={disabled||checking} note={catalog.note||`${catalog.assets.length} assets: known ${network.name} tokens, Aquarius pool tokens and launchpad tokens, each listed once.`} onPick={asset=>{setInspection(null);onChange({...value,token:asset.address,symbol:'',price:undefined,routeAddress:''});void verify(asset.address);}} onCustom={()=>document.getElementById(`${id}-token`)?.focus()}/>
   <div className="field"><label htmlFor={`${id}-token`}>Token contract address</label><input id={`${id}-token`} value={value.token} placeholder="C... or CODE:ISSUER" disabled={disabled} onChange={e=>{setInspection(null);onChange({...value,token:e.target.value.trim(),symbol:'',price:undefined,routeAddress:''});}}/><span className="field-hint">Pick a token above, or paste your own (for example one from the launchpad) or any Soroban token contract. A classic asset like USDC:G... is converted to its contract. Total supply is shown only when the token reports it.</span></div>
   <div className="row"><button type="button" className="button sm" disabled={disabled||checking||!value.token} onClick={()=>void verify()}>{checking?'Checking token...':'Verify token and price feed'}</button></div>
   {value.symbol&&value.price&&<div className="status success"><CheckCircle2 size={16} aria-hidden/><div style={{minWidth:0,flex:1}}><p>{value.symbol} {'·'} {value.decimals} decimals {'·'} Approved {feedLabel(inspection&&inspection.info.address===value.token?inspection.source:null)} mapping{network.useMocks?' (demo)':''}</p>{value.price.tag==='ReflectorOnly'&&<details><summary className="text-link" style={{fontSize:12}}>View token price mapping</summary><div className="kv mt-2" style={{fontSize:12}}><div><span>Feed asset</span><span>{value.price.values[0].asset.tag} {'·'} {value.price.values[0].asset.values[0].length>20?<Address value={value.price.values[0].asset.values[0]} label="feed asset"/>:value.price.values[0].asset.values[0]}</span></div><div><span>Oracle</span><span><Address value={value.price.values[0].oracle} label="oracle address"/></span></div></div><p className="subtle" style={{fontSize:12,marginTop:6}}>The factory must approve this exact token, oracle and asset combination before launch.</p></details>}</div></div>}
   {error&&<p role="alert" className="status danger">{error}</p>}
   {inspection&&inspection.info.address===value.token&&<TokenIntakePanel inspection={inspection} vaultHint={vaultHint(inspection.info.symbol,inspection.info.address)}/>}
  </section>
  <section className="editor-step">
   <Step n={2} title="Interest rate" summary="Choose a rate curve. A zero borrow rate is allowed. Coefficients up to 1000%; kink up to 100%."/>
   <div className="row">{Object.entries(RATE_PRESETS).map(([name,params])=><button className={`button sm ${value.base===params.base&&value.multiplier===params.multiplier&&value.jump===params.jump&&value.kink===params.kink?'':'secondary'}`} type="button" key={name} disabled={disabled} onClick={()=>onChange({...value,...params})}>{name}</button>)}</div>
   <div className="field-grid">{field('base','Base APR (%)')}{field('multiplier','Slope below kink (%)')}{field('jump','Slope above kink (%)')}{field('kink','Kink utilization (%)')}</div>
   {rates?<RateCurveChart rates={rates} reserveFactor={reserve>500_000n?500_000n:reserve} height={190}/>:<Notice tone="warn">Enter valid rate values to preview the curve.</Notice>}
   <div className="row" style={{gap:16}}>{[0,50,80,100].map(u=><span className="muted" key={u} style={{fontSize:12}}>{u}% utilized: <strong className="num" style={{color:'var(--text)'}}>{curve.find(p=>p.utilization===u)?fmtPct(curve.find(p=>p.utilization===u)!.apr):'n/a'}</strong> borrow APR</span>)}</div>
  </section>
  <section className="editor-step">
   <Step n={3} title="Risk limits" summary="Factory guardrails: collateral factor up to 75% with Reflector pricing, caps required, reserve factor up to 50%."/>
   <div className="field-grid">{field('collateralFactor',`Collateral factor (1% to ${Number(GUARDRAILS.MAX_CF_REFLECTOR)/10000}%)`,'Share of supplied value that counts as collateral. Later changes wait 60 seconds.')}{field('supplyCap',`Supply cap (${value.symbol||'tokens'})`,'Required. Deposits above the cap are rejected.')}{field('borrowCap',`Borrow cap (${value.symbol||'tokens'})`,'Required. Borrows above the cap are rejected.')}{field('reserveFactor',`Reserve factor (max ${Number(GUARDRAILS.MAX_RESERVE_FACTOR)/10000}%)`,'Share of interest kept as protocol reserves.')}</div>
  </section>
  <section className="editor-step">
   <Step n={4} title="Liquidity and yield" summary="The liquid buffer is available for borrowing and withdrawals. Remaining funds can be routed into the selected vault."/>
   <VaultStep id={id} value={value} onChange={onChange} disabled={disabled}/>
  </section>
  <section className="editor-step">
   <Step n={5} title="Leverage and rewards" summary="Leverage needs a seven-decimal token and an approved Aquarius pool. Emissions start at zero and are set after rewards are enabled."/>
   <label className="check"><input type="checkbox" checked={value.marginEnabled} disabled={disabled} onChange={e=>set('marginEnabled',e.target.checked)}/>Allow leverage for this market</label>
   {value.marginEnabled&&value.decimals!==7&&<Badge tone="warn">Leverage requires seven decimals</Badge>}
   {rewardsEnabled&&<div className="field-grid">{field('supplyRewardsPerDay','Supply rewards (tokens per day)')}{field('borrowRewardsPerDay','Borrow rewards (tokens per day)')}</div>}
  </section>
 </div>;
}
export { MarketConfigEditor };
