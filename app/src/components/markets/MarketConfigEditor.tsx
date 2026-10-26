'use client';
import { useEffect, useId, useRef, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { findReflectorFeed, getTokenMetadata, isYieldVaultAllowed } from '@/lib/peridot/factory';
import { borrowApr, RATE_PRESETS, ratesFromDraft, type MarketDraft } from '@/lib/peridot/market-config';
import { getDeployments, network } from '@/lib/peridot/network';
import { GUARDRAILS } from '@/lib/peridot/types';
import { MOCK_EURC, MOCK_USDC, MOCK_XLM } from '@/lib/peridot/mock';
import { Badge, Notice } from '@/components/ui/primitives';
import { Address } from '@/components/ui/Address';
import { RateCurveChart } from '@/components/charts/RateCurveChart';
import { fmtPct } from '@/components/ui/format';
import { TokenRegistryPicker } from '@/components/vaults/TokenRegistryPicker';
import { TokenIntakePanel } from '@/components/vaults/TokenIntakePanel';
import { inspectToken, type Inspection } from '@/lib/vaults/token-intake-client';
import { VaultOptionList } from '@/components/vaults/VaultOptionList';
export interface MarketConfigEditorProps {value:MarketDraft;onChange:(value:MarketDraft)=>void;rewardsEnabled?:boolean;rewardDecimals?:number;disabled?:boolean}
export default function MarketConfigEditor({value,onChange,rewardsEnabled=false,disabled=false}:MarketConfigEditorProps){
 const id=useId();const latest=useRef(value);latest.current=value;const [checking,setChecking]=useState(false);const [inspection,setInspection]=useState<Inspection|null>(null);const [error,setError]=useState('');
 const deployment=(()=>{try{return getDeployments();}catch{return null;}})();
 const external=deployment?.external||{};
 const defindex=external.defindex_vaults;
 const blend=external.blend_fee_vault;
 const tokenChoices=network.useMocks?[['USDC',MOCK_USDC],['XLM',MOCK_XLM],['EURC',MOCK_EURC]]:[['USDC',external.usdc],['XLM',external.xlm],['EURC',external.eurc]].filter((entry):entry is [string,string]=>typeof entry[1]==='string'&&!!entry[1]);
 const configuredVaults:string[]=value.route==='Defindex'
  ? (defindex&&typeof defindex==='object'?[defindex[value.token],defindex[value.symbol]].filter((v):v is string=>typeof v==='string'&&!!v):[])
  : value.route==='Blend'?(typeof blend==='string'&&blend?[blend]:blend&&typeof blend==='object'?[blend[value.token],blend[value.symbol]].filter((v):v is string=>typeof v==='string'&&!!v):[]):[];
 const candidateKey=[...new Set([...configuredVaults,value.routeAddress].filter(Boolean))].sort().join(',');
 const [approval,setApproval]=useState<{key:string;allowed:string[];failed:boolean}>({key:'',allowed:[],failed:false});
 useEffect(()=>{let cancelled=false;const candidates=candidateKey?candidateKey.split(','):[];
  Promise.all(candidates.map(async address=>({address,allowed:await isYieldVaultAllowed(address)}))).then(results=>{if(!cancelled)setApproval({key:candidateKey,allowed:results.filter(r=>r.allowed).map(r=>r.address),failed:false});}).catch(()=>{if(!cancelled)setApproval({key:candidateKey,allowed:[],failed:true});});
  return()=>{cancelled=true;};
 },[candidateKey]);
 const vaultChoices=[...new Set(configuredVaults)].filter(address=>approval.key===candidateKey&&approval.allowed.includes(address));
 const defindexAvailable=network.useMocks||!!external.defindex_factory||!!(defindex&&typeof defindex==='object'&&Object.values(defindex).some(Boolean));
 const blendAvailable=network.useMocks||!!deployment?.wasm?.blend_adapter;
 const selectRoute=(route:MarketDraft['route'])=>onChange({...value,route,routeAddress:''});
 const set=(key:keyof MarketDraft,v:unknown)=>onChange({...value,[key]:v});
 const field=(key:keyof MarketDraft,label:string,hint?:string)=> <div className="field" key={key}><label htmlFor={`${id}-${key}`}>{label}</label><input id={`${id}-${key}`} inputMode="decimal" value={String(value[key]??'')} onChange={e=>set(key,e.target.value)} disabled={disabled}/>{hint&&<span className="field-hint">{hint}</span>}</div>;
 async function verify(raw?:string){const input=(raw??latest.current.token).trim();setChecking(true);setError('');try{const result=await inspectToken(input);if(raw!==undefined||latest.current.token.trim()===input||result.parsed.kind==='classic'){onChange({...latest.current,token:result.info.address,symbol:result.info.symbol,decimals:result.info.decimals,price:result.price,routeAddress:'',marginEnabled:result.info.decimals===7?latest.current.marginEnabled:false});}setInspection(result);}catch(e){setInspection(null);setError(e instanceof Error?e.message:'Unable to verify token.');}finally{setChecking(false);}}
 const vaultHint=(symbol:string,token:string)=>{const parts=['Keep in Peridot is always available.'];const d=defindex&&typeof defindex==='object'?(defindex[token]||defindex[symbol]):undefined;parts.push(d?'A DeFindex vault is configured for this token.':'No DeFindex vault is configured for this token.');parts.push(typeof blend==='string'&&blend?'Blend needs a fee vault for this exact token, checked at launch.':'No Blend fee vault is configured.');parts.push('Aquarius LP (demo), XOXNO and Zenex are listed in step 4 but not active.');return parts.join(' ');};
 let curve:Array<{utilization:number;apr:number}>=[];let rates:ReturnType<typeof ratesFromDraft>|null=null;try{const r=ratesFromDraft(value);rates=r;curve=Array.from({length:21},(_,i)=>({utilization:i*5,apr:borrowApr(r,i*5)}));}catch{/* Invalid input is handled on review. */}
 let reserve=100_000n;try{reserve=BigInt(Math.round(Number(value.reserveFactor)*10_000));if(reserve<0n)reserve=0n;}catch{/* Fallback to a 10% reserve for the preview only. */}
 const Step=({n,title,summary}:{n:number;title:string;summary?:string})=><div className="editor-step-head"><span className="step-dot" aria-hidden>{n}</span><div><h3>{title}</h3>{summary&&<p className="muted" style={{fontSize:12,margin:0}}>{summary}</p>}</div></div>;
 return <div className="market-config-editor editor">
  <section className="editor-step">
   <Step n={1} title="Token and price" summary="Verify the token and its approved Reflector mapping. Reflector is the price source. No fallback price is set."/>
   <TokenRegistryPicker id={id} disabled={disabled||checking} onPick={address=>{onChange({...value,token:address,symbol:'',price:undefined,routeAddress:''});setInspection(null);void verify(address);}}/>
   <div className="field"><label htmlFor={`${id}-token`}>Token contract address</label><input id={`${id}-token`} value={value.token} placeholder="C... or CODE:ISSUER" disabled={disabled} onChange={e=>{setInspection(null);onChange({...value,token:e.target.value.trim(),symbol:'',price:undefined,routeAddress:''});}}/><span className="field-hint">Paste your own token (for example one from the launchpad) or any Soroban token contract. A classic asset like USDC:G... is converted to its contract. Total supply is shown only when the token reports it.</span></div>
   <div className="row">{tokenChoices.map(([symbol,token])=><button type="button" className="button secondary sm" disabled={disabled} key={token} onClick={()=>{setInspection(null);onChange({...value,token,symbol:'',price:undefined,routeAddress:''});}}>Use {symbol}</button>)}<button type="button" className="button sm" disabled={disabled||checking||!value.token} onClick={()=>void verify()}>{checking?'Checking token...':'Verify token and price feed'}</button></div>
   {value.symbol&&value.price&&<div className="status success"><CheckCircle2 size={16} aria-hidden/><div style={{minWidth:0,flex:1}}><p>{value.symbol} {'·'} {value.decimals} decimals {'·'} Approved Reflector mapping{network.useMocks?' (demo)':''}</p>{value.price.tag==='ReflectorOnly'&&<details><summary className="text-link" style={{fontSize:12}}>View token price mapping</summary><div className="kv mt-2" style={{fontSize:12}}><div><span>Feed asset</span><span>{value.price.values[0].asset.tag} {'·'} {value.price.values[0].asset.values[0].length>20?<Address value={value.price.values[0].asset.values[0]} label="feed asset"/>:value.price.values[0].asset.values[0]}</span></div><div><span>Oracle</span><span><Address value={value.price.values[0].oracle} label="oracle address"/></span></div></div><p className="subtle" style={{fontSize:12,marginTop:6}}>The factory must approve this exact token, oracle and asset combination before launch.</p></details>}</div></div>}
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
   <div className="field-grid">{field('idleBuffer',`Kept liquid (${GUARDRAILS.MIN_IDLE_BUFFER_BPS/100}% to ${GUARDRAILS.MAX_IDLE_BUFFER_BPS/100}%)`,'Idle buffer between 10% and 100%. The default 20% keeps one fifth of deposits in the market.')}<div className="field"><label htmlFor={`${id}-route`}>Where idle liquidity goes</label><select id={`${id}-route`} value={value.route} disabled={disabled} onChange={e=>selectRoute(e.target.value as MarketDraft['route'])}><option value="None">Keep in Peridot</option><option value="Defindex" disabled={!defindexAvailable}>DeFindex vault{defindexAvailable?'':' (not deployed)'}</option><option value="Blend" disabled={!blendAvailable}>Blend fee vault{blendAvailable?'':' (not deployed)'}</option></select><span className="field-hint">The factory accepts the options below that are live. Locked options are shown so you can see what is planned.</span></div></div>
   <VaultOptionList compact ariaLabel="All yield options" disabled={disabled} selected={value.route==='Defindex'?'defindex':value.route==='Blend'?'blend':'idle'} onSelect={option=>{if(option.factoryRoute==='Defindex'&&!defindexAvailable)return;if(option.factoryRoute==='Blend'&&!blendAvailable)return;if(option.factoryRoute)selectRoute(option.factoryRoute);}}/>
   {value.route!=='None'&&<div className="stack-sm card inset" style={{padding:14}}>{vaultChoices.length>0&&<div className="field"><label htmlFor={`${id}-vault-choice`}>Allowlisted {value.route==='Defindex'?'DeFindex':'Blend fee'} vault</label><select id={`${id}-vault-choice`} disabled={disabled} value={vaultChoices.includes(value.routeAddress)?value.routeAddress:''} onChange={e=>set('routeAddress',e.target.value)}><option value="">Choose an allowlisted vault or enter a custom address</option>{vaultChoices.map(address=><option key={address} value={address}>{value.symbol||'Token'} {'·'} {address.slice(0,8)}...{address.slice(-6)}</option>)}</select><span className="field-hint">Addresses come from this network&apos;s deployment manifest and are approved by the factory. Asset compatibility is checked during simulation.</span></div>}<div className="field"><label htmlFor={`${id}-vault`}>{value.route==='Defindex'?'DeFindex':'Blend fee'} vault address for {value.symbol||'this token'}</label><input id={`${id}-vault`} placeholder="C..." value={value.routeAddress} disabled={disabled} onChange={e=>set('routeAddress',e.target.value.trim())}/><span className="field-hint">A custom vault must be approved by the factory and pass simulation for this underlying token. Entering an address does not verify compatibility.</span></div>{value.routeAddress&&<Notice tone={approval.key!==candidateKey?'info':approval.failed?'warn':approval.allowed.includes(value.routeAddress)?'success':'danger'}>{approval.key!==candidateKey?'Checking factory vault approval...':approval.failed?'Factory vault approval could not be checked.':approval.allowed.includes(value.routeAddress)?'Vault is approved by the factory. Underlying compatibility still requires simulation.':'This vault is not approved by the factory. Select an approved vault before launch.'}</Notice>}</div>}
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
