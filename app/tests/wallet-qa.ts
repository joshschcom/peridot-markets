/** Wallet QA checks with an Albedo protocol fixture. No keys, no signatures, no submissions.
 * Start a production build with mocks off, then:
 * WALLET_TEST_URL=http://127.0.0.1:3091 WALLET_TEST_BROWSER=chromium node --import tsx tests/wallet-qa.ts
 * WALLET_TEST_BROWSER=webkit works too (npx playwright install webkit once).
 * Set WALLET_TEST_SKIP_CHAIN=1 to skip the group page check that needs the public RPC.
 */
import assert from 'node:assert/strict';
import { chromium, webkit, expect, type BrowserContext, type Page } from '@playwright/test';

const account = 'GBTAM7KI53O5CMJW7QHS2TG7JX65H4Y2TGDXS42ZLJEK6YMGDBBZOOQD';
const base = process.env.WALLET_TEST_URL ?? 'http://127.0.0.1:3091';
type Gestures = { popupGestures: boolean[] };
/** Albedo stand-in. `delay: 'manual'` waits for the test to call window.__reply(). */
function fixture(mode: 'auto' | 'manual') {
  return `<!doctype html><title>Albedo protocol fixture</title><p id="state">fixture</p><script>
  let pending;
  window.addEventListener('message',event=>{
    if(event.source!==window.opener)return;
    const request=event.data;
    if(request.intent==='public_key'){
      pending={__reqid:request.__reqid,pubkey:${JSON.stringify(account)},intent:'public_key'};
      window.__reply=()=>window.opener.postMessage({albedoIntentResult:pending},event.origin);
      if(${mode === 'auto'})window.__reply();
    }
  });
  window.opener.postMessage({albedo:{protocol:3}},'*');
  </script>`;
}
async function newPage(context: BrowserContext): Promise<Page> {
  const page = await context.newPage();
  await page.addInitScript(() => {
    const original = window.open.bind(window);
    (window as unknown as Gestures).popupGestures = [];
    window.open = (...args) => { (window as unknown as Gestures).popupGestures.push(navigator.userActivation?.isActive ?? false); return original(...args); };
  });
  return page;
}
const gestures = (page: Page) => page.evaluate(() => (window as unknown as Gestures).popupGestures);

async function main() {
  const engine = process.env.WALLET_TEST_BROWSER === 'webkit' ? webkit : chromium;
  const browser = await engine.launch({ headless: true });
  const results: Record<string, boolean> = {};
  try {
    // 1. A slow first-time Albedo login (65 s) must not time out, and connect must run inside the click.
    {
      const context = await browser.newContext();
      let mode: 'auto' | 'manual' = 'manual';
      await context.route('https://albedo.link/confirm', route => route.fulfill({ contentType: 'text/html', body: fixture(mode) }));
      const page = await newPage(context);
      const response = await page.goto(base, { waitUntil: 'domcontentloaded' });
      const headers = response!.headers();
      assert.equal(headers['cross-origin-opener-policy'], undefined, 'COOP would sever the Albedo postMessage channel');
      assert.equal(headers['content-security-policy'], undefined);
      results.noCoopOrCsp = true;
      const connect = page.getByRole('button', { name: 'Connect wallet', exact: true });
      await expect(connect).toBeEnabled({ timeout: 60_000 });
      await page.clock.install();
      const popupReady = page.waitForEvent('popup');
      await connect.click();
      const popup = await popupReady;
      assert.deepEqual(await gestures(page), [true]);
      results.connectInGesture = true;
      // The popup's request is delivered asynchronously; wait until the fixture holds it.
      await popup.waitForFunction(() => typeof (window as unknown as { __reply?: unknown }).__reply === 'function', undefined, { timeout: 10_000 });
      await page.clock.fastForward(65_000);
      await expect(page.locator('.wallet-alert')).toHaveCount(0);
      await popup.evaluate(() => (window as unknown as { __reply: () => void }).__reply());
      await expect(page.locator('.wallet-button')).toContainText('GBTA', { timeout: 15_000 });
      results.slowLoginAccepted = true;
      await context.close();
    }
    // 2. Closing the Albedo window is reported within seconds and a retry works.
    {
      const context = await browser.newContext();
      await context.route('https://albedo.link/confirm', route => route.fulfill({ contentType: 'text/html', body: fixture('manual') }));
      const page = await newPage(context);
      await page.goto(base, { waitUntil: 'domcontentloaded' });
      const connect = page.getByRole('button', { name: 'Connect wallet', exact: true });
      await expect(connect).toBeEnabled({ timeout: 60_000 });
      const popupReady = page.waitForEvent('popup');
      await connect.click();
      const popup = await popupReady;
      await popup.waitForFunction(() => typeof (window as unknown as { __reply?: unknown }).__reply === 'function');
      await popup.close();
      await expect(page.locator('.wallet-alert')).toContainText('closed before it responded', { timeout: 8_000 });
      await expect(connect).toBeEnabled();
      results.closedWindowFastFail = true;
      await context.close();
    }
    // 3. A blocked popup fails at once and names the setting.
    {
      const context = await browser.newContext();
      const page = await newPage(context);
      await page.goto(base, { waitUntil: 'domcontentloaded' });
      const connect = page.getByRole('button', { name: 'Connect wallet', exact: true });
      await expect(connect).toBeEnabled({ timeout: 60_000 });
      await page.evaluate(() => { window.open = () => null; });
      await connect.click();
      await expect(page.locator('.wallet-alert')).toContainText('Allow pop-ups', { timeout: 3_000 });
      await expect(connect).toBeEnabled();
      results.blockedPopupFastFail = true;
      await context.close();
    }
    // 4. Wallet choice persists across reloads; a missing Freighter gives an actionable message.
    {
      const context = await browser.newContext();
      const page = await newPage(context);
      await page.goto(base, { waitUntil: 'domcontentloaded' });
      const provider = page.getByRole('combobox', { name: 'Wallet provider' });
      await expect(provider).toHaveValue('albedo', { timeout: 60_000 });
      await provider.selectOption('freighter');
      await page.reload({ waitUntil: 'domcontentloaded' });
      await expect(provider).toHaveValue('freighter', { timeout: 60_000 });
      const connect = page.getByRole('button', { name: 'Connect wallet', exact: true });
      await expect(connect).toBeEnabled({ timeout: 60_000 });
      await connect.click();
      await expect(page.locator('.wallet-alert')).toContainText('Freighter was not detected', { timeout: 15_000 });
      assert.deepEqual(await gestures(page), []);
      results.walletChoicePersists = true;
      results.missingFreighterMessage = true;
      await context.close();
    }
    // 5. Disconnected action buttons say Connect wallet and open the popup inside the click.
    if (!process.env.WALLET_TEST_SKIP_CHAIN) {
      const context = await browser.newContext();
      await context.route('https://albedo.link/confirm', route => route.fulfill({ contentType: 'text/html', body: fixture('auto') }));
      const page = await newPage(context);
      await page.goto(base, { waitUntil: 'domcontentloaded' });
      await page.getByRole('link', { name: 'Explore', exact: true }).first().click();
      await page.getByRole('link', { name: /Meridian/ }).first().click({ timeout: 90_000 });
      await page.getByRole('button', { name: /^Manage / }).first().click({ timeout: 90_000 });
      const panel = page.locator('aside.manage-panel');
      const submit = panel.getByRole('button', { name: 'Connect wallet', exact: true }).last();
      await expect(submit).toBeEnabled({ timeout: 30_000 });
      const popupReady = page.waitForEvent('popup');
      await submit.click();
      await popupReady;
      assert.deepEqual(await gestures(page), [true]);
      await expect(page.locator('.wallet-button')).toContainText('GBTA', { timeout: 30_000 });
      await expect(panel.getByRole('button', { name: 'Connect wallet' })).toHaveCount(0, { timeout: 30_000 });
      results.actionButtonConnects = true;
      await context.close();
    }
    console.log(JSON.stringify({ browser: engine.name(), ...results, realWalletAcceptance: false }));
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error instanceof Error ? error.stack : String(error)); process.exitCode = 1; });
