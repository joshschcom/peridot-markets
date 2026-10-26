import { MOCK_OWNER } from '@/lib/peridot/mock';
import { MOCK_XLM_TOKEN, type MockLaunchpadState } from './mock';
import { emptyPosition, icoBuyQuote, ICO_SCALE, validateIco, type IcoConfig, type IcoInfo, type IcoInput, type IcoPosition, type IcoState } from './ico-types';
export interface MockIco { info: IcoInfo; config: IcoConfig; state: IcoState; positions: Record<string, IcoPosition>; holdings: Record<string, bigint>; demoEnd?: bigint }
const now = () => BigInt(Math.floor(Date.now() / 1000));
export function mockIcos(state: MockLaunchpadState): MockIco[] {
  if (state.icos) return state.icos;
  const t = now();
  state.icos = [{
    info: { id: 0, token: 'mock-token-orbit', ico: 'mock-ico-orbit', creator: 'mock-orbit-creator', quote_token: MOCK_XLM_TOKEN, name: 'Orbit Collective', symbol: 'ORBIT', created_at: t - 3600n },
    config: { token: 'mock-token-orbit', creator: 'mock-orbit-creator', params: { quote_token: MOCK_XLM_TOKEN, supply: 1_000_000n * ICO_SCALE, price: 1_000_000n, soft_cap: 1000n * ICO_SCALE, hard_cap: 5000n * ICO_SCALE, start: t - 3600n, end: t + 86400n, buyer_cap: 1000n * ICO_SCALE } },
    state: { phase: 0, raised: 2200n * ICO_SCALE, allocated: 22000n * ICO_SCALE, paused: false, withdrawn: false },
    positions: { [MOCK_OWNER]: { paid: 200n * ICO_SCALE, tokens: 2000n * ICO_SCALE, claimed: false, refunded: false } }, holdings: {},
  }];
  return state.icos;
}
export function findIco(state: MockLaunchpadState, address: string): MockIco {
  const ico = mockIcos(state).find(i => i.info.token === address || i.info.ico === address);
  if (!ico) throw new Error('ICO not found.'); return ico;
}
export function mockCreateIco(state: MockLaunchpadState, creator: string, input: IcoInput): IcoInfo {
  const error = validateIco(input.params, now()); if (error) throw new Error(error);
  const all = mockIcos(state); if (all.filter(i => i.info.creator === creator).length >= 100) throw new Error('You have reached the limit of 100 ICO launches.');
  const id = all.length; const token = `mock-token-ico-${id}`; const ico = `mock-ico-${id}`;
  const info = { id, token, ico, creator, quote_token: MOCK_XLM_TOKEN, name: input.name, symbol: input.symbol, created_at: now() };
  all.push({ info, config: { token, creator, params: input.params }, state: { phase: 0, raised: 0n, allocated: 0n, paused: false, withdrawn: false }, positions: {}, holdings: {} });
  return info;
}
export function mockIcoAction(state: MockLaunchpadState, ico: MockIco, user: string, action: 'buy' | 'claim' | 'refund' | 'finalize' | 'withdraw', amount = 0n): void {
  const p = ico.positions[user] ?? emptyPosition(); const s = ico.state; const params = ico.config.params;
  const time = ico.demoEnd ?? now();
  if (action === 'buy') {
    const tokens = icoBuyQuote(params, s, p, amount, time);
    if ((state.xlm[user] ?? 0n) < amount) throw new Error('Insufficient demo XLM balance.');
    state.xlm[user] -= amount; p.paid += amount; p.tokens += tokens; s.raised += amount; s.allocated += tokens; ico.positions[user] = p; return;
  }
  if (time < params.end) throw new Error('The sale has not ended yet.');
  if (s.phase === 0) s.phase = s.raised >= params.soft_cap ? 1 : 2;
  if (action === 'claim') {
    if (s.phase !== 1) throw new Error('This sale did not succeed. Request a refund instead.');
    if (p.claimed || p.tokens === 0n) throw new Error('No unclaimed tokens.');
    p.claimed = true; ico.holdings[user] = (ico.holdings[user] ?? 0n) + p.tokens;
  } else if (action === 'refund') {
    if (s.phase !== 2) throw new Error('This sale succeeded. Claim your tokens instead.');
    if (p.refunded || p.paid === 0n) throw new Error('No refundable contribution.');
    p.refunded = true; state.xlm[user] = (state.xlm[user] ?? 0n) + p.paid;
  } else if (action === 'withdraw') {
    if (user !== ico.config.creator) throw new Error('Only the creator can withdraw.');
    if (s.withdrawn) throw new Error('The creator already withdrew.');
    s.withdrawn = true;
    state.xlm[user] = (state.xlm[user] ?? 0n) + (s.phase === 1 ? s.raised : 0n);
    ico.holdings[user] = (ico.holdings[user] ?? 0n) + params.supply - (s.phase === 1 ? s.allocated : 0n);
  }
  ico.positions[user] = p;
}
