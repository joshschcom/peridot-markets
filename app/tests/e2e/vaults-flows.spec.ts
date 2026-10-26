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

  // Pick a pool, configure the ladder, create a demo vault (mock mode keeps it in the browser).
  await page.getByRole('button', { name: 'Create a vault for USDC/EURC' }).click();
  await expect(page.getByRole('heading', { name: 'Create a vault', exact: true })).toBeVisible();
  await expect(page.locator('#vf-pool')).toHaveValue(/^C/);
  await expect(page.getByTestId('ladder-preview')).toBeVisible();
  await expect(page.getByText('Demo mode')).toBeVisible();

  // Live validation: out-of-range values block submission and say why.
  await page.locator('#vf-rungs').fill('9');
  await expect(page.getByRole('button', { name: 'Create demo vault' })).toBeDisabled();
  await expect(page.getByText(/Rungs must be at most 7/).first()).toBeVisible();
  await page.locator('#vf-rungs').fill('3');
  await expect(page.getByRole('listitem').filter({ hasText: /^Rung 3/ })).toHaveCount(1);
  await page.locator('#vf-shape').selectOption('2');
  await page.locator('#vf-fee').fill('25');
  await expect(page.getByRole('button', { name: 'Create demo vault' })).toBeDisabled();
  await page.locator('#vf-fee').fill('10');
  await page.getByRole('button', { name: 'Create demo vault' }).click();
  await expect(page.getByText('Demo vault saved').first()).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('my-vault')).toHaveCount(1);
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

test('zenex vault kind: customizable form, bounds, preview, demo creation and honest labelling', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('/vaults');
  const venues = page.getByRole('group', { name: 'Yield venues' });
  await expect(venues.locator('[data-vault="zenex"]').getByText('Testnet, customizable')).toBeVisible();
  await page.screenshot({ path: '../docs/ui/zenex-venues.png', fullPage: true });

  await page.locator('[data-kind="zenex"]').click();
  await expect(page.getByText('Zenex strategy vault', { exact: true })).toBeVisible();
  await expect(page.locator('#vf-targetBuffer')).toHaveValue('30');
  await expect(page.getByText('How a deposit is split')).toBeVisible();
  await expect(page.locator('#vf-zenexMarket')).toHaveValue(/^C/);

  // Bounds mirror the contract: buffer below 20% and a cap above Zenex's own limit are refused with a reason.
  await page.locator('#vf-targetBuffer').fill('10');
  await expect(page.getByRole('button', { name: 'Create demo vault' })).toBeDisabled();
  await expect(page.getByText(/Liquid buffer must be at least 20/).first()).toBeVisible();
  await page.locator('#vf-targetBuffer').fill('40');
  await page.locator('#vf-cap').fill('200000');
  await expect(page.getByText(/Deposit cap must be at most 100000/).first()).toBeVisible();
  await page.locator('#vf-cap').fill('500');
  await page.locator('#vf-haircut').fill('3');
  await expect(page.getByRole('button', { name: 'Create demo vault' })).toBeEnabled();
  await page.screenshot({ path: '../docs/ui/zenex-create.png', fullPage: true });
  await page.getByRole('button', { name: 'Create demo vault' }).click();
  await expect(page.getByText('Demo vault saved').first()).toBeVisible({ timeout: 30_000 });
  await page.screenshot({ path: '../docs/ui/zenex-created.png', fullPage: true });

  await page.setViewportSize({ width: 375, height: 800 });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  expect(errors).toEqual([]);
});
