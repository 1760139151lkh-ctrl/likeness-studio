/**
 * 软键盘：页面高度固定在「没有键盘时」的屏幕高度（--app-h），键盘只盖在上面，不会把布局顶崩、挤扁。
 * 需要打字的输入框都放在屏幕上方的卡片里（见 sheet--top），所以键盘永远挡不住正在输入的地方。
 */
export function watchKeyboard(/** @type {HTMLElement} */ stage) {
  let tall = 0, wide = 0;
  const root = document.documentElement;
  const typing = () => { const el = /** @type {HTMLElement | null} */ (document.activeElement); return !!el && el.matches('input:not([type="range"]):not([type="file"]), textarea'); };
  const measure = () => {
    const h = window.innerHeight, w = window.innerWidth;
    if (w !== wide) { wide = w; tall = 0; }
    if (!typing() || !tall) tall = h; else tall = Math.max(tall, h);
    root.style.setProperty('--app-h', tall + 'px');
    const vv = window.visualViewport;
    const kb = vv && typing() ? Math.max(0, Math.round(tall - vv.height - vv.offsetTop)) : 0;
    root.style.setProperty('--kb', kb + 'px');
    stage.classList.toggle('is-typing', kb > 60);
    if (typing() && (window.scrollY || document.scrollingElement?.scrollTop)) window.scrollTo(0, 0);
  };
  measure();
  addEventListener('resize', measure);
  window.visualViewport?.addEventListener('resize', measure);
  window.visualViewport?.addEventListener('scroll', measure);
  document.addEventListener('focusin', () => { measure(); setTimeout(measure, 150); setTimeout(measure, 450); });
  document.addEventListener('focusout', () => setTimeout(measure, 80));
  addEventListener('orientationchange', () => { tall = 0; setTimeout(measure, 300); });
}
