import './lib/bootstrap';
/** One-off: the first launch runs of groups X and Y overwrote their result file; rebuild their step records from chain history (Horizon). */
import { getOrCreateAccount } from './lib/chain';
import { setOut, records, flush } from './lib/report';
import { getRpc } from './../src/lib/peridot/rpc';
import { resourcesFromEnvelope } from './lib/signer';
import { TransactionBuilder } from '@stellar/stellar-sdk';
import { network } from '../src/lib/peridot/network';
setOut('testnet-launch');
(async () => {
  const owner = await getOrCreateAccount('owner');
  const url = `https://horizon-testnet.stellar.org/accounts/${owner.publicKey()}/transactions?order=asc&limit=200`;
  const j: any = await (await fetch(url)).json();
  const have = new Set(records.flatMap(r => r.hashes));
  const launchFns = ['create_group', 'add_market', 'activate_market', 'attach_yield', 'enable_margin', 'set_pool_allowed', 'set_pool_binding', 'set_market_margin', 'apply_margin', 'set_rewards', 'fund', 'set_reward_speeds'];
  let seq = 0; const rows: any[] = [];
  for (const t of j._embedded.records) {
    if (!t.successful) continue;
    const tx: any = TransactionBuilder.fromXDR(t.envelope_xdr, network.passphrase);
    const op = tx.operations[0]; const fn = op?.func?.invokeContract?.functionName?.toString?.() ?? String(op?.func?.invokeContract?.functionName);
    rows.push({ hash: t.hash, fn, ledger: t.ledger, fee: t.fee_charged, env: tx.toEnvelope(), created: t.created_at });
  }
  // groups: X = first create_group ... first 'set_reward_speeds' pair; Y = next create_group, add_market, activate_market
  const names: Record<number, string> = {}; let group = ''; let nCreate = 0;
  for (const r of rows) {
    if (!launchFns.includes(r.fn)) continue;
    if (r.fn === 'create_group') { nCreate++; group = nCreate === 1 ? 'X' : nCreate === 2 ? 'Y' : nCreate === 3 ? 'W' : 'other'; }
    if (group !== 'X' && group !== 'Y') continue;
    if (have.has(r.hash)) continue;
    if (group === 'Y' && !['create_group', 'add_market', 'activate_market'].includes(r.fn)) continue;
    if (group === 'Y' && rows.filter(q => q.hash === r.hash).length && r.created > rows.find(q => q.fn === 'create_group' && q === rows.filter(z => z.fn === 'create_group')[2])?.created) continue;
    records.push({ flow: `A-launch/${group} (backfilled from chain history)`, step: `launch:${r.fn}`, status: 'PASS', hashes: [r.hash], sims: [], onchain: [{ hash: r.hash, ledger: r.ledger, feeCharged: String(r.fee), resources: resourcesFromEnvelope(r.env) }], ms: 0, startedAt: r.created, note: 'record rebuilt from Horizon; app wizard run succeeded at the time (console log)' });
  }
  flush(); console.log('records', records.length);
})();
