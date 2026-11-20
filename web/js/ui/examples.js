/**
 * 看样张：一个风格在六位不同的人身上变身前后的样子（拖动分割线对比），底下两个动作：
 *   拍同款  直接带着这个风格打开实时变身
 *   用这个  在上传精修里选中它
 */
import { h, icon, clamp } from '../core/dom.js';
import { go } from '../core/nav.js';
import { presetById } from '../presets.js';
import { styleArt, personArt, examplesOf } from '../core/assets.js';
import { setPref, saveDraft, draft } from '../core/data.js';
import { applyTheme } from '../core/theme.js';
import { sheet } from './sheet.js';
import { T } from '../copy.js';

/** @param {string} id @param {{ onUse?: (id: string) => void }} [o] */
export function openExamples(id, o = {}) {
  const p = presetById(id); if (!p) return;
  const people = examplesOf(id);
  if (!people.length) return;
  applyTheme(id);
  let who = people.includes(p.hero) ? p.hero : people[0];
  const before = /** @type {HTMLImageElement} */ (h('img.ex__before', { alt: '原图' }));
  const after = /** @type {HTMLImageElement} */ (h('img.ex__after', { alt: p.name + ' 样张' }));
  const handle = h('div.cmp__handle', { 'aria-hidden': 'true' }, h('span.cmp__knob', { html: icon('compare') }));
  const view = h('div.ex__view', { data: { frame: p.theme.frame } }, before, after, handle);
  const set = (/** @type {number} */ v) => { const k = clamp(v); view.style.setProperty('--cmp', (k * 100) + '%'); handle.style.left = (100 - k * 100) + '%'; };
  view.addEventListener('pointerdown', e => {
    const r = view.getBoundingClientRect();
    const move = (/** @type {PointerEvent} */ ev) => set(1 - (ev.clientX - r.left) / r.width);
    move(e); view.setPointerCapture(e.pointerId);
    view.addEventListener('pointermove', move);
    view.addEventListener('pointerup', () => view.removeEventListener('pointermove', move), { once: true });
  });
  const pick = h('div.ex__who', { role: 'group', 'aria-label': '换个人看' });
  const show = (/** @type {string} */ w) => {
    who = w;
    before.src = personArt(w); after.src = styleArt(id, w);
    pick.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(/** @type {HTMLElement} */ (b).dataset.who === w)));
    set(.5);
  };
  pick.append(...people.map(w => h('button.ex__person', { type: 'button', data: { who: w }, 'aria-label': '看看 ' + w, onclick: () => show(w) }, h('img', { src: personArt(w, 't'), alt: '' }))));
  sheet(close => [
    h('div.ex', null,
      view,
      h('p.ex__line', null, p.line + ' · 左右拖动看变身前后'),
      pick,
      h('div.ex__acts', null,
        h('button.btn.btn--ghost', { type: 'button', onclick: () => { close(); setPref('preset', id); if (o.onUse) o.onUse(id); else { saveDraft('studio', { ...(draft('studio') || {}), preset: id, tab: 'style' }); go('studio'); } } }, h('span', { html: icon('upload') }), '用这个'),
        h('button.btn.btn--main', { type: 'button', onclick: () => { close(); setPref('preset', id); go('live'); } }, h('span', { html: icon('camera') }), T.same))),
  ], { title: p.name + ' · 样张', tall: true });
  show(who);
}
