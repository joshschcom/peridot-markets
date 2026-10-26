import '../lib/bootstrap';
/** Harness SETUP (not an app flow): the shared testnet XLM/USDT pool sits ~13% off Reflector, outside the controller's
 *  10% open band, so begin_open_position_v3 panics. Selling XLM into the pool moves it back inside the band. */
import { getOrCreateAccount, invokeRead, setupInvoke, addrV, u128 } from '../lib/chain';
import { TESTNET_EXTERNAL as X } from '../lib/bootstrap';
import { uint } from '../../src/lib/peridot/group-client';
import { xdr } from '@stellar/stellar-sdk';
import { readContract } from '../../src/lib/peridot/rpc';
const sellers: Array<[string, bigint]> = [['owner', 4000n]];
async function oracle(sym: string) { const v: any = await readContract(X.reflector_external, 'lastprice', [xdr.ScVal.scvVec([xdr.ScVal.scvSymbol('Other'), xdr.ScVal.scvSymbol(sym)])]); return Number(v.price) / 1e14; }
async function main() {
  const ratio = async () => { const q = Number(await invokeRead<bigint>(X.xlm_usdt_pool, 'estimate_swap', [uint(0, 'u32'), uint(1, 'u32'), uint(1000_0000000n)])) / 1e10; return { pool: q, oracle: (await oracle('XLM')) / (await oracle('USDT')) }; };
  console.log('before', await ratio());
  for (const [who, amt] of sellers) {
    const kp = await getOrCreateAccount(who);
    const h = await setupInvoke(kp, X.xlm_usdt_pool, 'swap', [addrV(kp.publicKey()), uint(0, 'u32'), uint(1, 'u32'), uint(amt * 10000000n), uint(1n)]);
    console.log(who, 'sold', amt.toString(), 'XLM', h);
  }
  const r = await ratio(); console.log('after', r, 'deviation', ((r.pool / r.oracle - 1) * 100).toFixed(2) + '%');
}
main().catch(e => { console.error(e); process.exit(1); });
