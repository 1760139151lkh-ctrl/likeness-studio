/**
 * 软键盘：页面布局不跟着键盘缩，也不会被整体顶上去。
 *
 *   --app-h   舞台高度 = 没有键盘时的屏幕高度（打字时锁住不变，所以页面不会被挤扁）
 *   --kb      键盘盖住了舞台底部多少像素
 *   --vv-top  iOS / 安卓会把可视区往下「平移」去露出输入框；舞台反向平移同样多，看起来纹丝不动（不会被顶到屏幕上方）
 *
 * 需要打字的那一条（对话输入条、补一句）带 .kb-lift，自己贴到键盘上沿；其余内容原地不动，被键盘盖住而不是被挤压。
 * 视口用 interactive-widget=resizes-visual（iOS 与安卓 Chrome 行为一致：只缩可视区，不缩布局）。
 */
const subs = new Set();
/** 键盘高度变化时通知（例如对话列表滚到底）。 @param {(kb: number) => void} fn */
export function onKeyboard(fn) { subs.add(fn); return () => subs.delete(fn); }
let current = 0;
export const keyboardHeight = () => current;

const FIELD = 'input:not([type="range"]):not([type="file"]):not([type="checkbox"]):not([type="radio"]):not([type="button"]), textarea, [contenteditable="true"]';

export function watchKeyboard(/** @type {HTMLElement} */ stage) {
  const root = document.documentElement;
  let tall = 0, wide = 0, raf = 0;
  const typing = () => { const el = /** @type {HTMLElement | null} */ (document.activeElement); return !!el && el.matches(FIELD); };
  const measure = () => {
    raf = 0;
    const vv = window.visualViewport, h = window.innerHeight, w = window.innerWidth, t = typing();
    if (w !== wide) { wide = w; tall = 0; }                       // 转屏或换了窗口：重新量
    if (!t || !tall) tall = h; else tall = Math.max(tall, h);     // 打字时只增不减：布局高度锁在键盘弹出前
    let kb = 0, top = 0;
    if (t && vv && Math.abs(vv.scale - 1) < .01) {
      kb = Math.max(0, Math.round(tall - vv.height));
      top = Math.max(0, Math.round(vv.offsetTop));
      if (kb < 60) { kb = 0; top = 0; }                            // 硬件键盘 / 桌面：没有软键盘
    }
    root.style.setProperty('--app-h', tall + 'px');
    root.style.setProperty('--kb', kb + 'px');
    root.style.setProperty('--vv-top', top + 'px');
    stage.classList.toggle('is-typing', kb > 0);
    // 贴键盘的元素（输入框所在的那一条）：只抬到刚好露出来，不多不少
    const box = stage.getBoundingClientRect();
    for (const el of /** @type {NodeListOf<HTMLElement>} */ (document.querySelectorAll('.kb-lift'))) {
      if (!kb || !el.offsetParent || !el.contains(document.activeElement)) { el.style.removeProperty('--lift'); continue; }
      const was = parseFloat(el.style.getPropertyValue('--lift')) || 0;
      const bottom = el.getBoundingClientRect().bottom + was - box.top;
      el.style.setProperty('--lift', Math.max(0, Math.round(bottom - (tall - kb))) + 'px');
    }
    if (kb !== current) { current = kb; for (const fn of subs) { try { fn(kb); } catch { /* 一个订阅出错不影响别的 */ } } }
    // 文档本身被浏览器滚动过（老系统会这样露出输入框）：滚回去，交给 --vv-top 处理
    if (t && (window.scrollY || document.scrollingElement?.scrollTop)) window.scrollTo(0, 0);
  };
  const soon = () => { if (!raf) raf = requestAnimationFrame(measure); };
  measure();
  addEventListener('resize', soon);
  window.visualViewport?.addEventListener('resize', soon);
  window.visualViewport?.addEventListener('scroll', soon);
  document.addEventListener('focusin', () => { soon(); setTimeout(soon, 120); setTimeout(soon, 360); setTimeout(soon, 700); });
  document.addEventListener('focusout', () => { setTimeout(soon, 60); setTimeout(soon, 400); });
  addEventListener('orientationchange', () => { tall = 0; setTimeout(soon, 300); });
}
