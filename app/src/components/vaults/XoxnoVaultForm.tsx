'use client';
import { useMemo, useState } from 'react';
import { CheckCircle2, ArrowRight } from 'lucide-react';
import { useWallet } from '@/lib/peridot/wallet';
import type { Signer, TxProgress } from '@/lib/peridot/rpc';
import { transactionUrl } from '@/lib/peridot/network';
import { Badge, Notice } from '@/components/ui/primitives';
import { Address } from '@/components/ui/Address';
import { defaultXoxnoConfig, previewXoxno, validateXoxno, XOXNO_FIELDS, type XoxnoConfig, type XoxnoFieldId } from '@/lib/vaults/kinds/xoxno';
import { createXoxnoVault, xoxnoVaultMode, type CreatedXoxnoVault } from '@/lib/vaults/kinds/xoxno-client';

/** Testnet XLM Stellar Asset Contract: the asset the demo vault supplies to XOXNO (hub 1, spoke 1). */
const TESTNET_XLM = 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC';
const readable = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** "Create vault" form for the `xoxno` kind. Fields, validation and init_args encoding come from
 * `lib/vaults/kinds/xoxno.ts`; the contract re-checks every bound in its constructor. */
export default function XoxnoVaultForm() {
  const wallet = useWallet();
  const mode = xoxnoVaultMode();
  const owner = wallet.address || '';
  const [draft, setDraft] = useState<XoxnoConfig>(() => defaultXoxnoConfig('', TESTNET_XLM));
  // Fields that default to the owner follow the wallet until the user edits them.
  const [touched, setTouched] = useState<Partial<Record<XoxnoFieldId, boolean>>>({});
  const cfg: XoxnoConfig = useMemo(() => ({ ...draft, owner, depositor: touched.depositor ? draft.depositor : owner, keeper: touched.keeper ? draft.keeper : owner }), [draft, owner, touched]);
  const errors = useMemo(() => validateXoxno(cfg), [cfg]);
  const hasErrors = Object.keys(errors).length > 0;
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<TxProgress | null>(null);
  const [error, setError] = useState('');
  const [created, setCreated] = useState<CreatedXoxnoVault | null>(null);

  const set = (id: XoxnoFieldId, value: string) => {
    setTouched(t => ({ ...t, [id]: true }));
    setDraft(d => ({ ...d, [id]: id === 'hubId' || id === 'spokeId' || id === 'feeBps' ? Number(value) : value }));
  };
  const blocked = mode === 'unavailable' ? 'Creating XOXNO vaults runs on the testnet app only.' : !wallet.address ? 'Connect your wallet to create a vault.' : wallet.networkMismatch ? 'Switch your wallet to testnet before signing.' : null;

  async function create() {
    if (busy || !wallet.address || hasErrors) return;
    const signer: Signer = { address: wallet.address, signTransaction: wallet.signTransaction };
    setBusy(true); setError(''); setProgress(null);
    try { setCreated(await createXoxnoVault(signer, cfg, setProgress)); }
    catch (e) { setError(readable(e)); }
    finally { setBusy(false); }
  }

  return <section className="card" aria-labelledby="xoxno-form-h" id="create-xoxno">
    <div className="card-header"><div><h2 id="xoxno-form-h">Create a XOXNO Lending vault <Badge tone="info">Testnet, customizable</Badge></h2>
      <p>One transaction deploys your own vault from the Peridot vault factory. It supplies one asset to the real XOXNO Lending testnet controller and never borrows. Every setting below is checked again by the contract.</p></div></div>
    {error && <Notice tone="danger" role="alert">{error}</Notice>}
    {created ? <div className="launch-token-success" style={{ display: 'grid', gap: 10, justifyItems: 'center', textAlign: 'center' }}>
      <CheckCircle2 size={36} aria-hidden /><h3>{mode === 'mock' ? 'Demo vault recorded' : 'Your vault is live on testnet'}</h3>
      <div className="row" style={{ gap: 8 }}>Vault <Address value={created.vault} label="vault address" head={8} tail={8} /></div>
      {!created.hash.startsWith('mock-') && <a className="text-link" href={transactionUrl(created.hash)} target="_blank" rel="noreferrer">View transaction</a>}
      <p className="muted">Deposit and withdraw with <code>node scripts/xoxno_vault.mjs deposit --vault {created.vault.slice(0, 6)}...</code>. In-app deposit comes next.</p>
      <button type="button" className="button secondary" onClick={() => { setCreated(null); setProgress(null); }}>Create another</button></div>
      : <div className="stack-sm" style={{ display: 'grid', gap: 12 }}>
        <div className="field-grid">
          {XOXNO_FIELDS.map(f => {
            const value = f.id === 'hubId' || f.id === 'spokeId' || f.id === 'feeBps' ? String(cfg[f.id]) : cfg[f.id];
            return <div className="field" key={f.id}>
              <label htmlFor={`xv-${f.id}`}>{f.label}</label>
              <input id={`xv-${f.id}`} value={value} disabled={busy} inputMode={f.kind === 'address' ? 'text' : 'decimal'} aria-invalid={!!errors[f.id]} aria-describedby={`xv-${f.id}-h`} onChange={e => set(f.id, e.target.value)} />
              <span className={`field-hint${errors[f.id] ? ' error' : ''}`} id={`xv-${f.id}-h`}>{errors[f.id] ?? f.help}</span>
            </div>;
          })}
        </div>
        <div className="card inset" style={{ padding: 14 }} aria-label="Vault preview">
          <p className="kicker">Preview</p>
          <dl style={{ display: 'grid', gridTemplateColumns: 'minmax(120px, max-content) 1fr', gap: '4px 14px', margin: 0 }}>
            {previewXoxno(cfg).map(r => <div key={r.label} style={{ display: 'contents' }}><dt className="muted">{r.label}</dt><dd style={{ margin: 0 }}>{r.value}</dd></div>)}
          </dl>
        </div>
        {progress && <Notice tone={progress.status === 'error' ? 'danger' : 'info'} role="status" live="polite">{progress.message || progress.status}</Notice>}
        {blocked && <Notice tone="warn" role="status">{blocked}</Notice>}
        <div className="row">{!wallet.address && mode !== 'unavailable' && mode !== 'mock' ? <button type="button" className="button" onClick={() => void wallet.connect()} disabled={wallet.isConnecting || !wallet.isReady}>Connect wallet to create</button>
          : <button type="button" className="button large" disabled={busy || hasErrors || (mode !== 'mock' && !!blocked)} onClick={create}>{busy ? `${progress?.status || 'Preparing'}...` : mode === 'mock' ? 'Create demo XOXNO vault' : 'Create vault'}<ArrowRight size={17} aria-hidden /></button>}</div>
      </div>}
  </section>;
}
