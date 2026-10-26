import { test, expect } from '@playwright/test';
import { disclaimerPreAcceptScript } from '../../src/lib/ui/risk-disclaimer';

test.beforeEach(async ({ page }) => { await page.addInitScript(disclaimerPreAcceptScript); });

test('launch a test token, trade, reach a target, graduate in six steps and claim a group in demo mode', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));

  // Launch: one transaction with a small creator buy (creator buys are capped at 5% of the curve supply).
  await page.goto('/launch-token');
  await expect(page.getByRole('heading', { name: 'Launch a token' })).toBeVisible();
  await page.getByRole('button', { name: 'Bonding curve launch' }).click();
  await expect(page.getByRole('heading', { name: /Launch a test token/ })).toBeVisible();
  await expect(page.getByText('Testnet', { exact: true }).first()).toBeVisible();
  await page.getByLabel('Name', { exact: true }).fill('Browser Fox');
  await page.getByLabel('Symbol', { exact: true }).fill('e2e');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByText('Fast', { exact: true }).click();
  await expect(page.getByRole('radio', { name: /^Fast/ })).toBeChecked();
  await page.getByLabel('Creator buy in XLM (optional)').fill('10');
  await expect(page.getByText(/above the creator cap/)).toBeVisible();
  await page.getByLabel('Creator buy in XLM (optional)').fill('1');
  await expect(page.getByText(/You would receive about/)).toBeVisible();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(page.getByText(/launch_curve\(creator, name, symbol/)).toBeVisible();
  await expect(page.getByText('New tokens are highly risky. Prices can go to zero. Peridot does not vet projects. Testnet only.').first()).toBeVisible();
  await page.getByLabel(/I understand this is a testnet experiment/).check();
  await page.getByRole('button', { name: 'Create demo token' }).click();
  await expect(page.getByRole('heading', { name: 'Your token is live on testnet' })).toBeVisible();
  await page.getByRole('link', { name: 'Open token page' }).click();
  await expect(page).toHaveURL(/\/token\/mock-token-e2e$/);
  await expect(page.getByRole('heading', { level: 1, name: /Browser Fox/ })).toBeVisible();
  await expect(page.locator('h1 [data-token-type="curve"]')).toBeVisible();
  await expect(page.getByText('Trading', { exact: true }).first()).toBeVisible();
  await expect(page.getByText(/Creator cap: your buys are limited/)).toBeVisible();

  // Buy a little more as the creator, then sell part of it back to the curve.
  await page.getByLabel('Spend XLM').fill('1');
  await expect(page.getByText('You receive', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Buy E2E', exact: true }).click();
  await expect(page.getByText('Demo action saved. No onchain transaction.')).toBeVisible();
  await page.getByRole('button', { name: 'Sell', exact: true }).click();
  await page.getByLabel('Sell E2E').fill('1000');
  await expect(page.getByText('You receive', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Sell E2E', exact: true }).click();
  await expect(page.getByText('Demo action saved. No onchain transaction.')).toBeVisible();

  // Another creator's token: a buy above the remaining target is clamped and makes the curve graduatable.
  await page.goto('/token/mock-token-moon');
  await expect(page.getByRole('heading', { level: 1, name: /Meridian Moon/ })).toBeVisible();
  await page.getByLabel('Spend XLM').fill('60000');
  await expect(page.getByText(/Your buy will be partly filled to land exactly on the target/)).toBeVisible();
  await page.getByRole('button', { name: 'Buy MOON', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Ready to graduate' })).toBeVisible();
  await expect(page.getByText('0 of 6 steps')).toBeVisible();
  await expect(page.getByText('Buys are closed: the curve reached its target.')).toBeVisible();

  // Six permissionless steps; step 1 needs the demo wallet's AQUA.
  await expect(page.getByText(/Your balance: 5 AQUA/)).toBeVisible();
  for (const [index, short] of ['Pool', 'Group', 'XLM market', 'Activate XLM', 'Token market', 'Done'].entries()) {
    await page.getByRole('button', { name: `Run step ${index + 1}: ${short}`, exact: true }).click();
    if (index < 5) await expect(page.getByText(`${index + 1} of 6 steps`)).toBeVisible();
  }
  await expect(page.getByRole('heading', { name: 'Graduated', exact: true })).toBeVisible();
  await expect(page.getByText(/Liquidity locked permanently/)).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Lending market live' })).toBeVisible();
  await expect(page.getByRole('link', { name: /Open lending market/ })).toHaveAttribute('href', /\/groups\/\d+$/);
  await expect(page.getByText(/The creator can take ownership with claim_group/)).toBeVisible();
  await expect(page.getByText(/now trades in its Aquarius pool/)).toBeVisible();

  // The demo wallet created PGRAD, which graduated earlier: it can claim that group.
  await page.goto('/token/mock-token-pgrad');
  await page.getByRole('button', { name: 'Claim your group', exact: true }).click();
  await expect(page.getByText(/The creator claimed the group/)).toBeVisible();

  // The list reflects the new states.
  await page.goto('/tokens');
  await page.getByRole('button', { name: /^Graduated \(2\)/ }).click();
  await expect(page.getByRole('article', { name: 'Meridian Moon (MOON)' })).toBeVisible();
  await expect(page.getByRole('article', { name: 'Peridot Graduate (PGRAD)' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('launchpad routes fit a 375px viewport and resolve a curve address', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  for (const route of ['/tokens', '/launch-token', '/token/mock-token-pgrad', '/token/mock-token-fox', '/token/mock-token-moon']) {
    await page.goto(route); await page.waitForLoadState('networkidle');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), route).toBeTruthy();
  }
  await page.goto('/token/mock-curve-pgrad');
  await expect(page.getByRole('heading', { level: 1, name: /Peridot Graduate/ })).toBeVisible();
  await page.goto('/token/mock-token-unknown');
  await expect(page.getByRole('heading', { name: 'Token unavailable' })).toBeVisible();
});

test('simple token: choose the plain path, create it in one step and find it tagged Plain in the list', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('/launch-token');
  await expect(page.getByRole('button', { name: 'Simple token (no curve, no ICO)' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Bonding curve launch' })).toBeVisible();
  await expect(page.getByText('Coming later')).toBeVisible();
  await expect(page.getByText('Rises automatically as people buy.')).toBeVisible();
  await expect(page.getByText('Fixed by you.')).toBeVisible();
  await expect(page.getByText('Nobody, until you share or list the token.')).toBeVisible();
  await page.getByRole('button', { name: 'Simple token (no curve, no ICO)' }).click();
  await expect(page.getByRole('heading', { name: /Create a simple token/ })).toBeVisible();
  await expect(page.getByLabel('Decimals')).toBeDisabled();

  const create = page.getByRole('button', { name: 'Create demo token' });
  await expect(create).toBeDisabled();
  await page.getByLabel('Name', { exact: true }).fill('Plain Fox');
  await page.getByLabel('Symbol', { exact: true }).fill('pfox');
  await page.getByLabel('Total supply (whole tokens)').fill('0');
  await expect(page.getByText(/Supply must be a whole number between 1 and/).first()).toBeVisible();
  await page.getByLabel('Total supply (whole tokens)').fill('2500000');
  await expect(create).toBeDisabled();
  await page.getByLabel(/I understand this is a testnet experiment/).check();
  await expect(create).toBeEnabled();
  await create.click();
  await expect(page.getByRole('heading', { name: 'Your token is live on testnet' })).toBeVisible();
  await expect(page.getByText('Later: add a Peridot market')).toBeVisible();

  await page.getByRole('link', { name: 'Open token page' }).click();
  await expect(page).toHaveURL(/\/token\/mock-plain-pfox$/);
  await expect(page.getByRole('heading', { level: 1, name: /Plain Fox/ })).toBeVisible();
  await expect(page.locator('h1 [data-token-type="simple"]')).toBeVisible();
  await expect(page.getByText('Later: add a Peridot market')).toBeVisible();

  await page.goto('/tokens');
  await page.getByRole('button', { name: /^Simple \(1\)/ }).click();
  await expect(page.getByRole('article', { name: 'Plain Fox (PFOX), simple token' }).locator('[data-token-type="simple"]')).toBeVisible();
  await page.getByRole('button', { name: /^All \(/ }).click();
  await expect(page.getByRole('article', { name: 'Meridian Moon (MOON)' }).locator('[data-token-type="curve"]')).toBeVisible();
  expect(errors).toEqual([]);
});

test('simple token routes fit a 375px viewport', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/launch-token'); await page.waitForLoadState('networkidle');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'chooser').toBeTruthy();
  await page.getByRole('button', { name: 'Simple token (no curve, no ICO)' }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'simple form').toBeTruthy();
});
