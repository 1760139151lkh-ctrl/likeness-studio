/**
 * 「一风格一世界」：选中哪个风格，整个应用就穿上它的配色、字体气质、装饰语言和画框。
 * 颜色变量都注册成可插值的 CSS 属性（见 app.css 的 @property），切换时是一段柔和的过渡，不闪、不跳。
 */
import { presetById } from '../presets.js';
import { bgArt } from './assets.js';

const BRAND = { dark: true, bg: '#0d0a1a', bg2: '#2a1048', surface: '#171226', ink: '#f7f3ff', soft: '#b5a9d6', accent: '#ff3d8b', accent2: '#2fe0ff', onAccent: '#ffffff', glow: 'rgba(255,61,139,.45)', line: 'rgba(247,243,255,.14)', radius: '24px', display: 'round', deco: 'brand', frame: 'brand' };
let current = '';

/** @param {string} id 风格 id；空字符串 = 品牌默认 */
export function applyTheme(id) {
  if (id === current) return;
  current = id;
  const p = presetById(id), t = p?.theme || BRAND;
  const root = document.documentElement, s = root.style;
  const vars = { '--bg': t.bg, '--bg2': t.bg2, '--surface': t.surface, '--ink': t.ink, '--soft': t.soft, '--accent': t.accent, '--accent2': t.accent2,
    '--on-accent': t.onAccent, '--glow': t.glow, '--line': t.line, '--art-radius': t.radius };
  for (const [k, v] of Object.entries(vars)) s.setProperty(k, v);
  Object.assign(root.dataset, { theme: p ? p.id : 'brand', dark: String(t.dark), display: t.display, deco: t.deco, frame: t.frame });
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', t.bg);
  // the backdrop: the style's own ambient art, cross-faded over the last one
  const layer = document.querySelector('.ambience');
  if (layer) {
    const src = bgArt(p ? p.id : 'brand');
    const imgs = /** @type {HTMLImageElement[]} */ ([...layer.querySelectorAll('img')]);
    const [on, off] = imgs[0].classList.contains('is-on') ? [imgs[1], imgs[0]] : [imgs[0], imgs[1]];
    if (src) { on.onload = () => { on.classList.add('is-on'); off.classList.remove('is-on'); }; on.src = src; }
    else { on.classList.remove('is-on'); off.classList.remove('is-on'); }
    s.setProperty("--amb", src ? `url("${new URL(src, location.href).href}")` : "none");   // absolute: a url() in a custom property resolves against the stylesheet otherwise
  }
  try { localStorage.setItem('hjx.theme', JSON.stringify({ vars, data: { theme: p ? p.id : 'brand', dark: String(t.dark), display: t.display, deco: t.deco, frame: t.frame } })); } catch { /* 隐私模式 */ }
}
export const themeNow = () => current;
