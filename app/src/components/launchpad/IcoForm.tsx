'use client';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, CheckCircle2 } from 'lucide-react';
import { useWallet } from '@/lib/peridot/wallet';
import type { TxProgress } from '@/lib/peridot/rpc';
import { KeyValue, Notice } from '@/components/ui/primitives';
import { fmtAmount } from '@/components/ui/format';
import { validateMetadataUri, validateName, validateSymbol } from '@/lib/launchpad/math';
import { parseAmount } from '@/lib/peridot/amount';
import { quoteToken } from '@/lib/launchpad/client';
import { createIco } from '@/lib/launchpad/ico-client';
import { validateIco, type IcoParams } from '@/lib/launchpad/ico-types';
import { icoAvailable, isLaunchpadMainnet, launchpadCanSign, launchpadMode, launchpadNetworkLabel } from '@/lib/launchpad/config';
import { LaunchpadBadges, MainnetCost, MainnetNotice, RiskNotice, TxStatus, TypeBadge } from './LaunchpadFrame';
import { LpAddress } from './LpAddress';

const localTime = (ms: number) => { const d = new Date(ms); return new Date(ms - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16); };
const initial = () => ({ name: '', symbol: '', supply: '1000000', price: '0.1', soft: '1000', hard: '5000', cap: '0', start: localTime(Date.now() + 5 * 60000), end: localTime(Date.now() + 24 * 3600000 + 5 * 60000), metadata: '' });
export default function IcoForm({ onBack }: { onBack: () => void }) {
  const wallet = useWallet(); const [draft, setDraft] = useState(initial);
  const [ack, setAck] = useState(false); const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<TxProgress | null>(null); const [error, setError] = useState('');
  const [result, setResult] = useState<{ token: string; ico: string } | null>(null);
  const parsed = useMemo(() => {
    const errors = [validateName(draft.name.trim()), validateSymbol(draft.symbol.trim()), validateMetadataUri(draft.metadata.trim())].filter(Boolean) as string[];
    let params: IcoParams | null = null;
    try {
      const values = [draft.supply, draft.price, draft.soft, draft.hard, draft.cap].map(v => parseAmount(v, 7));
      if (values.some(v => v === null)) throw new Error('Enter valid amounts with at most 7 decimal places.');
      const [supply, price, soft_cap, hard_cap, buyer_cap] = values as bigint[];
      const start = BigInt(Math.floor(new Date(draft.start).getTime() / 1000)); const end = BigInt(Math.floor(new Date(draft.end).getTime() / 1000));
      params = { quote_token: quoteToken(), supply, price, soft_cap, hard_cap, buyer_cap, start, end };
      const invalid = validateIco(params, BigInt(Math.floor(Date.now() / 1000))); if (invalid) errors.push(invalid);
    } catch (e) { errors.push(e instanceof RangeError ? 'Choose valid start and end times.' : e instanceof Error ? e.message : 'Check sale terms.'); }
    return { params, errors };
  }, [draft]);
  const net = launchpadNetworkLabel(); const canSign = launchpadCanSign() && icoAvailable(); const blocked = !canSign || !wallet.address || wallet.networkMismatch;
  async function create() {
    if (busy || blocked || !wallet.address || !parsed.params || parsed.errors.length || !ack) return;
    setBusy(true); setError(''); setProgress(null);
    try { setResult(await createIco({ address: wallet.address, signTransaction: wallet.signTransaction }, { name: draft.name.trim(), symbol: draft.symbol.trim(), metadataUri: draft.metadata.trim(), params: parsed.params }, setProgress)); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); } finally { setBusy(false); }
  }
  const field = (key: keyof typeof draft, label: string, hint: string, type = 'text') => <div className="field"><label htmlFor={`ico-${key}`}>{label}</label><input id={`ico-${key}`} type={type} value={draft[key]} disabled={busy || !canSign} onChange={e => setDraft(d => ({ ...d, [key]: key === 'symbol' ? e.target.value.toUpperCase() : e.target.value }))} /><span className="field-hint">{hint}</span></div>;
  return <div className="page launch-page">
    <div className="page-heading"><div><button className="text-link" onClick={onBack} disabled={busy}><ArrowLeft size={13} /> All launch options</button><h1 className="lp-title">Launch an ICO <LaunchpadBadges /></h1><p className="lead">One fixed price. A clear funding goal. A full refund if the sale falls short.</p></div><TypeBadge type="ico" /></div>
    <MainnetNotice />
    {error && <Notice tone="danger" role="alert">{error}</Notice>}
    <div className="two-col launch-token-layout"><section className="card launch-content">
      {result ? <div className="launch-token-success"><CheckCircle2 size={42} /><h2>Your ICO is live on {net}</h2><p>{draft.name} ({draft.symbol})</p><p className="muted">{launchpadMode() === 'mock' ? 'Demo sale saved in this browser. No funds moved.' : 'The full token supply is held in the sale contract until settlement.'}</p><LpAddress value={result.token} label="token address" /><TxStatus progress={progress} /><Link className="button" href={`/token/${result.token}`}>Open ICO page <ArrowRight size={16} /></Link></div>
      : <div className="stack"><div><p className="kicker">Token & sale terms</p><h2>Set your fixed-price sale</h2><p className="muted">All tokens have 7 decimals. Buyers receive their allocation after a successful sale ends.</p></div>
        <div className="field-grid">{field('name', 'Name', '1 to 32 letters, digits, spaces, dots, hyphens or underscores.')}{field('symbol', 'Symbol', '2 to 12 letters or digits.')}</div>
        <div className="field-grid">{field('supply', 'Total token supply', 'Fixed at launch. Unsold tokens return to you.')}{field('price', 'Price per token (XLM)', 'The same price for every buyer, rounded down to token base units.')}</div>
        <div className="field-grid">{field('soft', 'Soft cap (XLM)', 'Minimum raise. Below this, buyers receive a full refund.')}{field('hard', 'Hard cap (XLM)', 'Maximum raise. Purchases above the remaining cap are rejected.')}</div>
        {field('cap', 'Per-wallet cap (XLM)', 'Cumulative per buyer. Set to 0 for no wallet cap.')}
        <div className="field-grid">{field('start', 'Sale starts', 'Your local time. Allow time to sign the creation transaction.', 'datetime-local')}{field('end', 'Sale ends', '10 minutes to 30 days after the start.', 'datetime-local')}</div>
        {field('metadata', 'Image URI (optional)', 'Public https or ipfs URL, at most 256 bytes.')}
        <RiskNotice />
        {(draft.name || draft.symbol) && parsed.errors.length > 0 && <Notice tone="warn" title="Check these details"><ul>{parsed.errors.map(e => <li key={e}>{e}</li>)}</ul></Notice>}
        <label className="check"><input type="checkbox" checked={ack} onChange={e => setAck(e.target.checked)} disabled={busy} />{isLaunchpadMainnet() ? 'I understand this is an unaudited beta on mainnet, that buyers and I use real XLM, and that Peridot does not vet projects.' : 'I understand this is a testnet experiment and Peridot does not vet projects.'}</label>
        <MainnetCost buy={0n} kind="ico" />
        {!icoAvailable() && <Notice tone="warn">ICOs are not live on {net} yet.</Notice>}
        <TxStatus progress={progress} />
        {wallet.networkMismatch && <Notice tone="warn">Switch your wallet to {net} before signing.</Notice>}
        {!wallet.address && canSign ? <button className="button" onClick={() => void wallet.connect()} disabled={wallet.isConnecting}>Connect wallet to create</button> : <button className="button large" onClick={create} disabled={busy || blocked || !ack || parsed.errors.length > 0}>{busy ? 'Creating ICO...' : launchpadMode() === 'mock' ? 'Create demo ICO' : 'Create ICO'} <ArrowRight size={16} /></button>}
      </div>}
    </section><aside className="card sticky-aside stack"><p className="kicker">Sale preview</p><h2>{draft.name || 'Your new token'} <TypeBadge type="ico" /></h2><KeyValue rows={[
      ['Price', `${draft.price || '0'} XLM / ${draft.symbol || 'token'}`], ['Minimum raise', `${draft.soft} XLM`], ['Maximum raise', `${draft.hard} XLM`],
      ['Supply', `${draft.supply} ${draft.symbol || 'tokens'}`], ['Tokens at hard cap', parsed.params && parsed.params.price > 0n ? fmtAmount(parsed.params.hard_cap * 10000000n / parsed.params.price, 7, 7) : 'Check price'], ['Network', `Stellar ${net}`],
    ]} /><hr /><h3>When the sale ends</h3><p className="muted">If the soft cap is reached, buyers claim tokens and you withdraw the raise plus unsold tokens. Otherwise, buyers reclaim all their XLM and you reclaim the token supply.</p><p className="muted">This sale does not create a liquidity pool or lending market. There is no vesting or launch fee, only network fees.</p><p className="muted">An admin can pause new purchases. Claims and refunds stay available. Upgrades are locked after the first purchase.</p></aside></div>
  </div>;
}
