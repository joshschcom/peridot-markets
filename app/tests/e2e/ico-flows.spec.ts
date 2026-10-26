import { test, expect } from '@playwright/test';
import { disclaimerPreAcceptScript } from '../../src/lib/ui/risk-disclaimer';

test.beforeEach(async ({ page }) => { await page.addInitScript(disclaimerPreAcceptScript); });
for (const outcome of ['success', 'refund'] as const) {
  test(`ICO ${outcome}: create, buy, end, settle and persist`, async ({ page }) => {
    const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto('/launch-token');
    await page.getByRole('button', { name: 'ICO fixed price sale' }).click();
    await expect(page.getByRole('heading', { name: /Launch an ICO/ })).toBeVisible();
    await page.getByLabel('Name', { exact: true }).fill(`Browser ${outcome}`);
    await page.getByLabel('Symbol', { exact: true }).fill(outcome === 'success' ? 'WIN' : 'BACK');
    await page.getByLabel('Soft cap (XLM)', { exact: true }).fill(outcome === 'success' ? '10' : '100');
    await page.getByLabel('Hard cap (XLM)', { exact: true }).fill('200');
    await page.getByLabel(/I understand this is a testnet experiment/).check();
    await page.getByRole('button', { name: 'Create demo ICO' }).click();
    await expect(page.getByRole('heading', { name: 'Your ICO is live on testnet' })).toBeVisible();
    await page.getByRole('link', { name: 'Open ICO page' }).click();
    await expect(page.getByRole('heading', { level: 1, name: new RegExp(`Browser ${outcome}`) })).toBeVisible({ timeout: 60000 });
    await expect(page.locator('h1 [data-token-type="ico"]')).toBeVisible();
    await page.getByRole('button', { name: 'Start sale now (demo)' }).click();
    await page.getByLabel('Spend XLM').fill('201');
    await expect(page.getByText(/exceeds the remaining hard cap/)).toBeVisible();
    await page.getByLabel('Spend XLM').fill('20');
    await page.getByRole('button', { name: outcome === 'success' ? 'Buy WIN' : 'Buy BACK', exact: true }).click();
    await expect(page.getByText('Demo action saved. No onchain transaction.')).toBeVisible();
    await page.getByRole('button', { name: 'End sale now (demo)' }).click();
    await page.getByRole('button', { name: 'Finalize sale', exact: true }).click();
    if (outcome === 'success') {
      await page.getByRole('button', { name: 'Claim WIN', exact: true }).click();
      await expect(page.getByRole('button', { name: 'Tokens claimed' })).toBeDisabled();
      await page.getByRole('button', { name: 'Withdraw raise and unsold tokens' }).click();
    } else {
      await page.getByRole('button', { name: 'Refund XLM', exact: true }).click();
      await expect(page.getByRole('button', { name: 'Refund received' })).toBeDisabled();
      await page.getByRole('button', { name: 'Reclaim token supply' }).click();
    }
    await expect(page.getByRole('button', { name: 'Creator withdrawal complete' })).toBeDisabled();
    await page.reload();
    await expect(page.getByRole('button', { name: 'Creator withdrawal complete' })).toBeDisabled();
    await page.goto('/tokens');
    await page.getByRole('button', { name: /^ICO \(/ }).click();
    await expect(page.getByRole('article', { name: new RegExp(`Browser ${outcome}`) })).toBeVisible();
    expect(errors).toEqual([]);
  });
}

test('ICO form rejects impossible supply, caps and duration', async ({ page }) => {
  await page.goto('/launch-token'); await page.getByRole('button', { name: 'ICO fixed price sale' }).click();
  await page.getByLabel('Name', { exact: true }).fill('Guardrail Token'); await page.getByLabel('Symbol', { exact: true }).fill('GUARD');
  await page.getByLabel('Soft cap (XLM)', { exact: true }).fill('6000');
  await expect(page.getByText(/Soft cap must be above zero/)).toBeVisible();
  await page.getByLabel('Soft cap (XLM)', { exact: true }).fill('1000');
  await page.getByLabel('Total token supply', { exact: true }).fill('1');
  await expect(page.getByText(/Supply must cover the tokens/)).toBeVisible();
  await page.getByLabel('Total token supply', { exact: true }).fill('1000000');
  await page.getByLabel('Sale ends', { exact: true }).fill(await page.getByLabel('Sale starts', { exact: true }).inputValue());
  await expect(page.getByText(/sale must last between 10 minutes/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Create demo ICO' })).toBeDisabled();
});

test('ICO screenshots and 375px layout in both themes', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1080 });
  await page.goto('/token/mock-token-orbit?network=testnet');
  await expect(page.getByRole('heading', { level: 1, name: /Orbit Collective/ })).toBeVisible();
  await page.addStyleTag({ content: 'nextjs-portal { display: none; }' });
  for (const theme of ['dark', 'light']) {
    await page.evaluate(t => document.documentElement.setAttribute('data-theme', t), theme);
    await page.screenshot({ path: `../docs/ui/ico-desktop-${theme}.png`, fullPage: true, style: 'nextjs-portal { display: none !important; }' });
  }
  await page.setViewportSize({ width: 375, height: 812 });
  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  await page.screenshot({ path: '../docs/ui/ico-mobile-dark.png', fullPage: true, style: 'nextjs-portal { display: none !important; }' });
  await page.goto('/launch-token'); await page.getByRole('button', { name: 'ICO fixed price sale' }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: '../docs/ui/ico-create-mobile.png', fullPage: true, style: 'nextjs-portal { display: none !important; }' });
});
