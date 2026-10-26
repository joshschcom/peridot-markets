'use client';
/** Step 4 of the add-market form: where idle liquidity goes. Owns the venue choice, the fixed DeFindex default vault,
 * the Blend fee vault from the manifest, created vaults (Aquarius ladder, Zenex, XOXNO) attached through the
 * DeFindex-shaped route, the factory allow-list state and the rate shown for each option. The draft only ever carries
 * `route` (None | Defindex | Blend) and `routeAddress`, so submit paths are unchanged. */
import { useEffect, useMemo, useState } from 'react';
import { StrKey } from '@stellar/stellar-sdk';
import { CheckCircle2, ShieldAlert, ShieldCheck } from 'lucide-react';
import { isYieldVaultAllowed } from '@/lib/peridot/factory';
import { readContract } from '@/lib/peridot/rpc';
import { getDeployments, network } from '@/lib/peridot/network';
import { useWallet } from '@/lib/peridot/wallet';
import { GUARDRAILS } from '@/lib/peridot/types';
import { borrowApr, ratesFromDraft, type MarketDraft } from '@/lib/peridot/market-config';
import { Badge, Notice, Tooltip } from '@/components/ui/primitives';
import { Address } from '@/components/ui/Address';
import { VaultOptionList } from './VaultOptionList';
import { YieldRate } from './YieldRate';
import { defaultDefindexVault, defindexUnavailableReason } from '@/lib/vaults/defindex-defaults';
import { APPROVAL_COPY, getVaultOption, venueAvailability, venueForRoute, type VaultId, type VaultOption } from '@/lib/vaults/registry';
import { deployedKinds, listMyVaults } from '@/lib/vaults/factory-client';
import type { VaultRecordView } from '@/lib/vaults/kinds/types';
import type { YieldQuote } from '@/lib/vaults/apy';
import './vaults.css';

export interface VaultStepProps { id: string; value: MarketDraft; onChange: (value: MarketDraft) => void; disabled?: boolean }
type Approval = 'idle' | 'checking' | 'allowed' | 'needs' | 'failed';
interface VaultCheck { address: string; name?: string; symbol?: string; asset?: string; active?: boolean; kind?: string; error?: string }

/** The field helper mirrors MarketConfigEditor's so the step looks like its siblings. */
function Field({ id, label, hint, children }: { id: string; label: string; hint?: string; children: React.ReactNode }) {
  return <div className="field"><label htmlFor={id}>{label}</label>{children}{hint && <span className="field-hint">{hint}</span>}</div>;
}

export function ApprovalBadge({ state }: { state: Approval }) {
  if (state === 'idle') return null;
  if (state === 'checking') return <Badge tone="info">Checking factory allow-list...</Badge>;
  if (state === 'failed') return <Badge tone="warn" icon={ShieldAlert}>Allow-list could not be read</Badge>;
  if (state === 'allowed') return <Badge tone="success" icon={ShieldCheck} title="is_yield_vault_allowed returned true">Approved by Peridot</Badge>;
  return <Badge tone="warn" icon={ShieldAlert} title="is_yield_vault_allowed returned false">Needs Peridot approval</Badge>;
}

export default function VaultStep({ id, value, onChange, disabled }: VaultStepProps) {
  const wallet = useWallet();
  const owner = wallet.address ?? '';
  const external = useMemo(() => { try { return getDeployments().external as Record<string, unknown>; } catch { return {} as Record<string, unknown>; } }, []);
  const blendVault = typeof external.blend_fee_vault === 'string' ? external.blend_fee_vault : '';
  const blendAvailable = network.useMocks || (!!blendVault && (() => { try { return !!getDeployments().wasm?.blend_adapter; } catch { return false; } })());
  const kinds = useMemo(() => deployedKinds(), []);
  const defindex = defaultDefindexVault(network.name, value.token);
  const defindexReason = network.useMocks && !value.token ? 'Verify a token first. DeFindex vaults exist for XLM, USDC and EURC.' : defindexUnavailableReason(network.name, value.token, value.symbol);

  const [myVaults, setMyVaults] = useState<VaultRecordView[]>([]);
  useEffect(() => { let c = false; if (!owner) { setMyVaults([]); return; } listMyVaults(owner).then(v => { if (!c) setMyVaults(v); }).catch(() => { if (!c) setMyVaults([]); }); return () => { c = true; }; }, [owner]);
  const ownKind = myVaults.find(v => v.address === value.routeAddress)?.kind ?? null;
  const [venue, setVenue] = useState<VaultId>(() => venueForRoute(value.route, null));
  // A draft restored with a created vault as its route address is told apart by the vault's kind once the list loads.
  useEffect(() => { if (value.route === 'Defindex' && ownKind) setVenue(venueForRoute('Defindex', ownKind)); }, [value.route, ownKind]);
  useEffect(() => { if (value.route === 'None' && venue !== 'idle') setVenue('idle'); if (value.route === 'Blend' && venue !== 'blend') setVenue('blend'); }, [value.route, venue]);
  const option = getVaultOption(venue);

  const availability = (o: VaultOption): { selectable: boolean; reason?: string } => {
    if (o.id === 'defindex' && defindexReason) return { selectable: false, reason: defindexReason };
    if (o.id === 'blend' && !blendAvailable) return { selectable: false, reason: `No Blend fee vault is deployed on ${network.name}.` };
    const a = venueAvailability(o, network.name, kinds);
    return { selectable: a.selectable, reason: a.reason };
  };
  const pick = (o: VaultOption) => {
    if (!availability(o).selectable) return;
    setVenue(o.id);
    const address = o.id === 'defindex' ? defindex?.vault ?? '' : o.id === 'blend' ? blendVault : '';
    onChange({ ...value, route: o.factoryRoute ?? 'None', routeAddress: address });
  };
  // The DeFindex default follows the verified token; the draft is updated only when it differs.
  useEffect(() => { if (venue === 'defindex') { const want = defindex?.vault ?? ''; if (value.routeAddress !== want) onChange({ ...value, routeAddress: want }); } }, [venue, defindex?.vault]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (venue === 'blend' && blendVault && value.routeAddress !== blendVault) onChange({ ...value, routeAddress: blendVault }); }, [venue, blendVault]); // eslint-disable-line react-hooks/exhaustive-deps

  // Factory allow-list for the chosen vault.
  const [approval, setApproval] = useState<{ address: string; state: Approval }>({ address: '', state: 'idle' });
  useEffect(() => {
    const address = value.routeAddress;
    if (!StrKey.isValidContract(address)) { setApproval({ address, state: 'idle' }); return; }
    let c = false; setApproval({ address, state: 'checking' });
    isYieldVaultAllowed(address).then(ok => { if (!c) setApproval({ address, state: ok ? 'allowed' : 'needs' }); }).catch(() => { if (!c) setApproval({ address, state: 'failed' }); });
    return () => { c = true; };
  }, [value.routeAddress]);

  // Read-only simulation of the vault's DeFindex-shaped surface: name, symbol, underlying asset, strategy, kind.
  const [check, setCheck] = useState<VaultCheck | null>(null);
  useEffect(() => {
    const address = value.routeAddress;
    if (!StrKey.isValidContract(address) || venue === 'blend' || venue === 'idle') { setCheck(null); return; }
    if (network.useMocks) { setCheck({ address, name: 'Demo vault (no simulation)', symbol: '', asset: value.token, active: true, kind: option.kind }); return; }
    let c = false; setCheck(null);
    (async () => {
      try {
        const assets = await readContract<Array<{ address: string; strategies: Array<{ name: string; paused: boolean }> }>>(address, 'get_assets');
        const [name, symbol] = venue === 'defindex' ? await Promise.all([readContract<string>(address, 'name'), readContract<string>(address, 'symbol')]) : ['', ''];
        let kind = ''; if (option.kind) { try { kind = await readContract<string>(address, 'kind'); } catch { kind = ''; } }
        if (!c) setCheck({ address, name, symbol, asset: assets[0]?.address ?? '', active: assets[0]?.strategies.some(s => !s.paused) ?? false, kind });
      } catch (e) { if (!c) setCheck({ address, error: e instanceof Error ? e.message : 'The vault did not answer.' }); }
    })();
    return () => { c = true; };
  }, [value.routeAddress, venue, option.kind, value.token]);
  const assetOk = check && !check.error ? check.asset === value.token : null;

  // Keep in Peridot: the market does not exist yet, so the rate comes from the draft's own curve at fixed utilizations.
  const idleQuote = useMemo<YieldQuote>(() => {
    try {
      const r = ratesFromDraft(value); const rf = Math.min(0.5, Math.max(0, Number(value.reserveFactor) / 100 || 0));
      const at = (u: number) => borrowApr(r, u) / 100 * (u / 100) * (1 - rf);
      return { kind: 'apr', value: at(50), label: 'APR at 50% utilization, from your rate curve', formula: 'supply APR = borrow APR(utilization) * utilization * (1 - reserve factor), with the borrow APR from the curve in step 2. A new market starts at 0% utilization, so suppliers earn nothing until borrowers arrive.', facts: [['At launch (0%)', `${(at(0) * 100).toFixed(2)}%`], ['At 50%', `${(at(50) * 100).toFixed(2)}%`], ['At 80%', `${(at(80) * 100).toFixed(2)}%`]], asOf: Date.now() };
    } catch { return { kind: 'na', label: 'n/a', formula: 'Enter valid rate values in step 2.', reason: 'The rate curve is not valid yet.', facts: [], asOf: Date.now() }; }
  }, [value]);

  const rateFor = (o: VaultOption) => o.id === 'idle' ? { quote: idleQuote } : o.id === 'defindex' ? { token: value.token } : o.id === 'blend' ? { token: value.token } : o.id === 'xoxno' ? { token: value.token || undefined } : {};
  const ownList = myVaults.filter(v => v.kind === option.kind);

  return <>
    <div className="field-grid">
      <Field id={`${id}-idleBuffer`} label={`Kept liquid (${GUARDRAILS.MIN_IDLE_BUFFER_BPS / 100}% to ${GUARDRAILS.MAX_IDLE_BUFFER_BPS / 100}%)`} hint="Idle buffer between 10% and 100%. The default 20% keeps one fifth of deposits in the market."><input id={`${id}-idleBuffer`} inputMode="decimal" value={String(value.idleBuffer ?? '')} onChange={e => onChange({ ...value, idleBuffer: e.target.value })} disabled={disabled} /></Field>
      <Field id={`${id}-route`} label="Where idle liquidity goes" hint="Vault addresses are never typed in: DeFindex and Blend vaults are fixed per token, and your own vaults come from the vault factory.">
        <select id={`${id}-route`} value={venue} disabled={disabled} onChange={e => pick(getVaultOption(e.target.value as VaultId))}>
          {(['idle', 'defindex', 'blend', 'aquarius', 'zenex', 'xoxno'] as const).map(vid => { const o = getVaultOption(vid); const a = availability(o); return <option key={vid} value={vid} disabled={!a.selectable}>{o.name}{a.selectable ? '' : ` (${a.reason?.split('.')[0] ?? 'unavailable'})`}</option>; })}
        </select>
      </Field>
    </div>
    <VaultOptionList compact ariaLabel="All yield options" disabled={disabled} selected={venue} onSelect={pick} isLocked={o => availability(o).reason ?? null} rateFor={rateFor} />

    {venue === 'idle' && <div className="card inset stack-sm" style={{ padding: 14 }}><p className="muted" style={{ margin: 0, fontSize: 12 }}>Funds stay in the market and earn only borrower interest. <YieldRate venue="idle" quote={idleQuote} facts /></p></div>}

    {venue === 'defindex' && defindex && <div className="card inset stack-sm vault-fixed" style={{ padding: 14 }} data-testid="defindex-default">
      <div className="row between"><strong>Default DeFindex vault for {defindex.symbol}</strong><ApprovalBadge state={approval.address === value.routeAddress ? approval.state : 'checking'} /></div>
      <div className="kv" style={{ fontSize: 12 }}>
        <div><span>Vault</span><span><Address value={defindex.vault} label="DeFindex vault address" head={6} tail={6} /></span></div>
        <div><span>Name</span><span>{check?.name ? `${check.name} (${check.symbol})` : check?.error ? 'unavailable' : 'reading...'}</span></div>
        <div><span>Asset check</span><span>{check?.error ? <Badge tone="danger">{check.error}</Badge> : assetOk === null ? 'simulating get_assets...' : assetOk ? <Badge tone="success" icon={CheckCircle2}>Manages {defindex.symbol}{check?.active ? ', strategy active' : ', no active strategy'}</Badge> : <Badge tone="danger">Vault asset does not match {defindex.symbol}</Badge>}</span></div>
        <div><span>Rate</span><span><YieldRate venue="defindex" token={value.token} facts /></span></div>
        <div><span>Source</span><span className="muted">{defindex.source}<Tooltip text="The address is fixed in app/src/lib/vaults/defindex-defaults.ts with the file it was taken from. Owners cannot substitute another vault; Peridot admin allow-lists vaults on the market factory." /></span></div>
      </div>
      {approval.state === 'needs' && approval.address === value.routeAddress && <Notice tone="warn">{APPROVAL_COPY} The launch will be refused until then; the vault address is still passed through add_market unchanged.</Notice>}
    </div>}

    {venue === 'blend' && <div className="card inset stack-sm" style={{ padding: 14 }}>
      <div className="row between"><strong>Blend fee vault</strong><ApprovalBadge state={approval.address === value.routeAddress ? approval.state : 'checking'} /></div>
      <div className="kv" style={{ fontSize: 12 }}>
        <div><span>Fee vault</span><span>{blendVault ? <Address value={blendVault} label="Blend fee vault address" head={6} tail={6} /> : 'not configured'}</span></div>
        <div><span>Rate</span><span><YieldRate venue="blend" token={value.token} facts /></span></div>
      </div>
      <p className="muted" style={{ margin: 0, fontSize: 12 }}>From the deployment manifest. The fee vault must hold a reserve for this exact token; that is checked by simulation at launch.</p>
    </div>}

    {option.kind && <div className="card inset stack-sm" style={{ padding: 14 }} data-testid="own-vault">
      <div className="row between"><strong>Your {option.name}</strong><ApprovalBadge state={approval.address === value.routeAddress ? approval.state : 'idle'} /></div>
      <p className="muted" style={{ margin: 0, fontSize: 12 }}>Create and tune the vault on the <a className="text-link" href="/vaults">Vaults page</a>, then choose it here. It is attached through the same route as a DeFindex vault (add_market with the vault address, then attach_yield). {APPROVAL_COPY}{option.underlying ? ` Deposit token: ${option.underlying} only.` : ''}</p>
      {owner && ownList.length > 0 && <div className="chip-row" role="group" aria-label={`Your ${option.name}s`}>{ownList.map(v => <button key={v.address} type="button" className={`chip${v.address === value.routeAddress ? ' selected' : ''}`} disabled={disabled} aria-pressed={v.address === value.routeAddress} onClick={() => onChange({ ...value, routeAddress: v.address })}>{v.address.slice(0, 6)}...{v.address.slice(-6)}{v.demo ? ' (demo)' : ''}</button>)}</div>}
      {owner && ownList.length === 0 && <p className="subtle" style={{ margin: 0, fontSize: 12 }}>No {option.name} created by {owner.slice(0, 6)}... yet.</p>}
      <Field id={`${id}-ownvault`} label={`${option.name} address (created on the Vaults page)`} hint="Only vaults deployed by the Peridot vault factory can be allow-listed. The asset and kind are checked by simulation."><input id={`${id}-ownvault`} placeholder="C..." value={value.routeAddress} disabled={disabled} onChange={e => onChange({ ...value, routeAddress: e.target.value.trim() })} /></Field>
      {StrKey.isValidContract(value.routeAddress) && <div className="kv" style={{ fontSize: 12 }}>
        <div><span>Kind</span><span>{check?.error ? 'unavailable' : !check ? 'simulating...' : check.kind ? (check.kind === option.kind ? <Badge tone="success">{check.kind}</Badge> : <Badge tone="danger">reports {check.kind}, expected {option.kind}</Badge>) : 'not reported'}</span></div>
        <div><span>Asset check</span><span>{check?.error ? <Badge tone="danger">{check.error}</Badge> : assetOk === null ? 'simulating get_assets...' : assetOk ? <Badge tone="success" icon={CheckCircle2}>Manages {value.symbol || 'this token'}</Badge> : <Badge tone="danger">Vault asset does not match {value.symbol || 'this token'}</Badge>}</span></div>
        <div><span>Rate</span><span><YieldRate venue={venue} token={value.token} vault={value.routeAddress} facts /></span></div>
      </div>}
      {venue === 'zenex' && <Notice tone="info" title="Extra step for Zenex: bind_market">Your Zenex vault only accepts deposits from the market bound to it. After the market is created, call <code>bind_market(owner, market)</code> on the vault once with the market's receipt vault address (shown on the group page). Until then only the owner can deposit. Withdrawals beyond the liquid buffer wait for Zenex: at least one hour.</Notice>}
      {venue === 'xoxno' && <p className="muted" style={{ margin: 0, fontSize: 12 }}>The vault's depositor must be this market's receipt vault for the market to route into it (set at creation, or create a new vault once the market address is known).</p>}
    </div>}
  </>;
}
