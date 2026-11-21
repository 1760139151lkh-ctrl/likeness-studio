/**
 * 上传精修的三个基础面板：
 *   风格  分类胶囊 + 三列风格卡（真样张封面），最后一类是「自创」：一句话造一个全新风格（旧版 Rooms 的「用一句话发明一个世界」）
 *   微调  风格强度 / 保留像貌 / 细节丰富度 / 美颜微调，画幅、画质，一键重置
 *   细节  配饰 / 光效 / 背景氛围 / 画框装饰，外加「补一句」（输入框贴着键盘上沿，页面不被挤压）
 * 每一个改动都经 ctx.commit 记一步，能撤回。
 */
import { h, icon, toast, chooseFile } from '../core/dom.js';
import { presetById, inCategory, categories, toggleDetail, DETAIL_GROUPS, KNOBS } from '../presets.js';
import { cover } from '../core/assets.js';
import { isFav, toggleFav, pref, setPref, saveStyle, addSource, ensureUploaded } from '../core/data.js';
import { studio, inventStyle } from '../core/api.js';
import { prepare } from '../core/image.js';
import { applyTheme } from '../core/theme.js';
import { sheet, focusSoon } from '../ui/sheet.js';
import { etaText } from '../ui/parts.js';
import { T, level } from '../copy.js';

/** 面板底部的「一键变身」（和收起时的主按钮同一个动作）。 */
function makeCta(/** @type {any} */ ctx) {
  const b = ctx.cta(T.go, '', () => ctx.make());
  const paint = () => {
    const p = presetById(ctx.S.preset), w = ctx.shownWork();
    const busy = !!w && w.op === 'restyle' && w.state === 'working';
    b.toggleAttribute('disabled', busy);
    b.querySelector('.cta__label').textContent = !ctx.sourceObj() ? T.upload : busy ? '出片中…' : T.go;
    b.querySelector('.cta__sub').textContent = !ctx.sourceObj() ? '先来一张照片' : (p?.name || '') + ' · ' + etaText();
  };
  return Object.assign(b, { paint });
}

// ───────────── 风格 ─────────────
export function stylePanel(/** @type {any} */ ctx) {
  const pills = h('nav.pills', { role: 'tablist', 'aria-label': '风格分类' });
  const grid = h('div.sgrid', { role: 'listbox', 'aria-label': '风格' });
  const foot = makeCta(ctx);
  const body = h('div.tp.tp--split', null, pills, grid);
  function paintPills() {
    pills.replaceChildren(...[...categories(), { id: 'mine', label: '自创' }].filter((c, i, a) => a.findIndex(x => x.id === c.id) === i).map(c =>
      h('button.pill', { type: 'button', role: 'tab', data: { cat: c.id }, 'aria-selected': String(c.id === ctx.cat), onclick: () => { ctx.cat = c.id; paintPills(); paintGrid(true); } }, c.id === 'mine' ? '自创 +' : c.label)));
    requestAnimationFrame(() => pills.querySelector('[aria-selected="true"]')?.scrollIntoView({ inline: 'center', block: 'nearest' }));
  }
  function card(/** @type {any} */ p) {
    const on = p.id === ctx.S.preset;
    const fav = h('span.scard__fav', { role: 'button', tabindex: '0', 'aria-label': isFav(p.id) ? '取消收藏' : T.fav, 'aria-pressed': String(isFav(p.id)), html: icon(isFav(p.id) ? 'heartFill' : 'heart'),
      onclick: async (/** @type {Event} */ e) => { e.stopPropagation(); const f = await toggleFav(p.id); fav.innerHTML = icon(f ? 'heartFill' : 'heart'); fav.setAttribute('aria-pressed', String(f)); toast(f ? '已收藏「' + p.name + '」' : '已取消收藏'); } });
    const marks = [p.isNew ? h('span.scard__tag', null, 'NEW') : p.hot >= 3 ? h('span.scard__tag.is-hot', null, 'HOT') : null,
      on ? h('span.scard__on', null, h('span', { html: icon('eye') }), '看样张') : null];
    const art = p.custom
      ? h('span.scard__art.scard__art--custom', { style: { background: `linear-gradient(150deg, ${p.theme.bg}, ${p.theme.bg2})`, color: p.theme.ink } }, h('b', null, p.name.slice(0, 2)), ...marks)
      : h('span.scard__art', null, h('img', { src: cover(p.id, 'm').art, alt: '', loading: 'lazy', decoding: 'async' }), ...marks);
    return h('button.scard', { type: 'button', role: 'option', data: { style: p.id, frame: p.theme.frame }, 'aria-selected': String(on), 'aria-label': p.name + '：' + p.line,
      style: { '--c-accent': p.theme.accent }, onclick: () => { ctx.pickStyle(p.id); paintGrid(); } },
      art, h('span.scard__name', null, p.name), h('span.scard__hook', null, p.hook || p.line), fav);
  }
  function paintGrid(scrollTop = false) {
    const list = inCategory(ctx.cat);
    const kids = list.map(card);
    if (ctx.cat === 'mine') kids.unshift(h('button.scard.scard--new', { type: 'button', onclick: () => invent() }, h('span.scard__art', null, h('span', { html: icon('wand') })), h('span.scard__name', null, '造个新风格'), h('span.scard__hook', null, '一句话就行')));
    grid.replaceChildren(...kids);
    if (scrollTop) grid.scrollTop = 0;
    else requestAnimationFrame(() => grid.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' }));
  }
  /** 自创风格：一句话（可配一张参考图）→ 名字、口号、配色主题、实时滤镜、生图 Prompt、八个细节，一整个新世界。 */
  function invent() {
    if (!studio.live) { toast('自创风格要连上工作室才能用（演示版不行）'); return; }
    const field = /** @type {HTMLTextAreaElement} */ (h('textarea.say__field', { rows: 2, maxlength: 120, placeholder: '比如：雨夜东京的爵士酒吧、外婆家的南洋厨房、蒸汽波泳池…', 'aria-label': '想要什么风格', enterkeyhint: 'go' }));
    let ref = /** @type {Blob | null} */ (null);
    const refBtn = h('button.btn.btn--ghost.btn--sm', { type: 'button', onclick: async () => {
      const f = await chooseFile(); if (!f) return;
      ref = (await prepare(f, 1024)).blob; refBtn.replaceChildren(h('span', { html: icon('check') }), '已加参考图');
    } }, h('span', { html: icon('image') }), '加张参考图');
    const ideas = h('div.chips', null, ...['蒸汽波泳池', '雨夜爵士酒吧', '敦煌飞天', '南洋咖啡店', '宝可梦训练家风'].map(t => h('button.chip2', { type: 'button', onclick: () => { field.value = t; field.focus({ preventScroll: true }); } }, t)));
    const status = h('p.sheet__text', { 'aria-live': 'polite' });
    const goBtn = h('button.btn.btn--main', { type: 'button', onclick: async () => {
      const text = field.value.trim();
      if (!text && !ref) { status.textContent = '说一句你想要的风格，或者加一张参考图'; return; }
      goBtn.setAttribute('disabled', ''); status.textContent = '正在造一个新世界…（大概十几秒）';
      try {
        let asset = '';
        if (ref) { const s = await addSource(ref, {}); asset = await ensureUploaded(s); }
        const r = await inventStyle({ text, ...(asset ? { asset } : {}) });
        const p = { ...r.style, id: 'my-' + Date.now().toString(36), custom: true, cat: 'mine', hot: 0 };
        await saveStyle(p);
        close();
        ctx.cat = 'mine'; paintPills(); ctx.pickStyle(p.id); paintGrid();
        toast('新风格「' + p.name + '」造好了，点「一键变身」试试', { tone: 'ok', ms: 3600 });
      } catch (e) { status.textContent = /** @type {any} */ (e)?.message || '这次没造出来，换个说法试试'; }
      finally { goBtn.removeAttribute('disabled'); }
    } }, h('span', { html: icon('wand') }), '造出来');
    const { close } = sheet(() => [field, ideas, status, h('div.sheet__acts', null, refBtn, goBtn)], { title: '自创风格', cls: 'sheet--top' });
    focusSoon(field);
  }
  return {
    body, foot,
    shown() { paintPills(); paintGrid(); foot.paint(); },
    repaint() { paintGrid(); foot.paint(); },
    paintCta() { foot.paint(); },
  };
}

// ───────────── 微调 ─────────────
export function tunePanel(/** @type {any} */ ctx) {
  const foot = makeCta(ctx);
  const body = h('div.tp.tp--pad');
  function paint() {
    const P = ctx.S.params;
    const knob = (/** @type {any} */ k) => {
      const val = h('b.knob__val', null, level(P[k.id]) + ' · ' + P[k.id]);
      const r = /** @type {HTMLInputElement} */ (h('input.range', { type: 'range', min: '0', max: '100', step: '5', value: String(P[k.id]), 'aria-label': k.label }));
      r.style.setProperty('--v', P[k.id] + '%');
      let from = P[k.id];
      r.addEventListener('pointerdown', () => { from = P[k.id]; });
      r.addEventListener('input', () => { val.textContent = level(Number(r.value)) + ' · ' + r.value; r.style.setProperty('--v', r.value + '%'); P[k.id] = Number(r.value); });
      r.addEventListener('change', () => ctx.setParams({ [k.id]: Number(r.value) }, k.label + ' ' + from + '→' + r.value));
      return h('label.knob', null, h('span.knob__head', null, h('span.knob__name', null, k.label), val), r, h('span.knob__ends', null, h('span', null, k.low), h('span', null, k.high)));
    };
    const segOf = (/** @type {string} */ label, /** @type {[string, string][]} */ opts, /** @type {string} */ now, /** @type {(v: string) => void} */ set) => h('div.opt', null, h('span.opt__name', null, label),
      h('div.seg.seg--sm', { role: 'radiogroup', 'aria-label': label }, ...opts.map(([v, t]) => h('button.seg__opt', { type: 'button', role: 'radio', 'aria-checked': String(v === now), onclick: () => { set(v); paint(); } }, t))));
    body.replaceChildren(
      h('div.knobs', null, ...KNOBS.map(knob)),
      segOf('画幅', [['avatar', T.format.avatar], ['portrait', T.format.portrait]], ctx.S.format, v => ctx.setFormat(v)),
      studio.live ? segOf('画质', [['quick', T.pace.quick], ['fine', T.pace.fine], ['deep', T.pace.deep]], pref('pace', 'fine'), v => { setPref('pace', v); ctx.paintCta(); foot.paint(); toast(T.pace[/** @type {'fine'} */ (v)] + ' · ' + T.paceLine[/** @type {'fine'} */ (v)]); }) : null,
      h('div.opt', null, h('span.opt__name', null, '不满意？'), h('button.btn.btn--ghost.btn--sm', { type: 'button', onclick: () => { ctx.resetParams(); paint(); } }, h('span', { html: icon('refresh') }), '重置为默认')));
  }
  return { body, foot, shown() { paint(); foot.paint(); }, repaint() { paint(); foot.paint(); }, paintCta() { foot.paint(); } };
}

// ───────────── 细节 ─────────────
export function detailPanel(/** @type {any} */ ctx) {
  const foot = makeCta(ctx);
  const body = h('div.tp.tp--pad');
  function paint() {
    const p = /** @type {any} */ (presetById(ctx.S.preset)), P = ctx.S.params;
    const groups = DETAIL_GROUPS.map(g => h('div.dgroup', null, h('span.dgroup__name', null, g.label),
      h('div.chips', { role: 'group', 'aria-label': g.label }, ...p.details.filter((/** @type {any} */ x) => x.group === g.id).map((/** @type {any} */ x) =>
        h('button.chip2', { type: 'button', data: { id: x.id }, 'aria-pressed': String(P.details.includes(x.id)), onclick: () => {
          const had = P.details.includes(x.id);
          ctx.setParams({ details: toggleDetail(p, P.details, x.id) }, (had ? '去掉「' : '加上「') + x.label + '」');
          paint();
        } }, x.label)))));
    const field = /** @type {HTMLTextAreaElement} */ (h('textarea.say__field.say__field--inline', { rows: 2, maxlength: 200, placeholder: T.wordsHint, 'aria-label': T.words, enterkeyhint: 'done' }));
    field.value = P.words || '';
    const save = () => { const v = field.value.trim(); if (v !== (P.words || '')) ctx.setParams({ words: v }, v ? '补一句：' + v : '清空了补充'); };
    field.addEventListener('change', save);
    field.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); field.blur(); } });
    field.addEventListener('blur', save);
    body.replaceChildren(...groups, h('div.dgroup', null, h('span.dgroup__name', null, T.words + '（想要的细节，直接说）'), field));
  }
  return { body, foot, shown() { paint(); foot.paint(); }, repaint() { if (!body.contains(document.activeElement)) paint(); foot.paint(); }, paintCta() { foot.paint(); } };
}

void applyTheme;
