/** Shared steps for the browser tests. */
import { expect } from '@playwright/test';

/** Opens the app with a fresh profile; `intro` keeps the first-run onboarding. */
export async function open(page, { intro = false } = {}) {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(intro ? '/' : '/?skipintro');
  await expect(page.locator('html')).toHaveAttribute('data-screen', /.+/);
  return errors;
}

/** Labels that must never wrap or spill out of the screen; the containers that scroll sideways on purpose. */
const LABELS = '.pill, .seg__opt, .chip2, .act__label, .tool__label, .tool2__label, .tools__fold, .scard__name, .card__name, .bar__title, .cta__label, .hud__btn, .btn, .modes__opt, .pp__part, .pp__opt, .chat__q, .mitem__name';
const SCROLLERS = '.cards, .pills, .carousel__track, .res__styles, .versions, .sgrid, .tpanel__body, .pp__parts, .chat__quick, .chat__ideas, .chat__roles, .gal__scroll, .me__scroll, .work__scroll, .work__chain';

/** Nothing on screen spills out, wraps a short label, or scrolls the page sideways. */
export async function tidy(page) {
  const issues = await page.evaluate(([labels, scrollers]) => {
    const stage = document.getElementById('stage').getBoundingClientRect(), out = [];
    for (const el of document.querySelectorAll(labels)) {
      const r = el.getBoundingClientRect();
      if (!r.width || el.closest('[hidden]')) continue;
      const tops = new Set();
      const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      for (let n = walk.nextNode(); n; n = walk.nextNode()) { if (!n.textContent.trim()) continue; const range = document.createRange(); range.selectNodeContents(n); for (const x of range.getClientRects()) if (x.width > 1) tops.add(Math.round(x.top / 4)); }
      if (tops.size > 1) out.push('wraps: ' + el.textContent.trim());
      if (!el.closest(scrollers) && (r.right > stage.right + 1 || r.left < stage.left - 1)) out.push('outside: ' + el.textContent.trim());
    }
    if (document.scrollingElement.scrollWidth > document.scrollingElement.clientWidth + 1) out.push('page scrolls sideways');
    return out;
  }, [LABELS, SCROLLERS]);
  expect(issues).toEqual([]);
}

/** Starts the camera: the button is only there while permission has not been given yet. */
export async function camera(page) {
  const ask = page.getByRole('button', { name: '打开摄像头' });
  await page.waitForFunction(() => document.querySelector('.live')?.dataset.cam && document.querySelector('.live')?.dataset.cam !== 'starting', null, { timeout: 15000 }).catch(() => {});
  if (await ask.isVisible()) await ask.click();
}

/** Puts one of the invented sample people into 上传精修. */
export async function useSample(page, nth = 0) {
  await page.goto('/?skipintro#/studio');
  await page.getByRole('button', { name: '用示例玩', exact: true }).click();
  await page.locator('.sample').nth(nth).click();
  await expect(page.locator('.studio')).toHaveAttribute('data-has', 'photo');
  await expect(page.locator('.sheet')).toHaveCount(0);   // 示例抽屉滑走了
}

/** Opens one of 上传精修's tools (风格 · 微调 · 细节 · 部位 · 对话) in the panel under the picture. */
export async function tool(page, label) {
  const b = page.locator('.tool2', { hasText: label });
  if ((await b.getAttribute('aria-selected')) !== 'true') await b.click();
  await expect(b).toHaveAttribute('aria-selected', 'true');
}

/** The main button of whatever is on screen in 上传精修 (一键变身, 精修这 N 处…). */
export const cta = (page) => page.locator('.studio .cta:visible');

/** 一键变身 and wait for the picture. */
export async function make(page, timeout = 30000) {
  await cta(page).click();
  await expect(page.locator('.frame')).toHaveAttribute('data-state', 'done', { timeout });
}

/** Pretends the on-screen keyboard is up (it takes `kb` px from the bottom of the visual viewport). */
export async function keyboardUp(page, kb = 320) {
  await page.evaluate((k) => {
    const vv = window.visualViewport, h = innerHeight - k;
    Object.defineProperty(vv, 'height', { configurable: true, get: () => h });
    vv.dispatchEvent(new Event('resize'));
  }, kb);
  await page.waitForTimeout(450);
}
export async function keyboardDown(page) {
  await page.evaluate(() => { delete window.visualViewport.height; window.visualViewport.dispatchEvent(new Event('resize')); });
  await page.waitForTimeout(300);
}
