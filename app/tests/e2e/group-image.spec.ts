import { test, expect, type Page } from '@playwright/test';
import zlib from 'node:zlib';
import { disclaimerPreAcceptScript } from '../../src/lib/ui/risk-disclaimer';

test.beforeEach(async ({ page }) => { await page.addInitScript(disclaimerPreAcceptScript); });

/** A real, decodable gradient PNG so the browser can crop it. */
function makePng(width: number, height: number): Buffer {
  const raw = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 3 + 1)] = 0;
    for (let x = 0; x < width; x++) { const o = y * (width * 3 + 1) + 1 + x * 3; raw[o] = (x * 255 / width) | 0; raw[o + 1] = (y * 255 / height) | 0; raw[o + 2] = 160; }
  }
  const chunk = (type: string, data: Buffer) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const body = Buffer.concat([Buffer.from(type), data]); const crc = Buffer.alloc(4); crc.writeUInt32BE(zlib.crc32(body)); return Buffer.concat([len, body, crc]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
const upload = (page: Page, file: { name: string; mimeType: string; buffer: Buffer }) => page.locator('input[type="file"]').setInputFiles(file);

test('launch with an image, then see it on cards and the group page; owner can replace and remove it', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/launch');
  await page.getByLabel(/Group name/).fill('PicGroup');
  await expect(page.getByTestId('group-avatar').first()).toHaveAttribute('data-has-image', 'false');

  await upload(page, { name: 'logo.svg', mimeType: 'image/svg+xml', buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>') });
  await expect(page.getByRole('alert').filter({ hasText: 'Only PNG, JPEG and WebP' })).toBeVisible();

  await page.getByRole('button', { name: 'Image URL' }).click();
  await page.getByLabel('HTTPS image URL').fill('http://example.com/a.png');
  await page.getByRole('button', { name: 'Use this URL' }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'https' })).toBeVisible();
  await page.getByLabel('HTTPS image URL').fill('https://127.0.0.1/a.png');
  await page.getByRole('button', { name: 'Use this URL' }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'public host name' })).toBeVisible();

  await page.getByRole('button', { name: 'Upload', exact: true }).click();
  await upload(page, { name: 'logo.png', mimeType: 'image/png', buffer: makePng(200, 120) });
  await expect(page.getByLabel('Cropped preview')).toBeVisible();
  await page.getByLabel('Zoom').fill('1.5');
  await page.waitForTimeout(600);
  await page.screenshot({ path: '../docs/ui/groupimage-wizard.png', fullPage: false });

  for (let i = 0; i < 4; i++) await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByRole('button', { name: 'Create demo group' }).click();
  await expect(page.getByRole('heading', { name: 'Your group is ready' })).toBeVisible();
  await expect(page.getByText('Group image saved.')).toBeVisible();
  await page.getByRole('link', { name: /Open group #/ }).click();
  await expect(page.getByRole('heading', { name: 'PicGroup', level: 1 })).toBeVisible();
  const header = page.locator('.group-header-title [data-testid="group-avatar"]');
  await expect(header).toHaveAttribute('data-has-image', 'true');
  await expect(header.locator('img')).toHaveAttribute('referrerpolicy', 'no-referrer');
  await expect(header.locator('img')).toHaveCSS('opacity', '1');
  await page.screenshot({ path: '../docs/ui/groupimage-group-page.png' });

  await page.goto('/groups');
  const card = page.locator('article.group-card', { hasText: 'PicGroup' });
  await expect(card.getByTestId('group-avatar')).toHaveAttribute('data-has-image', 'true');
  await expect(card.locator('img')).toHaveCSS('opacity', '1');
  await expect(page.locator('article.group-card', { hasText: 'Meridian' }).getByTestId('group-avatar')).toHaveAttribute('data-has-image', 'false');
  await page.screenshot({ path: '../docs/ui/groupimage-groups.png' });

  // Owner Control Panel: remove, then set a URL image.
  const href = await card.getByRole('link', { name: /Open group/ }).getAttribute('href');
  await page.goto(`${href}/control`);
  await expect(page.getByRole('heading', { name: 'Group image' })).toBeVisible();
  await page.screenshot({ path: '../docs/ui/groupimage-control.png' });
  await page.getByRole('button', { name: 'Remove image' }).click();
  await expect(page.getByText('Group image removed.')).toBeVisible();
  await expect(page.locator('.group-image-preview [data-testid="group-avatar"]')).toHaveAttribute('data-has-image', 'false');
  await page.getByRole('button', { name: 'Image URL' }).click();
  await page.getByLabel('HTTPS image URL').fill('https://cdn.example.com/logo.png');
  await page.getByRole('button', { name: 'Use this URL' }).click();
  await page.getByRole('button', { name: 'Save image' }).click();
  await expect(page.getByText('Group image saved.')).toBeVisible();
  expect(errors).toEqual([]);
});
