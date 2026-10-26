import { TESTNET_EXTERNAL as X } from '../lib/bootstrap';
import { getDeployments } from '../../src/lib/peridot/network';
import { listGroups, isOracleAllowed, isPriceFeedAllowed, findReflectorFeed, getTokenMetadata, normalizeContract } from '../../src/lib/peridot/factory';
import { loadMarginRegistry } from '../../src/lib/peridot/margin-registry';
import { readContract } from '../../src/lib/peridot/rpc';
import { invokeRead } from '../lib/chain';

async function main() {
  const d = getDeployments();
  console.log('factory', d.factory);
  const groups = await listGroups(0, 20);
  console.log('groups', groups.map(g => ({ id: g.id, name: g.name, owner: g.owner, markets: g.markets.length, rewards: !!g.reward_distributor, margin: !!g.margin_controller })));
  for (const o of [X.reflector_external, X.reflector_stellar]) console.log('oracle allowed', o, await isOracleAllowed(o));
  for (const [sym, tok] of Object.entries({ XLM: X.xlm, USDT: X.usdt_mock, USDC: X.usdc })) {
    try { const f = await findReflectorFeed(tok, sym); console.log('feed', sym, JSON.stringify(f)); } catch (e) { console.log('feed', sym, 'ERR', (e as Error).message); }
    for (const s of ['XLM', 'USDC', 'USDT']) for (const oracle of [X.reflector_external]) {
      const ok = await isPriceFeedAllowed(tok, { tag: 'ReflectorOnly', values: [{ oracle, asset: { tag: 'Other', values: [s] } }] } as any);
      if (ok) console.log('  allowed', sym, 'Other', s);
    }
    try { console.log('meta', sym, await getTokenMetadata(tok)); } catch (e) { console.log('meta ERR', (e as Error).message); }
  }
  console.log('reflector ext assets', JSON.stringify(normalizeContract(await readContract(X.reflector_external, 'assets'))).slice(0, 400));
  console.log('reflector stellar assets', JSON.stringify(normalizeContract(await readContract(X.reflector_stellar, 'assets'))).slice(0, 400));
  console.log('registry', await loadMarginRegistry());
  console.log('pool tokens', await readContract(X.xlm_usdt_pool, 'get_tokens'));
  console.log('estimate swap 100 XLM', await readContract(X.xlm_usdt_pool, 'estimate_swap', [(await import('../../src/lib/peridot/group-client')).uint(0, 'u32'), (await import('../../src/lib/peridot/group-client')).uint(1, 'u32'), (await import('../../src/lib/peridot/group-client')).uint(1000_0000000n)]).catch(e => 'ERR ' + e.message));
}
main().catch(e => { console.error('PROBE FAIL', e); process.exit(1); });
