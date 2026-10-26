/** Browser-local simulation of the launchpad for NEXT_PUBLIC_USE_MOCKS=true. Same storage pattern as
 * lib/peridot/mock.ts (own key), same curve math as the contract, no signatures. Demo ids use the `mock-` prefix
 * so address components render them as plain text without explorer links. */
import { network } from '@/lib/peridot/network';
import { MOCK_OWNER } from '@/lib/peridot/mock';
import { creatorCap, feeOf, quoteBuy, quoteSell, reserves, soldAtTarget } from './math';
import { GradStep, Phase, Preset, type PlainTokenInfo, type CurveActivity, type CurveInfo, type CurveParams, type FactoryConfig, type Graduation, type HistoryEvent, type LaunchInfo, type Trade } from './types';

export const MOCK_XLM_TOKEN = 'mock-xlm';
export const MOCK_AQUA = 'mock-aqua';
export const MOCK_AQUA_ISSUER = 'GAHPYWLK6YRN7CVYZOO4H3VDRZ7PVF5UJGLZCSPAEIKJE2XSWF5LAGER';
const DEMO_CREATOR_MOON = 'GDEMOCREATORMOONXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXMOON';
const DEMO_CREATOR_FOX = 'GDEMOCREATORFOXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXFOX';
const X7 = 10_000_000n;
const KEY = `peridot:launchpad:mock:v1:${network.name}`;

export interface MockLaunch {
  info: LaunchInfo;
  params: CurveParams;
  metadataUri: string;
  realQuote: bigint;
  sold: bigint;
  creatorBought: bigint;
  feesTreasury: bigint;
  feesCreator: bigint;
  phase: Phase;
  graduation: Graduation | null;
  holdings: Record<string, bigint>;
  trades: Trade[];
  history: HistoryEvent[];
}
export interface MockLaunchpadState {
  version: 1;
  launches: MockLaunch[];
  /** Simple tokens (absent in states saved before the simple-token path existed). */
  plainTokens?: PlainTokenInfo[];
  plainHoldings?: Record<string, Record<string, bigint>>;
  xlm: Record<string, bigint>;
  aqua: Record<string, bigint>;
  groupOwners: Record<string, string>;
  nextGroupId: number;
  ledger: number;
}

/** The factory's `default_preset`: virtual quote = target * 30 / 85, 1.073B virtual tokens, 800M curve, 200M LP. */
export function mockPreset(preset: Preset): CurveParams {
  const target = preset === Preset.Fast ? 500n * X7 : preset === Preset.Standard ? 85_000n * X7 : 250_000n * X7;
  return { virtual_quote: target * 30n / 85n, virtual_token: 1_073_000_000n * X7, curve_supply: 800_000_000n * X7, lp_supply: 200_000_000n * X7, graduation_target: target, trade_fee_bps: 100, creator_fee_share_bps: 0, creator_cap_bps: 500 };
}
const hash = () => `mock-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
const now = () => new Date().toISOString();

function launchAt(id: number, name: string, symbol: string, creator: string, preset: Preset, realQuote: bigint, createdAgoSec: number): MockLaunch {
  const params = mockPreset(preset);
  const k = params.virtual_quote * params.virtual_token;
  // Closed form: tokens out once `realQuote` net quote sits in the curve.
  const sold = realQuote > 0n ? params.virtual_token - (k / (params.virtual_quote + realQuote) + ((k % (params.virtual_quote + realQuote)) === 0n ? 0n : 1n)) : 0n;
  return {
    info: { id, token: `mock-token-${symbol.toLowerCase()}`, curve: `mock-curve-${symbol.toLowerCase()}`, creator, quote_token: MOCK_XLM_TOKEN, preset, name, symbol, created_at: BigInt(Math.floor(Date.now() / 1000) - createdAgoSec) },
    params, metadataUri: '', realQuote, sold, creatorBought: 0n, feesTreasury: feeOf(realQuote, 100), feesCreator: 0n,
    phase: realQuote >= params.graduation_target ? Phase.Graduatable : Phase.Trading, graduation: null, holdings: {}, trades: [], history: [],
  };
}
function initial(): MockLaunchpadState {
  const pgrad = launchAt(0, 'Peridot Graduate', 'PGRAD', MOCK_OWNER, Preset.Fast, 500n * X7, 3 * 3600);
  pgrad.sold = soldAtTarget(pgrad.params);
  pgrad.phase = Phase.Graduated;
  pgrad.holdings[MOCK_OWNER] = 120_000_000n * X7;
  pgrad.graduation = { step: GradStep.Graduated, pool: 'mock-pool-pgrad', pool_index: 'mock-pool-index', share_token: 'mock-share-pgrad', quote_in_pool: 500n * X7, token_in_pool: pgrad.params.lp_supply, lp_shares_burned: 3_162_277_660_168n, unsold_burned: pgrad.params.curve_supply - pgrad.sold, group_id: 1, quote_market: 'mock-market-1-XLM', token_market: 'mock-market-1-PGRAD', claimed: false };
  const t0 = Date.now() - 3 * 3600 * 1000;
  const at = (offset: number) => new Date(t0 + offset * 1000).toISOString();
  // The same sequence as the recorded testnet run: buy 200, sell 10%, buy 300, buy 100 clamped at the target.
  const demoTrades: Trade[] = [
    { kind: 'buy', user: MOCK_OWNER, quote: 200n * X7, tokens: 5_673_449_576_406_545n, fee: 2n * X7, clamped: false, hash: 'mock-demo-buy-1', ledger: 1_000_010, at: at(60) },
    { kind: 'sell', user: MOCK_OWNER, quote: 195_000_000n, tokens: 567_344_957_640_654n, fee: 1_970_000n, clamped: false, hash: 'mock-demo-sell-1', ledger: 1_000_020, at: at(120) },
    { kind: 'buy', user: DEMO_CREATOR_FOX, quote: 300n * X7, tokens: 1_800_000_000_000_000n, fee: 3n * X7, clamped: false, hash: 'mock-demo-buy-2', ledger: 1_000_030, at: at(180) },
    { kind: 'buy', user: DEMO_CREATOR_MOON, quote: 303_030_303n, tokens: 120_000_000_000_000n, fee: 3_030_304n, clamped: true, hash: 'mock-demo-buy-3', ledger: 1_000_040, at: at(240) },
  ];
  pgrad.trades = demoTrades.reverse();
  pgrad.history = [
    { name: 'graduated', hash: 'mock-demo-grad-6', ledger: 1_000_090, at: at(600), data: { group_id: 1 } },
    { name: 'pool_created', hash: 'mock-demo-grad-1', ledger: 1_000_050, at: at(300), data: { pool: 'mock-pool-pgrad' } },
  ];
  const moon = launchAt(1, 'Meridian Moon', 'MOON', DEMO_CREATOR_MOON, Preset.Standard, 34_000n * X7, 26 * 3600);
  moon.trades = [{ kind: 'buy', user: DEMO_CREATOR_MOON, quote: 34_343n * X7, tokens: moon.sold, fee: 343n * X7, clamped: false, hash: 'mock-demo-moon-1', ledger: 999_000, at: new Date(Date.now() - 26 * 3600 * 1000).toISOString() }];
  const fox = launchAt(2, 'Testnet Fox', 'FOX', DEMO_CREATOR_FOX, Preset.Fast, 500n * X7, 40 * 60);
  fox.sold = soldAtTarget(fox.params);
  fox.holdings[MOCK_OWNER] = 2_000_000_000n * X7 / 10n;
  return { version: 1, launches: [pgrad, moon, fox], xlm: { [MOCK_OWNER]: 100_000n * X7 }, aqua: { [MOCK_OWNER]: 5n * X7 }, groupOwners: { '1': 'mock-curve-pgrad' }, nextGroupId: 2, ledger: 1_000_100 };
}

const replacer = (_key: string, value: unknown) => typeof value === 'bigint' ? { __peridotBigint: value.toString() } : value;
const reviver = (_key: string, value: unknown) => value && typeof value === 'object' && '__peridotBigint' in value ? BigInt((value as { __peridotBigint: string }).__peridotBigint) : value;
let memory: MockLaunchpadState | undefined;
export function readLaunchpadMock(): MockLaunchpadState {
  if (!network.useMocks) throw new Error('Launchpad demo data is disabled.');
  if (typeof window === 'undefined') return memory ??= initial();
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) { const parsed = JSON.parse(raw, reviver) as MockLaunchpadState; if (parsed.version === 1) return parsed; }
  } catch { /* The demo can run in memory when storage is blocked. */ }
  return memory ??= initial();
}
export function mutateLaunchpadMock<T>(fn: (state: MockLaunchpadState) => T): T {
  const state = readLaunchpadMock();
  const result = fn(state);
  memory = state;
  try { window.localStorage.setItem(KEY, JSON.stringify(state, replacer)); } catch { /* In-memory demo only. */ }
  return result;
}
export function resetLaunchpadMock(): void { memory = undefined; try { window.localStorage.removeItem(KEY); } catch { /* ignore */ } }

export function findMockLaunch(state: MockLaunchpadState, address: string): MockLaunch {
  const launch = state.launches.find(l => l.info.token === address || l.info.curve === address);
  if (!launch) throw new Error('This token was not launched through the Peridot launchpad.');
  return launch;
}
export function mockCurveInfo(l: MockLaunch): CurveInfo {
  const r = reserves(l.params, l.realQuote, l.sold);
  const price = r.x * X7 / r.y;
  const p = l.params;
  const progress = Number((l.realQuote < p.graduation_target ? l.realQuote : p.graduation_target) * 10_000n / p.graduation_target);
  return { phase: l.phase, price, progress_bps: progress, real_quote: l.realQuote, sold: l.sold, tokens_remaining: p.curve_supply - l.sold, virtual_quote: p.virtual_quote, virtual_token: p.virtual_token, graduation_target: p.graduation_target, fully_diluted_value: price * (p.curve_supply + p.lp_supply) / X7, creator_bought: l.creatorBought, creator_cap: creatorCap(p), fees_treasury_pending: l.feesTreasury, fees_creator_pending: l.feesCreator };
}
export function mockFactoryConfig(state: MockLaunchpadState): FactoryConfig {
  return { admin: MOCK_OWNER, treasury: MOCK_OWNER, paused: false, wasm_set: true, fee_token: null, launch_fee: 0n, launch_count: state.launches.length };
}
export function mockActivity(l: MockLaunch): CurveActivity { return { trades: [...l.trades], history: [...l.history], partial: false }; }

function syncPhase(l: MockLaunch, state: MockLaunchpadState) {
  if (l.phase === Phase.Trading && l.realQuote >= l.params.graduation_target) {
    l.phase = Phase.Graduatable;
    l.history.unshift({ name: 'state_changed', hash: hash(), ledger: ++state.ledger, at: now(), data: { from: 0, to: 1, real_quote: l.realQuote } });
  }
}
export function mockQuoteBuy(l: MockLaunch, quoteIn: bigint) {
  if (l.phase !== Phase.Trading) throw new Error('Trading is closed for this token.');
  const q = quoteBuy(reserves(l.params, l.realQuote, l.sold), l.params.graduation_target - l.realQuote, quoteIn, l.params.trade_fee_bps);
  if (!q) throw new Error('This trade is too small and would round to zero. Enter a larger amount.');
  return q;
}
export function mockQuoteSell(l: MockLaunch, tokensIn: bigint) {
  if (l.phase === Phase.Graduating || l.phase === Phase.Graduated) throw new Error('Trading is closed for this token.');
  if (tokensIn > l.sold) throw new Error('You cannot sell more tokens than the curve has sold.');
  const q = quoteSell(reserves(l.params, l.realQuote, l.sold), tokensIn, l.params.trade_fee_bps);
  if (!q) throw new Error('This trade is too small and would round to zero. Enter a larger amount.');
  return q;
}
export function mockBuy(state: MockLaunchpadState, user: string, l: MockLaunch, quoteIn: bigint, minTokensOut: bigint): { tokensOut: bigint; hash: string } {
  if (minTokensOut <= 0n) throw new Error('The minimum output must be above zero.');
  const q = mockQuoteBuy(l, quoteIn);
  if (q.tokensOut < minTokensOut) throw new Error('The price moved past your slippage setting. Refresh the quote and try again.');
  if ((state.xlm[user] ?? 0n) < q.gross) throw new Error('Insufficient demo XLM balance.');
  if (user === l.info.creator) {
    const total = l.creatorBought + q.tokensOut;
    if (total > creatorCap(l.params)) throw new Error('This buy would exceed the creator cap, a fixed share of the curve supply.');
    l.creatorBought = total;
  }
  state.xlm[user] = (state.xlm[user] ?? 0n) - q.gross;
  l.holdings[user] = (l.holdings[user] ?? 0n) + q.tokensOut;
  l.realQuote += q.net; l.sold += q.tokensOut; l.feesTreasury += q.fee;
  const h = hash();
  l.trades.unshift({ kind: 'buy', user, quote: q.gross, tokens: q.tokensOut, fee: q.fee, clamped: q.clamped, hash: h, ledger: ++state.ledger, at: now() });
  syncPhase(l, state);
  return { tokensOut: q.tokensOut, hash: h };
}
export function mockSell(state: MockLaunchpadState, user: string, l: MockLaunch, tokensIn: bigint, minQuoteOut: bigint): { quoteOut: bigint; hash: string } {
  if (minQuoteOut <= 0n) throw new Error('The minimum output must be above zero.');
  if ((l.holdings[user] ?? 0n) < tokensIn) throw new Error('You do not hold that many tokens.');
  const q = mockQuoteSell(l, tokensIn);
  if (q.quoteOut < minQuoteOut) throw new Error('The price moved past your slippage setting. Refresh the quote and try again.');
  l.holdings[user] = (l.holdings[user] ?? 0n) - tokensIn;
  state.xlm[user] = (state.xlm[user] ?? 0n) + q.quoteOut;
  l.realQuote -= q.gross; l.sold -= tokensIn; l.feesTreasury += q.fee;
  const h = hash();
  l.trades.unshift({ kind: 'sell', user, quote: q.quoteOut, tokens: tokensIn, fee: q.fee, clamped: false, hash: h, ledger: ++state.ledger, at: now() });
  return { quoteOut: q.quoteOut, hash: h };
}
export const MOCK_GRADUATION_FEE = 1n * X7;
export function mockGraduate(state: MockLaunchpadState, payer: string, l: MockLaunch): { step: GradStep; hash: string } {
  const h = hash();
  if (!l.graduation) {
    if (l.phase !== Phase.Graduatable) throw new Error('The graduation target has not been reached yet.');
    if ((state.aqua[payer] ?? 0n) < MOCK_GRADUATION_FEE) throw new Error('The payer needs 1 AQUA for the pool creation fee.');
    state.aqua[payer] = (state.aqua[payer] ?? 0n) - MOCK_GRADUATION_FEE;
    const unsold = l.params.curve_supply - l.sold;
    l.graduation = { step: GradStep.PoolCreated, pool: `mock-pool-${l.info.symbol.toLowerCase()}`, pool_index: 'mock-pool-index', share_token: `mock-share-${l.info.symbol.toLowerCase()}`, quote_in_pool: l.realQuote, token_in_pool: l.params.lp_supply, lp_shares_burned: 3_162_277_660_168n, unsold_burned: unsold, group_id: 0, quote_market: null, token_market: null, claimed: false };
    l.phase = Phase.Graduating;
    l.history.unshift({ name: 'pool_created', hash: h, ledger: ++state.ledger, at: now(), data: { pool: l.graduation.pool, quote_amount: l.realQuote, token_amount: l.params.lp_supply } });
    return { step: GradStep.PoolCreated, hash: h };
  }
  const g = l.graduation;
  switch (g.step) {
    case GradStep.PoolCreated: g.group_id = state.nextGroupId++; state.groupOwners[String(g.group_id)] = l.info.curve; g.step = GradStep.GroupCreated; l.history.unshift({ name: 'group_created', hash: h, ledger: ++state.ledger, at: now(), data: { group_id: g.group_id } }); break;
    case GradStep.GroupCreated: g.quote_market = `mock-market-${g.group_id}-XLM`; g.step = GradStep.QuoteMarketAdded; l.history.unshift({ name: 'market_added', hash: h, ledger: ++state.ledger, at: now(), data: { group_id: g.group_id, market: g.quote_market, is_quote: true } }); break;
    case GradStep.QuoteMarketAdded: g.step = GradStep.QuoteMarketActivated; l.history.unshift({ name: 'market_activated', hash: h, ledger: ++state.ledger, at: now(), data: { group_id: g.group_id, market: g.quote_market, is_quote: true } }); break;
    case GradStep.QuoteMarketActivated: g.token_market = `mock-market-${g.group_id}-${l.info.symbol}`; g.step = GradStep.TokenMarketAdded; l.history.unshift({ name: 'market_added', hash: h, ledger: ++state.ledger, at: now(), data: { group_id: g.group_id, market: g.token_market, is_quote: false } }); break;
    case GradStep.TokenMarketAdded: g.step = GradStep.Graduated; l.phase = Phase.Graduated; l.history.unshift({ name: 'graduated', hash: h, ledger: ++state.ledger, at: now(), data: { token: l.info.token, pool: g.pool, group_id: g.group_id } }); break;
    default: throw new Error('Graduation is already complete.');
  }
  return { step: g.step, hash: h };
}
export function mockClaimGroup(state: MockLaunchpadState, creator: string, l: MockLaunch): { groupId: number; hash: string } {
  if (creator !== l.info.creator) throw new Error('Only the creator can claim the group.');
  if (!l.graduation || l.graduation.step !== GradStep.Graduated) throw new Error('Graduation is not complete yet.');
  if (l.graduation.claimed) throw new Error('The group was already claimed.');
  l.graduation.claimed = true;
  state.groupOwners[String(l.graduation.group_id)] = creator;
  const h = hash();
  l.history.unshift({ name: 'group_claimed', hash: h, ledger: ++state.ledger, at: now(), data: { group_id: l.graduation.group_id, owner: creator } });
  return { groupId: l.graduation.group_id, hash: h };
}
export function mockLaunchCurve(state: MockLaunchpadState, creator: string, name: string, symbol: string, preset: Preset, metadataUri: string, creatorBuy: bigint, minTokensOut: bigint): { token: string; curve: string; hash: string } {
  if (state.launches.some(l => l.info.symbol.toLowerCase() === symbol.toLowerCase())) throw new Error('A demo token with this symbol already exists. Choose another symbol.');
  if (creatorBuy < 0n || (creatorBuy > 0n && minTokensOut <= 0n)) throw new Error('A creator buy needs a positive minimum token output.');
  const id = state.launches.length;
  const launch = launchAt(id, name, symbol, creator, preset, 0n, 0);
  launch.metadataUri = metadataUri;
  state.launches.push(launch);
  const h = hash();
  launch.history.unshift({ name: 'launched', hash: h, ledger: ++state.ledger, at: now(), data: { id, creator } });
  if (creatorBuy > 0n) mockBuy(state, creator, launch, creatorBuy, minTokensOut);
  return { token: launch.info.token, curve: launch.info.curve, hash: h };
}

export function mockCreatePlainToken(state: MockLaunchpadState, creator: string, name: string, symbol: string, supplyWhole: bigint): { token: string; hash: string } {
  const plain = (state.plainTokens ??= []);
  if (state.launches.some(l => l.info.symbol.toLowerCase() === symbol.toLowerCase()) || plain.some(t => t.symbol.toLowerCase() === symbol.toLowerCase())) throw new Error('A demo token with this symbol already exists. Choose another symbol.');
  if (supplyWhole < 1n || supplyWhole > 1_000_000_000_000n) throw new Error('Supply must be a whole number between 1 and 1,000,000,000,000 tokens.');
  if (plain.filter(t => t.creator === creator).length >= 100) throw new Error('This creator has reached the limit of 100 launches.');
  const token = `mock-plain-${symbol.toLowerCase()}`;
  const supply = supplyWhole * X7;
  plain.push({ id: plain.length, token, creator, name, symbol, supply, created_at: BigInt(Math.floor(Date.now() / 1000)) });
  (state.plainHoldings ??= {})[token] = { [creator]: supply };
  return { token, hash: hash() };
}
export function findMockPlain(state: MockLaunchpadState, address: string): PlainTokenInfo | null {
  return (state.plainTokens ?? []).find(t => t.token === address) ?? null;
}
