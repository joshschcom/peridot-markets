/** Read-only page sweep against a running production build (mainnet data, NEXT_PUBLIC_READ_ONLY=true).
 *  usage: QA_BASE=http://127.0.0.1:3055 npx tsx qa/pages/check-pages.ts */
import { chromium, type ConsoleMessage } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const BASE = process.env.QA_BASE || 'http://127.0.0.1:3055';
const OUT = resolve(__dirname, '../../../docs/qa/screens');
mkdirSync(OUT, { recursive: true });
const pages = ['/', '/groups', '/groups/1', '/groups/2', '/groups/3', '/groups/1/control', '/groups/2/control', '/groups/3/control', '/launch', '/about', '/groups/99', '/groups/abc', '/nope'];
(async () => {
  const browser = await chromium.launch();
  const results: any[] = [];
  for (const theme of ['dark', 'light'] as const) for (const vp of [{ w: 1440, h: 900, tag: 'desktop' }, { w: 375, h: 812, tag: 'mobile' }]) {
    if (theme === 'light' && vp.tag === 'mobile') continue;
    const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, colorScheme: theme });
    for (const path of pages) {
      const page = await ctx.newPage();
      const consoleErrors: string[] = [], warnings: string[] = [], failed: string[] = [], bad: string[] = [], pageErrors: string[] = [];
      page.on('console', (m: ConsoleMessage) => { const t = m.text(); if (m.type() === 'error') consoleErrors.push(t.slice(0, 300)); if (/hydrat|did not match|Warning:/i.test(t)) warnings.push(t.slice(0, 300)); });
      page.on('pageerror', e => pageErrors.push(String(e).slice(0, 300)));
      page.on('requestfailed', r => failed.push(`${r.method()} ${r.url().slice(0, 120)} ${r.failure()?.errorText}`));
      page.on('response', r => { if (r.status() >= 400) bad.push(`${r.status()} ${r.url().slice(0, 120)}`); });
      const t0 = Date.now();
      let status = 0;
      try { const resp = await page.goto(BASE + path, { waitUntil: 'networkidle', timeout: 60000 }); status = resp?.status() ?? 0; } catch (e) { pageErrors.push('goto: ' + String(e).slice(0, 200)); }
      await page.waitForTimeout(2500);
      const text = (await page.locator('body').innerText().catch(() => '')).slice(0, 6000);
      const name = `${theme}-${vp.tag}-${path === '/' ? 'home' : path.replace(/\//g, '_').replace(/^_/, '')}`;
      await page.screenshot({ path: resolve(OUT, name + '.png'), fullPage: true }).catch(() => undefined);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1).catch(() => false);
      results.push({ theme, viewport: vp.tag, path, status, ms: Date.now() - t0, consoleErrors, hydrationWarnings: warnings, pageErrors, failedRequests: failed.slice(0, 10), badResponses: bad.slice(0, 10), horizontalOverflow: overflow, text: vp.tag === 'desktop' && theme === 'dark' ? text : undefined, screenshot: name + '.png' });
      console.log(`${status} ${theme}/${vp.tag} ${path} err=${consoleErrors.length} pageErr=${pageErrors.length} failed=${failed.length} bad=${bad.length} overflow=${overflow}`);
      await page.close();
    }
    await ctx.close();
  }
  await browser.close();
  writeFileSync(resolve(__dirname, '../out/pages.json'), JSON.stringify(results, null, 2));
})();
