'use client';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, CheckCircle2, Coins, Lightbulb } from 'lucide-react';
import { useWallet } from '@/lib/peridot/wallet';
import type { Signer, TxProgress } from '@/lib/peridot/rpc';
import { Badge, KeyValue, Notice } from '@/components/ui/primitives';
import { createPlainToken } from '@/lib/launchpad/client';
import { launchpadCanSign, launchpadMode } from '@/lib/launchpad/config';
import { parsePlainSupply, validateMetadataUri, validateName, validatePlainSupply, validateSymbol } from '@/lib/launchpad/math';
import { LpAddress, LpTxLink } from './LpAddress';
import { LaunchpadBadges, MainnetNotice, RiskNotice, TxStatus } from './LaunchpadFrame';

const readable = (e: unknown) => e instanceof Error ? e.message : String(e);
const initialDraft = () => ({ name: '', symbol: '', supply: '1000000', metadataUri: '' });
const whole = new Intl.NumberFormat('en-US');

/** Simple token: one transaction, whole fixed supply to the creator. Decimals are fixed at 7 because the token
 * template (and every Peridot market guardrail) uses 7-decimal assets. */
export default function SimpleTokenForm({ onBack }: { onBack: () => void }) {
  const wallet = useWallet();
  const [draft, setDraft] = useState(initialDraft);
  const [acknowledged, setAcknowledged] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<TxProgress | null>(null);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ token: string; hash: string; name: string; symbol: string } | null>(null);
  const mode = launchpadMode();
  const locked = !launchpadCanSign() || !!result;
  const set = (key: keyof typeof draft, value: string) => { if (!locked) setDraft(d => ({ ...d, [key]: value })); };
  const errors = useMemo(() => [validateName(draft.name), validateSymbol(draft.symbol), validatePlainSupply(draft.supply), validateMetadataUri(draft.metadataUri)].filter((e): e is string => !!e), [draft]);
  const supply = parsePlainSupply(draft.supply);
  const signingBlocked = !launchpadCanSign() ? 'Creating tokens runs on the testnet app only.' : !wallet.address ? 'Connect your wallet to create a token.' : wallet.networkMismatch ? 'Switch your wallet to testnet before signing.' : null;
  async function create() {
    if (busy || !wallet.address) return;
    const signer: Signer = { address: wallet.address, signTransaction: wallet.signTransaction };
    setBusy(true); setError(''); setProgress(null);
    try {
      const outcome = await createPlainToken(signer, { name: draft.name.trim(), symbol: draft.symbol.trim(), supply: draft.supply, metadataUri: draft.metadataUri.trim() }, setProgress);
      setResult({ ...outcome, name: draft.name.trim(), symbol: draft.symbol.trim() });
    } catch (e) { setError(readable(e)); }
    finally { setBusy(false); }
  }
  function startAnother() { setResult(null); setDraft(initialDraft()); setProgress(null); setError(''); setAcknowledged(false); }
  const field = (key: 'name' | 'symbol' | 'supply' | 'metadataUri', label: string, hint: string, extra: Record<string, unknown> = {}) => <div className="field"><label htmlFor={`st-${key}`}>{label}</label><input id={`st-${key}`} value={draft[key]} disabled={locked} onChange={e => set(key, key === 'symbol' ? e.target.value.toUpperCase() : e.target.value)} {...extra} /><span className="field-hint">{hint}</span></div>;
  return <div className="page launch-page">
    <div className="page-heading">
      <div style={{ minWidth: 0 }}><p className="eyebrow"><button type="button" className="text-link row" style={{ gap: 6, background: 'none', border: 0, padding: 0, cursor: 'pointer' }} onClick={onBack} disabled={busy}><ArrowLeft size={12} aria-hidden />All launch options</button></p><h1 className="lp-title">Create a simple token <LaunchpadBadges /></h1><p className="lead">A plain fixed-supply token: no curve, no ICO, no launch fee. The whole supply lands in your wallet in one transaction.</p></div>
      <div className="page-actions"><Badge tone="accent">1 transaction</Badge></div>
    </div>
    <MainnetNotice />
    {error && <Notice tone="danger" role="alert">{error}</Notice>}
    <div className="two-col launch-token-layout">
      <section className="card launch-content">
        {result ? <div className="launch-token-success"><CheckCircle2 size={42} aria-hidden /><h2>Your token is live on testnet</h2><h3>{result.name} ({result.symbol})</h3><p className="muted">{mode === 'mock' ? 'Demo token saved in this browser. No funds moved.' : `The whole supply of ${supply ? whole.format(Number(supply)) : draft.supply} ${result.symbol} is now in your wallet.`}</p>
          <div className="lp-meta" style={{ justifyContent: 'center' }}><span>Token <LpAddress value={result.token} label="token address" /></span>{!result.hash.startsWith('mock-') && <LpTxLink hash={result.hash}>View transaction</LpTxLink>}</div>
          <Notice tone="info" role="note" title="Later: add a Peridot market"><p>Want people to lend or borrow it? A token with 7 decimals can later get a Peridot lending market (and an Aquarius pool for its price). Nothing to do now.</p></Notice>
          <div className="row" style={{ justifyContent: 'center' }}><Link className="button" href={`/token/${result.token}`}>Open token page <ArrowRight size={16} aria-hidden /></Link><button className="button secondary" onClick={startAnother}>Create another</button></div></div>
        : <div className="stack">
          <div><p className="kicker">Token details</p><h2>Name, symbol and supply</h2><p className="muted">Stored on chain in the token contract. The supply is fixed: nobody can mint more, freeze holders or change the metadata.</p></div>
          {field('name', 'Name', 'Letters, digits, spaces, dots, hyphens and underscores. 1 to 32 characters.', { maxLength: 32, placeholder: 'Peridot Demo' })}
          {field('symbol', 'Symbol', '2 to 12 letters or digits.', { maxLength: 12, placeholder: 'PDEMO', style: { textTransform: 'uppercase' } })}
          <div className="field-grid">
            {field('supply', 'Total supply (whole tokens)', '1 to 1,000,000,000,000. All of it is minted to your wallet.', { inputMode: 'numeric', placeholder: '1000000' })}
            <div className="field"><label htmlFor="st-decimals">Decimals</label><input id="st-decimals" value="7" disabled readOnly /><span className="field-hint">Fixed at 7, the Stellar standard, so the token can later be listed in a Peridot market.</span></div>
          </div>
          {field('metadataUri', 'Image URI (optional)', 'A public https or ipfs link to the token image or metadata. At most 256 bytes.', { maxLength: 256, placeholder: 'https://...' })}
          <div className="card inset" style={{ padding: 14 }}><KeyValue rows={[['Name', draft.name || 'Missing'], ['Symbol', draft.symbol || 'Missing'], ['Supply', supply ? `${whole.format(Number(supply))} ${draft.symbol || 'tokens'}` : 'Invalid'], ['Minted to', wallet.address ? <LpAddress key="me" value={wallet.address} label="your address" /> : 'Your connected wallet'], ['Launch fee', 'None (network fee only)'], ['Network', 'Stellar testnet']]} /></div>
          <div><h3>What will happen</h3><ul className="lp-what"><li><Coins size={16} aria-hidden /><span><strong>One transaction</strong>: <code>create_plain_token(creator, name, symbol, supply, metadata_uri)</code> on the launchpad factory, signed by your wallet. It deploys the token and mints the whole supply to you.</span></li><li><Lightbulb size={16} aria-hidden /><span><strong>No curve and no sale</strong>. You decide what to do with the tokens afterwards. The token is immutable: no mint, no admin, no freeze.</span></li></ul></div>
          <RiskNotice />
          {errors.length > 0 && (draft.name || draft.symbol || draft.metadataUri) && <Notice tone="danger" title="Finish these details before creating"><ul>{errors.map((e, i) => <li key={i}>{e}</li>)}</ul></Notice>}
          <label className="check"><input type="checkbox" checked={acknowledged} disabled={locked} onChange={e => setAcknowledged(e.target.checked)} />I understand this is a testnet experiment, that Peridot does not vet projects, and that public token offerings may require legal review.</label>
          <TxStatus progress={progress} />
          {signingBlocked && <Notice tone="warn" role="status">{signingBlocked}</Notice>}
          <div className="row">{!wallet.address && launchpadCanSign() ? <button className="button" onClick={() => void wallet.connect()} disabled={wallet.isConnecting || !wallet.isReady}>Connect wallet to create</button> : <button className="button large" disabled={busy || !!signingBlocked || errors.length > 0 || !acknowledged} onClick={create}>{busy ? `${progress?.status || 'Preparing'}...` : mode === 'mock' ? 'Create demo token' : 'Create token'}<ArrowRight size={17} aria-hidden /></button>}</div>
        </div>}
      </section>
      <aside className="card sticky-aside" style={{ display: 'grid', gap: 14 }}>
        <div className="row" style={{ gap: 10 }}><span className="token-icon" aria-hidden>{(draft.symbol || '?').slice(0, 2)}</span><div><p className="kicker">Your token at a glance</p><h3 style={{ margin: 0 }}>{draft.name || 'New token'}</h3></div></div>
        <KeyValue rows={[['Symbol', draft.symbol || 'n/a'], ['Supply', supply ? whole.format(Number(supply)) : 'n/a'], ['Decimals', '7'], ['Type', 'Simple'], ['Network', mode === 'mock' ? 'testnet demo' : 'testnet']]} />
        <hr />
        <p className="kicker" style={{ marginBottom: 6 }}>Rules</p>
        <ul className="muted" style={{ fontSize: 12, paddingLeft: 16, display: 'grid', gap: 4 }}><li>Name 1 to 32 characters, symbol 2 to 12 letters or digits</li><li>Supply fixed at creation, 7 decimals</li><li>At most 100 launches per creator</li></ul>
        <hr />
        <p className="muted" style={{ fontSize: 12 }}>New tokens are highly risky. Prices can go to zero. Peridot does not vet projects. Testnet only.</p>
      </aside>
    </div>
  </div>;
}
