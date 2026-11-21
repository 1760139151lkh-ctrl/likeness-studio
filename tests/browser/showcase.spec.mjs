/** The static demo: every screen works with no server; sample results are labelled as examples, own photos as local previews. */
import { test, expect } from '@playwright/test';
import { open, tidy, useSample, camera, tool, cta, make, keyboardUp, keyboardDown } from './kit.mjs';
import { PRESETS } from '../../web/js/presets.js';

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
  for (const t of ['compare', 'strength']) {
    await page.locator(`.tool[data-tool="${t}"]`).click();
    await expect(page.locator(`.tool[data-tool="${t}"]`)).toHaveAttribute('aria-pressed', 'true');
    await page.locator(`.tool[data-tool="${t}"]`).click();
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

test('one upload, any style; every change can be undone and redone, even after a reload', async ({ page }) => {
  const errors = await open(page);
  await useSample(page, 2);
  const theme = await page.locator('html').getAttribute('data-theme');
  await tool(page, '风格');
  await page.locator('.tpanel .pill', { hasText: '氛围出片' }).click();
  await page.locator('.scard[data-style="neon"]').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'neon');
  await tool(page, '微调');
  const knob = page.locator('.knob', { hasText: '风格强度' }).locator('input');
  await knob.fill('95'); await knob.dispatchEvent('change');
  await expect(page.locator('.knob', { hasText: '风格强度' }).locator('.knob__val')).toContainText('95');
  // 撤回：先撤回滑块，再撤回换风格（主题跟着回去）
  const undo = page.getByRole('button', { name: '撤回一步' }).first(), redo = page.getByRole('button', { name: '恢复一步' }).first();
  await undo.click();
  await expect(page.locator('.knob', { hasText: '风格强度' }).locator('.knob__val')).not.toContainText('95');
  await undo.click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', theme || '');
  await redo.click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'neon');
  await page.reload();
  await expect(page.locator('.studio')).toHaveAttribute('data-has', 'photo');
  await expect(page.getByRole('button', { name: '撤回一步' }).first()).toBeEnabled();
  await expect(page.getByRole('button', { name: '恢复一步' }).first()).toBeEnabled();
  await page.locator('.tools__fold').click();
  await make(page, 15000);
  await expect(page.locator('.hud__btn--main')).toBeVisible();
  await tidy(page);
  await page.locator('.studio .chip', { hasText: '作品库' }).click();
  await expect(page.locator('.tile')).toHaveCount(1);
  await page.locator('.tile').click();
  await expect(page.locator('.trail__item')).toHaveCount(1);
  await page.locator('.work .bar__back').click();
  await page.locator('.gallery .bar__back').click();
  await expect(page).toHaveURL(/#\/studio/);
  expect(errors).toEqual([]);
});

test('the back gesture folds an open panel first, and never leaves 上传精修', async ({ page }) => {
  await useSample(page, 0);
  await tool(page, '细节');
  await expect(page.locator('.studio')).toHaveAttribute('data-panel', 'detail');
  await page.goBack();
  await expect(page.locator('.studio')).not.toHaveAttribute('data-panel', /.+/);
  await expect(page).toHaveURL(/#\/studio/);
  await tool(page, '风格');
  await page.locator('.tools__fold').click();
  await expect(page.locator('.studio')).not.toHaveAttribute('data-panel', /.+/);
  await expect(page.locator('.dock__cta .cta')).toBeVisible();
});

test('每个二次元世界都穿上自己的主题，样张 → 拍同款 打开那个世界的相机', async ({ page }) => {
  const acg = PRESETS.filter(p => p.cat === 'acg');
  await open(page);
  await camera(page);
  await page.locator('.live .pill', { hasText: '二次元' }).click();
  await expect(page.locator('.live .dot')).toHaveCount(acg.length);
  for (const p of acg.slice(0, 4)) {
    await page.locator(`.live .dot[data-style="${p.id}"]`).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', p.id);
  }
  const last = acg[3];
  await page.locator('.live__label').click();
  await expect(page.locator('.ex__person').first()).toBeVisible();
  await page.locator('.ex__acts .btn--main').click();
  await expect(page).toHaveURL(/#\/live/);
  await expect(page.locator('.live__name')).toHaveText(last.name);
  await tidy(page);
});

test('changing the style after a result brings back 一键变身, and the style chip shows its examples', async ({ page }) => {
  await useSample(page, 1);
  await make(page, 15000);
  await expect(page.locator('.dock__cta .cta__label')).toHaveText('再来一张');
  await tool(page, '风格');
  await page.locator('.tpanel .pill', { hasText: '角色变身' }).click();
  await page.locator('.scard[data-style="robot"]').click();
  await expect(page.locator('.tpanel__foot .cta__label')).toHaveText('一键变身');
  await page.locator('.hud__chip').click();
  await expect(page.locator('.ex__view')).toBeVisible();
});

test('部位精修：点部位、挑样子、颜色当场看到，出来是新的一版，可以撤回', async ({ page }) => {
  const errors = await open(page);
  await useSample(page, 0);
  await make(page, 15000);
  await tool(page, '部位');
  await expect(page.locator('.pp__hint')).not.toContainText('正在认脸', { timeout: 30000 });
  await page.locator('.pp__part', { hasText: '发色' }).click();
  await page.locator('.pp__opt', { hasText: '樱花粉' }).click();
  await expect(page.locator('.pp__tok')).toHaveCount(1);
  await expect(page.locator('.frame__tint')).toBeVisible({ timeout: 20000 });
  await page.locator('.pp__part', { hasText: '刘海' }).click();
  await page.locator('.pp__opt', { hasText: '八字刘海' }).click();
  await expect(page.locator('.pp__tok')).toHaveCount(2);
  await expect(cta(page).locator('.cta__label')).toHaveText('精修这 2 处');
  await tidy(page);
  await cta(page).click();
  await expect(page.locator('.ver[data-op="region"]')).toHaveCount(1);
  await expect(page.locator('.frame')).toHaveAttribute('data-state', 'done', { timeout: 15000 });
  await expect(page.locator('.pp__tok')).toHaveCount(0);
  await page.getByRole('button', { name: '撤回一步' }).first().click();
  await expect(page.locator('.pp__tok')).toHaveCount(2);
  expect(errors).toEqual([]);
});

test('圈选：手指涂出一块，撤一笔、清空都有效', async ({ page }) => {
  await useSample(page, 3);
  await tool(page, '部位');
  await page.locator('.pp__part--paint').click();
  const b = await page.locator('.frame__brush').boundingBox();
  await page.mouse.move(b.x + b.width * .3, b.y + b.height * .3); await page.mouse.down();
  await page.mouse.move(b.x + b.width * .5, b.y + b.height * .35, { steps: 6 }); await page.mouse.up();
  await expect(cta(page).locator('.cta__label')).toHaveText('改这一块');
  await page.locator('.pp__tool', { hasText: '撤一笔' }).click();
  await expect(cta(page)).toBeDisabled();
});

test('对话：输入框贴着键盘上沿，页面不被挤也不被顶走', async ({ page }) => {
  await useSample(page, 4);
  await make(page, 15000);
  await tool(page, '对话');
  const stageH = await page.locator('#stage').evaluate(el => el.getBoundingClientRect().height);
  await page.locator('.chat__field').click();
  await page.locator('.chat__field').fill('背景换成海边日落');
  await keyboardUp(page, 320);
  const vvH = await page.evaluate(() => window.visualViewport.height);
  const field = await page.locator('.chat__field').evaluate(el => el.getBoundingClientRect().toJSON());
  const panel = await page.locator('.tpanel').evaluate(el => el.getBoundingClientRect().toJSON());
  expect(field.bottom, '输入框在键盘上方').toBeLessThanOrEqual(vvH + 1);
  expect(panel.bottom, '面板刚好贴着键盘').toBeGreaterThan(vvH - 40);
  expect(await page.locator('#stage').evaluate(el => el.getBoundingClientRect().height), '版面没有被挤扁').toBeGreaterThanOrEqual(stageH - 1);
  await expect(page.locator('.bar')).toBeInViewport();
  await keyboardDown(page);
  await expect(page.locator('.chat__send')).toHaveClass(/is-ready/);
});
