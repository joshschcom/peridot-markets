import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const source = new URL('../../contracts/peridot-interfaces/ts/index.ts', import.meta.url);
const target = new URL('../src/lib/peridot/generated/interfaces.ts', import.meta.url);
let canonical;
try { canonical = await readFile(source, 'utf8'); }
catch (error) {
  if (error.code !== 'ENOENT' || process.argv.includes('--check')) throw error;
  await readFile(target, 'utf8');
  console.log('Using bundled canonical interface snapshot for standalone app build.');
  process.exit(0);
}
const digest = createHash('sha256').update(canonical).digest('hex');
const expected = `// Generated from contracts/peridot-interfaces/ts/index.ts. Do not edit.\n// SHA-256: ${digest}\n` + canonical;
let existing;
try { existing = await readFile(target, 'utf8'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
if (process.argv.includes('--check')) {
  if (existing !== expected) throw new Error('Bundled interfaces differ from canonical contracts types. Run node scripts/sync-interfaces.mjs.');
} else if (existing !== expected) await writeFile(target, expected);
