import { readFile } from 'node:fs/promises';
import pg from 'pg';
import { databaseOptions } from './journal.mjs';

/** Read-only summary of the signing journal, for operators before a service hand-over. Prints no connection details. */
async function main() {
  const ca = process.env.DATABASE_CA_PEM ?? (process.env.DATABASE_CA_FILE ? await readFile(process.env.DATABASE_CA_FILE, 'utf8') : undefined);
  const client = new pg.Client(databaseOptions(process.env.DATABASE_URL, ca));
  await client.connect();
  try {
    const { rows } = await client.query(`SELECT status, count(*)::int AS intents, max(created_at) AS latest,
      COALESCE(sum(max_fee) FILTER (WHERE created_at > clock_timestamp() - interval '24 hours'),0)::text AS reserved_24h_stroops
      FROM margin_keeper_intents GROUP BY status ORDER BY status`);
    console.table(rows);
    const open = rows.filter(row => row.status !== 'SUCCESS');
    console.log(open.length ? 'UNRESOLVED intents exist: do not start a new keeper until each hash is reconciled.' : 'OK: no unresolved intents.');
    process.exitCode = open.length ? 1 : 0;
  } finally { await client.end(); }
}
main().catch(() => { console.error('Cannot read the journal. Check DATABASE_URL and DATABASE_CA_FILE.'); process.exitCode = 2; });
