/**
 * 第一次打开：3 秒看懂。
 * 全屏是同一个人在不同风格之间切换的高燃蜕变（一条光线从原图扫到艺术头像，手指也能拖），下面一句话说清
 * 「一张自拍，秒变艺术头像」，三步玩法，和两个按钮：开拍（直达实时变身）/ 用示例玩（一键试玩范例）。
 */
import { h, icon, stageEl, reduced, clamp } from '../core/dom.js';
import { setPref } from '../core/data.js';
import { styleArt, personArt, hasArt } from '../core/assets.js';
import { presetById } from '../presets.js';
import { applyTheme } from '../core/theme.js';
import { T } from '../copy.js';

const TOUR = ['princess', 'giant', 'magical', 'robocat', 'shonen', 'ghibli', 'neon', 'dragon', 'vtuber', 'anime', 'figure', 'ccd', 'gothic', 'clay'];

/** @param {{ onShoot: () => void, onSample: () => void, onSkip: () => void }} o */
export function onboard(o) {
  const who = 'mei';
  const list = TOUR.filter(id => hasArt(id, who));
  let k = 0, pos = 0, raf = 0, timer = 0, dragging = false;
  const photo = h('img.ob__photo', { src: personArt(who), alt: '一张普通自拍' });
  const art = /** @type {HTMLImageElement} */ (h('img.ob__art', { alt: '' }));
  const line = h('span.ob__line', { 'aria-hidden': 'true' });
  const tag = h('span.ob__tag');
  const view = h('div.ob__view', null, photo, art, line, h('span.ob__was', null, '原图'), tag);
  const close = (/** @type {() => void} */ then) => { setPref('onboarded', true); clearInterval(timer); cancelAnimationFrame(raf); el.classList.add('is-out'); setTimeout(() => el.remove(), reduced ? 0 : 380); then(); };
  const el = h('div.ob', { role: 'dialog', 'aria-modal': 'true', 'aria-label': '欢迎来到哈基秀' }, view,
    h('div.ob__words', null,
      h('p.ob__brand', null, T.brand),
      h('h1.ob__title', null, '一张自拍，', h('br'), h('em', null, '秒变艺术头像')),
      h('ol.ob__steps', null, h('li', null, h('b', null, '1'), '选风格'), h('li', null, h('b', null, '2'), '拍照或传图'), h('li', null, h('b', null, '3'), '加细节出片')),
      h('div.ob__acts', null,
        h('button.btn.btn--main.btn--lg', { type: 'button', onclick: () => close(o.onShoot) }, h('span', { html: icon('camera') }), '开拍'),
        h('button.btn.btn--glass.btn--lg', { type: 'button', onclick: () => close(o.onSample) }, h('span', { html: icon('sparkle') }), T.sample)),
      h('button.ob__skip', { type: 'button', onclick: () => close(o.onSkip) }, '跳过')));
  const set = (/** @type {number} */ v) => { pos = clamp(v); view.style.setProperty('--x', (pos * 100).toFixed(2) + '%'); };
  function show(/** @type {number} */ i) {
    const id = list[i % list.length]; if (!id) return;
    const p = presetById(id);
    art.src = styleArt(id, who);
    tag.textContent = p?.name || '';
    applyTheme(id);
    if (dragging || reduced) { set(.5); return; }
    const t0 = performance.now();
    cancelAnimationFrame(raf);
    // 每一轮：先是原图，一道光从左扫到右，扫过的地方变成艺术头像
    const run = (/** @type {number} */ t) => { const e = Math.min(1, Math.max(0, (t - t0 - 250) / 1300)); set(1 - Math.pow(1 - e, 3)); if (e < 1) raf = requestAnimationFrame(run); };
    set(0); raf = requestAnimationFrame(run);
  }
  view.addEventListener('pointerdown', e => {
    dragging = true; clearInterval(timer); cancelAnimationFrame(raf);
    const r = view.getBoundingClientRect();
    const move = (/** @type {PointerEvent} */ ev) => set((ev.clientX - r.left) / r.width);
    move(e); view.setPointerCapture(e.pointerId);
    view.addEventListener('pointermove', move);
    view.addEventListener('pointerup', () => view.removeEventListener('pointermove', move), { once: true });
  });
  for (const id of list.slice(0, 4)) { const i = new Image(); i.src = styleArt(id, who); }
  stageEl().append(el);
  show(0);
  timer = window.setInterval(() => { if (!dragging) show(++k); }, reduced ? 3200 : 2600);
  el.addEventListener('keydown', e => { if (e.key === 'Escape') close(o.onSkip); });
  setTimeout(() => /** @type {HTMLElement | null} */ (el.querySelector('.btn--main'))?.focus({ preventScroll: true }), 300);
}
