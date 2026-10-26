import { Address, scValToNative, xdr } from '@stellar/stellar-sdk';
import { readContract, readContractRaw } from '@/lib/peridot/rpc';
import { decodeMarginPoolRegistry } from '@/lib/peridot/margin';
import { AQUARIUS_ROUTER, type ChainReader, type Net, type PoolType } from './aquarius-pools';

const addr = (a: string) => new Address(a).toScVal();
const toHex = (b: Uint8Array) => Array.from(b, x => x.toString(16).padStart(2, '0')).join('');
function sortedPair(tokens: [string, string]): [string, string] {
  const [a, b] = tokens.map(t => new Address(t).toScAddress().toXDR()) as [Buffer, Buffer];
  return Buffer.compare(a, b) <= 0 ? tokens : [tokens[1], tokens[0]];
}
async function tryRead<T>(pool: string, method: string): Promise<T | null> {
  try { return await readContract<T>(pool, method); } catch { return null; }
}
function normalizeType(raw: unknown): PoolType {
  return raw === 'concentrated' || raw === 'stable' || raw === 'constant_product' ? raw : 'unknown';
}
/** Reads through the app's read-only RPC helpers (failover and rate limiting included). */
export function chainReader(net: Net): ChainReader {
  const router = AQUARIUS_ROUTER[net];
  return {
    async getPools(tokens) {
      const raw = await readContractRaw(router, 'get_pools', [xdr.ScVal.scvVec(sortedPair(tokens).map(addr))]);
      return decodeMarginPoolRegistry(raw).map(({ poolId, pool }) => ({ poolIndex: toHex(poolId), pool }));
    },
    async poolInfo(pool) {
      const [tokens, type, fee, reserves] = await Promise.all([
        readContract<string[]>(pool, 'get_tokens'),
        tryRead<unknown>(pool, 'pool_type'),
        tryRead<number | bigint>(pool, 'get_fee_fraction'),
        tryRead<Array<bigint | number>>(pool, 'get_reserves'),
      ]);
      // Aquarius stores the fee as a fraction of 10_000 (30 = 0.30%).
      const feeBps = fee === null || fee === undefined ? null : Number(fee);
      return {
        tokens: tokens.map(String),
        type: normalizeType(type !== null && typeof type === 'object' ? scValToNative(type as never) : type),
        feeBps: feeBps !== null && Number.isFinite(feeBps) && feeBps >= 0 && feeBps <= 10_000 ? feeBps : null,
        reserves: Array.isArray(reserves) ? reserves.map(r => BigInt(r)) : null,
      };
    },
  };
}
