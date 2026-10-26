'use client';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, CheckCircle2, Coins, FileCode2, Rocket, Scale } from 'lucide-react';
import { useWallet } from '@/lib/peridot/wallet';
import type { Signer, TxProgress } from '@/lib/peridot/rpc';
import { Badge, KeyValue, Notice, Skeleton, Stepper } from '@/components/ui/primitives';
import { fmtAmount, fmtCompact } from '@/components/ui/format';
import { getFactoryConfig, getPreset, launchCurve } from '@/lib/launchpad/client';
import { launchpadCanSign, launchpadMode } from '@/lib/launchpad/config';
import { creatorCap, finePrice, fmtPrice, minOut, parsePositiveAmount, parseSlippage, quoteBuy, reserves, validateMetadataUri, validateName, validateSymbol } from '@/lib/launchpad/math';
import { PRESETS, type CurveParams, type FactoryConfig, type LaunchDraft, type Preset } from '@/lib/launchpad/types';
import { LpAddress, LpTxLink } from './LpAddress';
import { LaunchpadBadges, MainnetNotice, RiskNotice, TxStatus } from './LaunchpadFrame';

const stages = ['Token', 'Curve', 'Review'];
const readable = (e: unknown) => e instanceof Error ? e.message : String(e);
const initialDraft = (): LaunchDraft => ({ name: '', symbol: '', metadataUri: '', preset: 1, creatorBuy: '', slippage: '1' });

export default function LaunchTokenForm() {
  const wallet = useWallet();
  const [stage, setStage] = useState(0);
  const [draft, setDraft] = useState<LaunchDraft>(initialDraft);
  const [presets, setPresets] = useState<Partial<Record<Preset, CurveParams>>>({});
  const [presetError, setPresetError] = useState('');
  const [factory, setFactory] = useState<FactoryConfig | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<TxProgress | null>(null);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ token: string; curve: string; hash: string } | null>(null);
  useEffect(() => {
    let alive = true;
    Promise.all(PRESETS.map(p => getPreset(p.value).then(params => [p.value, params] as const)))
      .then(entries => { if (alive) setPresets(Object.fromEntries(entries) as Partial<Record<Preset, CurveParams>>); })
      .catch(e => { if (alive) setPresetError(readable(e)); });
    getFactoryConfig().then(cfg => { if (alive) setFactory(cfg); }).catch(() => { /* fee stays unknown */ });
    return () => { alive = false; };
  }, []);
  const locked = !launchpadCanSign() || !!result;
  const set = <K extends keyof LaunchDraft>(key: K, value: LaunchDraft[K]) => { if (!locked) setDraft(d => ({ ...d, [key]: value })); };
  const params = presets[draft.preset];
  const preview = useMemo(() => {
    if (!params || !draft.creatorBuy.trim()) return null;
    try {
      const quoteIn = parsePositiveAmount(draft.creatorBuy);
      const q = quoteBuy(reserves(params, 0n, 0n), params.graduation_target, quoteIn, params.trade_fee_bps);
      if (!q) return { error: 'This buy is too small and would round to zero tokens.' };
      const bps = parseSlippage(draft.slippage);
      const cap = creatorCap(params);
      if (q.tokensOut > cap) return { error: `A creator buy of ${draft.creatorBuy} XLM would receive ${fmtCompact(q.tokensOut, 7)} tokens, above the creator cap of ${fmtCompact(cap, 7)} tokens (${params.creator_cap_bps / 100}% of the curve supply).` };
      return { quoteIn, tokensOut: q.tokensOut, fee: q.fee, min: minOut(q.tokensOut, bps), clamped: q.clamped };
    } catch (e) { return { error: readable(e) }; }
  }, [params, draft.creatorBuy, draft.slippage]);
  const errors = useMemo(() => {
    const list: string[] = [];
    const name = validateName(draft.name); if (name) list.push(name);
    const symbol = validateSymbol(draft.symbol); if (symbol) list.push(symbol);
    const uri = validateMetadataUri(draft.metadataUri); if (uri) list.push(uri);
    if (!params) list.push(presetError ? `Preset unavailable: ${presetError}` : 'Presets are still loading.');
    if (preview && 'error' in preview && preview.error) list.push(preview.error);
    return list;
  }, [draft, params, presetError, preview]);
  const launchFee = factory && factory.launch_fee > 0n ? `${fmtAmount(factory.launch_fee, 7, 2)} ${factory.fee_token ? 'of the fee token' : ''}`.trim() : null;
  const mode = launchpadMode();
  const signingBlocked = !launchpadCanSign() ? 'Launching runs on the testnet app only.' : !wallet.address ? 'Connect your wallet to launch.' : wallet.networkMismatch ? 'Switch your wallet to testnet before signing.' : null;
  async function launch() {
    if (busy || !params || !wallet.address) return;
    const signer: Signer = { address: wallet.address, signTransaction: wallet.signTransaction };
    setBusy(true); setError(''); setProgress(null);
    try {
      const buy = preview && !('error' in preview) ? preview : null;
      const outcome = await launchCurve(signer, { name: draft.name.trim(), symbol: draft.symbol.trim(), metadataUri: draft.metadataUri.trim(), preset: draft.preset, creatorBuy: buy ? buy.quoteIn : 0n, minTokensOut: buy ? buy.min : 0n }, setProgress);
      setResult(outcome);
    } catch (e) { setError(readable(e)); }
    finally { setBusy(false); }
  }
  function startAnother() { setResult(null); setDraft(initialDraft()); setStage(0); setProgress(null); setError(''); setAcknowledged(false); }
  const field = (key: 'name' | 'symbol' | 'metadataUri', label: string, hint: string, extra: Record<string, unknown> = {}) => <div className="field"><label htmlFor={`lt-${key}`}>{label}</label><input id={`lt-${key}`} value={draft[key]} disabled={locked} onChange={e => set(key, key === 'symbol' ? e.target.value.toUpperCase() : e.target.value)} {...extra} /><span className="field-hint">{hint}</span></div>;
  const startPrice = params ? fmtPrice(finePrice(reserves(params, 0n, 0n))) : null;
  return <div className="page launch-page">
    <div className="page-heading">
      <div style={{ minWidth: 0 }}><p className="eyebrow"><Link href="/tokens" className="row" style={{ gap: 6 }}><ArrowLeft size={12} aria-hidden />Launchpad</Link></p><h1 className="lp-title">Launch a test token <LaunchpadBadges /></h1><p className="lead">Launch your own test token. Public token offerings may require legal review. One transaction deploys a fixed-supply token and its bonding curve; graduation into an Aquarius pool and a lending market comes later, permissionlessly.</p></div>
      <div className="page-actions"><Badge tone="accent">1 transaction</Badge></div>
    </div>
    <Stepper ariaLabel="Launch steps" steps={stages} current={stage} onSelect={setStage} disabled={busy} />
    <MainnetNotice />
    {error && <Notice tone="danger" role="alert">{error}</Notice>}
    <div className="two-col launch-token-layout">
      <section className="card launch-content">
        {stage === 0 && <div className="stack">
          <div><p className="kicker">Step 1 of 3</p><h2>Token details</h2><p className="muted">Stored on chain in the token contract. The supply is fixed at launch: nobody can mint more, freeze holders or change the metadata.</p></div>
          {field('name', 'Name', 'Letters, digits, spaces, dots, hyphens and underscores. 1 to 32 characters.', { maxLength: 32, placeholder: 'Peridot Demo' })}
          {field('symbol', 'Symbol', '2 to 12 letters or digits. It also names the lending group at graduation.', { maxLength: 12, placeholder: 'PDEMO', style: { textTransform: 'uppercase' } })}
          {field('metadataUri', 'Image URI (optional)', 'A public https or ipfs link to the token image or metadata. At most 256 bytes.', { maxLength: 256, placeholder: 'https://...' })}
          <Notice tone="info" role="note">Launch your own test token. Public token offerings may require legal review.</Notice>
        </div>}
        {stage === 1 && <div className="stack">
          <div><p className="kicker">Step 2 of 3</p><h2>Curve preset</h2><p className="muted">Pick how much XLM the curve raises before it graduates. Targets are read live from the testnet factory; the token supply, fee and creator cap are the same for every preset.</p></div>
          {presetError && <Notice tone="danger" role="alert">Presets could not be read: {presetError}</Notice>}
          <div className="preset-grid" role="radiogroup" aria-label="Graduation preset">
            {PRESETS.map(p => { const pp = presets[p.value]; return <label key={p.value} className={`preset-option${draft.preset === p.value ? ' selected' : ''}${locked ? ' disabled' : ''}`}>
              <input type="radio" name="preset" value={p.value} checked={draft.preset === p.value} disabled={locked} onChange={() => set('preset', p.value)} />
              <strong>{p.label}</strong>
              <span className="preset-target">{pp ? `${fmtAmount(pp.graduation_target, 7, 0)} XLM` : <Skeleton width={90} height={22} />}</span>
              <small>{p.blurb}</small>
              <small>{pp ? `Starts at ${fmtPrice(finePrice(reserves(pp, 0n, 0n)))} XLM per token` : 'Reading target...'}</small>
            </label>; })}
          </div>
          {params && <div className="card inset" style={{ padding: 14 }}><KeyValue rows={[['Total supply', `${fmtCompact(params.curve_supply + params.lp_supply, 7)} ${draft.symbol || 'tokens'}`], ['Sold on the curve', `${fmtCompact(params.curve_supply, 7)} (up to the target)`], ['Reserved for the pool', fmtCompact(params.lp_supply, 7)], ['Trade fee', `${params.trade_fee_bps / 100}% of the XLM side`], ['Creator cap', `${fmtCompact(creatorCap(params), 7)} tokens (${params.creator_cap_bps / 100}% of the curve supply)`]]} /></div>}
          <div className="field-grid">
            <div className="field"><label htmlFor="lt-creator-buy">Creator buy in XLM (optional)</label><input id="lt-creator-buy" inputMode="decimal" value={draft.creatorBuy} disabled={locked} placeholder="0" onChange={e => set('creatorBuy', e.target.value)} /><span className="field-hint">An atomic first buy in the launch transaction. {params ? `Capped at ${fmtCompact(creatorCap(params), 7)} tokens.` : ''}</span></div>
            <div className="field"><label htmlFor="lt-slippage">Slippage for the creator buy (%)</label><input id="lt-slippage" inputMode="decimal" value={draft.slippage} disabled={locked || !draft.creatorBuy} onChange={e => set('slippage', e.target.value)} /><span className="field-hint">Sets the minimum tokens the buy must deliver.</span></div>
          </div>
          {preview && ('error' in preview ? <Notice tone="danger" role="alert">{preview.error}</Notice> : <Notice tone="info" role="status">You would receive about {fmtCompact(preview.tokensOut, 7)} {draft.symbol || 'tokens'} for {fmtAmount(preview.quoteIn, 7, 2)} XLM (fee {fmtAmount(preview.fee, 7, 4)} XLM), at least {fmtCompact(preview.min, 7)} after slippage.{preview.clamped ? ' This buy alone would reach the target and be clamped.' : ''}</Notice>)}
        </div>}
        {stage === 2 && <div className="stack">
          <div><p className="kicker">Step 3 of 3</p><h2>{result ? 'Your token is live on testnet' : 'Review and launch'}</h2></div>
          {result ? <div className="launch-token-success"><CheckCircle2 size={42} aria-hidden /><h3>{draft.name} ({draft.symbol})</h3><p className="muted">{mode === 'mock' ? 'Demo launch saved in this browser. No funds moved.' : 'The launch transaction confirmed on testnet.'}</p><div className="lp-meta" style={{ justifyContent: 'center' }}><span>Token <LpAddress value={result.token} label="token address" /></span><span>Curve <LpAddress value={result.curve} label="curve address" /></span>{!result.hash.startsWith('mock-') && <LpTxLink hash={result.hash}>View transaction</LpTxLink>}</div><div className="row" style={{ justifyContent: 'center' }}><Link className="button" href={`/token/${result.token}`}>Open token page <ArrowRight size={16} aria-hidden /></Link><button className="button secondary" onClick={startAnother}>Launch another</button></div></div>
          : <>
            <div className="card inset" style={{ padding: 14 }}><KeyValue rows={[['Name', draft.name || 'Missing'], ['Symbol', draft.symbol || 'Missing'], ['Image URI', draft.metadataUri || 'None'], ['Preset', `${PRESETS.find(p => p.value === draft.preset)?.label}${params ? `, ${fmtAmount(params.graduation_target, 7, 0)} XLM target` : ''}`], ['Creator buy', preview && !('error' in preview) ? `${fmtAmount(preview.quoteIn, 7, 2)} XLM for at least ${fmtCompact(preview.min, 7)} tokens` : 'None'], ['Launch fee', launchFee ?? 'None set on the factory'], ['Network', 'Stellar testnet']]} /></div>
            <div><h3>What will happen</h3><ul className="lp-what">
              <li><FileCode2 size={16} aria-hidden /><span><strong>One transaction</strong>: <code>launch_curve(creator, name, symbol, LaunchParams {'{'} quote_token: XLM, preset: {PRESETS.find(p => p.value === draft.preset)?.label}, metadata_uri, creator_buy{preview && !('error' in preview) ? `: ${fmtAmount(preview.quoteIn, 7, 2)} XLM` : ': 0'}, min_tokens_out{preview && !('error' in preview) ? `: ${fmtCompact(preview.min, 7)}` : ': 0'} {'}'})</code> on the launchpad factory, signed by your wallet.</span></li>
              <li><Coins size={16} aria-hidden /><span><strong>Deploys the token</strong>: fixed supply of {params ? fmtCompact(params.curve_supply + params.lp_supply, 7) : '1B'} {draft.symbol || 'tokens'}, 7 decimals, all minted to the curve. No mint, no admin, no freeze.</span></li>
              <li><Scale size={16} aria-hidden /><span><strong>Deploys the bonding curve</strong> with the {PRESETS.find(p => p.value === draft.preset)?.label} preset: {params ? `${fmtAmount(params.graduation_target, 7, 0)} XLM target, starting at ${startPrice} XLM per token, ${params.trade_fee_bps / 100}% trade fee, creator cap ${params.creator_cap_bps / 100}%` : 'reading the preset'}. Parameters are immutable.</span></li>
              {preview && !('error' in preview) && <li><Check size={16} aria-hidden /><span><strong>Runs your first buy</strong>: {fmtAmount(preview.quoteIn, 7, 2)} XLM for at least {fmtCompact(preview.min, 7)} {draft.symbol}.</span></li>}
              <li><Rocket size={16} aria-hidden /><span><strong>Later, at the target</strong>: anyone can graduate the token into an Aquarius pool with locked liquidity and its own lending group in six permissionless steps. The first step needs 1 AQUA on testnet.</span></li>
            </ul></div>
            <RiskNotice />
            {errors.length > 0 && <Notice tone="danger" title="Finish these details before launching"><ul>{errors.map((e, i) => <li key={i}>{e}</li>)}</ul></Notice>}
            <label className="check"><input type="checkbox" checked={acknowledged} disabled={locked} onChange={e => setAcknowledged(e.target.checked)} />I understand this is a testnet experiment, that Peridot does not vet projects, and that public token offerings may require legal review.</label>
            <TxStatus progress={progress} />
            {signingBlocked && <Notice tone="warn" role="status">{signingBlocked}</Notice>}
            <div className="row">{!wallet.address && launchpadCanSign() ? <button className="button" onClick={() => void wallet.connect()} disabled={wallet.isConnecting || !wallet.isReady}>Connect wallet to launch</button> : <button className="button large" disabled={busy || !!signingBlocked || errors.length > 0 || !acknowledged} onClick={launch}>{busy ? `${progress?.status || 'Preparing'}...` : mode === 'mock' ? 'Create demo token' : 'Launch token'}<ArrowRight size={17} aria-hidden /></button>}</div>
          </>}
        </div>}
        {stage < 2 && <div className="launch-navigation"><button className="button ghost" disabled={stage === 0 || busy} onClick={() => setStage(s => s - 1)}><ArrowLeft size={15} aria-hidden />Back</button><button className="button" onClick={() => setStage(s => s + 1)}>Continue<ArrowRight size={15} aria-hidden /></button></div>}
      </section>
      <aside className="card sticky-aside" style={{ display: 'grid', gap: 14 }}>
        <div className="row" style={{ gap: 10 }}><span className="token-icon" aria-hidden>{(draft.symbol || '?').slice(0, 2)}</span><div><p className="kicker">Your token at a glance</p><h3 style={{ margin: 0 }}>{draft.name || 'New token'}</h3></div></div>
        <KeyValue rows={[['Symbol', draft.symbol || 'n/a'], ['Preset', PRESETS.find(p => p.value === draft.preset)?.label ?? 'n/a'], ['Target', params ? `${fmtAmount(params.graduation_target, 7, 0)} XLM` : 'n/a'], ['Creator buy', draft.creatorBuy ? `${draft.creatorBuy} XLM` : 'None'], ['Network', mode === 'mock' ? 'testnet demo' : 'testnet']]} />
        <hr />
        <p className="kicker" style={{ marginBottom: 6 }}>Rules</p>
        <ul className="muted" style={{ fontSize: 12, paddingLeft: 16, display: 'grid', gap: 4 }}><li>Name 1 to 32 characters, symbol 2 to 12 letters or digits</li><li>Parameters are fixed at launch</li><li>Creator buys capped at {params ? `${params.creator_cap_bps / 100}%` : '5%'} of the curve supply</li><li>At most 100 launches per creator</li><li>The factory admin can upgrade curve code (house rule)</li></ul>
        <hr />
        <p className="muted" style={{ fontSize: 12 }}>New tokens are highly risky. Prices can go to zero. Peridot does not vet projects. Testnet only.</p>
        {wallet.address && <p className="subtle row" style={{ fontSize: 12, gap: 6 }}>Creator <LpAddress value={wallet.address} label="creator address" /></p>}
      </aside>
    </div>
  </div>;
}
