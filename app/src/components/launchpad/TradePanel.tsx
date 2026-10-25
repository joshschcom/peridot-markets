'use client';
import { useEffect, useRef, useState } from 'react';
import { useWallet } from '@/lib/peridot/wallet';
import { network } from '@/lib/peridot/network';
import { formatAmount } from '@/lib/peridot/amount';
import type { Signer, TxProgress } from '@/lib/peridot/rpc';
import { KeyValue, Notice, Tabs } from '@/components/ui/primitives';
import { fmtAmount, fmtPct } from '@/components/ui/format';
import { buyTokens, quoteBuy, quoteSell, sellTokens, type TokenBalance } from '@/lib/launchpad/client';
import { launchpadMode } from '@/lib/launchpad/config';
import { DEFAULT_SLIPPAGE_BPS, FINE_SCALE, finePrice, fmtPrice, minOut, parsePositiveAmount, parseSlippage, reserves } from '@/lib/launchpad/math';
import { Phase, type BuyQuote, type CurveInfo, type CurveParams, type LaunchInfo, type SellQuote } from '@/lib/launchpad/types';

export interface TradePanelProps {
  launch: LaunchInfo; state: CurveInfo; params: CurveParams;
  xlm: TokenBalance | null; token: TokenBalance | null;
  busy: boolean; run: (task: () => Promise<unknown>) => Promise<void>; signer: () => Signer; report: (p: TxProgress) => void;
}
type Side = 'buy' | 'sell';
const readable = (e: unknown) => e instanceof Error ? e.message : String(e);
/** Keep two XLM behind for fees and the account reserve when filling the maximum. */
const XLM_FEE_RESERVE = 20_000_000n;

export function TradePanel({ launch, state, params, xlm, token, busy, run, signer, report }: TradePanelProps) {
  const wallet = useWallet();
  const [side, setSide] = useState<Side>(state.phase === Phase.Trading ? 'buy' : 'sell');
  const [amount, setAmount] = useState('');
  const [slippage, setSlippage] = useState('1');
  const [quote, setQuote] = useState<{ buy?: BuyQuote; sell?: SellQuote } | null>(null);
  const [quoteError, setQuoteError] = useState('');
  const [quoting, setQuoting] = useState(false);
  const generation = useRef(0);
  const buysOpen = state.phase === Phase.Trading;
  const sellsOpen = state.phase === Phase.Trading || state.phase === Phase.Graduatable;
  const open = side === 'buy' ? buysOpen : sellsOpen;
  let amountIn: bigint | null = null, amountError = '';
  if (amount.trim()) { try { amountIn = parsePositiveAmount(amount); } catch (e) { amountError = readable(e); } }
  let slippageBps = DEFAULT_SLIPPAGE_BPS, slippageError = '';
  try { slippageBps = parseSlippage(slippage); } catch (e) { slippageError = readable(e); }
  const amountKey = amountIn === null ? '' : amountIn.toString();
  useEffect(() => {
    const version = ++generation.current;
    setQuote(null); setQuoteError('');
    if (!amountKey || !open) { setQuoting(false); return; }
    const value = BigInt(amountKey);
    setQuoting(true);
    const timer = setTimeout(() => {
      const request = side === 'buy' ? quoteBuy(launch.curve, value).then(buy => ({ buy })) : quoteSell(launch.curve, value).then(sell => ({ sell }));
      request.then(q => { if (version === generation.current) { setQuote(q); setQuoting(false); } })
        .catch(e => { if (version === generation.current) { setQuoteError(readable(e)); setQuoting(false); } });
    }, 350);
    return () => clearTimeout(timer);
  }, [side, amountKey, open, launch.curve, state.real_quote, state.sold]);

  const mode = launchpadMode();
  const reason = mode === 'remote' ? 'Trading is available on the testnet app only.'
    : mode === 'live' && network.readOnly ? 'This preview is read-only. Transactions are not enabled.'
    : !wallet.address ? 'Connect your wallet to trade.'
    : wallet.networkMismatch ? 'Switch your wallet to testnet before signing.'
    : !open ? (side === 'buy' ? 'Buys are closed: the curve reached its target.' : 'Sells are closed: graduation has started.')
    : null;
  const current = finePrice(reserves(params, state.real_quote, state.sold));
  const out = quote?.buy ? quote.buy.tokens_out : quote?.sell ? quote.sell.quote_out : null;
  const minimum = out !== null ? (slippageError ? null : minOut(out, slippageBps)) : null;
  const average = quote?.buy && quote.buy.tokens_out > 0n ? quote.buy.quote_spent * FINE_SCALE / quote.buy.tokens_out : quote?.sell && amountIn ? quote.sell.gross_quote * FINE_SCALE / amountIn : null;
  const impact = average !== null && current > 0n ? Number((average - current) * 10_000n / current) / 100 : null;
  const isCreator = !!wallet.address && wallet.address === launch.creator;
  const canSubmit = !busy && !reason && !!quote && !!amountIn && !amountError && !slippageError && !quoting;
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!amountIn || !quote || minimum === null) return;
    const value = amountIn;
    void run(async () => {
      const s = signer();
      if (side === 'buy') await buyTokens(s, launch.curve, value, minimum, report);
      else await sellTokens(s, launch.curve, value, minimum, report);
      setAmount('');
    });
  };
  const maxValue = side === 'buy' ? (xlm ? (xlm.balance > XLM_FEE_RESERVE ? xlm.balance - XLM_FEE_RESERVE : 0n) : null) : token?.balance ?? null;
  if (!buysOpen && !sellsOpen) return <section className="card trade-panel" aria-label={`Trade ${launch.symbol}`}>
    <div className="card-header"><div><h2>Trade</h2><p>Trading on the curve has ended.</p></div></div>
    {wallet.address && <KeyValue rows={[['Your XLM', xlm ? `${fmtAmount(xlm.balance, 7, 2)} XLM` : 'Loading...'], [`Your ${launch.symbol}`, token ? (token.needsTrustline ? 'No trustline' : `${fmtAmount(token.balance, 7, 2)} ${launch.symbol}`) : 'Loading...']]} />}
    <Notice tone="info" role="note">{state.phase === Phase.Graduated ? `${launch.symbol} now trades in its Aquarius pool and can be supplied or borrowed in its lending market. The curve no longer buys or sells.` : 'Graduation has started. Buys and sells on the curve are closed for good; the pool opens when graduation completes.'}</Notice>
    <KeyValue rows={[['Final curve price', `${fmtPrice(current)} XLM`], ['Raised on the curve', `${fmtAmount(state.real_quote, 7, 2)} XLM`]]} />
  </section>;
  return <section className="card trade-panel" aria-label={`Trade ${launch.symbol}`}>
    <div className="card-header"><div><h2>Trade</h2><p>Buy with XLM or sell back to the curve. {Number(params.trade_fee_bps) / 100}% fee on the XLM side.</p></div></div>
    <Tabs block ariaLabel="Trade side" value={side} onChange={s => { setSide(s); setAmount(''); }} items={[{ value: 'buy', label: 'Buy' }, { value: 'sell', label: 'Sell' }]} />
    {wallet.address && <KeyValue rows={[['Your XLM', xlm ? `${fmtAmount(xlm.balance, 7, 2)} XLM` : 'Loading...'], [`Your ${launch.symbol}`, token ? (token.needsTrustline ? 'No trustline' : `${fmtAmount(token.balance, 7, 2)} ${launch.symbol}`) : 'Loading...']]} />}
    {!wallet.address && mode !== 'remote' && <button type="button" className="button secondary" onClick={() => void wallet.connect()} disabled={wallet.isConnecting || !wallet.isReady}>{wallet.isConnecting ? 'Connecting...' : 'Connect wallet'}</button>}
    <form className="stack" onSubmit={submit}>
      <div className="field">
        <label htmlFor="trade-amount">{side === 'buy' ? 'Spend XLM' : `Sell ${launch.symbol}`}</label>
        <div className="amount-row">
          <input id="trade-amount" inputMode="decimal" placeholder="0.00" value={amount} disabled={!open || mode === 'remote'} onChange={e => setAmount(e.target.value)} aria-invalid={!!amountError} aria-describedby="trade-amount-hint" />
          {maxValue !== null && maxValue > 0n && <button type="button" className="button ghost sm" disabled={!open} onClick={() => setAmount(formatAmount(maxValue, 7))}>Max</button>}
        </div>
        <span id="trade-amount-hint" className="field-hint">{amountError || (side === 'buy' ? 'The fee is included in what you spend.' : 'You receive XLM after the fee.')}</span>
      </div>
      <div className="field">
        <label htmlFor="trade-slippage">Maximum slippage (%)</label>
        <input id="trade-slippage" inputMode="decimal" value={slippage} onChange={e => setSlippage(e.target.value)} aria-invalid={!!slippageError} style={{ maxWidth: 140 }} />
        <span className="field-hint">{slippageError || 'The transaction reverts if you would receive less than the minimum below.'}</span>
      </div>
      <div className="trade-summary" aria-live="polite">
        {quoting ? <p className="muted" style={{ margin: 0 }}>Fetching a quote...</p>
          : quoteError ? <p className="muted" style={{ margin: 0 }}>{quoteError}</p>
          : quote?.buy ? <KeyValue rows={[['You spend', `${fmtAmount(quote.buy.quote_spent, 7, 4)} XLM`], ['Fee', `${fmtAmount(quote.buy.fee, 7, 4)} XLM`], ['You receive', `${fmtAmount(quote.buy.tokens_out, 7, 2)} ${launch.symbol}`], ['Minimum received', minimum !== null ? `${fmtAmount(minimum, 7, 2)} ${launch.symbol}` : 'n/a'], ['Average price', average !== null ? `${fmtPrice(average)} XLM` : 'n/a'], ['Price impact', impact !== null ? fmtPct(impact, 2) : 'n/a']]} />
          : quote?.sell ? <KeyValue rows={[['You sell', `${fmtAmount(amountIn ?? 0n, 7, 2)} ${launch.symbol}`], ['Fee', `${fmtAmount(quote.sell.fee, 7, 4)} XLM`], ['You receive', `${fmtAmount(quote.sell.quote_out, 7, 4)} XLM`], ['Minimum received', minimum !== null ? `${fmtAmount(minimum, 7, 4)} XLM` : 'n/a'], ['Average price', average !== null ? `${fmtPrice(average)} XLM` : 'n/a'], ['Price impact', impact !== null ? fmtPct(impact, 2) : 'n/a']]} />
          : <KeyValue rows={[['Current price', `${fmtPrice(current)} XLM`], ['Trade fee', `${Number(params.trade_fee_bps) / 100}%`], ['Slippage', slippageError ? 'n/a' : `${slippageBps / 100}%`]]} />}
      </div>
      {quote?.buy?.clamped && <Notice tone="warn" role="status">Your buy will be partly filled to land exactly on the target. Only {fmtAmount(quote.buy.quote_spent, 7, 4)} XLM is charged; the rest stays in your wallet, and the curve becomes ready to graduate.</Notice>}
      {reason && <Notice tone={open ? 'info' : 'warn'} role="status">{reason}</Notice>}
      <button className="button block" disabled={!canSubmit}>{busy ? 'Working...' : side === 'buy' ? `Buy ${launch.symbol}` : `Sell ${launch.symbol}`}</button>
    </form>
    {isCreator && <p className="subtle" style={{ fontSize: 12, margin: 0 }}>Creator cap: your buys are limited to {fmtAmount(state.creator_cap, 7, 0)} {launch.symbol} in total ({Number(params.creator_cap_bps) / 100}% of the curve supply). Bought so far: {fmtAmount(state.creator_bought, 7, 0)} {launch.symbol}. Sells do not reset the cap.</p>}
    {token?.needsTrustline && <p className="subtle" style={{ fontSize: 12, margin: 0 }}>Your account cannot hold {launch.symbol} until the token contract balance exists; a first buy creates it.</p>}
  </section>;
}
