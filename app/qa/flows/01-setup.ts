import { TESTNET_EXTERNAL as X } from '../lib/bootstrap';
import { Keypair, nativeToScVal } from '@stellar/stellar-sdk';
import { getOrCreateAccount, invokeRead, setupInvoke, addrV, i128, xlmBalance } from '../lib/chain';
import { isYieldVaultAllowed, normalizeContract } from '../../src/lib/peridot/factory';
import { readContract } from '../../src/lib/peridot/rpc';
import { uint } from '../../src/lib/peridot/group-client';

async function main() {
  const owner = await getOrCreateAccount('owner');
  const user = await getOrCreateAccount('user');
  console.log('owner', owner.publicKey(), 'user', user.publicKey());
  console.log('owner XLM', await xlmBalance(owner.publicKey()), 'user XLM', await xlmBalance(user.publicKey()));
  console.log('defindex XLM vault allowed:', await isYieldVaultAllowed('CCLV4H7WTLJQ7ATLHBBQV2WW3OINF3FOY5XZ7VPHZO7NH3D2ZS4GFSF6'));
  for (const s of ['XLM', 'USDT']) {
    const lp: any = await readContract(X.reflector_external, 'lastprice', [normalizeEnum(s)]);
    console.log('oracle', s, lp, 'decimals', await readContract(X.reflector_external, 'decimals'));
  }
  try { const h = await setupInvoke(owner, X.usdt_mock, 'mint', [addrV(owner.publicKey()), i128(100000_0000000n)]); console.log('mint ok', h); } catch (e) { console.log('mint ERR', (e as Error).message.slice(0, 300)); }
  console.log('owner USDT', await invokeRead(X.usdt_mock, 'balance', [addrV(owner.publicKey())]));
}
import { xdr } from '@stellar/stellar-sdk';
function normalizeEnum(sym: string) { return xdr.ScVal.scvVec([xdr.ScVal.scvSymbol('Other'), xdr.ScVal.scvSymbol(sym)]); }
main().catch(e => { console.error('SETUP FAIL', e); process.exit(1); });
