'use client';

/** Health factor interpretation mirrors the dashboard: null is pending, above 1e15 means no debt, otherwise 1e6 scaled. */
export function healthLabel(health: bigint | null): string {
  if (health === null) return 'Pending';
  if (Number(health) > 1e15) return 'No debt';
  return (Number(health) / 1e6).toFixed(2);
}

export function HealthGauge({ health }: { health: bigint | null }) {
  const label = healthLabel(health);
  const numeric = health !== null && Number(health) <= 1e15 ? Number(health) / 1e6 : null;
  // 0.5 maps to 0%, 1.0 (liquidation) to 20%, 3.0 and above to 100%.
  const pos = numeric === null ? 100 : Math.min(100, Math.max(0, (numeric - 0.5) / 2.5 * 100));
  const tone = numeric === null ? 'var(--success)' : numeric < 1 ? 'var(--danger)' : numeric < 1.5 ? 'var(--warn)' : 'var(--success)';
  return <div className="gauge" role="img" aria-label={`Health factor ${label}. Liquidation below 1.0.`}>
    <div className="meter-row"><span>Health factor</span><span className="meter-value" style={{ color: tone }}>{label}</span></div>
    <div className="gauge-bar" style={{ background: 'linear-gradient(90deg, var(--danger) 0 20%, var(--warn) 20% 40%, var(--success) 40%)' }}>
      <span className="gauge-marker" style={{ left: `${pos}%` }} />
    </div>
    <div className="gauge-scale" aria-hidden><span>0.5</span><span style={{ marginLeft: 'calc(20% - 2.2em)' }}>1.0 liquidation</span><span style={{ marginLeft: 'auto' }}>3.0+</span></div>
  </div>;
}
