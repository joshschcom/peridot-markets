'use client';
import type { PreviewModel } from '@/lib/vaults/kinds/types';

/** Generic preview renderer: one case per PreviewModel type. Add a case when a new kind needs a new picture. */
export function StrategyPreview({ model }: { model: PreviewModel }) {
  if (model.type === 'rows') {
    return <div className="preview" aria-label={model.title}>
      <h3 className="preview-title">{model.title}</h3>
      <dl className="preview-rows">{model.rows.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
    </div>;
  }
  return <LadderChart model={model} />;
}

function LadderChart({ model }: { model: Extract<PreviewModel, { type: 'ladder' }> }) {
  const { rungs } = model;
  const lo = Math.min(...rungs.map(r => r.lowerPct), 0), hi = Math.max(...rungs.map(r => r.upperPct), 0);
  const span = Math.max(hi - lo, 0.01), W = 100;
  const x = (pct: number) => ((pct - lo) / span) * W;
  const maxW = Math.max(...rungs.map(r => r.weightPct), 1);
  const rowH = 22, gap = 6, top = 6, height = top + rungs.length * (rowH + gap) + 18;
  const spot = x(0);
  return <figure className="preview ladder" aria-label={model.title} data-testid="ladder-preview">
    <h3 className="preview-title">{model.title}</h3>
    <svg viewBox={`0 0 ${W} ${height}`} preserveAspectRatio="none" role="img" aria-label={model.caption} style={{ width: '100%', height: Math.max(120, height * 1.6) }}>
      <line x1={spot} x2={spot} y1={0} y2={height - 14} stroke="var(--warn)" strokeWidth={0.5} strokeDasharray="1.5 1.5" vectorEffect="non-scaling-stroke" />
      {rungs.map((r, i) => {
        const y = top + i * (rowH + gap);
        const opacity = 0.35 + 0.65 * (r.weightPct / maxW);
        return <g key={r.index}>
          <rect x={x(r.lowerPct)} y={y} width={Math.max(x(r.upperPct) - x(r.lowerPct), 0.6)} height={rowH} rx={1.2} fill="var(--accent)" opacity={opacity} />
        </g>;
      })}
      <text x={spot} y={height - 3} fontSize={4} textAnchor="middle" fill="var(--text-2)">price</text>
    </svg>
    <ul className="ladder-legend" aria-label="Rung weights">{rungs.map(r => <li key={r.index}><span>Rung {r.index + 1}</span><span>{r.lowerPct.toFixed(1)}% to {r.upperPct >= 0 ? '+' : ''}{r.upperPct.toFixed(1)}%</span><strong>{r.weightPct.toFixed(r.weightPct % 1 ? 1 : 0)}%</strong></li>)}</ul>
    <figcaption className="subtle">{model.caption}</figcaption>
  </figure>;
}
