'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { HeartPulse, RefreshCw, Wallet } from 'lucide-react';
import { readContract } from '@/lib/peridot/rpc';
import { addr, type MarketView } from '@/lib/peridot/group-client';
import { network } from '@/lib/peridot/network';
import { useWallet } from '@/lib/peridot/wallet';
import type { Group } from '@/lib/peridot/types';
import { Badge, Meter, Notice, Skeleton, Stat } from '@/components/ui/primitives';
import { STATE_COPY, commonDecimals, fmtUsd, mixedDecimals, summarizeHealth, type AccountHealthSummary, type HealthPosition } from '@/lib/health/account-health';
import '../ui/qol.css';

/* Lending-account health for the group page. Idea from PeridotV2Full 86ae3795 hooks/use-borrowing-power.ts
 * and hooks/use-borrow-balance.ts; the data source is the group controller: `account_liquidity(user)`
 * (authoritative liquidity and shortfall in USD) plus `get_price_usd(token)` for the per-market dollar
 * values. Reads go through the existing `readContract` helper. In demo mode nothing is read: the values
 * come from the mock market views with 1 USD per token. */
type Position = HealthPosition & { token: string };
type PriceReading = [bigint, bigint] | null | undefined;
const readable = (e: unknown) => e instanceof Error ? e.message : String(e);
const DEMO_PRICE: [bigint, bigint] = [1_000_000n, 1_000_000n];

export function AccountHealth({ group, markets }: { group: Group; markets: MarketView[] }) {
  const wallet = useWallet();
  const address = wallet.address;
  const [summary, setSummary] = useState<AccountHealthSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const generation = useRef(0);
  const positions = useMemo<Position[]>(() => markets.map(m => ({
    symbol: m.token.symbol, decimals: m.token.decimals, token: m.token.address,
    underlying: m.receiptBalance * m.exchangeRate / 1_000_000n, debt: m.debt,
    collateralFactor: m.config.collateral_factor, entered: m.entered,
  })), [markets]);

  const load = useCallback(async () => {
    const version = ++generation.current;
    if (!address) { setSummary(null); return; }
    setLoading(true); setError('');
    try {
      if (network.useMocks) {
        setSummary(summarizeHealth(positions.map(p => ({ ...p, price: DEMO_PRICE[0], priceScale: DEMO_PRICE[1] })), null));
        return;
      }
      const held = positions.filter(p => p.underlying > 0n || p.debt > 0n);
      const [liquidity, ...prices] = await Promise.all([
        readContract<[bigint, bigint]>(group.controller, 'account_liquidity', [addr(address)]),
        ...held.map(p => readContract<PriceReading>(group.controller, 'get_price_usd', [addr(p.token)]).catch((): PriceReading => null)),
      ]);
      if (version !== generation.current) return;
      const priced = positions.map(p => {
        const index = held.indexOf(p);
        const price = index >= 0 ? prices[index] : null;
        return Array.isArray(price) && price.length === 2 ? { ...p, price: price[0], priceScale: price[1] } : p;
      });
      setSummary(summarizeHealth(priced, { liquidity: liquidity[0], shortfall: liquidity[1] }, commonDecimals(priced)));
    } catch (e) {
      if (version === generation.current) { setError(readable(e)); setSummary(null); }
    } finally {
      if (version === generation.current) setLoading(false);
    }
  }, [address, group.controller, positions]);

  useEffect(() => { void load(); return () => { generation.current++; }; }, [load]);

  if (!address) {
    return <div className="health health-connect">
      <p><Wallet size={16} aria-hidden style={{ verticalAlign: '-3px', marginRight: 8, color: 'var(--accent-text)' }} />Connect your wallet to see the health of your lending account in this group.</p>
      <button type="button" className="button secondary sm" onClick={() => void wallet.connect()} disabled={wallet.isConnecting || !wallet.isReady}>{wallet.isConnecting ? 'Connecting' : 'Connect wallet'}</button>
    </div>;
  }
  if (loading && !summary) {
    return <div className="health" aria-busy="true" role="status">
      <div className="health-head"><h3><HeartPulse size={15} aria-hidden />Account health</h3><Skeleton width={60} height={20} /></div>
      <div className="stat-grid health-stats">{[0, 1, 2].map(i => <div key={i} className="stack-sm"><Skeleton width={90} height={12} /><Skeleton width={120} height={22} /></div>)}</div>
      <Skeleton height={6} />
      <span className="sr-only">Loading account health...</span>
    </div>;
  }
  if (error) {
    return <div className="health">
      <Notice tone="warn" role="status" title="Account health unavailable">
        <span className="wrap">{error}</span>
        <div className="mt-2"><button type="button" className="button secondary sm" onClick={() => void load()}><RefreshCw size={13} aria-hidden />Retry health check</button></div>
      </Notice>
    </div>;
  }
  if (!summary) return null;

  const copy = STATE_COPY[summary.state];
  const pct = summary.utilization === null ? 0 : Math.min(100, summary.utilization * 100);
  const used = summary.utilization === null ? 'No debt' : summary.utilization === Infinity ? 'No limit' : `${(summary.utilization * 100).toFixed(summary.utilization >= 1 ? 0 : 1)}% used`;
  const tone = summary.state === 'risk' ? 'danger' : summary.state === 'watch' ? 'warn' : summary.state === 'unavailable' ? 'warn' : 'accent';
  const notEnabled = summary.suppliedUsd - summary.collateralUsd;
  return <div className="health" aria-live="polite">
    <div className="health-head">
      <h3><HeartPulse size={15} aria-hidden />Account health</h3>
      <span className="row" style={{ gap: 8 }}>{loading && <span className="subtle" style={{ fontSize: 12 }}>Updating</span>}<Badge tone={copy.tone}>{copy.label}</Badge></span>
    </div>
    <div className="stat-grid health-stats">
      <Stat label="Collateral value" value={fmtUsd(summary.collateralUsd)} hint={notEnabled > 0.005 ? `${fmtUsd(notEnabled)} more supplied but not counted as collateral` : 'Enabled supply at oracle prices'} />
      <Stat label="Debt value" value={fmtUsd(summary.debtUsd)} hint={summary.borrowLimitUsd > 0 ? `Borrow limit ${fmtUsd(summary.borrowLimitUsd)}` : 'No borrow limit yet'} />
      <Stat label="Borrowing power left" value={summary.state === 'unavailable' ? 'n/a' : fmtUsd(summary.availableUsd)} hint={summary.state === 'risk' ? `Shortfall ${fmtUsd(summary.shortfallUsd)}` : summary.source === 'contract' ? 'Reported by the group controller' : 'Estimated from market data'} />
    </div>
    <Meter thin label="Borrow limit used" value={used} pct={pct} tone={tone} ariaLabel="Share of the borrow limit in use" hint={copy.text} />
    {network.useMocks && <p className="health-note">Demo mode: values use 1 USD per token and are computed from the simulated balances.</p>}
    {summary.priceMissing.length > 0 && <p className="health-note">Price unavailable for {summary.priceMissing.join(', ')}; those balances count as 0 here. The controller still enforces its own pricing.</p>}
    {mixedDecimals(positions) && <p className="health-note">Markets in this group use different token decimals; the controller totals are shown with {commonDecimals(positions)} decimals.</p>}
  </div>;
}
