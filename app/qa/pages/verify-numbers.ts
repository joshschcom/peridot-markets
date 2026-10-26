/** Compare numbers rendered on the live group pages with direct contract reads. Needs the read-only server on QA_BASE and QA_NETWORK=mainnet. */
import '../lib/bootstrap';
import { chromium } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { getGroup, getMarketConfig } from '../../src/lib/peridot/factory';
import { readMarket, readRewards } from '../../src/lib/peridot/group-client';
import { formatAmount } from '../../src/lib/peridot/amount';

const BASE = process.env.QA_BASE || 'http://127.0.0.1:3055';
const compact = (v: bigint, dec: number) => { const n = Number(formatAmount(v, dec)); return n < 1e4 ? n.toLocaleString('en-US') : n >= 1e6 ? `${+(n / 1e6).toFixed(2)}M` : n >= 1e3 ? `${+(n / 1e3).toFixed(2)}K` : String(+n.toFixed(2)); };
const trim = (s: string) => s.replace(/\.0+$/, '');
(async () => {
  const browser = await chromium.launch(); const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const rows: any[] = [];
  for (const gid of [1, 2, 3]) {
    const group = await getGroup(gid);
    await page.goto(`${BASE}/groups/${gid}`, { waitUntil: 'networkidle', timeout: 60000 }); await page.waitForTimeout(3000);
    const text = (await page.locator('body').innerText()).replace(/\s+/g, ' ');
    for (const m of group.markets) {
      const cfg = await getMarketConfig(gid, m); const v = await readMarket(group, m, cfg, null);
      const d = v.token.decimals; const sym = v.token.symbol;
      const expect: Record<string, string> = {
        supplied: `${sym} ${trim(formatAmount(v.supplied, d))} supplied`,
        borrowed: `${trim(formatAmount(v.borrowed, d))} borrowed`,
        supplyCap: `of ${compact(cfg.supply_cap, d)}`,
        borrowCap: `of ${compact(cfg.borrow_cap, d)}`,
        cf: `${Number(cfg.collateral_factor) / 10000}%`,
        liquidBuffer: `${cfg.idle_buffer_bps / 100}% liquid buffer`,
      };
      for (const [k, want] of Object.entries(expect)) rows.push({ group: gid, market: sym, field: k, expected: want, found: text.includes(want) });
    }
    if (group.reward_distributor) {
      const r = await readRewards(group, null);
      const want = `Distributor funding ${trim(formatAmount(r!.available, r!.token.decimals))}${r!.token.symbol}`;
      rows.push({ group: gid, market: '-', field: 'distributorFunding', expected: want, found: text.includes(want) });
      const cfg = await getMarketConfig(gid, group.markets[0]);
      const perDay = Math.floor(Number(cfg.supply_reward_per_sec) * 86400 / 10 ** r!.token.decimals * 100) / 100; // the page truncates to 2 decimals
      rows.push({ group: gid, market: '-', field: 'rewardsPerDay', expected: `${perDay.toFixed(2)} ${r!.token.symbol}/day`, found: text.includes(`${perDay.toFixed(2)} ${r!.token.symbol}/day`) });
    }
  }
  await browser.close();
  writeFileSync(resolve(__dirname, '../out/page-numbers.json'), JSON.stringify(rows, null, 2));
  for (const r of rows) console.log(`${r.found ? 'MATCH   ' : 'MISMATCH'} g${r.group} ${r.market} ${r.field}: ${r.expected}`);
})();
