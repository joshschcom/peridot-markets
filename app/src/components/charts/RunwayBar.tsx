'use client';
import { Meter } from '@/components/ui/primitives';
import { fmtAmount, fmtNumber, runwayDays } from '@/components/ui/format';

/** Reward runway: funded balance divided by total emissions. The bar fills at 30 days or more. */
export function RunwayBar({ balance, perSecond, decimals, symbol, horizonDays = 30 }: { balance: bigint; perSecond: bigint; decimals: number; symbol: string; horizonDays?: number }) {
  const perDay = perSecond * 86_400n;
  const days = runwayDays(balance, perSecond);
  const pct = days === null ? 0 : Math.min(100, days / horizonDays * 100);
  const tone = days === null ? 'info' : days < 2 ? 'danger' : days < 7 ? 'warn' : 'accent';
  return <div className="stack-sm">
    <Meter label="Reward runway" value={days === null ? 'No emissions set' : days >= 365 ? 'Over a year' : `${fmtNumber(days, days < 10 ? 1 : 0)} days`} pct={pct} tone={tone} ariaLabel="Reward runway in days" hint={<>{fmtAmount(perDay, decimals)} {symbol} per day across all markets. {fmtAmount(balance, decimals)} {symbol} funded. Bar is full at {horizonDays} days.</>} />
  </div>;
}
