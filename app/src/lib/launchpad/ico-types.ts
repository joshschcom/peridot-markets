export interface IcoParams {
  quote_token: string; supply: bigint; price: bigint; soft_cap: bigint; hard_cap: bigint;
  start: bigint; end: bigint; buyer_cap: bigint;
}
export interface IcoInfo {
  id: number; token: string; ico: string; creator: string; quote_token: string;
  name: string; symbol: string; created_at: bigint;
}
export interface IcoConfig { token: string; creator: string; params: IcoParams }
export interface IcoState { phase: number; raised: bigint; allocated: bigint; paused: boolean; withdrawn: boolean }
export interface IcoPosition { paid: bigint; tokens: bigint; claimed: boolean; refunded: boolean }
export interface IcoInput { name: string; symbol: string; metadataUri: string; params: IcoParams }
export const ICO_SCALE = 10_000_000n;
export const ICO_MAX = 10_000_000_000_000_000_000n;
export const emptyPosition = (): IcoPosition => ({ paid: 0n, tokens: 0n, claimed: false, refunded: false });
export function validateIco(p: IcoParams, now: bigint): string | null {
  if (p.start < now) return 'Start time must be in the future.';
  if (p.end - p.start < 600n || p.end - p.start > 2_592_000n) return 'The sale must last between 10 minutes and 30 days.';
  if (p.supply <= 0n || p.supply > ICO_MAX) return 'Supply must be above zero and at most 1 trillion tokens.';
  if (p.price <= 0n || p.price > ICO_MAX) return 'Price must be above zero and at most 1 trillion XLM.';
  if (p.soft_cap <= 0n || p.soft_cap > p.hard_cap || p.hard_cap > ICO_MAX) return 'Soft cap must be above zero and no higher than the hard cap (at most 1 trillion XLM).';
  if (p.buyer_cap < 0n || p.buyer_cap > p.hard_cap) return 'Wallet cap must be between zero and the hard cap.';
  const sold = p.hard_cap * ICO_SCALE / p.price;
  if (sold === 0n || sold > p.supply) return 'Supply must cover the tokens sold at the hard cap. The cap must buy at least one token base unit.';
  return null;
}
export function icoBuyQuote(p: IcoParams, s: IcoState, position: IcoPosition, amount: bigint, now: bigint): bigint {
  if (s.paused) throw new Error('New purchases are paused. Claims and refunds remain available.');
  if (now < p.start) throw new Error('This sale has not started yet.');
  if (now >= p.end || s.phase !== 0) throw new Error('This sale has ended.');
  if (amount <= 0n) throw new Error('Enter an amount above zero.');
  if (amount > p.hard_cap - s.raised) throw new Error('This purchase exceeds the remaining hard cap. Lower the amount.');
  if (p.buyer_cap > 0n && amount > p.buyer_cap - position.paid) throw new Error('This purchase exceeds your remaining wallet cap.');
  const tokens = amount * ICO_SCALE / p.price;
  if (tokens === 0n) throw new Error('This amount is too small to buy a token base unit.');
  return tokens;
}
