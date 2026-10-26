'use client';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, Clock, ShieldCheck } from 'lucide-react';
import { useWallet } from '@/lib/peridot/wallet';
import type { TxProgress } from '@/lib/peridot/rpc';
import { parseAmount } from '@/lib/peridot/amount';
import { Badge, KeyValue, Meter, Notice, Skeleton } from '@/components/ui/primitives';
import { fmtAmount } from '@/components/ui/format';
import { actOnIco, endIcoDemo, getIcoDetails, type IcoAction } from '@/lib/launchpad/ico-client';
import { icoBuyQuote, type IcoInfo } from '@/lib/launchpad/ico-types';
import { launchpadCanSign, launchpadMode, launchpadNetworkLabel } from '@/lib/launchpad/config';
import { LaunchpadBadges, MainnetNotice, RiskNotice, TokenIcon, TxStatus, TypeBadge } from './LaunchpadFrame';
import { LpAddress } from './LpAddress';

type Details = Awaited<ReturnType<typeof getIcoDetails>>;
const amountText = (n: bigint) => fmtAmount(n, 7, 7);
const timeText = (n: bigint) => new Date(Number(n) * 1000).toLocaleString();
export default function IcoPage({ info }: { info: IcoInfo }) {
  const wallet = useWallet(); const [data, setData] = useState<Details | null>(null);
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false); const [spend, setSpend] = useState('10');
  const [now, setNow] = useState(() => BigInt(Math.floor(Date.now() / 1000)));
  const [progress, setProgress] = useState<TxProgress | null>(null);
  const refresh = useCallback(async () => { const next = await getIcoDetails(info, wallet.address); setData(next); }, [info, wallet.address]);
  useEffect(() => {
    let alive = true;
    const load = () => getIcoDetails(info, wallet.address).then(next => { if (alive) { setData(next); setError(''); } }).catch(e => { if (alive) setError(e instanceof Error ? e.message : String(e)); });
    void load(); const poll = setInterval(() => void load(), 15000); const clock = setInterval(() => setNow(BigInt(Math.floor(Date.now() / 1000))), 1000);
    return () => { alive = false; clearInterval(poll); clearInterval(clock); };
  }, [info, wallet.address]);
  async function action(kind: IcoAction) {
    if (!wallet.address || busy || !launchpadCanSign() || wallet.networkMismatch) return;
    setBusy(true); setError(''); setProgress(null);
    try { await actOnIco({ address: wallet.address, signTransaction: wallet.signTransaction }, info, kind, kind === 'buy' ? parseAmount(spend, 7) : 0n, setProgress); await refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); } finally { setBusy(false); }
  }
  if (!data) return <div className="page">{error ? <Notice tone="danger" role="alert">{error}</Notice> : <Skeleton height={240} />}</div>;
  const { config: { params }, state, position } = data;
  const time = data.demoEnd ?? now; const started = time >= params.start; const ended = time >= params.end;
  const succeeded = state.phase === 1 || (ended && state.raised >= params.soft_cap);
  const status = ended ? succeeded ? 'Succeeded' : 'Refunds available' : !started ? 'Upcoming' : state.paused ? 'Purchases paused' : state.raised >= params.hard_cap ? 'Hard cap reached' : 'Sale live';
  const seconds = Number((!started ? params.start : params.end) - time);
  const countdown = seconds > 0 ? `${Math.floor(seconds / 86400)}d ${Math.floor(seconds % 86400 / 3600)}h ${Math.floor(seconds % 3600 / 60)}m ${seconds % 60}s` : 'Sale ended';
  const locked = busy || !launchpadCanSign() || !wallet.address || wallet.networkMismatch;
  let preview = 0n; let buyError = '';
  try { preview = icoBuyQuote(params, state, position, parseAmount(spend, 7), time); } catch (e) { buyError = e instanceof Error ? e.message : String(e); }
  return <div className="page launch-page">
    <div className="page-heading"><div><p className="eyebrow"><Link href="/tokens"><ArrowLeft size={12} /> All tokens</Link></p><h1 className="lp-title"><TokenIcon symbol={info.symbol} large />{info.name} <TypeBadge type="ico" /> <LaunchpadBadges /></h1><p className="lead">{info.symbol} at a fixed price of {amountText(params.price)} XLM per token. Claim after success, or get all your XLM back if the sale fails.</p></div><Badge tone={ended ? succeeded ? 'success' : 'warn' : 'accent'}>{status}</Badge></div>
    <MainnetNotice />
    {error && <Notice tone="danger" role="alert">{error}</Notice>}
    <div className="two-col launch-token-layout"><section className="stack"><div className="card stack"><p className="kicker">Funding progress</p><h2>{amountText(state.raised)} <span className="muted">/ {amountText(params.hard_cap)} XLM</span></h2>
      <Meter label="Raised toward hard cap" value={`${amountText(state.raised)} / ${amountText(params.hard_cap)} XLM`} pct={Number(state.raised * 10000n / params.hard_cap) / 100} ariaLabel="ICO funding progress" tone="accent" />
      <div className="ico-countdown"><Clock size={18} /><div><span className="muted">{!started ? 'Starts in' : ended ? 'Final outcome' : 'Ends in'}</span><strong>{ended ? status : countdown}</strong></div></div>
      <KeyValue rows={[
        ['Soft cap', `${amountText(params.soft_cap)} XLM`], ['Hard cap', `${amountText(params.hard_cap)} XLM`], ['Fixed price', `${amountText(params.price)} XLM`], ['Token supply', `${amountText(params.supply)} ${info.symbol}`],
        ['Wallet cap', params.buyer_cap ? `${amountText(params.buyer_cap)} XLM` : 'No cap'], ['Starts', timeText(params.start)], ['Ends', timeText(params.end)],
      ]} />
    </div><div className="card stack"><h2><ShieldCheck size={20} /> Clear settlement rules</h2><p className="muted">At the deadline, reaching the soft cap unlocks token claims. The creator can withdraw the raise and unsold tokens. Below the soft cap, buyers receive a full XLM refund and the creator reclaims the supply.</p><p className="muted">Purchases round down to 7 token decimals. No liquidity pool, lending market or vesting is included. An admin can pause new purchases, but cannot block claims or refunds. Contract upgrades lock permanently after the first purchase.</p><div className="lp-meta"><span>Token <LpAddress value={info.token} label="token address" /></span><span>Sale <LpAddress value={info.ico} label="ICO address" /></span><span>Creator <LpAddress value={info.creator} label="creator address" /></span></div></div><RiskNotice /></section>
    <aside className="card sticky-aside stack"><p className="kicker">Your allocation</p><h2>{ended ? succeeded ? 'Claim your tokens' : 'Get your refund' : 'Buy at a fixed price'}</h2>
      <KeyValue rows={[
        ['Contributed', `${amountText(position.paid)} XLM`], ['Allocated', `${amountText(position.tokens)} ${info.symbol}`],
        ['Status', position.claimed ? 'Tokens claimed' : position.refunded ? 'Refund received' : position.paid > 0n ? 'Held in escrow' : 'No contribution yet'],
      ]} />
      {!ended && <><div className="field"><label htmlFor="ico-spend">Spend XLM</label><input id="ico-spend" inputMode="decimal" value={spend} onChange={e => setSpend(e.target.value)} disabled={busy} /></div>{buyError ? <p className="field-hint" role="status">{buyError}</p> : <p>You receive <strong>{amountText(preview)} {info.symbol}</strong> after success.</p>}<button className="button" disabled={!!locked || !!buyError} onClick={() => void action('buy')}>Buy {info.symbol}</button></>}
      {ended && succeeded && <button className="button" disabled={!!locked || position.claimed || position.tokens === 0n} onClick={() => void action('claim')}>{position.claimed ? 'Tokens claimed' : `Claim ${info.symbol}`}</button>}
      {ended && !succeeded && <button className="button" disabled={!!locked || position.refunded || position.paid === 0n} onClick={() => void action('refund')}>{position.refunded ? 'Refund received' : 'Refund XLM'}</button>}
      {ended && state.phase === 0 && <button className="button secondary" disabled={!!locked} onClick={() => void action('finalize')}>Finalize sale</button>}
      {ended && wallet.address === info.creator && <button className="button secondary" disabled={!!locked || state.withdrawn} onClick={() => void action('withdraw')}>{state.withdrawn ? 'Creator withdrawal complete' : succeeded ? 'Withdraw raise and unsold tokens' : 'Reclaim token supply'}</button>}
      {!wallet.address && launchpadCanSign() && <button className="button secondary" onClick={() => void wallet.connect()}>Connect wallet</button>}
      {wallet.networkMismatch && <Notice tone="warn">Switch your wallet to {launchpadNetworkLabel()} before signing.</Notice>}
      {busy && <p role="status">Confirming your transaction...</p>}<TxStatus progress={progress} />
      {launchpadMode() === 'mock' && !ended && <div className="ico-demo-controls"><Badge tone="info">Demo controls</Badge><p className="muted">Skip the wait for this browser demo. No onchain time or funds change.</p><button className="button secondary sm" disabled={busy} onClick={() => { endIcoDemo(info.ico, started ? 'end' : 'start'); void refresh(); }}>{started ? 'End sale now (demo)' : 'Start sale now (demo)'}</button></div>}
    </aside></div>
  </div>;
}
