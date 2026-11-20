/** The static demo: every screen works with no server; sample results are labelled as examples, own photos as local previews. */
import { test, expect } from '@playwright/test';
import { open, tidy, useSample, camera } from './kit.mjs';

test('the first open explains itself in seconds and one tap plays a sample', async ({ page }) => {
  const errors = await open(page, { intro: true });
  await expect(page.getByRole('heading', { name: /一张自拍/ })).toBeVisible();
  await expect(page.locator('.ob__steps li')).toHaveCount(3);
  await tidy(page);
  await page.getByRole('button', { name: '用示例玩', exact: true }).click();
  await expect(page.locator('.result')).toHaveAttribute('data-state', 'done', { timeout: 15000 });
  await expect(page.locator('.res__badges')).toContainText('示例成片');
  await expect(page.locator('.res__art')).toHaveClass(/is-in/);
  expect(errors).toEqual([]);
});

test('the live camera tracks a face and wears the style', async ({ page }) => {
  await open(page);
  await camera(page);
  await expect(page.locator('.live')).toHaveAttribute('data-cam', 'on');
  await expect(page.locator('.live')).toHaveClass(/has-face/, { timeout: 30000 });
  await page.locator('.live .pill', { hasText: '氛围出片' }).click();
  await expect(page.locator('.live__name')).toHaveText('复古CCD');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'ccd');
  for (const tool of ['compare', 'strength']) {
    await page.locator(`.tool[data-tool="${tool}"]`).click();
    await expect(page.locator(`.tool[data-tool="${tool}"]`)).toHaveAttribute('aria-pressed', 'true');
    await page.locator(`.tool[data-tool="${tool}"]`).click();
  }
  await tidy(page);
});

test('a denied camera leads gracefully to 上传精修', async ({ page }) => {
  await page.addInitScript(() => { navigator.mediaDevices.getUserMedia = () => Promise.reject(Object.assign(new Error('no'), { name: 'NotAllowedError' })); });
  await open(page);
  await camera(page);
  await expect(page.locator('.live')).toHaveAttribute('data-cam', 'denied');
  await expect(page.locator('.gate__text')).toContainText('照片');
  await page.locator('.gate .btn--ghost').click();
  await expect(page).toHaveURL(/#\/studio/);
});

test('one upload, any style, every step can be undone by going back', async ({ page }) => {
  await useSample(page, 2);
  await page.locator('.seg__opt', { hasText: '风格' }).click();
  await page.locator('.panel .pill', { hasText: '氛围出片' }).click();
  await page.locator('.card[data-style="neon"]').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'neon');
  await page.locator('.cta').click();
  await expect(page.locator('.frame')).toHaveAttribute('data-state', 'done', { timeout: 15000 });
  await expect(page.locator('.next')).toBeVisible();
  await tidy(page);
  await page.locator('.studio .chip', { hasText: '作品库' }).click();
  await expect(page.locator('.tile')).toHaveCount(1);
  await page.locator('.tile').click();
  await expect(page.locator('.trail__item')).toHaveCount(1);
  await page.locator('.work .bar__back').click();
  await page.locator('.gallery .bar__back').click();
  await expect(page).toHaveURL(/#\/studio/);
});

test('二次元 has six worlds, each wearing its own theme, and 样张 → 拍同款 opens the camera in that world', async ({ page }) => {
  await open(page);
  await camera(page);
  await page.locator('.live .pill', { hasText: '二次元' }).click();
  await expect(page.locator('.live .dot')).toHaveCount(6);
  for (const [id, theme] of [['magical', 'magical'], ['shonen', 'shonen'], ['ghibli', 'ghibli'], ['vtuber', 'vtuber']]) {
    await page.locator(`.live .dot[data-style="${id}"]`).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
  }
  await page.locator('.live__label').click();
  await expect(page.locator('.ex__person')).toHaveCount(6);
  await page.locator('.ex__person').nth(2).click();
  await page.locator('.ex__acts .btn--main').click();
  await expect(page).toHaveURL(/#\/live/);
  await expect(page.locator('.live__name')).toHaveText('虚拟主播');
  await tidy(page);
});

test('changing the style after a result brings back 一键变身', async ({ page }) => {
  await useSample(page, 1);
  await page.locator('.cta').click();
  await expect(page.locator('.frame')).toHaveAttribute('data-state', 'done', { timeout: 15000 });
  await expect(page.locator('.next')).toBeVisible();
  await page.locator('.next__btn', { hasText: '换个风格' }).click();
  await page.locator('.panel .pill', { hasText: '角色变身' }).click();
  await page.locator('.card[data-style="robocat"]').click();
  await expect(page.locator('.cta')).toBeVisible();
  await expect(page.locator('.cta__label')).toHaveText('一键变身');
  await page.locator('.frame__chip').click();
  await expect(page.locator('.ex__view')).toBeVisible();
});
