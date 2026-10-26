import './lib/bootstrap';
import { getRpc } from '../src/lib/peridot/rpc';
/** usage: QA_NETWORK=testnet npx tsx qa/diag-tx.ts <hash>  -> prints status, fee and the error/log diagnostic events */
(async () => {
  const t: any = await getRpc().getTransaction(process.argv[2]);
  console.log(t.status, 'ledger', t.ledger, 'fee', String(t.resultXdr?.feeCharged));
  const ev = (t.diagnosticEventsXdr || []).map((e: any) => JSON.stringify(e, (_k, v) => typeof v === 'bigint' ? v.toString() : v));
  for (const e of ev) if (/"error"|"log"|exceeded|panic/.test(e)) console.log(e.replace(/.*"body":/, '').slice(0, 420));
})();
