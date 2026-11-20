/** The real server (simulator engine): the whole loop, the account, and nothing lost on reload. */
import { test, expect } from '@playwright/test';
import { open, tidy, useSample, camera } from './kit.mjs';

test('shutter → instant result → switch style without reshooting → tweak in 上传精修', async ({ page }) => {
  const errors = await open(page);
  await camera(page);
  await expect(page.locator('.live')).toHaveAttribute('data-cam', 'on');
  await page.locator('.shutter').click();
  await expect(page.locator('.result')).toBeVisible({ timeout: 10000 });
  await expect(page.locator('.prog__steps li')).toHaveCount(3);
  await expect(page.locator('.result')).toHaveAttribute('data-state', 'done', { timeout: 30000 });
  await expect(page.locator('.res__badges')).toContainText('模拟出片');
  await page.locator('.res__styles .dot').nth(1).click();
  await expect(page.locator('.result')).toHaveAttribute('data-state', 'working');
  await expect(page.locator('.result')).toHaveAttribute('data-state', 'done', { timeout: 30000 });
  await page.getByRole('button', { name: '微调细节' }).click();
  await expect(page).toHaveURL(/#\/studio/);
  await expect(page.locator('.seg__opt[aria-selected="true"]')).toHaveText('细节');
  await expect(page.locator('.versions .ver')).toHaveCount(3);
  await tidy(page);
  expect(errors).toEqual([]);
});

test('a generation can be cancelled and retried', async ({ page }) => {
  await useSample(page, 1);
  await page.locator('.cta').click();
  await page.locator('.frame .prog__stop').click();
  await expect(page.locator('.frame')).toHaveAttribute('data-state', 'stopped', { timeout: 15000 });
  await page.locator('.frame__fail .btn').click();
  await expect(page.locator('.frame')).toHaveAttribute('data-state', 'done', { timeout: 30000 });
});

test('works, favourites and drafts survive a reload, and signing up keeps them', async ({ page }) => {
  await useSample(page, 3);
  await page.locator('.seg__opt', { hasText: '细节' }).click();
  await page.locator('.chip2').first().click();
  await page.locator('.cta').click();
  await expect(page.locator('.frame')).toHaveAttribute('data-state', 'done', { timeout: 30000 });
  await page.locator('.seg__opt', { hasText: '风格' }).click();
  await page.locator('.card .card__fav').first().click();
  await page.reload();
  await expect(page.locator('.studio')).toHaveAttribute('data-has', 'photo');
  await expect(page.locator('.versions .ver:not(.ver--src)')).toHaveCount(1);
  await page.evaluate(() => { location.hash = '#/me'; });
  await page.getByRole('button', { name: '注册', exact: true }).click();
  await page.locator('.auth input').nth(0).fill('tester' + Date.now() % 100000);
  await page.locator('.auth input').nth(1).fill('secret123');
  await page.locator('.auth button[type=submit]').click();
  await expect(page.locator('.me__handle')).toContainText('@tester');
  await expect(page.locator('.me__stats li').first()).toContainText('1');
  await page.evaluate(() => indexedDB.deleteDatabase('hajixiu'));
  await page.reload();
  await page.evaluate(() => { location.hash = '#/gallery'; });
  await expect(page.locator('.tile')).toHaveCount(1, { timeout: 15000 });
});

for (const [w, h] of [[360, 640], [430, 932], [1280, 800]]) {
  test(`every screen is tidy at ${w}×${h}`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    await useSample(page, 0);
    for (const t of ['风格', '微调', '细节']) { await page.locator('.seg__opt', { hasText: t }).click(); await tidy(page); }
    for (const route of ['#/gallery', '#/me', '#/live']) { await page.evaluate(r => { location.hash = r; }, route); await page.waitForTimeout(400); await tidy(page); }
  });
}
