/** Aquarius ladder vault: capital laddered across several adjacent concentrated-liquidity ranges of one Aquarius pool.
 * Constructor (contracts/aquarius-vault): owner, pool, underlying, keeper, rungs, width_spacings, step_spacings, shape,
 * recenter_spacings, cooldown_secs, fee_bps, deposit_cap, slippage_bps. The ladder maths here MUST match the contract
 * (`ladder()` in contracts/aquarius-vault/src/ladder.rs); both are covered by tests on the same vectors. */

import type { VaultCtx, VaultKind, Values, Validation, PreviewModel } from './types';
import { encodeField } from './schema';

export const AQ_BOUNDS = { rungsMax: 7, widthMax: 200, stepMax: 200, recenterMax: 100, cooldownMinSecs: 300, cooldownMaxSecs: 7 * 86_400, feeMaxBps: 2000, slippageMaxBps: 500 } as const;
export const SHAPES = [
  { value: '0', label: 'Flat', hint: 'Equal capital in every rung.' },
  { value: '1', label: 'Pyramid', hint: 'Most capital in the middle rungs, closest to the price.' },
  { value: '2', label: 'Wings', hint: 'Most capital in the outer rungs: earns less now, keeps working after a big move.' },
] as const;

/** Aquarius fee tiers map to tick spacings: 0.1% = 20, 0.3% = 60, 1% = 200. */
export function tickSpacingForFee(feeBps: number | null | undefined): number {
  if (feeBps === 10) return 20;
  if (feeBps === 100) return 200;
  return 60;
}

export interface LadderRung { index: number; lowerTick: number; upperTick: number; weightBps: number }
function floorDiv(a: number, b: number): number { return Math.floor(a / b); }

/** Ticks are relative to the spacing-aligned current tick (0). Same integer arithmetic as the contract. */
export function ladder(rungs: number, widthSp: number, stepSp: number, shape: number, spacing: number): LadderRung[] {
  const startUnits = floorDiv(-((rungs - 1) * stepSp + widthSp), 2);
  const raw: number[] = [];
  for (let i = 0; i < rungs; i++) {
    const d = Math.abs(2 * i - (rungs - 1));
    raw.push(shape === 1 ? rungs + 1 - d : shape === 2 ? 1 + d : 1);
  }
  const sum = raw.reduce((a, b) => a + b, 0);
  const w = raw.map(r => Math.floor((r * 10_000) / sum));
  let rem = 10_000 - w.reduce((a, b) => a + b, 0);
  // Remainder goes to the first rung with the largest raw weight (deterministic, identical on chain).
  const maxIdx = raw.indexOf(Math.max(...raw));
  w[maxIdx] += rem; rem = 0;
  return raw.map((_, i) => ({ index: i, lowerTick: (startUnits + i * stepSp) * spacing, upperTick: (startUnits + i * stepSp + widthSp) * spacing, weightBps: w[i] }));
}
export function tickToPct(tick: number): number { return (Math.pow(1.0001, tick) - 1) * 100; }

/** Largest recenter trigger (in spacings) that still keeps the price inside the ladder. */
export function maxRecenterSpacings(rungs: number, widthSp: number, stepSp: number): number {
  return Math.max(1, Math.floor(((rungs - 1) * stepSp + widthSp) / 2));
}

function num(v: Values, k: string): number { return Number(v[k]); }

function validate(v: Values, ctx: VaultCtx): Validation {
  const errors: Record<string, string> = {}; const warnings: string[] = [];
  const rungs = num(v, 'rungs'), w = num(v, 'width'), s = num(v, 'step'), r = num(v, 'recenter');
  if (v.keeper && v.owner === v.keeper) warnings.push('The keeper is the owner. Fine for a demo; use a separate key for unattended rebalancing.');
  if (r > maxRecenterSpacings(rungs, w, s)) errors.recenter = `Rebalance trigger must be at most ${maxRecenterSpacings(rungs, w, s)} spacings for this ladder, otherwise the price leaves the ladder before it rebalances.`;
  if (s > w * 2) warnings.push('Large gaps between rungs leave price levels with no liquidity.');
  const spacing = ctx.facts?.tickSpacing ?? tickSpacingForFee(ctx.facts?.feeBps);
  const half = ((rungs - 1) * s + w) * spacing / 2;
  if (half > 50_000) errors.width = 'The ladder would span more than about 50,000 ticks each side.';
  if (ctx.facts?.feeBps === 100) warnings.push('1% pools trade rarely: expect few fees.');
  return { errors, warnings };
}

function preview(v: Values, ctx: VaultCtx): PreviewModel | null {
  const rungs = num(v, 'rungs'), w = num(v, 'width'), s = num(v, 'step'), shape = num(v, 'shape');
  if (![rungs, w, s, shape].every(Number.isFinite) || rungs < 1 || w < 1 || s < 1) return null;
  const spacing = ctx.facts?.tickSpacing ?? tickSpacingForFee(ctx.facts?.feeBps);
  const rs = ladder(Math.min(rungs, AQ_BOUNDS.rungsMax), w, s, shape, spacing);
  const lo = rs[0].lowerTick, hi = rs[rs.length - 1].upperTick;
  return {
    type: 'ladder', title: 'Ladder preview',
    rungs: rs.map(r => ({ index: r.index, lowerPct: tickToPct(r.lowerTick), upperPct: tickToPct(r.upperTick), weightPct: r.weightBps / 100 })),
    caption: `${rs.length} rung${rs.length === 1 ? '' : 's'} from ${tickToPct(lo).toFixed(1)}% to +${tickToPct(hi).toFixed(1)}% around today's price (tick spacing ${spacing}).`,
  };
}

function summary(v: Values, ctx: VaultCtx): string[] {
  const spacing = ctx.facts?.tickSpacing ?? tickSpacingForFee(ctx.facts?.feeBps);
  const sym = ctx.facts?.symbols?.[v.underlying] ?? 'the underlying token';
  return [
    `Deposits and withdrawals are in ${sym}. Deposits stop at ${v.cap} ${sym}.`,
    `${v.rungs} range${num(v, 'rungs') === 1 ? '' : 's'}, each ${num(v, 'width') * spacing} ticks wide, ${num(v, 'step') * spacing} ticks apart, "${SHAPES[num(v, 'shape')]?.label ?? '?'}" weighting.`,
    `The keeper may rebalance when the price drifts ${num(v, 'recenter') * spacing} ticks from the ladder centre, at most once every ${v.cooldown} minutes.`,
    `You (the owner) take ${v.fee}% of earned fees as vault shares. The owner cannot withdraw depositors' funds.`,
  ];
}

export const aquariusKind: VaultKind = {
  id: 'aquarius',
  name: 'Aquarius ladder vault',
  tagline: 'Concentrated liquidity laddered across several price ranges',
  description: 'Deposit one token; the vault splits it into a ladder of adjacent Aquarius concentrated-liquidity ranges around the current price, earning swap fees and AQUA. A keeper recentres the ladder when the price drifts. Depositors can always leave, in kind if the pool is stressed.',
  status: 'live',
  risks: [
    'Impermanent loss: a ladder holds more of the falling token. A volatile pair can lose value against simply holding.',
    'Rebalancing swaps pay pool fees and can lose to price moves between ledgers; the vault caps slippage.',
    'Vault value is marked at the pool price, so a manipulated pool price affects share price. Deposit caps limit exposure.',
  ],
  fields: [
    { key: 'owner', label: 'Owner', help: 'Controls settings and pausing. Cannot withdraw other people\'s funds.', group: 'Pool', input: 'address', encoding: 'address', default: ctx => ctx.owner, suggest: 'owner', locked: 'owner' },
    { key: 'pool', label: 'Aquarius pool', help: 'A concentrated-liquidity pool. Pick one of the listed pools or paste a pool contract address; the vault checks it on creation.', group: 'Pool', input: 'address', encoding: 'address', default: '', suggest: 'pools' },
    { key: 'underlying', label: 'Deposit token', help: 'The token depositors put in and take out. Must be one of the pool\'s two tokens.', group: 'Pool', input: 'address', encoding: 'address', default: '', suggest: 'pool-tokens' },
    { key: 'keeper', label: 'Keeper', help: 'The one address (besides you) allowed to rebalance. A keeper cannot move funds out of the vault.', group: 'Operations', input: 'address', encoding: 'address', default: ctx => ctx.owner, suggest: 'owner' },
    { key: 'rungs', label: 'Rungs', help: 'How many adjacent price ranges (a "ladder" of positions). More rungs spread risk but cost more gas per rebalance.', group: 'Ladder', input: 'number', encoding: 'u32', unit: 'ranges', min: 1, max: AQ_BOUNDS.rungsMax, step: 1, default: '5' },
    { key: 'width', label: 'Rung width', help: 'Width of each range in tick spacings of the pool (one spacing is 0.2% to 2% of price depending on the pool fee). Narrow earns more per dollar while in range.', group: 'Ladder', input: 'number', encoding: 'u32', unit: 'spacings', min: 1, max: AQ_BOUNDS.widthMax, step: 1, default: '2' },
    { key: 'step', label: 'Rung spacing', help: 'Distance between rung starts, in tick spacings. Equal to the width makes touching ranges; smaller overlaps them; larger leaves gaps.', group: 'Ladder', input: 'number', encoding: 'u32', unit: 'spacings', min: 1, max: AQ_BOUNDS.stepMax, step: 1, default: '2' },
    { key: 'shape', label: 'Weighting', help: 'How capital is split across the rungs.', group: 'Ladder', input: 'select', encoding: 'u32', options: SHAPES.map(s => ({ ...s })), default: '1' },
    { key: 'recenter', label: 'Rebalance trigger', help: 'The keeper may rebuild the ladder once the price is this many spacings from the ladder centre.', group: 'Operations', input: 'number', encoding: 'u32', unit: 'spacings', min: 1, max: AQ_BOUNDS.recenterMax, step: 1, default: '3' },
    { key: 'cooldown', label: 'Rebalance cooldown', help: 'Minimum time between rebalances. Short cooldowns follow the price closely and pay more swap fees.', group: 'Operations', input: 'number', encoding: 'u32', unit: 'minutes', min: AQ_BOUNDS.cooldownMinSecs / 60, max: AQ_BOUNDS.cooldownMaxSecs / 60, step: 1, scale: 60, default: '60' },
    { key: 'fee', label: 'Performance fee', help: 'Share of earned fees paid to the owner as vault shares. Hard maximum 20%.', group: 'Safety', input: 'number', encoding: 'u32', unit: '%', min: 0, max: AQ_BOUNDS.feeMaxBps / 100, step: 0.1, scale: 100, default: '10' },
    { key: 'cap', label: 'Deposit cap', help: 'Total deposits the vault accepts, in the deposit token. Keep it small while the vault is new.', group: 'Safety', input: 'amount', encoding: 'i128', unit: 'tokens', min: 1, step: 1, default: '1000' },
    { key: 'slippage', label: 'Max swap slippage', help: 'Rebalance and exit swaps revert if they would lose more than this versus the pool price. Hard maximum 5%.', group: 'Safety', input: 'number', encoding: 'u32', unit: '%', min: 0.1, max: AQ_BOUNDS.slippageMaxBps / 100, step: 0.1, scale: 100, default: '1' },
  ],
  validate,
  preview,
  summary,
  // Constructor order differs from display order (owner, pool, underlying, keeper, rungs, width, step, shape, recenter, cooldown, fee, cap, slippage).
  encode(v, ctx) {
    const order = ['owner', 'pool', 'underlying', 'keeper', 'rungs', 'width', 'step', 'shape', 'recenter', 'cooldown', 'fee', 'cap', 'slippage'];
    return order.map(k => encodeField(aquariusKind.fields.find(f => f.key === k)!, v[k], ctx));
  },
};
