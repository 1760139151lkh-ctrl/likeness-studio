/**
 * 底部抽屉：标题 + 右上角固定的「关闭」；点遮罩、按 Esc、手机返回手势都能关。
 */
import { h, iconBtn, stageEl, reduced } from '../core/dom.js';
import { overlay } from '../core/nav.js';

/**
 * 抽屉打开后把光标放进它的第一个输入框。已经在抽屉里别的地方打字了（或已经在这个框里）就不抢：
 * 不然刚打的字会落到别处去。
 */
export function focusSoon(/** @type {HTMLElement} */ el, ms = 120) {
  setTimeout(() => {
    const a = /** @type {HTMLElement | null} */ (document.activeElement), box = el.closest('.sheet');
    if (!el.isConnected || a === el) return;
    if (a && box?.contains(a) && !a.classList.contains('sheet__close')) return;
    el.focus({ preventScroll: true });
  }, ms);
}

/** 有没有抽屉开着（Esc 先关抽屉）。 */
export const sheetOpen = () => open.length > 0;
/**
 * @param {(close: () => void) => any[]} build
 * @param {{ title: string, cls?: string, onClose?: () => void, tall?: boolean }} o
 */
const open = /** @type {HTMLElement[]} */ ([]);
export function sheet(build, o) {
  let gone = false;
  const onKey = (/** @type {KeyboardEvent} */ e) => { if (e.key === 'Escape' && open.at(-1) === panel) { e.preventDefault(); dismiss(); } };
  const remove = () => {
    if (gone) return; gone = true;
    document.removeEventListener('keydown', onKey);
    open.splice(open.indexOf(panel), 1);
    panel.classList.remove('is-in'); scrim.classList.remove('is-in');
    setTimeout(() => { panel.remove(); scrim.remove(); }, reduced ? 0 : 260);
    o.onClose?.();
  };
  const dismiss = overlay(remove);
  const scrim = h('div.scrim', { onclick: () => dismiss() });
  const panel = h('section.sheet' + (o.cls ? '.' + o.cls : '') + (o.tall ? '.sheet--tall' : ''), { role: 'dialog', 'aria-modal': 'true', 'aria-label': o.title },
    h('div.sheet__grip', { 'aria-hidden': 'true' }),
    h('header.sheet__head', null, h('h2.sheet__title', null, o.title), iconBtn('close', '关闭', () => dismiss(), 'sheet__close')),
    h('div.sheet__body', null, ...build(() => dismiss())));
  stageEl().append(scrim, panel);
  open.push(panel);
  requestAnimationFrame(() => { scrim.classList.add('is-in'); panel.classList.add('is-in'); });
  document.addEventListener('keydown', onKey);
  // 键盘和读屏用户：焦点先落在抽屉里（关闭按钮）。已经有东西在抽屉里拿到焦点了（例如已经点进输入框）就不抢
  setTimeout(() => { if (!panel.contains(document.activeElement)) /** @type {HTMLElement | null} */ (panel.querySelector('.sheet__close'))?.focus({ preventScroll: true }); }, 60);
  return { close: () => dismiss(), panel };
}

/** 一个确认弹窗：两个按钮，说清楚会发生什么。 @returns {Promise<boolean>} */
export function confirmBox(/** @type {string} */ title, /** @type {string} */ text, ok = '确定', cancel = '算了') {
  return new Promise(resolve => {
    let answered = false;
    const { close } = sheet(c => [
      h('p.sheet__text', null, text),
      h('div.sheet__acts', null,
        h('button.btn.btn--ghost', { type: 'button', onclick: () => { answered = true; resolve(false); c(); } }, cancel),
        h('button.btn.btn--main', { type: 'button', onclick: () => { answered = true; resolve(true); c(); } }, ok)),
    ], { title, cls: 'sheet--confirm', onClose: () => { if (!answered) resolve(false); } });
    void close;
  });
}
