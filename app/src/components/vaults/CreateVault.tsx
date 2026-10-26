'use client';
import { useEffect, useMemo, useState } from 'react';
import { Check, Lock } from 'lucide-react';
import { network, transactionUrl } from '@/lib/peridot/network';
import { useWallet } from '@/lib/peridot/wallet';
import { humanizeTxError } from '@/lib/ui/humanize-tx-error';
import { Badge, Notice } from '@/components/ui/primitives';
import { Address } from '@/components/ui/Address';
import { VAULT_KINDS, defaultValues, validateKind, isValid, type FieldSpec, type Values, type VaultCtx, type VaultKind } from '@/lib/vaults/kinds';
import { tickSpacingForFee } from '@/lib/vaults/kinds/aquarius';
import { createVault, deployedKinds, vaultFactoryId } from '@/lib/vaults/factory-client';
import { pairLabel, type AquariusPool } from '@/lib/vaults/aquarius-pools';
import { APPROVAL_COPY } from '@/lib/vaults/registry';
import { StrategyPreview } from './LadderPreview';
import './vaults.css';

/** Schema-driven "Create a vault" section. Everything kind-specific lives in the VaultKind; this component only renders fields. */
export function CreateVault({ pools, preset, onCreated }: { pools: AquariusPool[]; preset?: AquariusPool | null; onCreated: () => void }) {
  const wallet = useWallet();
  const owner = wallet.address ?? '';
  const [kindId, setKindId] = useState(VAULT_KINDS[0].id);
  const kind = VAULT_KINDS.find(k => k.id === kindId) ?? VAULT_KINDS[0];
  const placeholderOwner = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF';
  const baseCtx = useMemo<VaultCtx>(() => ({ owner: owner || placeholderOwner, net: network.name, decimals: 7 }), [owner]);
  const [values, setValues] = useState<Values>(() => defaultValues(kind, baseCtx));
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ address: string; hash: string; demo: boolean } | null>(null);

  // Reset the form when the kind changes; keep the connected wallet as owner/keeper default.
  useEffect(() => { setValues(defaultValues(kind, baseCtx)); setTouched({}); setResult(null); setError(''); }, [kind, baseCtx]);
  // Prefill from the pool table.
  useEffect(() => {
    if (!preset || kind.id !== 'aquarius') return;
    const under = preset.tokens.find(t => t.symbol === 'USDC' || t.symbol === 'USDT') ?? preset.tokens[0];
    setValues(v => ({ ...v, pool: preset.address, underlying: under.address }));
  }, [preset, kind.id]);

  const selectedPool = pools.find(p => p.address === values.pool);
  const symbols = useMemo(() => Object.fromEntries((selectedPool?.tokens ?? []).map(t => [t.address, t.symbol])), [selectedPool]);
  const ctx = useMemo<VaultCtx>(() => ({ ...baseCtx, facts: { feeBps: selectedPool?.feeBps ?? null, tickSpacing: tickSpacingForFee(selectedPool?.feeBps), symbols } }), [baseCtx, selectedPool, symbols]);
  const formValues = useMemo<Values>(() => ({ ...values, owner: ctx.owner, ...(values.keeper ? {} : { keeper: ctx.owner }) }), [values, ctx.owner]);
  const validation = useMemo(() => {
    const v = validateKind(kind, formValues, ctx);
    if (kind.id === 'aquarius') {
      if (selectedPool && selectedPool.type !== 'concentrated') v.errors.pool = 'Only concentrated-liquidity pools can have a ladder vault.';
      if (selectedPool && formValues.underlying && !selectedPool.tokens.some(t => t.address === formValues.underlying)) v.errors.underlying = 'The deposit token must be one of the pool\'s two tokens.';
    }
    return v;
  }, [kind, formValues, ctx, selectedPool]);
  const preview = useMemo(() => (kind.preview ? kind.preview(formValues, ctx) : null), [kind, formValues, ctx]);
  const summary = useMemo(() => (isValid(validation) && kind.summary ? kind.summary(formValues, ctx) : []), [validation, kind, formValues, ctx]);

  const groups = useMemo(() => {
    const out: Array<[string, FieldSpec[]]> = [];
    for (const f of kind.fields) { const g = out.find(([n]) => n === f.group); if (g) g[1].push(f); else out.push([f.group, [f]]); }
    return out;
  }, [kind]);

  const factoryReady = network.useMocks || (!!vaultFactoryId() && deployedKinds().includes(kind.id));
  const canSubmit = isValid(validation) && !busy && (network.useMocks || (!!wallet.address && factoryReady && !network.readOnly));
  const blocker = network.useMocks ? '' : !wallet.address ? 'Connect a wallet to create a vault.' : !factoryReady ? `The vault factory (${kind.name}) is not deployed on ${network.name} yet.` : network.readOnly ? 'This preview is read only.' : '';

  async function submit() {
    setError(''); setResult(null); setBusy(true);
    try {
      const signer = { address: ctx.owner, signTransaction: wallet.signTransaction };
      const r = await createVault(kind, formValues, ctx, signer);
      setResult(r); onCreated();
    } catch (e) { setError(humanizeTxError(e)); } finally { setBusy(false); }
  }

  const set = (key: string, v: string) => { setValues(s => ({ ...s, [key]: v })); setTouched(t => ({ ...t, [key]: true })); };
  const suggestions = (f: FieldSpec): Array<{ value: string; label: string }> => {
    if (f.suggest === 'pools') return pools.filter(p => p.type === 'concentrated').map(p => ({ value: p.address, label: `${pairLabel(p)} ${p.feeBps !== null ? (p.feeBps / 100).toFixed(2) + '%' : ''}`.trim() }));
    if (f.suggest === 'pool-tokens') return (selectedPool?.tokens ?? []).map(t => ({ value: t.address, label: t.symbol }));
    if (f.suggest === 'owner' && owner) return [{ value: owner, label: 'Connected wallet' }];
    return [];
  };

  return <section className="card vault-create" id="create-vault" aria-labelledby="create-h">
    <div className="card-header"><div><h2 id="create-h">Create a vault</h2><p>Pick a strategy, tune it, and the factory deploys your own vault contract. You own its settings; nobody can take depositors' funds.</p></div></div>

    <div className="kind-picker" role="radiogroup" aria-label="Vault strategy">
      {VAULT_KINDS.map(k => {
        const live = k.status === 'live';
        return <button key={k.id} type="button" role="radio" aria-checked={k.id === kindId} aria-disabled={!live} disabled={!live} data-kind={k.id} className={`kind-card${k.id === kindId ? ' selected' : ''}`} onClick={() => setKindId(k.id)}>
          <span className="row between"><strong>{k.name}</strong>{live ? (k.id === kindId ? <Check size={14} aria-hidden /> : null) : <Badge icon={Lock}>Soon</Badge>}</span>
          <span className="subtle">{k.tagline}</span>
        </button>;
      })}
    </div>
    <p className="muted" style={{ margin: 0, fontSize: 13 }}>{kind.description}</p>

    {network.useMocks && <Notice tone="warn" role="note" title="Demo mode">Vaults you create here are saved in this browser only. No wallet signature, no transaction.</Notice>}
    {!network.useMocks && !factoryReady && <Notice tone="warn" role="note" title="Not deployed on this network">The vault factory or this strategy is not registered on {network.name} yet. You can fill in the form and see the preview, but creation is disabled.</Notice>}

    <form className="stack" onSubmit={e => { e.preventDefault(); if (canSubmit) void submit(); }} noValidate>
      {groups.map(([group, fields]) => <fieldset key={group} className="vault-group">
        <legend>{group}</legend>
        <div className="field-grid">
          {fields.map(f => <FieldControl key={f.key} f={f} value={formValues[f.key] ?? ''} error={touched[f.key] || formValues[f.key] ? validation.errors[f.key] : undefined} suggestions={suggestions(f)} disabled={busy || !!f.locked} onChange={v => set(f.key, v)} unit={f.unit === 'tokens' ? (symbols[formValues.underlying] ?? 'tokens') : f.unit} />)}
        </div>
      </fieldset>)}

      <div className="vault-preview-grid">
        {preview ? <StrategyPreview model={preview} /> : <p className="subtle">Fill in the ladder fields to see the preview.</p>}
        <div className="stack-sm">
          <h3 className="preview-title">Summary</h3>
          {summary.length ? <ul className="summary-list">{summary.map(s => <li key={s}>{s}</li>)}</ul> : <p className="subtle">Fix the highlighted fields to see the summary.</p>}
          {validation.warnings.map(w => <Notice key={w} tone="warn" role="note">{w}</Notice>)}
        </div>
      </div>

      <details className="risk-box"><summary>Risks of this strategy</summary><ul>{kind.risks.map(r => <li key={r}>{r}</li>)}</ul></details>

      {Object.keys(validation.errors).length > 0 && Object.keys(touched).length > 0 && <Notice tone="danger" role="alert" title="Check the form"><ul style={{ margin: 0, paddingLeft: 18 }}>{Object.values(validation.errors).map(e => <li key={e}>{e}</li>)}</ul></Notice>}
      {error && <Notice tone="danger" role="alert">{error}</Notice>}
      {result && <Notice tone="success" role="status" title={result.demo ? 'Demo vault saved' : 'Vault created'}>
        <p>{result.demo ? 'Saved in "My vaults" below. Nothing was sent on chain.' : <>Vault <Address value={result.address} label="vault address" head={6} tail={6} /> is live. <a href={transactionUrl(result.hash)} target="_blank" rel="noreferrer">View transaction</a></>}</p>
        <p style={{ marginTop: 6 }}><strong>Next:</strong> {APPROVAL_COPY} Then add a market with this vault in the launch wizard or the group control panel (step 4, pick {kind.name}).{kind.id === 'zenex' ? ' Zenex vaults also need one bind_market(owner, market) call with the market\'s receipt vault before the market can deposit.' : ''}</p>
      </Notice>}
      <div className="row">
        <button type="submit" className="button" disabled={!canSubmit}>{busy ? 'Creating vault...' : network.useMocks ? 'Create demo vault' : 'Create vault'}</button>
        {blocker && <span className="subtle" style={{ fontSize: 12 }}>{blocker}</span>}
      </div>
    </form>
  </section>;
}

function FieldControl({ f, value, error, suggestions, disabled, onChange, unit }: { f: FieldSpec; value: string; error?: string; suggestions: Array<{ value: string; label: string }>; disabled: boolean; onChange: (v: string) => void; unit?: string }) {
  const id = `vf-${f.key}`, hintId = `${id}-hint`, listId = `${id}-list`;
  const common = { id, 'aria-describedby': hintId, 'aria-invalid': error ? true : undefined, disabled } as const;
  return <div className={`field${error ? ' invalid' : ''}`}>
    <label htmlFor={id}>{f.label}{unit && f.input !== 'select' && f.input !== 'address' ? <span className="field-unit"> ({unit})</span> : null}</label>
    {f.input === 'select'
      ? <select {...common} value={value} onChange={e => onChange(e.target.value)}>{f.options!.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select>
      : f.input === 'toggle'
        ? <input {...common} type="checkbox" checked={value === 'true'} onChange={e => onChange(String(e.target.checked))} />
        : <>
          <input {...common} type="text" inputMode={f.input === 'address' || f.input === 'text' ? 'text' : 'decimal'} autoComplete="off" spellCheck={false} value={value} list={suggestions.length ? listId : undefined} onChange={e => onChange(e.target.value.trim())} />
          {suggestions.length > 0 && <datalist id={listId}>{suggestions.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}</datalist>}
        </>}
    {f.input === 'select' && f.options!.find(o => o.value === value)?.hint && <span className="field-hint">{f.options!.find(o => o.value === value)!.hint}</span>}
    <span className="field-hint" id={hintId}>{error ? <span className="field-error" role="alert">{error}</span> : f.help}</span>
    {f.suggest && suggestions.length > 0 && f.input === 'address' && <span className="chip-row">{suggestions.slice(0, 6).map(s => <button type="button" key={s.value} className="chip" disabled={disabled} onClick={() => onChange(s.value)}>{s.label}</button>)}</span>}
  </div>;
}
