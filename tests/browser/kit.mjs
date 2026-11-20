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

/** Nothing on screen spills out, wraps a short label, or scrolls the page sideways. */
export async function tidy(page) {
  const issues = await page.evaluate(() => {
    const stage = document.getElementById('stage').getBoundingClientRect(), out = [];
    for (const el of document.querySelectorAll('.pill, .seg__opt, .chip2, .act__label, .tool__label, .card__name, .bar__title, .cta__label, .next__btn span, .btn, .modes__opt')) {
      const r = el.getBoundingClientRect();
      if (!r.width || el.closest('[hidden]')) continue;
      const tops = new Set();
      const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      for (let n = walk.nextNode(); n; n = walk.nextNode()) { if (!n.textContent.trim()) continue; const range = document.createRange(); range.selectNodeContents(n); for (const x of range.getClientRects()) if (x.width > 1) tops.add(Math.round(x.top / 4)); }
      if (tops.size > 1) out.push('wraps: ' + el.textContent.trim());
      if (!el.closest('.cards, .pills, .carousel__track, .res__styles, .versions, .panel__body, .gal__scroll, .me__scroll, .work__scroll') && (r.right > stage.right + 1 || r.left < stage.left - 1)) out.push('outside: ' + el.textContent.trim());
    }
    if (document.scrollingElement.scrollWidth > document.scrollingElement.clientWidth + 1) out.push('page scrolls sideways');
    return out;
  });
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
}
