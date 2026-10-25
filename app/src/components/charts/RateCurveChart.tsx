'use client';
import { useMemo } from 'react';
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { rateApr } from '@/lib/peridot/group-client';
import type { MarketConfig, RateModel } from '@/lib/peridot/types';
import { fmtPct } from '@/components/ui/format';
import { ChartTooltipBox, axisStroke, axisTick, gridStroke } from './ChartTooltip';

export interface RateCurveProps {
  rates: RateModel;
  /** 1e6 scale reserve factor; supply APR is net of it. */
  reserveFactor: bigint;
  /** Current utilization in percent. Omitted for a market that is not live yet. */
  utilization?: number;
  height?: number;
  /** Hide the headline row (used inside dense editors). */
  compact?: boolean;
}

/** Points for 0..100% utilization using the exact same rate math as the market view. */
export function rateCurvePoints(rates: RateModel, reserveFactor: bigint, step = 2) {
  const config = { rates, reserve_factor: reserveFactor } as MarketConfig;
  const points: Array<{ u: number; borrow: number; supply: number }> = [];
  for (let u = 0; u <= 100; u += step) {
    const r = rateApr(config, BigInt(100 - u), BigInt(u));
    points.push({ u, borrow: r.borrowApr, supply: r.supplyApr });
  }
  return points;
}

export function RateCurveChart({ rates, reserveFactor, utilization, height = 220, compact = false }: RateCurveProps) {
  const points = useMemo(() => rateCurvePoints(rates, reserveFactor), [rates, reserveFactor]);
  const maxBorrow = Math.max(0, ...points.map(p => p.borrow));
  const zero = maxBorrow === 0;
  const yMax = zero ? 1 : Math.ceil(maxBorrow * 1.1 * 10) / 10;
  const kink = Number(rates.kink) / 10_000;
  const current = utilization !== undefined ? rateApr({ rates, reserve_factor: reserveFactor } as MarketConfig, BigInt(Math.round((100 - Math.min(100, Math.max(0, utilization))) * 1000)), BigInt(Math.round(Math.min(100, Math.max(0, utilization)) * 1000))) : null;
  const label = `Interest rate model: borrow and supply APR from 0 to 100 percent utilization${utilization !== undefined ? `, currently ${fmtPct(utilization, 1)} utilized` : ''}`;
  return <figure className="chart" style={{ margin: 0 }}>
    {!compact && <div className="chart-head">
      <h4>Interest rate model</h4>
      <div className="chart-legend" aria-hidden><span><i style={{ background: 'var(--series-2)' }} />Borrow APR</span><span><i style={{ background: 'var(--series-1)' }} />Supply APR</span>{utilization !== undefined && <span><i className="dash" style={{ color: 'var(--text-2)' }} />Current utilization</span>}</div>
    </div>}
    <div role="img" aria-label={label} style={{ width: '100%', height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points} margin={{ left: 0, right: 12, top: 12, bottom: 4 }}>
          <CartesianGrid stroke={gridStroke} vertical={false} />
          <XAxis dataKey="u" type="number" domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tick={axisTick} tickFormatter={v => `${v}%`} axisLine={{ stroke: axisStroke }} tickLine={false} tickMargin={6} />
          <YAxis width={46} domain={[0, yMax]} tick={axisTick} tickFormatter={v => `${Number(v).toFixed(zero ? 0 : yMax < 5 ? 1 : 0)}%`} axisLine={false} tickLine={false} />
          <Tooltip cursor={{ stroke: 'var(--border-strong)' }} content={({ active, payload }) => active && payload?.length ? <ChartTooltipBox title={`${payload[0].payload.u}% utilization`} rows={[{ label: 'Borrow APR', value: fmtPct(payload[0].payload.borrow), color: 'var(--series-2)' }, { label: 'Supply APR', value: fmtPct(payload[0].payload.supply), color: 'var(--series-1)' }]} /> : null} />
          {kink > 0 && kink < 100 && <ReferenceLine x={kink} stroke={gridStroke} />}
          {utilization !== undefined && <ReferenceLine x={Math.min(100, Math.max(0, utilization))} stroke="var(--text-2)" strokeDasharray="4 4" label={{ value: 'Now', position: 'insideTopRight', fill: 'var(--chart-text)', fontSize: 11 }} />}
          <Line dataKey="borrow" type="linear" stroke="var(--series-2)" strokeWidth={2} dot={false} isAnimationActive={false} name="Borrow APR" />
          <Line dataKey="supply" type="linear" stroke="var(--series-1)" strokeWidth={2} dot={false} isAnimationActive={false} name="Supply APR" />
        </LineChart>
      </ResponsiveContainer>
    </div>
    <figcaption className="chart-note">
      {zero ? 'Zero borrow rate: borrowing costs 0% at every utilization, so suppliers earn only from the yield route.' : `Kink at ${kink}% utilization${current ? `. Now: ${fmtPct(current.borrowApr)} borrow, ${fmtPct(current.supplyApr)} supply` : ''}.`}
    </figcaption>
    <table className="sr-only"><caption>Rate curve values</caption><thead><tr><th>Utilization</th><th>Borrow APR</th><th>Supply APR</th></tr></thead><tbody>{[0, 25, 50, 75, 90, 100].map(u => { const p = points.find(x => x.u === u); return p ? <tr key={u}><td>{u}%</td><td>{fmtPct(p.borrow)}</td><td>{fmtPct(p.supply)}</td></tr> : null; })}</tbody></table>
  </figure>;
}
