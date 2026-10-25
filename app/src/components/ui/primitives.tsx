'use client';
import { useId, type ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, Info, OctagonAlert, type LucideIcon } from 'lucide-react';

export type Tone = 'neutral' | 'accent' | 'info' | 'warn' | 'danger' | 'success' | 'solid';

export function Badge({ tone = 'neutral', children, className = '', icon: Icon, title }: { tone?: Tone; children: ReactNode; className?: string; icon?: LucideIcon; title?: string }) {
  return <span className={`badge ${tone === 'neutral' ? '' : tone} ${className}`.trim()} title={title}>{Icon && <Icon aria-hidden />}{children}</span>;
}

export function Stat({ label, value, unit, hint, large = false, tip }: { label: ReactNode; value: ReactNode; unit?: string; hint?: ReactNode; large?: boolean; tip?: ReactNode }) {
  return <div className="stat">
    <span className="stat-label">{label}{tip && <Tooltip text={tip} />}</span>
    <span className={`stat-value${large ? ' large' : ''}`}>{value}{unit && <small>{unit}</small>}</span>
    {hint && <span className="stat-hint">{hint}</span>}
  </div>;
}

/** Progress meter. `pct` is 0..100. Tone escalates automatically unless given. */
export function Meter({ label, value, pct, tone, thin = false, hint, ariaLabel }: { label?: ReactNode; value?: ReactNode; pct: number; tone?: 'accent' | 'warn' | 'danger' | 'info'; thin?: boolean; hint?: ReactNode; ariaLabel?: string }) {
  const clamped = Number.isFinite(pct) ? Math.min(100, Math.max(0, pct)) : 0;
  const auto = tone ?? (clamped >= 90 ? 'danger' : clamped >= 75 ? 'warn' : 'accent');
  return <div className={`meter${thin ? ' thin' : ''}`}>
    {(label || value) && <div className="meter-row"><span>{label}</span><span className="meter-value">{value}</span></div>}
    <div className="meter-track" role="progressbar" aria-valuenow={Math.round(clamped)} aria-valuemin={0} aria-valuemax={100} aria-label={ariaLabel || (typeof label === 'string' ? label : undefined)}>
      <span className={`meter-fill ${auto === 'accent' ? '' : auto}`} style={{ width: `${clamped}%` }} />
    </div>
    {hint && <div className="meter-row"><span>{hint}</span></div>}
  </div>;
}

/** Hover and focus tooltip with an accessible description. */
export function Tooltip({ text, label = 'More information', align }: { text: ReactNode; label?: string; align?: 'left' | 'right' }) {
  const id = useId();
  return <span className={`tip${align ? ` ${align}` : ''}`}>
    <button type="button" className="tip-trigger" aria-label={label} aria-describedby={id}><Info size={11} aria-hidden /></button>
    <span role="tooltip" id={id} className="tip-bubble">{text}</span>
  </span>;
}

export function Skeleton({ width, height = 14, className = '', style }: { width?: number | string; height?: number | string; className?: string; style?: React.CSSProperties }) {
  return <span className={`skeleton ${className}`.trim()} aria-hidden style={{ display: 'block', width: width ?? '100%', height, ...style }} />;
}

const noticeIcons: Record<Exclude<Tone, 'accent' | 'solid'>, LucideIcon | null> = { neutral: null, info: Info, warn: AlertTriangle, danger: OctagonAlert, success: CheckCircle2 };
export function Notice({ tone = 'neutral', children, role, title, className = '', live }: { tone?: Exclude<Tone, 'accent' | 'solid'>; children: ReactNode; role?: 'status' | 'alert' | 'note'; title?: ReactNode; className?: string; live?: 'polite' | 'assertive' }) {
  const Icon = noticeIcons[tone];
  return <div className={`status ${tone === 'neutral' ? '' : tone} ${className}`.trim()} role={role} aria-live={live}>
    {Icon && <Icon size={16} aria-hidden />}
    <div style={{ minWidth: 0, flex: 1 }}>{title && <strong style={{ display: 'block', marginBottom: 2 }}>{title}</strong>}{children}</div>
  </div>;
}

export function EmptyState({ icon: Icon, title, children, action, role }: { icon?: LucideIcon; title: ReactNode; children?: ReactNode; action?: ReactNode; role?: 'status' | 'alert' }) {
  return <div className="panel empty-state" role={role}>
    {Icon && <Icon size={28} aria-hidden />}
    <h2>{title}</h2>
    {children}
    {action}
  </div>;
}

/** Segmented control rendered as plain buttons (no ARIA tab roles) so button-name queries keep working. */
export function Tabs<T extends string>({ items, value, onChange, block = false, ariaLabel, disabled }: { items: ReadonlyArray<{ value: T; label: ReactNode }>; value: T; onChange: (value: T) => void; block?: boolean; ariaLabel?: string; disabled?: boolean }) {
  return <div className={`tabs${block ? ' block' : ''}`} role="group" aria-label={ariaLabel}>
    {items.map(item => <button key={item.value} type="button" className={item.value === value ? 'selected' : ''} aria-pressed={item.value === value} disabled={disabled} onClick={() => onChange(item.value)}>{item.label}</button>)}
  </div>;
}

export function Stepper({ steps, current, onSelect, disabled, ariaLabel }: { steps: ReadonlyArray<string>; current: number; onSelect: (index: number) => void; disabled?: boolean; ariaLabel: string }) {
  return <ol className="stepper" aria-label={ariaLabel}>
    {steps.map((name, i) => <li key={name}>
      <button type="button" disabled={disabled} aria-current={i === current ? 'step' : undefined} className={i === current ? 'selected' : i < current ? 'visited' : ''} onClick={() => onSelect(i)}>
        <span aria-hidden>{i < current ? '✓' : i + 1}</span>{name}
      </button>
    </li>)}
  </ol>;
}

/** Countdown ring. Renders the "Applies in Ns" text exactly once. */
export function Countdown({ secondsLeft, total = 60, readyText = 'Ready to apply' }: { secondsLeft: number; total?: number; readyText?: string }) {
  const pct = total > 0 ? Math.max(0, Math.min(100, 100 - secondsLeft / total * 100)) : 100;
  return <span className="countdown">
    <span className="countdown-ring" style={{ ['--p' as string]: `${pct}%` }} aria-hidden />
    <span>{secondsLeft > 0 ? `Applies in ${secondsLeft}s` : readyText}</span>
  </span>;
}

export function KeyValue({ rows }: { rows: ReadonlyArray<[ReactNode, ReactNode]> }) {
  return <div className="kv">{rows.map(([k, v], i) => <div key={i}><span>{k}</span><span>{v}</span></div>)}</div>;
}
