'use client';
import { useMemo } from 'react';
import { Area, AreaChart, CartesianGrid, ReferenceDot, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ChartTooltipBox, axisStroke, axisTick, gridStroke } from '@/components/charts/ChartTooltip';
import { fmtNumber } from '@/components/ui/format';
import { curveChartPoints, finePriceAtSold, quoteRaisedAt, soldAtTarget } from '@/lib/launchpad/math';
import type { CurveParams } from '@/lib/launchpad/types';

export interface CurveChartProps { params: CurveParams; sold: bigint; symbol: string; quoteSymbol?: string; height?: number }

/** Compact token counts for the axis: 120M, 1.2B. */
export function fmtTokens(n: number): string {
  if (!Number.isFinite(n)) return 'n/a';
  return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(n);
}
/** Prices are a few stroops per token: show three significant digits without exponent notation. */
export function fmtFloatPrice(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return '0';
  if (n >= 1) return fmtNumber(n, 4);
  const decimals = Math.min(14, -Math.floor(Math.log10(n)) + 2);
  return n.toFixed(decimals).replace(/0+$/, '');
}

/** Price versus tokens sold along the constant-product curve, from zero to the graduation point. */
export function CurveChart({ params, sold, symbol, quoteSymbol = 'XLM', height = 260 }: CurveChartProps) {
  const end = soldAtTarget(params);
  const current = sold > end ? end : sold;
  const currentPoint = useMemo(() => ({ sold: Number(current) / 1e7, price: Number(finePriceAtSold(params, current)) / 1e14, raised: Number(quoteRaisedAt(params, current)) / 1e7 }), [params, current]);
  const data = useMemo(() => {
    const points = curveChartPoints(params, 80).map(p => ({ ...p, filled: p.sold <= currentPoint.sold ? p.price : null as number | null }));
    // Include the exact current point so the filled area ends where the marker sits.
    if (currentPoint.sold > 0 && !points.some(p => p.sold === currentPoint.sold)) points.push({ ...currentPoint, filled: currentPoint.price });
    return points.sort((a, b) => a.sold - b.sold);
  }, [params, currentPoint]);
  const last = data[data.length - 1];
  const target = Number(params.graduation_target) / 1e7;
  const label = `Bonding curve: price in ${quoteSymbol} per ${symbol} against tokens sold, from ${fmtFloatPrice(data[0].price)} at launch to ${fmtFloatPrice(last.price)} at the graduation point of ${fmtTokens(last.sold)} tokens. Currently ${fmtTokens(currentPoint.sold)} sold at ${fmtFloatPrice(currentPoint.price)}.`;
  return <figure className="chart" style={{ margin: 0 }}>
    <div className="chart-head">
      <h4>Bonding curve</h4>
      <div className="chart-legend" aria-hidden><span><i style={{ background: 'var(--series-1)' }} />Price</span><span><i className="dot" style={{ background: 'var(--text)' }} />Now</span><span><i className="dash" style={{ color: 'var(--series-3)' }} />Graduation</span></div>
    </div>
    <div role="img" aria-label={label} style={{ width: '100%', height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ left: 0, right: 16, top: 18, bottom: 4 }}>
          <defs>
            <linearGradient id="curve-fill" x1="0" y1="0" x2="0" y2="1"><stop offset={0} stopColor="var(--series-1)" stopOpacity={0.35} /><stop offset={1} stopColor="var(--series-1)" stopOpacity={0.03} /></linearGradient>
          </defs>
          <CartesianGrid stroke={gridStroke} vertical={false} />
          <XAxis dataKey="sold" type="number" domain={[0, last.sold]} tick={axisTick} tickFormatter={v => fmtTokens(Number(v))} axisLine={{ stroke: axisStroke }} tickLine={false} tickMargin={6} tickCount={6} />
          <YAxis width={84} tick={axisTick} tickFormatter={v => fmtFloatPrice(Number(v))} axisLine={false} tickLine={false} domain={[0, 'auto']} />
          <Tooltip cursor={{ stroke: 'var(--border-strong)' }} content={({ active, payload }) => active && payload?.length ? <ChartTooltipBox title={`${fmtTokens(payload[0].payload.sold)} ${symbol} sold`} rows={[{ label: 'Price', value: `${fmtFloatPrice(payload[0].payload.price)} ${quoteSymbol}`, color: 'var(--series-1)' }, { label: 'Raised at this point', value: `${fmtNumber(payload[0].payload.raised, 2)} ${quoteSymbol}` }]} /> : null} />
          <Area dataKey="price" type="monotone" stroke="var(--series-1)" strokeWidth={2} fill="none" isAnimationActive={false} dot={false} activeDot={{ r: 4, fill: 'var(--text)', stroke: 'var(--surface)', strokeWidth: 2 }} name="Price" />
          <Area dataKey="filled" type="monotone" stroke="none" fill="url(#curve-fill)" isAnimationActive={false} dot={false} activeDot={false} connectNulls={false} name="Sold" />
          <ReferenceLine x={last.sold} stroke="var(--series-3)" strokeDasharray="4 4" label={{ value: `Graduation at ${fmtNumber(target, 0)} ${quoteSymbol}`, position: 'insideBottomRight', fill: 'var(--chart-text)', fontSize: 11 }} />
          {currentPoint.sold > 0 && <ReferenceLine x={currentPoint.sold} stroke="var(--text-2)" strokeDasharray="2 4" />}
          <ReferenceDot x={currentPoint.sold} y={currentPoint.price} r={5} fill="var(--text)" stroke="var(--surface)" strokeWidth={2} label={{ value: 'Now', position: currentPoint.sold > last.sold * 0.8 ? 'left' : 'right', fill: 'var(--chart-text)', fontSize: 11 }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
    <figcaption className="chart-note">
      Constant product on virtual reserves: each buy moves the price up along this curve and each sell moves it back down. Buys stop when {fmtNumber(target, 0)} {quoteSymbol} has been raised; the Aquarius pool then opens near the graduation price.
    </figcaption>
    {/* Wrapped in a clipped div: a table never shrinks below its content width, so a bare sr-only table would widen the page on phones. */}
    <div className="sr-only"><table><caption>Bonding curve values</caption><thead><tr><th>Tokens sold</th><th>Price</th><th>Raised</th></tr></thead><tbody>{[0, 20, 40, 60, 80].map(i => { const p = data[i]; return p ? <tr key={i}><td>{fmtTokens(p.sold)}</td><td>{fmtFloatPrice(p.price)} {quoteSymbol}</td><td>{fmtNumber(p.raised, 2)} {quoteSymbol}</td></tr> : null; })}<tr><td>{fmtTokens(last.sold)}</td><td>{fmtFloatPrice(last.price)} {quoteSymbol}</td><td>{fmtNumber(last.raised, 2)} {quoteSymbol}</td></tr></tbody></table></div>
  </figure>;
}
