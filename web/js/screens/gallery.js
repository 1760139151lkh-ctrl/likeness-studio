/**
 * 作品库：你的创作历史（按天分组，生成中/失败一眼可见）、收藏的风格、没做完的草稿。左上角永远是返回。
 */
import { h, icon, dayOf } from '../core/dom.js';
import { go } from '../core/nav.js';
import { on } from '../core/bus.js';
import { presetById } from '../presets.js';
import { works, resultUrl, favs, draft, source as sourceById, sourceUrl, saveDraft } from '../core/data.js';
import { topBar, styleCard } from '../ui/parts.js';
import { T } from '../copy.js';

export function galleryScreen() {
  let tab = sessionStorage.getItem('hjx.galleryTab') || 'works';
  const list = h('div.gal__list');
  const segBtn = (/** @type {string} */ k, /** @type {string} */ label) => h('button.seg__opt', { type: 'button', role: 'tab', data: { k }, onclick: () => { tab = k; sessionStorage.setItem('hjx.galleryTab', k); paint(); } }, label);
  const seg = h('div.seg', { role: 'tablist', 'aria-label': T.gallery }, segBtn('works', '作品'), segBtn('favs', '收藏风格'), segBtn('drafts', '草稿'));
  const count = h('span.bar__count');
  const el = h('section.screen.gallery', { 'aria-label': T.gallery }, topBar(T.gallery, [count]), h('div.gal__seg', null, seg), h('div.gal__scroll', null, list));

  let rev = 0;
  async function paint() {
    const me = ++rev;
    seg.querySelectorAll('button').forEach(b => b.setAttribute('aria-selected', String(/** @type {HTMLElement} */ (b).dataset.k === tab)));
    const all = works();
    count.textContent = all.length ? all.length + ' 件' : '';
    if (tab === 'works') {
      if (!all.length) { list.replaceChildren(emptyBox('gallery', T.emptyGallery, T.emptyGalleryLine, [h('button.btn.btn--main', { type: 'button', onclick: () => go('live') }, h('span', { html: icon('camera') }), T.live), h('button.btn.btn--ghost', { type: 'button', onclick: () => go('studio') }, h('span', { html: icon('upload') }), T.studio)])); return; }
      /** @type {Map<string, any[]>} */ const days = new Map();
      for (const w of all) { const k = dayOf(w.createdAt); if (!days.has(k)) days.set(k, []); days.get(k)?.push(w); }
      const sections = [...days].map(([k, ws]) => h('section.gal__day', null, h('h2.gal__dayname', null, k), h('div.grid', null, ...ws.map(tile))));
      if (me === rev) list.replaceChildren(...sections);
    } else if (tab === 'favs') {
      const f = favs();
      list.replaceChildren(f.length ? h('div.grid.grid--cards', null, ...f.map(id => styleCard(id, { onPick: () => { saveDraft('studio', { ...(draft('studio') || {}), preset: id, tab: 'style' }); go('studio'); } }))) : emptyBox('heart', T.emptyFavs, '在风格卡右上角点一下爱心就能收藏', [h('button.btn.btn--main', { type: 'button', onclick: () => go('studio') }, '去挑风格')]));
    } else {
      const d = draft('studio');
      const s = d?.source ? sourceById(d.source) : null;
      const unfinished = all.filter(w => w.state === 'failed' || w.state === 'stopped');
      const items = [];
      if (s) {
        const p = presetById(d.preset);
        const img = /** @type {HTMLImageElement} */ (h('img', { alt: '' }));
        sourceUrl(s).then(u => { img.src = u; });
        items.push(h('button.draft', { type: 'button', onclick: () => go('studio') }, img, h('span.draft__text', null, h('b', null, '继续上次的创作'), h('span', null, (p?.name || '') + ' · 照片和设置都在')), h('span', { html: icon('chevron') })));
      }
      for (const w of unfinished) items.push(tile(w));
      list.replaceChildren(items.length ? h('div.drafts', null, ...items) : emptyBox('clock', '没有草稿', '没做完的创作和没生成成功的作品会出现在这里', []));
    }
  }
  function tile(/** @type {any} */ w) {
    const p = presetById(w.preset);
    const img = /** @type {HTMLImageElement} */ (h('img', { alt: '', loading: 'lazy', decoding: 'async' }));
    resultUrl(w).then(async u => { img.src = u || await sourceUrl(sourceById(w.source)); });
    const state = w.state === 'working' ? '生成中' : w.state === 'failed' ? '没成功' : w.state === 'stopped' ? '已取消' : '';
    return h('button.tile', { type: 'button', data: { state: w.state, style: w.preset }, 'aria-label': (p?.name || '') + (state ? '，' + state : ''), onclick: () => go(w.mode === 'live' && w.state !== 'done' ? 'result' : 'work', { id: w.id }) },
      img, h('span.tile__name', null, p?.name || ''), state ? h('span.tile__state', null, state) : null, w.fav ? h('span.tile__fav', { html: icon('heartFill') }) : null);
  }
  function emptyBox(/** @type {any} */ ic, /** @type {string} */ title, /** @type {string} */ line, /** @type {any[]} */ acts) {
    return h('div.empty', null, h('span.empty__ico', { html: icon(ic) }), h('h2', null, title), h('p', null, line), h('div.empty__acts', null, ...acts));
  }
  const offs = [on('works', () => { if (el.isConnected) paint(); }), on('favs', () => { if (el.isConnected) paint(); }), on('finished', () => { if (el.isConnected) paint(); })];
  return { el, shown: () => paint(), hidden: () => offs.forEach(f => f()) };
}
