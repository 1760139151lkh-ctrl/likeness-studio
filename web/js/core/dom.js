/**
 * 小工具：建元素、图标、提示条、底部抽屉。所有界面都从这里取，保持一致。
 */

/**
 * h('button.btn.btn--main', { onclick, 'aria-label': '…' }, child, child)
 * @param {string} tag @param {Record<string, any> | null} [props] @param {...any} kids @returns {HTMLElement}
 */
export function h(tag, props = null, ...kids) {
  const [name, ...cls] = tag.split('.');
  const el = document.createElement(name || 'div');
  if (cls.length) el.className = cls.join(' ');
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'html') el.innerHTML = v;
    else if (k === 'text') el.textContent = v;
    else if (k === 'data') for (const [dk, dv] of Object.entries(v)) { if (dv != null) el.dataset[dk] = String(dv); }
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k === 'class') el.className += ' ' + v;
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, String(v));
  }
  for (const kid of kids.flat(Infinity)) if (kid != null && kid !== false) el.append(kid instanceof Node ? kid : String(kid));
  return el;
}

export const $ = (/** @type {string} */ sel, /** @type {ParentNode} */ root = document) => /** @type {HTMLElement | null} */ (root.querySelector(sel));
export const $$ = (/** @type {string} */ sel, /** @type {ParentNode} */ root = document) => /** @type {HTMLElement[]} */ ([...root.querySelectorAll(sel)]);
export const uid = (prefix = '') => prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
export const clamp = (/** @type {number} */ v, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));
export const sleep = (/** @type {number} */ ms) => new Promise(r => setTimeout(r, ms));
export const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

/** 资源地址：相对页面，服务器会把 img/、js/ 改写成带版本号的永久缓存地址。 */
export const asset = (/** @type {string} */ path) => {
  const v = versions()[path.split('/')[0]];
  return v ? '/' + v + '/' + path : path;
};
let known = /** @type {Record<string, string> | null} */ (null);
function versions() {
  if (!known) { try { known = JSON.parse(document.getElementById('studio-versions')?.textContent || '{}') || {}; } catch { known = {}; } }
  return known;
}

// ── 图标：24px 线性图标，统一 1.8 线宽 ──
const P = {
  back: '<path d="M15 5l-7 7 7 7"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  flip: '<path d="M4 9a8 8 0 0 1 14.3-3.6L20 7"/><path d="M20 3v4h-4"/><path d="M20 15a8 8 0 0 1-14.3 3.6L4 17"/><path d="M4 21v-4h4"/>',
  bolt: '<path d="M13 2L5 13h6l-1 9 8-11h-6l1-9z"/>',
  compare: '<path d="M12 3v18"/><rect x="3" y="5" width="18" height="14" rx="3"/><path d="M7 9l-2 3 2 3M17 9l2 3-2 3"/>',
  upload: '<path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/>',
  gallery: '<rect x="3" y="3" width="8" height="8" rx="2"/><rect x="13" y="3" width="8" height="8" rx="2"/><rect x="3" y="13" width="8" height="8" rx="2"/><rect x="13" y="13" width="8" height="8" rx="2"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/>',
  camera: '<path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13.5" r="3.5"/>',
  sparkle: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3z"/><path d="M19 15l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7.7-2z"/>',
  heart: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>',
  heartFill: '<path fill="currentColor" d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>',
  download: '<path d="M12 4v12M7 11l5 5 5-5"/><path d="M4 19h16"/>',
  share: '<path d="M14 4h6v6"/><path d="M20 4l-9 9"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
  send: '<path d="M21 3L10 14"/><path d="M21 3l-7 18-4-7-7-4 18-7z"/>',
  refresh: '<path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/>',
  sliders: '<path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/>',
  wand: '<path d="M4 20L15 9"/><path d="M14 4v3M12.5 5.5h3M19 9v3M17.5 10.5h3M18 3l.6 1.4L20 5l-1.4.6L18 7l-.6-1.4L16 5l1.4-.6z"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  chevron: '<path d="M9 5l7 7-7 7"/>',
  image: '<rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-8 9"/>',
  stop: '<rect x="7" y="7" width="10" height="10" rx="2"/>',
  palette: '<path d="M12 3a9 9 0 1 0 0 18c1.1 0 1.5-.9 1.2-1.7-.4-1.1.3-2.3 1.5-2.3H17a4 4 0 0 0 4-4c0-5.5-4-10-9-10z"/><circle cx="7.5" cy="11" r="1.2"/><circle cx="10" cy="7" r="1.2"/><circle cx="15" cy="7.5" r="1.2"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  chat: '<path d="M4 5h16v11H9l-5 4V5z"/>',
  logout: '<path d="M15 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4"/><path d="M10 8l-4 4 4 4M6 12h10"/>',
  shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z"/><path d="M8.5 12l2.5 2.5L16 9.5"/>',
  face: '<circle cx="12" cy="12" r="9"/><path d="M8.5 14.6c.9 1.1 2.1 1.7 3.5 1.7s2.6-.6 3.5-1.7"/><path d="M9 9.6v.6M15 9.6v.6" stroke-width="2.4"/>',
  chevronDown: '<path d="M6 9l6 6 6-6"/>',
  undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
  redo: '<path d="M15 14l5-5-5-5"/><path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13"/>',
  brush: '<path d="M14.6 4.4l5 5L11 18l-5-5z"/><path d="M6 13c-2 1-3 3-2.4 6.4C7 20 9.2 19 11 18"/>',
  eraser: '<path d="M20 20H9"/><path d="M3.8 14.2l9.4-9.4a2 2 0 0 1 2.8 0l3.2 3.2a2 2 0 0 1 0 2.8L11 19H8.6z"/><path d="M8.6 9.4l6 6"/>',
  layers: '<path d="M12 3l9 5-9 5-9-5 9-5z"/><path d="M3 13l9 5 9-5"/>',
  rotate: '<path d="M12 3a9 9 0 1 1-8.5 6"/><path d="M3 4v5h5"/><circle cx="12" cy="12" r="2.6"/>',
  card: '<rect x="6" y="2.5" width="12" height="19" rx="2.5"/><circle cx="12" cy="10" r="3"/><path d="M9 17h6"/>',
  more: '<path d="M5 12h.01M12 12h.01M19 12h.01" stroke-width="3.2"/>',
  hd: '<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M7 9v6M7 12h3.6M10.6 9v6M14 9v6h1.4a3 3 0 0 0 0-6z"/>',
  history: '<path d="M3 12a9 9 0 1 0 2.6-6.4L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l3 2"/>',
  file: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/>',
};
/** @param {keyof typeof P} name */
export const icon = (name, cls = '') => `<svg class="ico ${cls}" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name] || ''}</svg>`;

/** 图标 + 短字的按钮。 */
export function iconBtn(/** @type {keyof typeof P} */ name, /** @type {string} */ label, /** @type {(e: Event) => void} */ run, cls = '', showLabel = false) {
  return h('button.ibtn' + (cls ? '.' + cls : ''), { type: 'button', 'aria-label': label, title: label, onclick: run },
    h('span.ibtn__ico', { html: icon(name) }), showLabel ? h('span.ibtn__label', null, label) : null);
}

// ── 提示条 ──
let toastTimer = 0;
/**
 * 屏幕上方的一条提示。可带一个动作（例如「去看看」「撤销」）。
 * @param {string} text @param {{ ms?: number, action?: { label: string, run: () => void }, tone?: 'ok' | 'warn' }} [o]
 */
export function toast(text, o = {}) {
  const root = stageEl();
  root.querySelector('.toast')?.remove();
  const el = h('div.toast', { role: 'status', 'aria-live': 'polite', data: { tone: o.tone || '' } },
    h('span.toast__text', null, text),
    o.action ? h('button.toast__act', { type: 'button', onclick: () => { el.remove(); o.action?.run(); } }, o.action.label) : null);
  root.append(el);
  requestAnimationFrame(() => el.classList.add('is-in'));
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => { el.classList.remove('is-in'); setTimeout(() => el.remove(), 300); }, o.ms || 2400);
}

export const stageEl = () => /** @type {HTMLElement} */ (document.getElementById('stage'));

/** 选文件（默认照片）。 @param {{ capture?: boolean, accept?: string }} [o] @returns {Promise<File | null>} */
export function chooseFile(o = {}) {
  return new Promise(resolve => {
    const input = /** @type {HTMLInputElement} */ (h('input', { type: 'file', accept: o.accept || 'image/*', hidden: true, ...(o.capture ? { capture: 'user' } : {}) }));
    let done = false;
    input.addEventListener('change', () => { done = true; resolve(input.files?.[0] || null); input.remove(); });
    window.addEventListener('focus', () => setTimeout(() => { if (!done) { resolve(null); input.remove(); } }, 1200), { once: true });
    document.body.append(input);
    input.click();
  });
}

/** 人脸模型（MediaPipe / TFLite）自己的启动日志不进控制台（它连 INFO 都走 console.error）；真正的错误照常显示。 */
let hushed = false;
export function hushVision() {
  if (hushed) return; hushed = true;
  const noise = /^(INFO|W\d|I\d|Created TensorFlow|Graph|gl_context|OpenGL|Feedback manager)/;
  for (const k of /** @type {const} */ (['log', 'info', 'warn', 'error'])) {
    const was = console[k];
    console[k] = (...a) => { if (!noise.test(String(a[0] ?? ''))) was.apply(console, a); };
  }
}

/** 时间说人话：8 秒 / 1 分 10 秒。 */
export function said(/** @type {number} */ ms) {
  const s = Math.max(1, Math.round(ms / 1000));
  return s < 60 ? s + ' 秒' : Math.floor(s / 60) + ' 分' + (s % 60 ? ' ' + (s % 60) + ' 秒' : '钟');
}
/** 今天 / 昨天 / 11月18日 */
export function dayOf(/** @type {number} */ t) {
  const d = new Date(t), today = new Date(); today.setHours(0, 0, 0, 0);
  const diff = Math.round((today.getTime() - new Date(d).setHours(0, 0, 0, 0)) / 864e5);
  return diff <= 0 ? '今天' : diff === 1 ? '昨天' : (d.getMonth() + 1) + '月' + d.getDate() + '日';
}

/** 长按（含鼠标按住）：按下时 on(true)，松开 on(false)。 */
export function holdable(/** @type {HTMLElement} */ el, /** @type {(on: boolean) => void} */ on, delay = 120) {
  let t = 0, held = false;
  const start = (/** @type {PointerEvent} */ e) => { if (e.button > 0) return; t = window.setTimeout(() => { held = true; on(true); }, delay); };
  const end = () => { clearTimeout(t); if (held) { held = false; on(false); } };
  el.addEventListener('pointerdown', start);
  for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) el.addEventListener(ev, end);
  el.addEventListener('contextmenu', e => e.preventDefault());
  el.addEventListener('keydown', e => { if (e.key === ' ' && !e.repeat) { e.preventDefault(); on(true); } });
  el.addEventListener('keyup', e => { if (e.key === ' ') on(false); });
}
