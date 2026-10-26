#!/usr/bin/env node
// Rerunnable 1440x900 screenshot generator for the pitch deck and demo video.
//
//   node scripts/pitch_screenshots.mjs --build     build app/ three ways (mainnet real data, testnet real data, mock demo) then shoot
//   node scripts/pitch_screenshots.mjs             shoot using the existing builds in app/.next-{mainnet,testnet,mock}
//   node scripts/pitch_screenshots.mjs --only=group,leverage
//
// Output: docs/assets/pitch-<id>.png (exactly 1440x900, viewport capture, dark theme) and docs/assets/pitch-screenshots.json
// (what each file shows, whether it is real chain data or mock mode, capture time, and any failure).
// Needs: `cd app && npm ci` first, and Playwright's chromium (`npx playwright install chromium`).
// Read-only: the pages are loaded without a wallet, nothing is signed and no transaction is sent. Mock mode never touches a chain.
import { spawn, spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const APP = path.join(ROOT, 'app');
const OUT = path.join(ROOT, 'docs', 'assets');
const require = createRequire(path.join(APP, 'package.json'));
const { chromium } = require('@playwright/test');
const args = process.argv.slice(2);
const BUILD = args.includes('--build');
const ONLY = (args.find((a) => a.startsWith('--only=')) || '').split('=')[1]?.split(',').filter(Boolean) || null;

const SERVERS = {
  mainnet: { dist: '.next-mainnet', port: 3411, env: { NEXT_PUBLIC_NETWORK: 'mainnet', NEXT_PUBLIC_USE_MOCKS: 'false' } },
  testnet: { dist: '.next-testnet', port: 3412, env: { NEXT_PUBLIC_NETWORK: 'testnet', NEXT_PUBLIC_USE_MOCKS: 'false' } },
  mock: { dist: '.next-mock', port: 3413, env: { NEXT_PUBLIC_NETWORK: 'mainnet', NEXT_PUBLIC_USE_MOCKS: 'true' } },
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const disc = readFileSync(path.join(APP, 'src/lib/ui/risk-disclaimer.ts'), 'utf8');
const DISC_KEY = disc.match(/DISCLAIMER_KEY\s*=\s*'([^']+)'/)?.[1];
const DISC_VER = disc.match(/DISCLAIMER_VERSION\s*=\s*'([^']+)'/)?.[1];
const PRE_ACCEPT = `try{localStorage.setItem('${DISC_KEY}','${DISC_VER}')}catch(e){}`;

function build(name) {
  const s = SERVERS[name];
  console.log(`building ${name} -> ${s.dist}`);
  const r = spawnSync('npm', ['run', 'build'], { cwd: APP, stdio: 'inherit', env: { ...process.env, ...s.env, NEXT_DIST_DIR: s.dist } });
  if (r.status !== 0) throw new Error(`build ${name} failed`);
}

async function waitHttp(url, ms = 60000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    try { const r = await fetch(url); if (r.status < 500) return; } catch {}
    await sleep(500);
  }
  throw new Error(`server ${url} did not come up`);
}

const children = [];
async function startServer(name) {
  const s = SERVERS[name];
  if (!existsSync(path.join(APP, s.dist, 'BUILD_ID'))) throw new Error(`no build in app/${s.dist}; run with --build`);
  const p = spawn('npx', ['next', 'start', '--port', String(s.port), '--hostname', '127.0.0.1'], { cwd: APP, env: { ...process.env, ...s.env, NEXT_DIST_DIR: s.dist }, stdio: 'ignore' });
  children.push(p);
  await waitHttp(`http://127.0.0.1:${s.port}/`);
  return `http://127.0.0.1:${s.port}`;
}
process.on('exit', () => children.forEach((c) => { try { c.kill('SIGTERM'); } catch {} }));

const settle = async (page, ms = 3500) => { await page.waitForLoadState('networkidle').catch(() => {}); await sleep(ms); };
const scrollTo = async (page, heading) => { const h = page.getByRole('heading', { name: heading }).first(); await h.scrollIntoViewIfNeeded().catch(() => {}); await page.evaluate(() => window.scrollBy(0, -140)); await sleep(800); };
const click = async (page, name, opts = {}) => page.getByRole('button', { name, exact: true, ...opts }).first().click();

// Testnet token pages (deployments/testnet.json): PDEMO still trading, PGRAD graduated 25 Oct (docs/DEMO-TESTNET.md).
const TESTNET = JSON.parse(readFileSync(path.join(ROOT, 'deployments/testnet.json'), 'utf8'));
const TRADING_TOKEN = TESTNET.demo.launchpad.first.curve;
const GRADUATED_TOKEN = TESTNET.demo.launchpad.graduated.token;

const SHOTS = [
  { id: 'landing', server: 'mainnet', kind: 'real mainnet data (read-only, no wallet)', desc: 'Landing page with live group cards', run: async (p, b) => { await p.goto(b + '/'); await settle(p, 5000); } },
  { id: 'wizard-market', server: 'mock', kind: 'MOCK mode (demo banner, no chain)', desc: 'Launch wizard, markets step with a market card', run: async (p, b) => { await p.goto(b + '/launch'); await settle(p, 1500); await p.getByLabel(/Group name/).fill('PitchDemo'); await click(p, 'Continue'); await settle(p, 1200); } },
  { id: 'wizard-review', server: 'mock', kind: 'MOCK mode (demo banner, no chain)', desc: 'Launch wizard review step listing every transaction', run: async (p, b) => {
      await p.goto(b + '/launch'); await settle(p, 1500);
      await p.getByLabel(/Group name/).fill('PitchDemo');
      await click(p, 'Continue'); await click(p, 'Continue');
      await p.getByLabel('Enable leverage for this group').check();
      await p.getByRole('button', { name: 'Discover and verify pool routes' }).click(); await sleep(1500);
      await click(p, 'Continue'); await click(p, 'Continue'); await settle(p, 1500);
      await p.getByRole('button', { name: 'Create demo group' }).waitFor({ timeout: 8000 }).catch(() => {});
    } },
  { id: 'group', server: 'mainnet', kind: 'real mainnet data (read-only, no wallet)', desc: 'Group 1 Meridian page: markets, yield routes, caps', run: async (p, b) => { await p.goto(b + '/groups/1'); await settle(p, 7000); } },
  { id: 'vaults', server: 'mainnet', kind: 'real mainnet registry data (read-only)', desc: 'Vault options panel (/vaults)', run: async (p, b) => { await p.goto(b + '/vaults'); await settle(p, 5000); } },
  { id: 'leverage', server: 'mainnet', kind: 'real mainnet data (read-only, no wallet)', desc: 'Group 1 Leverage tab', run: async (p, b) => { await p.goto(b + '/groups/1'); await settle(p, 6000); await click(p, 'Leverage'); await settle(p, 2500); } },
  { id: 'control', server: 'mainnet', kind: 'real mainnet data (read-only, no wallet)', desc: 'Control Panel for group 1 with staged-change and history sections', run: async (p, b) => { await p.goto(b + '/groups/1/control'); await settle(p, 9000); await scrollTo(p, 'Change history'); } },
  { id: 'control-mock', server: 'mock', kind: 'MOCK mode (demo banner, no chain)', desc: 'Control Panel in demo mode as group owner', run: async (p, b) => { await p.goto(b + '/groups/1/control'); await settle(p, 3500); await scrollTo(p, 'Change history'); } },
  { id: 'token-before', server: 'testnet', kind: 'real TESTNET data (read-only)', desc: 'Launched token still on its bonding curve (PDEMO), before graduation', run: async (p, b) => { await p.goto(b + '/token/' + TRADING_TOKEN); await settle(p, 7000); } },
  { id: 'token-after', server: 'testnet', kind: 'real TESTNET data (read-only)', desc: 'Graduated token (PGRAD): Aquarius pool, locked LP, own market group', run: async (p, b) => { await p.goto(b + '/token/' + GRADUATED_TOKEN); await settle(p, 7000); } },
];

mkdirSync(OUT, { recursive: true });
if (BUILD) for (const n of Object.keys(SERVERS)) build(n);

const wanted = SHOTS.filter((s) => !ONLY || ONLY.includes(s.id));
const needed = [...new Set(wanted.map((s) => s.server))];
const bases = {};
for (const n of needed) bases[n] = await startServer(n);

const browser = await chromium.launch();
const manifest = [];
for (const shot of wanted) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, colorScheme: 'dark' });
  await ctx.addInitScript(PRE_ACCEPT);
  const page = await ctx.newPage();
  page.__base = bases[shot.server];
  const rec = { id: shot.id, file: `docs/assets/pitch-${shot.id}.png`, server: shot.server, kind: shot.kind, description: shot.desc, capturedAt: new Date().toISOString() };
  try {
    await shot.run(page, bases[shot.server]);
    await page.screenshot({ path: path.join(OUT, `pitch-${shot.id}.png`), fullPage: false });
    rec.ok = true;
  } catch (e) { rec.ok = false; rec.error = String(e.message).slice(0, 300); }
  console.log(rec.ok ? `ok   ${shot.id}` : `FAIL ${shot.id}: ${rec.error}`);
  manifest.push(rec);
  await ctx.close();
}
await browser.close();
const mp = path.join(OUT, 'pitch-screenshots.json');
let old = []; try { old = JSON.parse(readFileSync(mp, 'utf8')); } catch {}
const merged = [...old.filter((o) => !manifest.some((m) => m.id === o.id)), ...manifest];
writeFileSync(mp, JSON.stringify(merged, null, 2));
children.forEach((c) => c.kill('SIGTERM'));
process.exit(0);
