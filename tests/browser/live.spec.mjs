/** The real server (simulator engine): the whole loop, every way of changing a picture, the account, and nothing lost on reload. */
import { test, expect } from '@playwright/test';
import { open, tidy, useSample, camera, tool, cta, make } from './kit.mjs';

test('shutter → instant result → switch style without reshooting → more takes → tweak in 上传精修', async ({ page, browserName }) => {
  test.skip(browserName === 'webkit', 'WebKit 没有假摄像头：拍照这一段只在 Chromium 里跑（WebKit 里测的是摄像头被拒后的上传路径）');
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
  // 撤回一步：回到换风格之前那一版，还能恢复
  await page.locator('.result .bar__right .ibtn').first().click();
  await expect(page.locator('.toast')).toContainText('已撤回');
  await page.locator('.result .bar__right .ibtn').nth(1).click();
  // 更多 → 多来几张：一次三张，右边一排小图随便挑
  await page.locator('.act', { hasText: '更多' }).click();
  await page.locator('.mitem', { hasText: '多来几张' }).click();
  await expect(page.locator('.res__sib')).toHaveCount(3);
  await expect(page.locator('.result')).toHaveAttribute('data-state', 'done', { timeout: 30000 });
  await page.locator('.res__sib').nth(2).click();
  await expect(page.locator('.res__sib').nth(2)).toHaveAttribute('aria-selected', 'true');
  await page.getByRole('button', { name: '微调细节' }).click();
  await expect(page).toHaveURL(/#\/studio/);
  await expect(page.locator('.tool2[aria-selected="true"]')).toHaveText('微调');
  await expect(page.locator('.versions .ver')).toHaveCount(6);
  await tidy(page);
  expect(errors).toEqual([]);
});

test('a generation can be cancelled and retried', async ({ page }) => {
  await useSample(page, 1);
  // 让请求慢一点（2.5 秒）：「停」一定还在屏幕上，慢的浏览器里也一样
  await page.route('**/api/turns', async r => { await new Promise(res => setTimeout(res, 2500)); await r.continue().catch(() => {}); });
  await cta(page).click();
  await page.locator('.frame .prog__stop').click();
  await expect(page.locator('.frame')).toHaveAttribute('data-state', 'stopped', { timeout: 15000 });
  await page.locator('.frame__fail .btn--main').click();
  await expect(page.locator('.frame')).toHaveAttribute('data-state', 'done', { timeout: 30000 });
});

test('部位精修 sends one mask per part and only those parts change; the studio answers with three ideas', async ({ page }) => {
  const errors = await open(page);
  await useSample(page, 0);
  await make(page);
  await tool(page, '部位');
  await expect(page.locator('.pp__hint')).not.toContainText('正在认脸', { timeout: 30000 });
  await page.locator('.pp__part', { hasText: '刘海' }).click();
  await page.locator('.pp__opt', { hasText: '八字刘海' }).click();
  await page.locator('.pp__part', { hasText: '唇妆' }).click();
  await page.locator('.pp__opt', { hasText: '豆沙' }).click();
  await expect(cta(page).locator('.cta__label')).toHaveText('精修这 2 处');
  const sent = page.waitForRequest(r => r.url().endsWith('/api/turns') && r.method() === 'POST');
  await cta(page).click();
  const region = (await sent).postDataJSON();
  await expect(page.locator('.ver[data-op="region"]')).toHaveCount(1);
  await expect(page.locator('.frame')).toHaveAttribute('data-state', 'done', { timeout: 30000 });
  expect(region.intent.op).toBe('region');
  expect(region.pins).toHaveLength(2);
  expect(region.pins.every(p => p.mask)).toBe(true);
  expect(region.say).toContain('八字刘海');
  await tool(page, '对话');
  await expect(page.locator('.chat__ideas .chip2--idea')).toHaveCount(3);
  expect(errors).toEqual([]);
});

test('对话微调：一句话改一版，回复和「接着改」都在对话里，点缩略图回到任何一版', async ({ page }) => {
  const errors = await open(page);
  await useSample(page, 2);
  await make(page);
  await tool(page, '对话');
  await page.locator('.chat__field').fill('背景换成海边日落');
  await page.locator('.chat__send').click();
  await expect(page.locator('.msg--me').last()).toHaveText('背景换成海边日落');
  await expect(page.locator('.msg--ai').last().locator('.msg__thumb[data-state="done"]')).toHaveCount(1, { timeout: 30000 });
  await expect(page.locator('.chat__ideas .chip2--idea')).toHaveCount(3);
  await page.locator('.chat__ideas .chip2--idea').first().click();
  await expect(page.locator('.chat__field')).not.toHaveValue('');
  await page.locator('.msg__thumb').first().click();
  await expect(page.locator('.msg__thumb').first()).toHaveAttribute('aria-pressed', 'true');
  await page.locator('.chat__q', { hasText: '多来几张' }).click();
  await expect(page.locator('.msg--ai').last().locator('.msg__thumb')).toHaveCount(3);
  await expect(page.locator('.msg--ai').last().locator('.msg__thumb[data-state="done"]')).toHaveCount(3, { timeout: 30000 });
  await tidy(page);
  expect(errors).toEqual([]);
});

test('works, favourites, drafts and the undo history survive a reload, and signing up keeps them', async ({ page }) => {
  await useSample(page, 3);
  await tool(page, '细节');
  await page.locator('.dgroup .chip2').first().click();
  await make(page);
  await tool(page, '风格');
  await page.locator('.scard .scard__fav').first().click();
  await page.reload();
  await expect(page.locator('.studio')).toHaveAttribute('data-has', 'photo');
  await expect(page.locator('.studio')).toHaveAttribute('data-panel', 'style');
  await expect(page.locator('.versions .ver:not(.ver--src)')).toHaveCount(1);
  await expect(page.getByRole('button', { name: '撤回一步' }).first()).toBeEnabled();
  await page.evaluate(() => { location.hash = '#/me'; });
  await page.locator('.me__row', { hasText: '我的口味' }).click();
  await page.locator('.sheet textarea').fill('保留我的痣');
  await page.locator('.sheet .btn--main').click();
  await expect(page.locator('.me__row', { hasText: '我的口味' })).toContainText('保留我的痣');
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
    await tidy(page);
    for (const t of ['风格', '微调', '细节', '部位', '对话']) { await tool(page, t); await tidy(page); }
    for (const route of ['#/gallery', '#/me', '#/live']) { await page.evaluate(r => { location.hash = r; }, route); await page.waitForTimeout(400); await tidy(page); }
  });
}
