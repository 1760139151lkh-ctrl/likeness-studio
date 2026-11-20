/**
 * 作品详情：前后对比、它的来历（风格、时间、用时）、完整的创作轨迹，以及下一步：微调细节 / 换个风格 / 保存 / 分享 / 删除。
 */
import { h, icon, toast } from '../core/dom.js';
import { go, back } from '../core/nav.js';
import { presetById, captionOf } from '../presets.js';
import { applyTheme } from '../core/theme.js';
import { work as workById, resultUrl, source as sourceById, sourceUrl, saveWork, deleteWork, note, saveDraft } from '../core/data.js';
import { topBar, compare, saveImage, shareTikTok, kindBadge } from '../ui/parts.js';
import { confirmBox } from '../ui/sheet.js';
import { setPref } from '../core/data.js';
import { T } from '../copy.js';

const KIND_ICON = { make: 'sparkle', style: 'palette', tweak: 'sliders', say: 'chat', save: 'download', share: 'send', fav: 'heart', fail: 'close' };

export function workScreen(/** @type {Record<string, string>} */ params) {
  const id = params.id || '';
  const w = workById(id);
  if (!w) {
    return { el: h('section.screen.work', null, topBar('作品'), h('div.empty', null, h('span.empty__ico', { html: icon('image') }), h('h2', null, '这件作品找不到了'), h('p', null, '可能已经删除，或者还没同步过来'), h('div.empty__acts', null, h('button.btn.btn--main', { type: 'button', onclick: () => go('gallery') }, '回' + T.gallery)))) };
  }
  const p = presetById(w.preset);
  const before = /** @type {HTMLImageElement} */ (h('img.frame__before', { alt: '原图' }));
  const after = /** @type {HTMLImageElement} */ (h('img.frame__after.is-in', { alt: '成片' }));
  const box = h('div.frame__img', null, before, after);
  const frame = h('div.frame.frame--work', { data: { frame: p?.theme.frame || '', format: w.format, state: w.state } }, box);
  const cmp = compare(box, before, after);
  const favBtn = h('button.ibtn', { type: 'button', onclick: async () => { w.fav = !w.fav; note(w, 'fav', w.fav ? '收藏了这张' : '取消收藏'); await saveWork(w); syncFav(); toast(w.fav ? '已收藏' : '已取消收藏'); } });
  const syncFav = () => { favBtn.innerHTML = icon(w.fav ? 'heartFill' : 'heart'); favBtn.setAttribute('aria-label', w.fav ? '取消收藏' : T.fav); favBtn.setAttribute('aria-pressed', String(!!w.fav)); };
  syncFav();
  const act = (/** @type {any} */ ic, /** @type {string} */ label, /** @type {() => void} */ run, cls = '') => h('button.act' + cls, { type: 'button', onclick: run }, h('span.act__ico', { html: icon(ic) }), h('span.act__label', null, label));
  const ready = w.state === 'done';
  const acts = h('div.work__acts', null,
    act('sliders', T.tweak, () => { saveDraft('studio', { source: w.source, preset: w.preset, params: w.params, format: w.format, tab: 'detail', from: w.id }); go('studio'); }),
    act('camera', T.same, () => { setPref('preset', w.preset); go('live'); }),
    act('palette', T.another, () => { saveDraft('studio', { source: w.source, preset: w.preset, params: w.params, format: w.format, tab: 'style', from: w.id }); go('studio'); }),
    ready ? act('download', T.save, async () => saveImage(w, await resultUrl(w))) : null,
    ready ? act('send', T.tiktok, async () => shareTikTok(w, await resultUrl(w)), '.act--main') : null
    );
  const delBtn = h('button.ibtn.ibtn--danger', { type: 'button', 'aria-label': T.del + '这件作品', title: T.del, html: icon('trash'), onclick: async () => { if (await confirmBox('删除这件作品？', '删除后作品和它的创作轨迹都会从你的私人空间移除，没法恢复。', '删除', '留着')) { await deleteWork(w.id); toast('已删除'); back('gallery'); } } });

  const when = new Date(w.createdAt);
  const meta = h('div.work__meta', null,
    h('b', null, p?.name || ''), h('span', null, captionOf(/** @type {any} */ (p), w.params)),
    h('span', null, `${when.getMonth() + 1}月${when.getDate()}日 ${String(when.getHours()).padStart(2, '0')}:${String(when.getMinutes()).padStart(2, '0')}` + (w.ms ? ' · 用时 ' + Math.max(1, Math.round(w.ms / 1000)) + ' 秒' : '') + ' · ' + (w.format === 'portrait' ? '竖版' : '头像')),
    kindBadge(w));
  const trail = h('ol.trail', { 'aria-label': '创作轨迹' }, ...(w.trail || []).slice().reverse().map(s => {
    const t = new Date(s.t);
    return h('li.trail__item', { data: { kind: s.kind } }, h('span.trail__ico', { html: icon(/** @type {any} */ (KIND_ICON[s.kind] || 'sparkle')) }),
      h('span.trail__text', null, s.text), h('time', null, `${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}`));
  }));
  const fail = w.state !== 'done' ? h('p.work__fail', null, w.state === 'working' ? '还在生成中…' : (w.error || T.failed)) : null;
  const el = h('section.screen.work', { 'aria-label': '作品详情' }, topBar(p?.name || '作品', [favBtn, delBtn]),
    h('div.work__scroll', null, frame, fail, meta, acts, h('h2.work__h', null, '创作轨迹'), trail));

  (async () => {
    applyTheme(w.preset);
    before.src = await sourceUrl(sourceById(w.source));
    const u = await resultUrl(w);
    if (u) after.src = u; else { after.src = before.src; }
    cmp.set(1);
  })();
  return { el };
}
