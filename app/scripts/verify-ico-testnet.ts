/** Read-only verification of the same decoder and registry helpers used by the ICO UI.
 * Run: NEXT_PUBLIC_NETWORK=testnet NEXT_PUBLIC_USE_MOCKS=false npx tsx scripts/verify-ico-testnet.ts
 */
import assert from 'node:assert/strict';
import { launchpadMode } from '../src/lib/launchpad/config';
import { getIco, getIcoDetails, listIcos } from '../src/lib/launchpad/ico-client';

async function main() {
  assert.equal(launchpadMode(), 'live', 'Use testnet with mocks disabled');
  const list = await listIcos();
  assert.ok(list.length >= 2);
  for (const info of list) {
    const resolved = await getIco(info.token); assert.equal(resolved?.ico, info.ico);
    const details = await getIcoDetails(info, info.creator);
    assert.equal(typeof details.config.params.start, 'bigint');
    assert.equal(typeof details.state.raised, 'bigint');
    assert.equal(typeof details.state.phase, 'number');
    assert.equal(details.config.token, info.token);
    assert.ok(details.state.raised <= details.config.params.hard_cap);
    console.log(info.symbol, info.ico, 'phase', details.state.phase, 'raised', details.state.raised.toString());
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
