/**
 * 作品详情：前后对比（可切「和原图比 / 和上一版比」）、它的来历（风格、怎么改的、时间、用时）、这张照片的整条创作链、
 * 完整的创作轨迹，以及下一步：微调细节 / 部位精修 / 对话微调 / 拍同款 / 换个风格 / 分享卡 / 保存 / 分享 / 删除。
 */
import { h, icon, toast } from '../core/dom.js';
import { go, back } from '../core/nav.js';
import { presetById, captionOf } from '../presets.js';
import { applyTheme } from '../core/theme.js';
import { work as workById, resultUrl, source as sourceById, sourceUrl, saveWork, deleteWork, note, saveDraft, setPref, chainOf } from '../core/data.js';
import { topBar, compare, saveImage, shareTikTok, kindBadge, opLabel, opBadge } from '../ui/parts.js';
import { openCard } from '../ui/card.js';
import { confirmBox } from '../ui/sheet.js';
import { T } from '../copy.js';

const KIND_ICON = { make: 'sparkle', style: 'palette', tweak: 'face', say: 'chat', save: 'download', share: 'send', fav: 'heart', fail: 'close' };

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
  const frame = h('div.frame.frame--work', { data: { frame: p?.theme.frame || '', format: w.format, state: w.state } }, h('div.frame__fit', null, box));
  const cmp = compare(box, before, after);
  const favBtn = h('button.ibtn', { type: 'button', onclick: async () => { w.fav = !w.fav; note(w, 'fav', w.fav ? '收藏了这张' : '取消收藏'); await saveWork(w); syncFav(); toast(w.fav ? '已收藏' : '已取消收藏'); } });
  const syncFav = () => { favBtn.innerHTML = icon(w.fav ? 'heartFill' : 'heart'); favBtn.setAttribute('aria-label', w.fav ? '取消收藏' : T.fav); favBtn.setAttribute('aria-pressed', String(!!w.fav)); };
  syncFav();
  const act = (/** @type {any} */ ic, /** @type {string} */ label, /** @type {() => void} */ run, cls = '') => h('button.act' + cls, { type: 'button', onclick: run }, h('span.act__ico', { html: icon(ic) }), h('span.act__label', null, label));
  const ready = w.state === 'done';
  const studioWith = (/** @type {string} */ tab) => { saveDraft('studio', { source: w.source, preset: w.preset, params: w.params, format: w.format === 'portrait' ? 'portrait' : 'avatar', tab, from: w.id }); go('studio'); };
  const acts = h('div.work__acts', null,
    act('sliders', T.tweak, () => studioWith('tune')),
    ready ? act('face', '部位精修', () => studioWith('parts')) : null,
    ready ? act('chat', '对话微调', () => studioWith('chat')) : null,
    act('palette', T.another, () => studioWith('style')),
    act('camera', T.same, () => { setPref('preset', w.preset); go('live'); }),
    ready ? act('card', '分享卡', () => openCard(w)) : null,
    ready ? act('download', T.save, async () => saveImage(w, await resultUrl(w))) : null,
    ready ? act('send', T.tiktok, async () => shareTikTok(w, await resultUrl(w)), '.act--main') : null);
  const delBtn = h('button.ibtn.ibtn--danger', { type: 'button', 'aria-label': T.del + '这件作品', title: T.del, html: icon('trash'), onclick: async () => { if (await confirmBox('删除这件作品？', '删除后这一版和它的创作轨迹都会从你的私人空间移除，没法恢复。在它基础上改出来的其他版本不受影响。', '删除', '留着')) { await deleteWork(w.id); toast('已删除'); back('gallery'); } } });

  // 对比谁：原图 / 上一版（它是在哪一版上改的）
  const base = w.base ? workById(w.base) : null, parent = !base && w.parent ? workById(w.parent) : null;
  const prev = base || (parent && parent.state === 'done' ? parent : null);
  let against = prev ? 'prev' : 'source';
  const cmpSeg = prev ? h('div.seg.seg--sm.work__against', { role: 'radiogroup', 'aria-label': '和谁对比' },
    ...[['prev', '比上一版'], ['source', '比原图']].map(([k, label]) => h('button.seg__opt', { type: 'button', role: 'radio', 'aria-checked': String(k === against), onclick: () => { against = k; cmpSeg?.querySelectorAll('button').forEach(b => b.setAttribute('aria-checked', String(b.textContent === label))); paintBefore(); } }, label))) : null;
  async function paintBefore() {
    before.src = against === 'prev' && prev ? await resultUrl(prev) : await sourceUrl(sourceById(w.source));
    cmp.sweep();
  }

  const when = new Date(w.createdAt);
  const how = w.op === 'region' ? (w.parts || []).join('、') : w.op === 'edit' ? '「' + (w.say || '') + '」' : w.op === 'vary' || w.op === 'angles' ? (w.say || opLabel(w)) + ' · 第 ' + ((w.index || 0) + 1) + ' 张' : captionOf(/** @type {any} */ (p), w.params);
  const meta = h('div.work__meta', null,
    h('b', null, w.op && w.op !== 'restyle' ? opLabel(w) + ' · ' + (p?.name || '') : p?.name || ''), h('span', null, how),
    w.reply ? h('span.work__reply', null, h('span', { html: icon('chat') }), w.reply) : null,
    h('span', null, `${when.getMonth() + 1}月${when.getDate()}日 ${String(when.getHours()).padStart(2, '0')}:${String(when.getMinutes()).padStart(2, '0')}` + (w.ms ? ' · 用时 ' + Math.max(1, Math.round(w.ms / 1000)) + ' 秒' : '') + ' · ' + (w.format === 'portrait' ? '竖版' : w.format === 'photo' ? '原图比例' : '头像')),
    kindBadge(w));
  // 这张照片的创作链
  const chain = chainOf(w.source).filter(x => x.state === 'done');
  const chainRow = chain.length > 1 ? h('div.work__chain', { role: 'list', 'aria-label': '同一张照片的其他版本' }, ...chain.slice(-24).map(x => {
    const b = h('button.ver', { type: 'button', role: 'listitem', 'aria-pressed': String(x.id === w.id), 'aria-label': opLabel(x), onclick: () => { if (x.id !== w.id) go('work', { id: x.id }, { replace: true }); } }, h('img', { alt: '' }), opBadge(x), h('span', null, opLabel(x)));
    resultUrl(x).then(u => { /** @type {HTMLImageElement} */ (b.querySelector('img')).src = u; });
    return b;
  })) : null;
  const trail = h('ol.trail', { 'aria-label': '创作轨迹' }, ...(w.trail || []).slice().reverse().map(s => {
    const t = new Date(s.t);
    return h('li.trail__item', { data: { kind: s.kind } }, h('span.trail__ico', { html: icon(/** @type {any} */ (KIND_ICON[s.kind] || 'sparkle')) }),
      h('span.trail__text', null, s.text), h('time', null, `${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}`));
  }));
  const fail = w.state !== 'done' ? h('p.work__fail', null, w.state === 'working' ? '还在生成中…' : (w.error || T.failed)) : null;
  const el = h('section.screen.work', { 'aria-label': '作品详情' }, topBar(w.op && w.op !== 'restyle' ? opLabel(w) : p?.name || '作品', [favBtn, delBtn]),
    h('div.work__scroll', null, frame, cmpSeg, fail, meta, acts,
      chainRow ? h('h2.work__h', null, '同一张照片的版本') : null, chainRow,
      h('h2.work__h', null, '创作轨迹'), trail));

  (async () => {
    applyTheme(w.preset);
    const u = await resultUrl(w);
    after.src = u || await sourceUrl(sourceById(w.source));
    await new Promise(r => { if (after.complete) r(0); else { after.onload = r; after.onerror = r; } });
    frame.style.setProperty('--ar', String(Math.max(.56, Math.min(1.6, (after.naturalWidth / after.naturalHeight) || 1))));
    await paintBefore();
    cmp.set(1);
  })();
  return { el };
}
