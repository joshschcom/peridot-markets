/** "Create a vault for me" on an Aquarius pair.
 *
 * What the contracts support TODAY (checked against contracts/market-factory/src/lib.rs, add_market):
 * the factory accepts YieldRoute::None | Defindex | Blend only. core/aquarius-lp-vault exists and is
 * deployed by hand in the mainnet pilot, but the factory cannot deploy it, bind it or take an Aquarius
 * route. So this flow is a DEMO: it builds and validates the exact plan, walks it with progress toasts,
 * and stores the result in this browser. No transaction is sent. The missing entrypoints are specified
 * in docs/ui/VAULTS-UI.md. */
import { isStablePair, isVaultEligible, pairLabel, underlyingIndex, vaultIneligibleReason, type AquariusPool, type Net } from './aquarius-pools';

/** Flip to true only when the factory ships YieldRoute::Aquarius and attach_yield can deploy the vault. */
export const FACTORY_SUPPORTS_AQUARIUS_ROUTE = false;
export const MIN_IDLE_BUFFER_PCT = 30;
export const DEFAULT_RESERVE_CUT_BPS = 3000;
export const DEFAULT_RESERVE_CAP_BPS = 1000;
export const DEFAULT_HALF_WIDTH_TICKS = 40;

export type RangeMode = { kind: 'FullRange' } | { kind: 'Centered'; halfWidthTicks: number };
export interface VaultPlanInput {
  pool: AquariusPool;
  net: Net;
  /** Supply cap in whole underlying tokens (USDC). */
  supplyCap: string;
  idleBufferPct: number;
  range?: RangeMode;
}
export interface PlanStep {
  id: string;
  /** Contract method label shown in toasts and the plan, snake case like real transactions. */
  method: string;
  title: string;
  detail: string;
  /** True when the contract entrypoint exists today; false means it is part of the missing spec. */
  existsToday: boolean;
}
export interface VaultPlan {
  ok: boolean;
  errors: string[];
  pair: string;
  underlyingIndex: 0 | 1;
  underlyingSymbol: string;
  range: RangeMode;
  supplyCap: string;
  idleBufferPct: number;
  reserveCutBps: number;
  reserveCapBps: number;
  steps: PlanStep[];
}

export function defaultRange(pool: Pick<AquariusPool, 'tokens'>): RangeMode {
  return isStablePair(pool) ? { kind: 'FullRange' } : { kind: 'Centered', halfWidthTicks: DEFAULT_HALF_WIDTH_TICKS };
}
export function describeRange(r: RangeMode): string {
  return r.kind === 'FullRange' ? 'Full range (stable pair)' : `Centered, ${r.halfWidthTicks} ticks each side, keeper rebalanced`;
}

export function buildVaultPlan(input: VaultPlanInput): VaultPlan {
  const { pool, net } = input;
  const errors: string[] = [];
  const reason = vaultIneligibleReason(pool);
  if (reason) errors.push(reason);
  const idx = underlyingIndex(net, pool);
  if (idx === null) errors.push('Pick a pair that contains USDC. The vault market uses the dollar side as its underlying asset.');
  const cap = Number(input.supplyCap);
  if (!input.supplyCap.trim() || !Number.isFinite(cap) || cap <= 0) errors.push('Enter a supply cap above zero. The factory requires a cap on every market.');
  if (!Number.isFinite(input.idleBufferPct) || input.idleBufferPct < MIN_IDLE_BUFFER_PCT || input.idleBufferPct > 100) errors.push(`Keep at least ${MIN_IDLE_BUFFER_PCT}% liquid so withdrawals never wait on the pool.`);
  const range = input.range ?? defaultRange(pool);
  if (range.kind === 'Centered' && (!Number.isInteger(range.halfWidthTicks) || range.halfWidthTicks < 1 || range.halfWidthTicks > 10_000)) errors.push('Range half width must be a whole number of ticks between 1 and 10,000.');
  const underlying = idx === null ? pool.tokens[0] : pool.tokens[idx];
  const label = pairLabel(pool);
  const steps: PlanStep[] = [
    { id: 'deploy', method: 'deploy_aquarius_vault', title: 'Deploy your LP vault', detail: `aquarius-lp-vault.initialize(admin, ${label} pool, underlying_index ${idx ?? '?'}, group price router)`, existsToday: false },
    { id: 'range', method: 'set_range_policy', title: 'Set the price range', detail: describeRange(range), existsToday: true },
    { id: 'rewards', method: 'set_reward_route', title: 'Route AQUA rewards to USDC', detail: 'harvest sells AQUA through the deepest AQUA/USDC pool', existsToday: true },
    { id: 'market', method: 'add_market', title: `Create the ${underlying.symbol} market`, detail: `YieldRoute::Aquarius { pool, underlying_index, range, reserve_cut_bps ${DEFAULT_RESERVE_CUT_BPS}, reserve_cap_bps ${DEFAULT_RESERVE_CAP_BPS} }`, existsToday: false },
    { id: 'activate', method: 'activate_market', title: 'Activate the market', detail: 'Makes the market visible in the group.', existsToday: true },
    { id: 'attach', method: 'attach_yield', title: 'Bind the vault to the market', detail: 'set_boosted_vault + bind_boosted_vault, plus the loss reserve wrapper.', existsToday: false },
  ];
  return {
    ok: errors.length === 0, errors, pair: label, underlyingIndex: idx ?? 0, underlyingSymbol: underlying.symbol, range,
    supplyCap: input.supplyCap, idleBufferPct: input.idleBufferPct, reserveCutBps: DEFAULT_RESERVE_CUT_BPS, reserveCapBps: DEFAULT_RESERVE_CAP_BPS, steps,
  };
}
export function missingSteps(plan: VaultPlan): PlanStep[] { return plan.steps.filter(s => !s.existsToday); }
/** True when every step could be sent as a real transaction. */
export function canRunOnChain(plan: VaultPlan): boolean { return plan.ok && FACTORY_SUPPORTS_AQUARIUS_ROUTE && missingSteps(plan).length === 0; }

// ---------- demo store ----------
export interface DemoVault {
  id: string;
  createdAt: number;
  net: Net;
  pool: string;
  pair: string;
  underlyingSymbol: string;
  range: string;
  supplyCap: string;
  idleBufferPct: number;
  reserveCutBps: number;
  txs: Array<{ method: string; hash: string }>;
}
export interface KeyValueStore { getItem(k: string): string | null; setItem(k: string, v: string): void }
const key = (net: Net) => `peridot:vault-demo:v1:${net}`;
export function loadDemoVaults(store: KeyValueStore | null, net: Net): DemoVault[] {
  if (!store) return [];
  try {
    const parsed = JSON.parse(store.getItem(key(net)) || '[]');
    return Array.isArray(parsed) ? parsed.filter(v => v && typeof v.id === 'string' && typeof v.pool === 'string') : [];
  } catch { return []; }
}
export function saveDemoVault(store: KeyValueStore | null, vault: DemoVault): DemoVault[] {
  const list = [vault, ...loadDemoVaults(store, vault.net).filter(v => v.id !== vault.id)].slice(0, 20);
  try { store?.setItem(key(vault.net), JSON.stringify(list)); } catch { /* In-memory only when storage is blocked. */ }
  return list;
}
export function demoVaultFromPlan(plan: VaultPlan, pool: AquariusPool, net: Net, txs: DemoVault['txs'], now = Date.now()): DemoVault {
  return { id: `demo-vault-${now.toString(36)}`, createdAt: now, net, pool: pool.address, pair: plan.pair, underlyingSymbol: plan.underlyingSymbol, range: describeRange(plan.range), supplyCap: plan.supplyCap, idleBufferPct: plan.idleBufferPct, reserveCutBps: plan.reserveCutBps, txs };
}

export interface StepEvent { id: string; status: 'simulating' | 'signing' | 'submitting' | 'confirming' | 'success' | 'error'; method: string; hash?: string; message?: string }
/** Walk the plan with the same status sequence as a real transaction so toasts look and behave the same. Nothing is sent. */
export async function runDemoPlan(plan: VaultPlan, emit: (e: StepEvent) => void, opts: { delayMs?: number; newId?: () => string } = {}): Promise<DemoVault['txs']> {
  if (!plan.ok) throw new Error(plan.errors[0] ?? 'The vault settings are not valid.');
  const delay = opts.delayMs ?? 450, newId = opts.newId ?? (() => `demo-${Date.now().toString(36)}-${Math.random().toString(16).slice(2, 6)}`);
  const txs: DemoVault['txs'] = [];
  for (const step of plan.steps) {
    const id = newId(), method = `demo_${step.method}`;
    for (const status of ['simulating', 'signing', 'submitting', 'confirming'] as const) {
      emit({ id, status, method });
      if (delay) await new Promise(r => setTimeout(r, delay));
    }
    const hash = `demo-${step.id}-${Math.random().toString(16).slice(2, 10)}`;
    txs.push({ method: step.method, hash });
    emit({ id, status: 'success', method, message: 'Demo step recorded. No onchain transaction.' });
  }
  return txs;
}
