import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { QA } from './bootstrap';
import { Keypair } from '@stellar/stellar-sdk';
import { keypairSigner, resourcesFromEnvelope, type Resources } from './signer';
import { network } from '../../src/lib/peridot/network';
import { getRpc } from '../../src/lib/peridot/rpc';

export interface StepRecord {
  flow: string; step: string; status: 'PASS' | 'FAIL' | 'EXPECTED-FAIL-OK' | 'EXPECTED-FAIL-MISSING' | 'SKIP';
  hashes: string[]; sims: Array<Resources | null>; onchain: Array<{ hash: string; ledger?: number; feeCharged?: string; resources: Resources | null }>;
  error?: string; note?: string; ms: number; startedAt: string;
}
export const records: StepRecord[] = [];
let outName = 'results';
export function setOut(name: string) {
  outName = name;
  try { const prev = JSON.parse(readFileSync(resolve(QA, `out/${name}.json`), 'utf8')); records.push(...prev); } catch { /* first run */ }
}
export function flush() {
  mkdirSync(resolve(QA, 'out'), { recursive: true });
  writeFileSync(resolve(QA, `out/${outName}.json`), JSON.stringify(records, (_k, v) => typeof v === 'bigint' ? v.toString() : v, 2));
}
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
export const errText = (e: unknown) => e instanceof Error ? `${e.name}: ${e.message}` : String(e);

export interface Ctx { sims: Array<Resources | null>; hashes: string[]; note: (s: string) => void; signer: ReturnType<typeof keypairSigner>; progress: (p: any) => void }
/** Run one app call as a recorded QA step. `fn` receives a signer whose prepared-tx resources are captured. */
export async function step<T>(flow: string, name: string, kp: Keypair, fn: (c: Ctx) => Promise<T>, opts: { expectFail?: RegExp; retries?: number; note?: string } = {}): Promise<{ ok: boolean; value?: T; error?: string; rec: StepRecord }> {
  const rec: StepRecord = { flow, step: name, status: 'PASS', hashes: [], sims: [], onchain: [], ms: 0, startedAt: new Date().toISOString(), note: opts.note };
  const t0 = Date.now();
  const notes: string[] = [];
  const signer = keypairSigner(kp, network.passphrase, { onPrepared: (_x, r) => rec.sims.push(r) });
  const ctx: Ctx = { sims: rec.sims, hashes: rec.hashes, signer, note: s => notes.push(s),
    progress: (p: any) => { if (p?.hash && !rec.hashes.includes(p.hash)) rec.hashes.push(p.hash); } };
  let value: T | undefined; let error: string | undefined;
  const attempts = (opts.retries ?? 1) + 1;
  for (let a = 0; a < attempts; a++) {
    try { value = await fn(ctx); error = undefined; break; }
    catch (e) {
      error = errText(e);
      const transient = /timeout|ETIMEDOUT|ECONNRESET|fetch failed|429|TRY_AGAIN|503|502|socket hang up/i.test(error);
      if (a < attempts - 1 && transient && !opts.expectFail) { notes.push(`retry after: ${error.slice(0, 120)}`); await sleep(3000 * (a + 1)); continue; }
      break;
    }
  }
  const h: any = value;
  if (h && typeof h === 'object' && typeof h.hash === 'string' && h.hash && !rec.hashes.includes(h.hash)) rec.hashes.push(h.hash);
  for (const hash of rec.hashes) {
    try {
      const t: any = await getRpc().getTransaction(hash);
      if (t.status === 'SUCCESS' || t.status === 'FAILED') {
        let resources: Resources | null = null;
        try { resources = resourcesFromEnvelope(t.envelopeXdr); } catch { /* ignore */ }
        let feeCharged: string | undefined; try { feeCharged = String(t.resultXdr.feeCharged); } catch { /* ignore */ }
        rec.onchain.push({ hash, ledger: t.ledger, feeCharged, resources });
      }
    } catch { /* ignore */ }
  }
  rec.ms = Date.now() - t0;
  rec.error = error; if (notes.length) rec.note = [rec.note, ...notes].filter(Boolean).join(' | ');
  if (opts.expectFail) rec.status = error && opts.expectFail.test(error) ? 'EXPECTED-FAIL-OK' : error ? 'FAIL' : 'EXPECTED-FAIL-MISSING';
  else rec.status = error ? 'FAIL' : 'PASS';
  records.push(rec); flush();
  const tag = rec.status === 'PASS' || rec.status === 'EXPECTED-FAIL-OK' ? 'ok ' : '!! ';
  console.log(`${tag}[${flow}] ${name} -> ${rec.status}${rec.hashes[0] ? ' ' + rec.hashes.join(',').slice(0, 20) : ''}${error ? ' :: ' + error.slice(0, 220) : ''}`);
  return { ok: !error, value, error, rec };
}
/** Pure assertion recorded as a step (no tx). */
export async function check(flow: string, name: string, fn: () => Promise<string | void> | string | void, opts: { expectFail?: RegExp } = {}) {
  const rec: StepRecord = { flow, step: name, status: 'PASS', hashes: [], sims: [], onchain: [], ms: 0, startedAt: new Date().toISOString() };
  const t0 = Date.now();
  try { const n = await fn(); if (typeof n === 'string') rec.note = n; } catch (e) { rec.error = errText(e); }
  rec.ms = Date.now() - t0;
  if (opts.expectFail) rec.status = rec.error && opts.expectFail.test(rec.error) ? 'EXPECTED-FAIL-OK' : rec.error ? 'FAIL' : 'EXPECTED-FAIL-MISSING';
  else rec.status = rec.error ? 'FAIL' : 'PASS';
  records.push(rec); flush();
  console.log(`${rec.status === 'PASS' || rec.status === 'EXPECTED-FAIL-OK' ? 'ok ' : '!! '}[${flow}] ${name} -> ${rec.status}${rec.error ? ' :: ' + rec.error.slice(0, 220) : ''}${rec.note ? ' // ' + rec.note.slice(0, 160) : ''}`);
  return rec;
}

/** MAINNET dry run: the app builds + simulates; our signer records the prepared tx and refuses to sign. Nothing is ever submitted. */
import { dryRunSigner } from './signer';
export const DEPLOYER = 'GC3FLITV3KLO5RUJLJWXM5O5MMWVDIF5RX64Y46YZFHP3WVYQBF37CXH';
export interface DryRecord { flow: string; step: string; verdict: 'SIM-OK' | 'SIM-FAIL' | 'CLIENT-GUARD' | 'ERROR'; resources?: Resources | null; fee?: string; error?: string; note?: string; ms: number }
export const dryRecords: DryRecord[] = [];
export function flushDry(name = 'mainnet-dry-run') {
  mkdirSync(resolve(QA, 'out'), { recursive: true });
  writeFileSync(resolve(QA, `out/${name}.json`), JSON.stringify(dryRecords, (_k, v) => typeof v === 'bigint' ? v.toString() : v, 2));
}
export async function dryStep(flow: string, name: string, fn: (signer: ReturnType<typeof dryRunSigner>) => Promise<unknown>, opts: { note?: string; paceMs?: number } = {}) {
  const sink: { last?: { xdr: string; resources: Resources | null; fee: string } } = {};
  const signer = dryRunSigner(DEPLOYER, network.passphrase, sink);
  const t0 = Date.now(); const rec: DryRecord = { flow, step: name, verdict: 'ERROR', ms: 0, note: opts.note };
  try { await fn(signer); rec.verdict = 'SIM-OK'; rec.note = [rec.note, 'returned without signing (read-only / no tx needed)'].filter(Boolean).join(' | '); }
  catch (e) {
    const msg = errText(e);
    if (/dry run/.test(msg) && sink.last) { rec.verdict = 'SIM-OK'; rec.resources = sink.last.resources; rec.fee = sink.last.fee; }
    else if (/Simulation failed/.test(msg)) { rec.verdict = 'SIM-FAIL'; rec.error = msg.replace(/\s+/g, ' ').slice(0, 400); }
    else { rec.verdict = 'CLIENT-GUARD'; rec.error = msg.replace(/\s+/g, ' ').slice(0, 400); }
  }
  rec.ms = Date.now() - t0; dryRecords.push(rec); flushDry();
  console.log(`${rec.verdict.padEnd(12)} [${flow}] ${name}${rec.resources ? ` insn=${(rec.resources.instructions / 1e6).toFixed(1)}M entries=${rec.resources.ledgerEntries}(ro ${rec.resources.readOnlyEntries}/rw ${rec.resources.readWriteEntries}) fee=${rec.fee}` : ''}${rec.error ? ' :: ' + rec.error.slice(0, 200) : ''}`);
  await sleep(opts.paceMs ?? 1200);
  return rec;
}
