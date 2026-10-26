import { test, expect } from '@playwright/test';
import { disclaimerPreAcceptScript } from '../../src/lib/ui/risk-disclaimer';

test.beforeEach(async ({ page }) => { await page.addInitScript(disclaimerPreAcceptScript); });

const MOCK_USDC = 'CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75';
const USDC_DEFINDEX = 'CAB4JOLSCNELJVDQKZLVGHKWJCLXFDBZZMITJAFL4GBGTHIKWO47PYFH';

test('vault options and the Aquarius registry list USDC pools and create a labelled demo vault', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));

  await page.goto('/vaults');
  await expect(page.getByRole('heading', { level: 1, name: /Where a market earns yield/ })).toBeVisible();

  // Every venue is listed with honest mainnet labels: created-vault kinds follow the manifest (zenex and xoxno registered, aquarius not yet).
  const venues = page.getByRole('group', { name: 'Yield venues' });
  for (const name of ['Keep in Peridot', 'Blend fee vault', 'DeFindex vault', 'Aquarius LP ladder vault', 'XOXNO lending vault', 'Zenex perps vault']) await expect(venues.getByText(name, { exact: true })).toBeVisible();
  await expect(venues.getByText('Coming soon, not active in this demo.')).toHaveCount(0);
  await expect(venues.getByText(/testnet/i)).toHaveCount(0);
  await expect(venues.getByText('Live on mainnet, customizable')).toHaveCount(2);
  await expect(venues.getByText('Registering on mainnet')).toHaveCount(1);
  await expect(venues.locator('[data-vault="aquarius"]')).toHaveAttribute('aria-disabled', 'true');
  await expect(venues.locator('[data-vault="xoxno"]')).toHaveAttribute('aria-disabled', 'false');
  await expect(venues.locator('[data-vault="zenex"]')).toHaveAttribute('aria-disabled', 'false');
  await expect(venues.locator('button.vault-option')).toHaveCount(0);
  // Rates never invent numbers: demo mode shows n/a with the reason in the tooltip.
  await expect(venues.getByTestId('yield-blend')).toContainText('n/a');
  await expect(page.getByRole('heading', { name: 'From a created vault to a market' })).toBeVisible();
  await expect(page.getByText(/set_yield_vault_allowed/).first()).toBeVisible();

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
  await expect(page.getByText('Demo mode', { exact: true })).toBeVisible();

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

test('the launch wizard vault step: fixed DeFindex default per token, created-vault venues, allow-list state, no free-form vault address', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(`console: ${m.text().slice(0, 200)}`); });
  await page.goto('/launch');
  await page.getByLabel(/Group name/).fill('VaultCheck');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  const all = page.getByRole('group', { name: 'All yield options' }).first();
  await expect(all).toBeVisible();
  // Aquarius is not registered on mainnet yet (manifest); DeFindex, Zenex and XOXNO are selectable (the demo draft starts with USDC verified).
  await expect(all.locator('[data-vault="aquarius"]')).toHaveAttribute('aria-disabled', 'true');
  await expect(all.locator('[data-vault="aquarius"]')).toContainText('Registering on mainnet');
  await expect(all.locator('[data-vault="defindex"]')).toHaveAttribute('aria-pressed', 'false');
  await expect(all.getByText('Coming soon, not active in this demo.')).toHaveCount(0);

  await all.getByRole('button', { name: /Zenex perps vault/ }).click();
  await expect(all.getByRole('button', { name: /Zenex perps vault/ })).toHaveAttribute('aria-pressed', 'true');
  const own = page.getByTestId('own-vault').first();
  await expect(own).toContainText('Your Zenex perps vault');
  await expect(own).toContainText('bind_market');
  await expect(own.getByLabel(/Zenex perps vault address/)).toBeVisible();

  await all.getByRole('button', { name: /Blend fee vault/ }).click();
  await expect(all.getByRole('button', { name: /Blend fee vault/ })).toHaveAttribute('aria-pressed', 'true');
  await all.getByRole('button', { name: /Keep in Peridot/ }).click();
  await expect(all.getByRole('button', { name: /Keep in Peridot/ })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('yield-idle').first()).toContainText('from your rate curve');

  // USDC market: DeFindex is the fixed Peridot USDC vault, read-only, with its allow-list state.
  await expect(page.getByLabel('Token contract address').first()).toHaveValue(MOCK_USDC);
  await all.getByRole('button', { name: /DeFindex vault/ }).click();
  const fixed = page.getByTestId('defindex-default').first();
  await expect(fixed).toContainText('Default DeFindex vault for USDC');
  await expect(fixed).toContainText(`${USDC_DEFINDEX.slice(0, 6)}`);
  await expect(fixed).toContainText('Approved by Peridot');
  await expect(fixed.locator('input')).toHaveCount(0);
  // No free-form vault address input anywhere in the DeFindex flow.
  await expect(page.locator('[id$="-vault"]')).toHaveCount(0);
  await expect(page.locator('[id$="-vault-choice"]')).toHaveCount(0);

  // Screenshots of the vault step: desktop dark and light, then mobile.
  const step = page.locator('.editor-step').nth(3).first();
  await step.scrollIntoViewIfNeeded();
  for (const theme of ['dark', 'light']) {
    await page.evaluate(t => document.documentElement.setAttribute('data-theme', t), theme);
    await step.screenshot({ path: `../docs/ui/vaultstep-desktop-${theme}.png` });
  }
  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
  await page.setViewportSize({ width: 375, height: 900 });
  await step.scrollIntoViewIfNeeded();
  await step.screenshot({ path: '../docs/ui/vaultstep-mobile.png' });
  // The vault step itself fits the phone width (the wizard header is outside this step's scope).
  const stepOverflow = await step.evaluate(el => Math.max(0, ...Array.from(el.querySelectorAll('*')).map(e => e.getBoundingClientRect().right)) - window.innerWidth);
  expect(stepOverflow).toBeLessThanOrEqual(0);
  expect(errors).toEqual([]);
});

test('the vaults page fits a 375px viewport', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto('/vaults');
  await expect(page.getByTestId('pool-row').first()).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  await page.screenshot({ path: '../docs/ui/vaultstep-venues-mobile.png', fullPage: false });
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
  await expect(panel).toContainText('Any token with an approved Reflector price and seven decimals');
  // A token without a Peridot DeFindex vault cannot pick DeFindex, with the reason on the card.
  const all = page.getByRole('group', { name: 'All yield options' }).first();
  await expect(all.locator('[data-vault="defindex"]')).toHaveAttribute('aria-disabled', 'true');
  await expect(all.locator('[data-vault="defindex"]')).toContainText('PDEMO has no Peridot DeFindex vault');

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
  await page.getByRole('button', { name: /^Token/ }).first().click();
  const search = page.getByRole('combobox', { name: 'Search token' });
  await search.fill('pdemo');
  await expect(page.getByRole('option', { name: /PDEMO/ }).first()).toHaveAttribute('id', /opt-0$/);
  await search.press('ArrowDown');
  await search.press('ArrowUp');
  await search.press('Enter');
  await expect(page.getByTestId('token-intake').first().getByText('Priced by Reflector')).toBeVisible();
  expect(errors).toEqual([]);
});

test('create a customizable XOXNO vault: validation bounds, summary, and a labelled demo result', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('/vaults');
  const form = page.locator('#create-vault');
  await form.locator('[data-kind="xoxno"]').click();
  await expect(form.locator('[data-kind="xoxno"]')).toHaveAttribute('aria-checked', 'true');
  await expect(form.getByText(/real XOXNO Lending deployment on mainnet/)).toBeVisible();

  await form.getByLabel('Asset (token contract)').fill('CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC');
  // The fee is bounded at 20% and the cap must cover the minimum deposit.
  await form.getByLabel('Performance fee').fill('25');
  await expect(form.getByText(/Performance fee must be at most 20/).first()).toBeVisible();
  await expect(form.getByRole('button', { name: 'Create demo vault' })).toBeDisabled();
  await form.getByLabel('Performance fee').fill('5');
  await form.getByLabel('Minimum deposit').fill('5000');
  await expect(form.getByText('The minimum deposit cannot exceed the deposit cap.').first()).toBeVisible();
  await form.getByLabel('Minimum deposit').fill('2');
  await form.getByLabel('Deposit cap').fill('250');
  await expect(form.getByText(/Deposits stop at 250 tokens/)).toBeVisible();
  await expect(form.getByText(/You \(the owner\) take 5% of the yield/)).toBeVisible();
  await expect(form.getByText(/Peridot admin can pause new deposits and upgrade the code/)).toBeVisible();
  await form.screenshot({ path: '../docs/ui/xoxno-create-vault.png' });
  await page.getByRole('group', { name: 'Yield venues' }).screenshot({ path: '../docs/ui/xoxno-venue-list.png' });

  await form.getByRole('button', { name: 'Create demo vault' }).click();
  await expect(page.getByText('Demo vault saved').first()).toBeVisible({ timeout: 30_000 });
  await form.screenshot({ path: '../docs/ui/xoxno-create-vault-result.png' });
  expect(errors).toEqual([]);
});

test('zenex vault kind: customizable form, bounds, preview, demo creation and honest labelling', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('/vaults');
  const venues = page.getByRole('group', { name: 'Yield venues' });
  await expect(venues.locator('[data-vault="zenex"]').getByText('Live on mainnet, customizable')).toBeVisible();
  await expect(venues.locator('[data-vault="zenex"]')).toContainText('async withdrawals');
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
