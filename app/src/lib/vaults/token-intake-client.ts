import { Address, xdr } from '@stellar/stellar-sdk';
import { canonicalTokenSymbol, findReflectorFeed } from '@/lib/peridot/factory';
import { network } from '@/lib/peridot/network';
import { MOCK_CUSTOM_TOKENS, MOCK_NOFEED_TOKEN, readMockState } from '@/lib/peridot/mock';
import { readContract, readContractRaw } from '@/lib/peridot/rpc';
import { decodeMarginPoolRegistry } from '@/lib/peridot/margin';
import type { PriceConfig } from '@/lib/peridot/types';
import { AQUARIUS_ROUTER, USDC_ADDRESS } from './aquarius-pools';
import { NotATokenError, decidePricing, parseTokenInput, readTokenInfo, type ParsedToken, type PricingDecision, type TokenInfo } from './token-intake';

export interface Inspection {
  parsed: Extract<ParsedToken, { kind: 'contract' | 'classic' }>;
  info: TokenInfo;
  /** Present only when the factory approved the mapping. */
  price: PriceConfig | undefined;
  pricing: PricingDecision;
  /** Leverage rule shown to owners: any token with seven decimals can be switched on. */
  leverage: { available: boolean; reason: string };
}

async function mockInfo(address: string): Promise<TokenInfo> {
  const custom = MOCK_CUSTOM_TOKENS[address];
  if (custom) return { address, name: custom.name, symbol: custom.symbol, decimals: custom.decimals, totalSupply: custom.totalSupply };
  const known = readMockState().tokens[address];
  if (known) return { address, name: known.symbol, symbol: known.symbol, decimals: known.decimals, totalSupply: null };
  throw new NotATokenError('demo mode (try the demo tokens PDEMO or NOFEED)');
}
async function findUsdcPool(token: string): Promise<{ address: string; depthUsd: number | null } | null> {
  if (network.useMocks) return token === MOCK_NOFEED_TOKEN ? { address: 'mock-nofeed-pool', depthUsd: 12_000 } : null;
  const usdc = USDC_ADDRESS[network.name];
  if (token === usdc) return null;
  try {
    const [a, b] = [token, usdc].map(t => new Address(t).toScAddress().toXDR()) as [Buffer, Buffer];
    const sorted = Buffer.compare(a, b) <= 0 ? [token, usdc] : [usdc, token];
    const pools = decodeMarginPoolRegistry(await readContractRaw(AQUARIUS_ROUTER[network.name], 'get_pools', [xdr.ScVal.scvVec(sorted.map(t => new Address(t).toScVal()))]));
    let best: { address: string; depthUsd: number | null } | null = null;
    for (const { pool } of pools) {
      let depth: number | null = null;
      try {
        const tokens = await readContract<string[]>(pool, 'get_tokens'), reserves = await readContract<Array<bigint | number>>(pool, 'get_reserves');
        const i = tokens.indexOf(usdc);
        if (i >= 0 && reserves[i] !== undefined) depth = Number(reserves[i]) / 1e7;
      } catch { /* depth stays unknown */ }
      if (!best || (depth ?? -1) > (best.depthUsd ?? -1)) best = { address: pool, depthUsd: depth };
    }
    return best;
  } catch { return null; }
}

/** Everything the add-market form shows after a paste: parse, SEP-41 reads, pricing explanation. Throws a readable Error on a bad input. */
export async function inspectToken(raw: string): Promise<Inspection> {
  const parsed = parseTokenInput(raw, network.passphrase);
  if (parsed.kind === 'invalid') throw new Error(parsed.reason);
  const info = network.useMocks ? await mockInfo(parsed.address) : await readTokenInfo((c, m) => readContract(c, m), parsed.address, network.name);
  info.symbol = canonicalTokenSymbol(info.address, info.symbol);
  let price: PriceConfig | undefined;
  try { price = await findReflectorFeed(parsed.address, info.symbol); } catch { price = undefined; }
  const pool = price ? null : await findUsdcPool(parsed.address);
  const pricing = decidePricing({ reflectorApproved: !!price, pool, symbol: info.symbol });
  const leverage = info.decimals !== 7
    ? { available: false, reason: `Leverage needs seven decimals. ${info.symbol} has ${info.decimals}.` }
    : pricing.canSubmit ? { available: true, reason: 'Any token with a Reflector price and seven decimals can have leverage. You choose it per market; it also needs an approved Aquarius pool to another leveraged market.' }
      : { available: false, reason: 'Leverage needs a priced market first.' };
  return { parsed, info, price, pricing, leverage };
}
