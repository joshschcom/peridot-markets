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
  await expect(venues.getByText('Coming soon, not active in this demo.')).toHaveCount(1);
  await expect(venues.getByText('Testnet, customizable')).toBeVisible();
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
  await expect(all.getByText('Coming soon, not active in this demo.')).toHaveCount(1);
  await all.getByRole('button', { name: /Blend fee vault/ }).click();
  await expect(all.getByRole('button', { name: /Blend fee vault/ })).toHaveAttribute('aria-pressed', 'true');
  await all.getByRole('button', { name: /Keep in Peridot/ }).click();
  await expect(all.getByRole('button', { name: /Keep in Peridot/ })).toHaveAttribute('aria-pressed', 'true');
});

test('the vaults page fits a 375px viewport', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto('/vaults');
  await expect(page.getByTestId('pool-row').first()).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

test('add market: paste a custom token, see its facts and pricing, and get blocked with a reason when it has no price', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('/launch');
  await page.getByLabel(/Group name/).fill('CustomTok');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  const token = page.getByLabel('Token contract address').first();

  // A priced custom token (demo PDEMO has a mock Reflector feed).
  await token.fill('CADQOBYHA4DQOBYHA4DQOBYHA4DQOBYHA4DQOBYHA4DQOBYHA4DQP5KR');
  await page.getByRole('button', { name: 'Verify token and price feed', exact: true }).first().click();
  const panel = page.getByTestId('token-intake').first();
  await expect(panel.getByText('Peridot Demo Token (PDEMO)')).toBeVisible();
  await expect(panel.getByText('1,000,000')).toBeVisible();
  await expect(panel.getByText('Priced by Reflector')).toBeVisible();
  await expect(panel).toContainText('Any token with a Reflector price and seven decimals');

  // An unpriced token: blocked with plain copy.
  await token.fill('CAEQSCIJBEEQSCIJBEEQSCIJBEEQSCIJBEEQSCIJBEEQSCIJBEEQTD2L');
  await page.getByRole('button', { name: 'Verify token and price feed', exact: true }).first().click();
  await expect(panel.getByText('No price source available, market blocked')).toBeVisible();
  await expect(panel.getByText(/can only be selected by markets that the launchpad creates/)).toBeVisible();

  // Not a token / not a contract: clear errors.
  await token.fill('CACQKBIFAUCQKBIFAUCQKBIFAUCQKBIFAUCQKBIFAUCQKBIFAUCQLC2U');
  await page.getByRole('button', { name: 'Verify token and price feed', exact: true }).first().click();
  await expect(page.getByText(/not a Soroban token contract/).first()).toBeVisible();
  await token.fill('GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF');
  await page.getByRole('button', { name: 'Verify token and price feed', exact: true }).first().click();
  await expect(page.getByText(/account address/).first()).toBeVisible();

  // Registry picker: search and pick a token, which verifies it.
  const registry = page.getByLabel('Pick from the Aquarius registry').first();
  await registry.fill('pdemo');
  await page.getByRole('group', { name: 'Registry tokens' }).first().getByRole('button', { name: /PDEMO/ }).click();
  await expect(page.getByTestId('token-intake').first().getByText('Priced by Reflector')).toBeVisible();
  expect(errors).toEqual([]);
});

test('create a customizable XOXNO vault: validation bounds, preview, and a labelled demo result', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('/vaults');
  const form = page.locator('#create-xoxno');
  await expect(form.getByRole('heading', { name: /Create a XOXNO Lending vault/ })).toBeVisible();
  await expect(form.getByText('Testnet, customizable')).toBeVisible();

  // The fee is bounded at 2000 bps and the cap must cover the minimum deposit.
  await form.getByLabel('Performance fee (bps)').fill('2500');
  await expect(form.getByText('A whole number from 0 to 2000.')).toBeVisible();
  await expect(form.getByRole('button', { name: 'Create demo XOXNO vault' })).toBeDisabled();
  await form.getByLabel('Performance fee (bps)').fill('500');
  await form.getByLabel('Minimum deposit').fill('5000');
  await expect(form.getByText('Cannot exceed the deposit cap.')).toBeVisible();
  await form.getByLabel('Minimum deposit').fill('2');
  await form.getByLabel('Deposit cap').fill('250');
  await expect(form.getByLabel('Vault preview')).toContainText('5.00% of yield');
  await expect(form.getByLabel('Vault preview')).toContainText('250 tokens');
  await expect(form.getByLabel('Vault preview')).toContainText('upgrade');

  await form.screenshot({ path: '../docs/ui/xoxno-create-vault.png' });
  await page.getByRole('group', { name: 'Yield venues' }).screenshot({ path: '../docs/ui/xoxno-venue-list.png' });
  await form.getByRole('button', { name: 'Create demo XOXNO vault' }).click();
  await expect(form.getByText('Demo vault recorded')).toBeVisible({ timeout: 30_000 });
  await form.screenshot({ path: '../docs/ui/xoxno-create-vault-result.png' });
  expect(errors).toEqual([]);
});
