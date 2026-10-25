'use client';
import { useMemo } from 'react';
import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { liquidationPriceEstimate, type Side } from '@/lib/peridot/margin';
import { fmtNumber, fmtPct } from '@/components/ui/format';
import { ChartTooltipBox, axisStroke, axisTick, gridStroke } from './ChartTooltip';

export interface PayoffProps {
  /** Margin posted, in margin-asset units (display number). */
  margin: number;
  leverage: number;
  side: Side;
  symbol: string;
  /** Maintenance margin ratio 0..1, or null when the controller has not reported one. */
  maintenance: number | null;
  /** True when `maintenance` was derived (for example from the collateral factor) rather than read from the controller. */
  estimated?: boolean;
  height?: number;
}

const SCALE = 1_000_000n;

/** Price move (fraction, relative to entry) at which the position is liquidated, using the same
 * estimator as the positions list, on a normalized position with entry price 1. */
export function liquidationMove(side: Side, leverage: number, maintenance: number | null): number | null {
  if (maintenance === null || !Number.isFinite(maintenance) || maintenance <= 0 || maintenance >= 1 || leverage < 2) return null;
  const V = SCALE, L = BigInt(Math.round(leverage));
  const mm = BigInt(Math.round(maintenance * 1_000_000));
  // Long: collateral is L*V of base at price 1, debt is (L-1)*V of the margin asset.
  // Short: collateral is (L+1)*V of the margin asset, debt is L*V of base at price 1.
  const price = side === 'Long' ? liquidationPriceEstimate('Long', L * V, (L - 1n) * V, mm) : liquidationPriceEstimate('Short', (L + 1n) * V, L * V, mm);
  return price === null ? null : price - 1;
}

export function PayoffChart({ margin, leverage, side, symbol, maintenance, estimated = false, height = 240 }: PayoffProps) {
  const V = Number.isFinite(margin) && margin > 0 ? margin : 1;
  const sign = side === 'Long' ? 1 : -1;
  const liq = liquidationMove(side, leverage, maintenance);
  const wipe = sign / leverage * -1; // move at which PnL equals -margin
  // Range is a multiple of 20% so the axis lands on round ticks.
  const range = Math.ceil(Math.max(0.6, Math.abs(wipe) * 1.25) / 0.2) * 0.2;
  const ticks = useMemo(() => { const t: number[] = []; for (let v = -Math.round(range * 100); v <= Math.round(range * 100) + 0.01; v += 20) t.push(v); return t; }, [range]);
  const data = useMemo(() => {
    const points: Array<{ x: number; pnl: number; equity: number }> = [];
    for (let i = -40; i <= 40; i++) {
      const x = range * i / 40;
      const raw = sign * leverage * V * x;
      const pnl = Math.max(-V, raw);
      points.push({ x: Math.round(x * 10000) / 100, pnl, equity: V + pnl });
    }
    return points;
  }, [V, leverage, sign, range]);
  const max = Math.max(...data.map(d => d.pnl)), min = Math.min(...data.map(d => d.pnl));
  const offset = max === min ? 0 : max / (max - min);
  const liqPnl = liq === null ? null : Math.max(-V, sign * leverage * V * liq);
  const label = `Position payoff: profit and loss versus price move for a ${leverage}x ${side.toLowerCase()} with ${fmtNumber(V)} ${symbol} margin${liq !== null ? `, liquidation near ${fmtPct(liq * 100, 1)}` : ''}`;
  return <figure className="chart" style={{ margin: 0 }}>
    <div className="chart-head">
      <h4>Payoff at close, before fees</h4>
      <div className="chart-legend" aria-hidden><span><i style={{ background: 'var(--series-1)' }} />Profit</span><span><i style={{ background: 'var(--series-neg)' }} />Loss</span>{liq !== null && <span><i className="dash" style={{ color: 'var(--danger)' }} />Liquidation</span>}</div>
    </div>
    <div role="img" aria-label={label} style={{ width: '100%', height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ left: 0, right: 12, top: 18, bottom: 4 }}>
          <defs>
            <linearGradient id="pnl-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset={0} stopColor="var(--series-1)" stopOpacity={0.28} />
              <stop offset={offset} stopColor="var(--series-1)" stopOpacity={0.04} />
              <stop offset={offset} stopColor="var(--series-neg)" stopOpacity={0.04} />
              <stop offset={1} stopColor="var(--series-neg)" stopOpacity={0.28} />
            </linearGradient>
            <linearGradient id="pnl-stroke" x1="0" y1="0" x2="0" y2="1">
              <stop offset={offset} stopColor="var(--series-1)" />
              <stop offset={offset} stopColor="var(--series-neg)" />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={gridStroke} vertical={false} />
          <XAxis dataKey="x" type="number" domain={[-range * 100, range * 100]} ticks={ticks} tick={axisTick} tickFormatter={v => `${v > 0 ? '+' : ''}${Math.round(v)}%`} axisLine={{ stroke: axisStroke }} tickLine={false} tickMargin={6} />
          <YAxis width={56} tick={axisTick} tickFormatter={v => fmtNumber(Number(v), 1)} axisLine={false} tickLine={false} />
          <Tooltip cursor={{ stroke: 'var(--border-strong)' }} content={({ active, payload }) => active && payload?.length ? <ChartTooltipBox title={`Price ${payload[0].payload.x >= 0 ? '+' : ''}${fmtPct(payload[0].payload.x, 1)}`} rows={[{ label: 'PnL', value: `${payload[0].payload.pnl >= 0 ? '+' : ''}${fmtNumber(payload[0].payload.pnl)} ${symbol}`, color: payload[0].payload.pnl >= 0 ? 'var(--series-1)' : 'var(--series-neg)' }, { label: 'Margin left', value: `${fmtNumber(payload[0].payload.equity)} ${symbol}` }]} /> : null} />
          <ReferenceLine y={0} stroke="var(--text-3)" label={{ value: 'Break-even', position: 'insideBottomLeft', fill: 'var(--chart-text)', fontSize: 11 }} />
          <ReferenceLine x={0} stroke={axisStroke} label={{ value: 'Entry', position: 'insideTopLeft', fill: 'var(--chart-text)', fontSize: 11 }} />
          <ReferenceLine y={-V} stroke="var(--danger)" strokeOpacity={0.6} label={{ value: 'Whole margin lost', position: 'insideBottomRight', fill: 'var(--danger)', fontSize: 11 }} />
          {liq !== null && <ReferenceLine x={liq * 100} stroke="var(--danger)" strokeDasharray="4 4" label={{ value: `Liquidation ${liq > 0 ? '+' : ''}${fmtPct(liq * 100, 0)}`, position: 'insideTopRight', fill: 'var(--danger)', fontSize: 11 }} />}
          <Area dataKey="pnl" type="linear" stroke="url(#pnl-stroke)" strokeWidth={2} fill="url(#pnl-fill)" isAnimationActive={false} dot={false} activeDot={{ r: 4, fill: 'var(--text)', stroke: 'var(--surface)', strokeWidth: 2 }} baseValue={0} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
    <figcaption className="chart-note">
      A {leverage}x {side.toLowerCase()} moves {leverage}x the price change. A {fmtPct(Math.abs(wipe) * 100, 0)} move {side === 'Long' ? 'down' : 'up'} wipes out the margin.{liq !== null ? ` Liquidation is ${estimated ? 'estimated' : 'expected'} around a ${fmtPct(Math.abs(liq) * 100, 0)} move ${liq < 0 ? 'down' : 'up'}${liqPnl !== null ? ` (about ${fmtNumber(Math.abs(liqPnl))} ${symbol} lost before the liquidation penalty)` : ''}.` : ' The liquidation threshold is unavailable until the controller reports it.'} You can lose your whole margin. Opening and closing fees and swap slippage are not included.
    </figcaption>
  </figure>;
}
