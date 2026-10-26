import { test, expect } from '@playwright/test';
import { disclaimerPreAcceptScript } from '../../src/lib/ui/risk-disclaimer';

test.beforeEach(async ({ page }) => { await page.addInitScript(disclaimerPreAcceptScript); });

test('vault options and the Aquarius registry list USDC pools and create a labelled demo vault', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));

  await page.goto('/vaults');
  await expect(page.getByRole('heading', { level: 1, name: /Where a market earns yield/ })).toBeVisible();

  // Every venue is listed; XOXNO and Zenex are honest about not being active.
  const venues = page.getByRole('group', { name: 'Yield venues' });
  for (const name of ['Keep in Peridot', 'Blend fee vault', 'DeFindex vault', 'Aquarius LP vault', 'XOXNO Lending', 'Zenex perps vault']) await expect(venues.getByText(name, { exact: true })).toBeVisible();
  await expect(venues.getByText('Coming soon, not active in this demo.')).toHaveCount(2);
  await expect(venues.locator('[data-vault="xoxno"]')).toHaveAttribute('aria-disabled', 'true');
  await expect(venues.locator('button')).toHaveCount(0);

  // Registry: demo data, USDC pairs, non-concentrated pools cannot get a vault.
  await expect(page.getByText('Demo data', { exact: true }).first()).toBeVisible();
  await expect(page.getByTestId('pool-row').first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Create a vault for XLM/USDC' })).toBeDisabled();
  await page.getByRole('button', { name: /Vault eligible/ }).click();
  await expect(page.getByTestId('pool-row')).toHaveCount(2);
  await page.getByLabel('Search pools').fill('pyusd');
  await expect(page.getByTestId('pool-row')).toHaveCount(1);
  await page.getByLabel('Search pools').fill('');

  // Create a demo vault on USDC/EURC.
  await page.getByRole('button', { name: 'Create a vault for USDC/EURC' }).click();
  await expect(page.getByRole('heading', { name: 'Create a vault for USDC/EURC' })).toBeVisible();
  await expect(page.getByText('Demo flow: nothing is deployed')).toBeVisible();
  await expect(page.getByText('Contract missing')).toHaveCount(3);
  await page.getByLabel('Kept liquid (%)').fill('10');
  await expect(page.getByText(/Keep at least 30% liquid/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Create demo vault' })).toBeDisabled();
  await page.getByLabel('Kept liquid (%)').fill('30');
  await page.getByRole('button', { name: 'Create demo vault' }).click();
  await expect(page.getByText('Demo vault saved')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('demo-vault')).toHaveCount(1);
  await expect(page.getByText('Demo, not deployed')).toBeVisible();
  expect(errors).toEqual([]);
});

test('the launch wizard shows locked XOXNO and Zenex options and still lets live routes be chosen', async ({ page }) => {
  await page.goto('/launch');
  await page.getByLabel(/Group name/).fill('VaultCheck');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  const all = page.getByRole('group', { name: 'All yield options' }).first();
  await expect(all).toBeVisible();
  await expect(all.locator('[data-vault="xoxno"]')).toHaveAttribute('aria-disabled', 'true');
  await expect(all.locator('[data-vault="zenex"]')).toHaveAttribute('aria-disabled', 'true');
  await expect(all.getByText('Coming soon, not active in this demo.')).toHaveCount(2);
  await all.getByRole('button', { name: /Blend fee vault/ }).click();
  await expect(all.getByRole('button', { name: /Blend fee vault/ })).toHaveAttribute('aria-pressed', 'true');
  await all.getByRole('button', { name: /Keep in Peridot/ }).click();
  await expect(all.getByRole('button', { name: /Keep in Peridot/ })).toHaveAttribute('aria-pressed', 'true');
});
