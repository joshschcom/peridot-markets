'use client';
import type { ReactNode } from 'react';

/** Shared tooltip body for recharts. Values are passed in already formatted. */
export function ChartTooltipBox({ title, rows }: { title: ReactNode; rows: ReadonlyArray<{ label: ReactNode; value: ReactNode; color?: string }> }) {
  return <div className="chart-tooltip">
    <strong>{title}</strong>
    {rows.map((r, i) => <span key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>{r.color && <i aria-hidden style={{ width: 8, height: 8, borderRadius: 4, background: r.color, display: 'inline-block' }} />}{r.label}</span>
      <span className="num">{r.value}</span>
    </span>)}
  </div>;
}

export const axisTick = { fill: 'var(--chart-text)', fontSize: 11 } as const;
export const gridStroke = 'var(--chart-grid)';
export const axisStroke = 'var(--chart-axis)';
