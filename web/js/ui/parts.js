/**
 * 共用的界面零件：分类胶囊、风格卡、前后对比、生成进度、保存与分享、顶部栏。
 */
import { h, icon, iconBtn, holdable, toast, clamp, reduced } from '../core/dom.js';
import { CATEGORIES, PRESETS, inCategory, presetById } from '../presets.js';
import { cover, icon as styleIcon } from '../core/assets.js';
import { isFav, toggleFav, note, saveWork, pref } from '../core/data.js';
import { download } from '../core/image.js';
import { back } from '../core/nav.js';
import { studio } from '../core/api.js';
import { T } from '../copy.js';

/** 页面顶栏：左边固定是返回，中间标题，右边可选。 */
export function topBar(/** @type {string} */ title, /** @type {any[]} */ right = [], onBack = () => back()) {
  return h('header.bar', null,
    h('button.bar__back', { type: 'button', 'aria-label': T.back, onclick: onBack }, h('span', { html: icon('back') }), h('span.bar__backtext', null, T.back)),
    h('h1.bar__title', null, title),
    h('div.bar__right', null, ...right));
}

/**
 * 横滑的分类胶囊。
 * @param {string} active @param {(id: string) => void} pick
 */
export function pills(active, pick, cls = '') {
  const el = h('nav.pills' + (cls ? '.' + cls : ''), { 'aria-label': '风格分类', role: 'tablist' },
    ...CATEGORIES.map(c => h('button.pill', { type: 'button', role: 'tab', data: { cat: c.id }, 'aria-selected': String(c.id === active), onclick: () => { set(c.id); pick(c.id); } }, c.label)));
  function set(/** @type {string} */ id) {
    for (const b of el.querySelectorAll('.pill')) b.setAttribute('aria-selected', String(/** @type {HTMLElement} */ (b).dataset.cat === id));
    const on = /** @type {HTMLElement | null} */ (el.querySelector(`[data-cat="${id}"]`));
    on?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: reduced ? 'auto' : 'smooth' });
  }
  return Object.assign(el, { set });
}

/**
 * 风格卡：真实样张做封面，穿着这个风格自己的画框；角上一颗心可以收藏。
 * @param {string} id @param {{ selected?: boolean, onPick: (id: string) => void, size?: 'm' | '' }} o
 */
export function styleCard(id, o) {
  const p = /** @type {import('../presets.js').Preset} */ (presetById(id));
  const c = cover(id, o.size ?? 'm');
  const fav = h('span.card__fav', { role: 'button', tabindex: '0', 'aria-label': isFav(id) ? '取消收藏' : T.fav, 'aria-pressed': String(isFav(id)), html: icon(isFav(id) ? 'heartFill' : 'heart'),
    onclick: async (/** @type {Event} */ e) => { e.stopPropagation(); const on = await toggleFav(id); fav.innerHTML = icon(on ? 'heartFill' : 'heart'); fav.setAttribute('aria-pressed', String(on)); toast(on ? '已收藏「' + p.name + '」' : '已取消收藏'); } });
  return h('button.card', { type: 'button', data: { style: id, frame: p.theme.frame, dark: String(p.theme.dark) }, 'aria-pressed': String(!!o.selected), 'aria-label': p.name + '：' + p.line,
    style: { '--c-accent': p.theme.accent, '--c-accent2': p.theme.accent2, '--c-bg': p.theme.bg, '--c-ink': p.theme.ink }, onclick: () => o.onPick(id) },
    h('span.card__art', null, h('img', { src: c.art, alt: '', loading: 'lazy', decoding: 'async' })),
    h('span.card__name', null, p.name),
    h('span.card__hook', null, p.hook),
    p.hot >= 3 ? h('span.card__hot', null, 'HOT') : null,
    o.selected ? h('span.card__on', null, h('span', { html: icon('check') }), '当前') : null,
    fav);
}

/** 一排风格卡（横滑），按分类过滤。 @param {string} cat @param {string} selected @param {(id: string) => void} onPick */
export function styleRow(cat, selected, onPick) {
  const list = inCategory(cat);
  return h('div.cards', { role: 'listbox', 'aria-label': '选择风格' }, ...list.map(p => styleCard(p.id, { selected: p.id === selected, onPick })));
}

/** 圆形风格头像（实时变身底部轮播用）。 */
export const styleDot = (/** @type {string} */ id) => {
  const p = /** @type {any} */ (presetById(id));
  return h('button.dot', { type: 'button', data: { style: id }, 'aria-label': p.name, style: { '--c-accent': p.theme.accent, '--c-accent2': p.theme.accent2 } },
    h('img', { src: styleIcon(id), alt: '', decoding: 'async', loading: 'lazy' }), h('span.dot__name', null, p.name));
};

/**
 * 前后对比：拖动分割线；按住画面看原图。键盘左右键也能拖。
 * @param {HTMLElement} box 放图的容器（相对定位） @param {HTMLImageElement} before @param {HTMLImageElement} after
 * @param {{ enabled?: () => boolean }} [o] enabled：现在能不能对比（部位精修、圈选时画面要留给手指）
 */
export function compare(box, before, after, o = {}) {
  const can = () => !o.enabled || o.enabled();
  let pos = 1;   // 1 = 全是成片
  const handle = h('div.cmp__handle', { 'aria-hidden': 'true' }, h('span.cmp__knob', { html: icon('compare') }));
  const range = /** @type {HTMLInputElement} */ (h('input.cmp__range', { type: 'range', min: '0', max: '100', value: '100', 'aria-label': '前后对比：向左拖看原图' }));
  const hint = h('span.cmp__hint', null, T.hold);
  box.append(handle, range, hint);
  box.classList.add('cmp');
  const set = (/** @type {number} */ v) => { pos = clamp(v); box.style.setProperty('--cmp', (pos * 100).toFixed(2) + '%'); range.value = String(Math.round(pos * 100)); box.classList.toggle('is-split', pos < .995); };
  range.addEventListener('input', () => set(Number(range.value) / 100));
  // 拖动：从分割线附近开始拖才算拖；其余地方是「按住看原图」
  let drag = false;
  box.addEventListener('pointerdown', e => {
    if (!can()) return;
    const r = box.getBoundingClientRect(), x = (e.clientX - r.left) / r.width;
    if (Math.abs(x - pos) < .08 || box.classList.contains('is-split')) { drag = true; box.setPointerCapture(e.pointerId); set(x); e.preventDefault(); }
  });
  box.addEventListener('pointermove', e => { if (!drag) return; const r = box.getBoundingClientRect(); set((e.clientX - r.left) / r.width); });
  box.addEventListener('pointerup', () => { drag = false; });
  holdable(box, on => { if (!drag) box.classList.toggle('is-before', on && can()); }, 160);
  range.addEventListener('focus', () => { if (!can()) range.blur(); });
  void before; void after;
  set(1);
  return {
    set,
    /** 出片时扫一遍：从原图扫到成片，让变化一眼可见。 */
    sweep() {
      if (reduced) { set(1); return; }
      const t0 = performance.now();
      const run = (/** @type {number} */ t) => { const k = Math.min(1, (t - t0) / 1100); const e = k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2; set(e); if (k < 1) requestAnimationFrame(run); };
      set(0); requestAnimationFrame(run);
    },
  };
}

/** 生成进度：三个阶段 + 进度条 + 一句会变的微文案 + 取消。 */
export function progressBox(/** @type {() => void} */ onCancel) {
  const steps = h('ol.prog__steps', null, ...T.stages.map((s, i) => h('li', { data: { i } }, h('i', { 'aria-hidden': 'true' }), h('span', null, s))));
  const bar = h('div.prog__bar', { role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-label': '生成进度' }, h('i'));
  const line = h('p.prog__line', { 'aria-live': 'polite' });
  const eta = h('p.prog__eta');
  const stop = h('button.btn.btn--ghost.btn--sm.prog__stop', { type: 'button', onclick: onCancel }, h('span', { html: icon('stop') }), T.cancel);
  const el = h('div.prog', { role: 'status' }, steps, bar, line, eta, stop);
  let waitAt = 0, lastLine = '';
  return Object.assign(el, {
    /** @param {import('../core/generate.js').Progress} p */
    update(p) {
      steps.querySelectorAll('li').forEach((li, i) => { li.classList.toggle('is-done', i < p.stage || p.value >= 1); li.classList.toggle('is-on', i === p.stage && p.value < 1); });
      bar.style.setProperty('--v', String(p.value)); bar.setAttribute('aria-valuenow', String(Math.round(p.value * 100)));
      // 等待时的微文案隔几秒换一句，别让人干等
      const since = performance.now() - p.started;
      const text = p.text === T.sending || p.text === T.queued ? p.text : since > 2500 ? T.waits[Math.min(T.waits.length - 1, Math.floor(since / 3500))] : p.text;
      if (text !== lastLine) { line.textContent = text; lastLine = text; waitAt = performance.now(); }
      const left = Math.max(0, p.eta - since);
      eta.textContent = p.value >= 1 ? '' : left > 1500 ? '预计还要 ' + Math.ceil(left / 1000) + ' 秒' : '马上就好';
      void waitAt;
    },
  });
}

const fileName = (/** @type {any} */ w) => `hajixiu-${presetById(w.preset)?.id || 'art'}-${new Date(w.createdAt).toISOString().slice(0, 10)}.jpg`;
/** 保存到相册：手机上走系统分享面板（可「存储图像」），否则直接下载。 */
export async function saveImage(/** @type {any} */ w, /** @type {string} */ url) {
  const blob = await fetch(url).then(r => r.blob());
  const file = new File([blob], fileName(w), { type: blob.type || 'image/jpeg' });
  const mobile = matchMedia('(pointer: coarse)').matches;
  if (mobile && navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file] }); toast(T.saved, { tone: 'ok' }); }
    catch (e) { if (/** @type {any} */ (e)?.name !== 'AbortError') { download(url, file.name); toast(T.savedDl, { tone: 'ok' }); } else return; }
  } else { download(url, file.name); toast(T.savedDl, { tone: 'ok' }); }
  note(w, 'save', '保存到相册'); saveWork(w);
}
/** 去发 TikTok：系统分享面板里直接选 TikTok；不支持时先保存，再提示去 TikTok 发布。 */
export async function shareTikTok(/** @type {any} */ w, /** @type {string} */ url) {
  const blob = await fetch(url).then(r => r.blob());
  const p = presetById(w.preset);
  const file = new File([blob], fileName(w), { type: blob.type || 'image/jpeg' });
  const text = `我用哈基秀变身「${p?.name || ''}」✨ #哈基秀 #艺术头像 #${p?.name || 'AIart'}`;
  if (navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], text }); note(w, 'share', '分享出去'); saveWork(w); return; }
    catch (e) { if (/** @type {any} */ (e)?.name === 'AbortError') return; }
  }
  download(url, file.name);
  try { await navigator.clipboard?.writeText(text); } catch { /* 剪贴板不可用 */ }
  toast(T.shareTip, { ms: 4200, tone: 'ok' });
  note(w, 'share', '准备发 TikTok'); saveWork(w);
}

/** 作品的来历标签：只有真正由模型生成的才叫成片。 */
export function kindBadge(/** @type {any} */ w, short = false) {
  const long = w.kind === 'preview' ? T.preview : w.kind === 'example' ? T.example : w.kind === 'simulated' ? T.simulated : '';
  if (!long) return null;
  return h('span.badge', { title: long }, short ? long.split(' · ')[0] : long);
}

/** 一个版本是怎么来的（短名字）。 @param {any} w */
export function opLabel(w) {
  if (!w) return '原图';
  return ({ region: '部位精修', edit: '对话微调', vary: '多来几张', angles: '多角度' })[/** @type {string} */ (w.op)] || presetById(w.preset)?.name || '作品';
}
/** 版本缩略图角上的小图标（整体换风格没有）。 @param {any} w */
export function opBadge(w) {
  const name = ({ region: 'face', edit: 'chat', vary: 'layers', angles: 'rotate' })[/** @type {string} */ (w?.op)];
  return name ? h('i.opb', { 'aria-hidden': 'true', html: icon(/** @type {any} */ (name)) }) : null;
}

/** 画质的说法（显示在按钮下）。 */
export function etaText() {
  const pace = pref('pace', 'fine');
  return studio.live ? `约 ${Math.round(studio.eta(pace) / 1000)} 秒 · ${T.pace[pace]}` : '演示版 · 本地出片';
}
export { PRESETS };
