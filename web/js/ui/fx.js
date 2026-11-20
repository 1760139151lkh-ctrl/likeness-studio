/**
 * 沉浸感的小动效，全部尊重「减少动态效果」设置：
 *   warp    换风格时，一个带风格信物的标题卡从快门处晕开（像动画里的转场眼）
 *   reveal  出片时一道光从左扫到右，扫过的地方从预览蜕变成成片
 *   burst   出片瞬间，这个世界自己的小物件四散飞出（公主是蝴蝶结和爱心、特摄是能量闪电、丹青是宫灯…）
 *   buzz    手机上轻轻震一下
 */
import { h, reduced } from '../core/dom.js';
import { sticker } from '../core/assets.js';
import { presetById } from '../presets.js';

/** 每个世界的「信物」（presets.js 的 emblem）：标题卡上的那个小图，和出片时飞出来的东西。 */
const emblem = (/** @type {string} */ id, i = 0) => sticker(presetById(id)?.emblem?.[i] || 'sparkle') || sticker('sparkle');

let warpEl = /** @type {HTMLElement | null} */ (null);
/** 世界切换标题卡。 @param {HTMLElement} host @param {string} id */
export function warp(host, id) {
  const p = presetById(id); if (!p) return;
  warpEl?.remove();
  if (reduced) return;
  const src = emblem(id, 0);
  warpEl = h('div.warp', { 'aria-hidden': 'true' },
    h('span.warp__wash'),
    h('div.warp__card', null, src ? h('img.warp__deco', { src, alt: '' }) : null, h('b.warp__name', null, p.name), h('span.warp__hook', null, p.hook)));
  host.append(warpEl);
  const mine = warpEl;
  setTimeout(() => mine.remove(), 1300);
}

/**
 * 蜕变揭晓：img 从左到右被一道光扫出来。
 * @param {HTMLElement} box 相对定位的容器 @param {HTMLElement} img 要揭晓的成片
 */
export function reveal(box, img, ms = 1000) {
  if (reduced) return Promise.resolve();
  const line = h('span.reveal-line');
  box.append(line);
  img.classList.add('reveal-sweep');
  const t0 = performance.now();
  return new Promise(done => {
    const step = (/** @type {number} */ t) => {
      const k = Math.min(1, (t - t0) / ms), e = 1 - Math.pow(1 - k, 3);
      img.style.setProperty('--rv', (e * 100).toFixed(2) + '%');
      line.style.left = (e * 100) + '%';
      if (k < 1) requestAnimationFrame(step);
      else { line.remove(); img.classList.remove('reveal-sweep'); img.style.removeProperty('--rv'); done(undefined); }
    };
    requestAnimationFrame(step);
  });
}

/** 这个世界的小物件四散飞出。 @param {HTMLElement} host @param {string} id */
export function burst(host, id, n = 16) {
  if (reduced) return;
  const box = h('div.burst', { 'aria-hidden': 'true' });
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + Math.random() * .3, d = 120 + Math.random() * 140;
    const src = emblem(id, i % 3 === 0 ? 0 : 1);
    if (!src) continue;
    box.append(h('img.burst__bit', { src, alt: '', style: { '--dx': Math.cos(a) * d + 'px', '--dy': Math.sin(a) * d + 'px', '--rot': (Math.random() * 120 - 60) + 'deg', width: 22 + Math.random() * 22 + 'px', animationDelay: Math.random() * 120 + 'ms' } }));
  }
  host.append(box);
  setTimeout(() => box.remove(), 1500);
}

const unveiled = new Set();
/** 这件作品是不是刚出炉、还没揭晓过（只揭晓一次；隔了很久再打开就直接显示）。 */
export function firstLook(/** @type {{ id: string, updatedAt: number }} */ w) {
  if (unveiled.has(w.id) || Date.now() - w.updatedAt > 6000) return false;
  unveiled.add(w.id);
  return true;
}

/** 轻轻震一下（安卓支持；iOS 浏览器会忽略）。 */
export const buzz = (/** @type {number | number[]} */ pattern = 12) => { try { navigator.vibrate?.(pattern); } catch { /* 不支持 */ } };
