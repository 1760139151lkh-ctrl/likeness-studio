/**
 * 导航：每个页面都有地址（#/studio、#/work/xxx…），刷新后回到原地；手机返回手势、浏览器后退、页面左上角的返回
 * 按钮走的是同一条路。抽屉和弹层也占一格历史，所以「返回」总是先关掉最上面那一层，绝不会把人带出应用。
 *
 * 根页面只有两个：实时变身（live）与上传精修（studio），它们之间是切换，不是前进。
 */
import { stageEl, reduced } from './dom.js';
import { emit } from './bus.js';

/** @typedef {{ el: HTMLElement, shown?: (params: Record<string, string>) => void, hidden?: () => void, keep?: boolean }} Screen */
/** @type {Map<string, (params: Record<string, string>) => Screen>} */
const factories = new Map();
/** @type {Map<string, Screen>} */
const kept = new Map();
/** @type {{ name: string, params: Record<string, string>, screen: Screen } | null} */
let current = null;
/** @type {{ id: number, close: () => void }[]} */
const overlays = [];
let depth = 0;   // how many entries this session has pushed (so back never leaves the app)
let overlaySeq = 0;
let swallow = 0;   // back steps we took ourselves to close a layer from its own button: their popstate is not a navigation
/** @type {[string, Record<string, string>, { replace: boolean }] | null} */
let queued = null;   // a go() asked for while such a back step is still on its way (it runs right after)

export const ROOTS = ['live', 'studio'];

export function define(/** @type {string} */ name, /** @type {(params: Record<string, string>) => Screen} */ make) { factories.set(name, make); }
export const here = () => current?.name || '';
export const params = () => current?.params || {};

/** #/work/abc → { name: 'work', params: { id: 'abc' } } */
function parse(hash = location.hash) {
  const [name, id] = hash.replace(/^#\/?/, '').split('/');
  const known = factories.has(name) ? name : '';
  return { name: known, params: id ? { id: decodeURIComponent(id) } : {} };
}
const hashOf = (/** @type {string} */ name, /** @type {Record<string, string>} */ p = {}) => '#/' + name + (p.id ? '/' + encodeURIComponent(p.id) : '');

/** 去某个页面。replace：替换当前这一格（例如两个根页面之间切换）。 */
export function go(/** @type {string} */ name, /** @type {Record<string, string>} */ p = {}, o = { replace: false }) {
  if (swallow > 0) { queued = [name, p, o]; return; }
  // an open sheet's history entry becomes the new page's, so one back gesture returns to where the sheet was opened
  const fromOverlay = overlays.length > 0;
  closeOverlays();
  const swap = o.replace || (ROOTS.includes(name) && ROOTS.includes(here()));
  if (fromOverlay && !swap) { depth++; history.replaceState({ app: true, depth }, '', hashOf(name, p)); }
  else if (swap) history.replaceState({ app: true, depth }, '', hashOf(name, p));
  else { depth++; history.pushState({ app: true, depth }, '', hashOf(name, p)); }
  show(name, p);
}

/** 返回上一页；如果这是进入应用的第一页，就回到根页面，而不是离开应用。 */
export function back(/** @type {string} */ fallback = '') {
  if (overlays.length) { history.back(); return; }
  if (depth > 0) { history.back(); return; }
  const root = fallback || lastRoot();
  history.replaceState({ app: true, depth: 0 }, '', hashOf(root));
  show(root, {});
}
let rootPref = 'live';
export const lastRoot = () => rootPref;
export function setRootPref(/** @type {string} */ r) { if (ROOTS.includes(r)) rootPref = r; }

function show(/** @type {string} */ name, /** @type {Record<string, string>} */ p) {
  const make = factories.get(name);
  if (!make) return;
  const prev = current;
  if (prev && prev.name === name && JSON.stringify(prev.params) === JSON.stringify(p)) { prev.screen.shown?.(p); return; }
  let screen = kept.get(name);
  if (!screen) {
    screen = make(p);
    if (screen.keep) kept.set(name, screen);
    stageEl().querySelector('.screens')?.append(screen.el);
  }
  if (ROOTS.includes(name)) rootPref = name;
  current = { name, params: p, screen };
  screen.el.hidden = false;
  screen.el.removeAttribute('inert');
  const forward = !prev || rank(name) >= rank(prev.name);
  if (!reduced) screen.el.animate(forward
    ? [{ opacity: 0, transform: 'translateY(14px) scale(.985)' }, { opacity: 1, transform: 'none' }]
    : [{ opacity: 0, transform: 'scale(1.015)' }, { opacity: 1, transform: 'none' }], { duration: 260, easing: 'cubic-bezier(.2,.8,.2,1)' });
  screen.shown?.(p);
  if (prev && prev.screen !== screen) {
    prev.screen.hidden?.();
    if (prev.screen.keep) { prev.screen.el.hidden = true; prev.screen.el.setAttribute('inert', ''); }
    else prev.screen.el.remove();
  }
  document.documentElement.dataset.screen = name;
  emit('screen', name);
}
const rank = (/** @type {string} */ n) => ({ live: 0, studio: 0, gallery: 1, me: 1, result: 2, work: 2 })[n] ?? 1;

/**
 * 一个盖在页面上的层（抽屉、弹窗）：占一格历史，所以返回手势会先把它关掉。
 * 返回 dismiss()：用户点「关闭」时调用它。
 * @param {() => void} close 真正把层收起来的函数（只会被调用一次）
 */
export function overlay(close) {
  const id = ++overlaySeq;
  overlays.push({ id, close });
  history.pushState({ app: true, depth, overlay: id }, '');
  // 点「关闭」：层立刻收起（不等浏览器的后退事件），再把它那一格历史退掉
  return () => {
    const i = overlays.findIndex(o => o.id === id);
    if (i < 0) return;
    overlays.splice(i, 1);
    close();
    swallow++;
    history.back();
  };
}
function closeOverlays() { while (overlays.length) overlays.pop()?.close(); }

window.addEventListener('popstate', () => {
  if (swallow > 0) {
    swallow--;
    if (!swallow && queued) { const q = queued; queued = null; go(...q); }
    return;
  }
  // 返回手势：回到同一个页面的那一格 = 关掉最上面那一层；地址变了（例如直接改了地址）= 收起所有层，去那个页面
  const to = parse();
  const same = !to.name || (current && to.name === current.name && JSON.stringify(to.params) === JSON.stringify(current.params));
  if (overlays.length && same) {
    const top = overlays.pop();
    top?.close();
    return;
  }
  if (overlays.length) closeOverlays();
  depth = Math.max(0, (history.state?.depth ?? depth - 1));
  const { name, params: p } = parse();
  show(name || rootPref, p);
});

/** 第一次打开：按地址进入，地址不认识就去根页面。 */
export function start(/** @type {string} */ fallback) {
  const { name, params: p } = parse();
  const first = name || fallback;
  history.replaceState({ app: true, depth: 0 }, '', hashOf(first, p));
  // 直接打开的是详情页：在它下面垫一个根页面，这样「返回」有地方可回
  if (!ROOTS.includes(first)) {
    history.replaceState({ app: true, depth: 0 }, '', hashOf(rootPref));
    history.pushState({ app: true, depth: 1 }, '', hashOf(first, p));
    depth = 1;
  }
  show(first, p);
}
