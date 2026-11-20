/**
 * 上传精修：艺术头像深度创作台。一次上传，无限换装与精雕。
 *
 *   画面  没图时是上传引导；有图时显示原图 + 当前风格的预计效果和构图小贴士；生成中是三段进度；出片后是可拖动的前后对比
 *   版本  同一张照片做过的所有版本排成一排，点哪个看哪个
 *   面板  风格 | 微调 | 细节 三个标签，进阶选项收在里面，不挤在一起
 *   底部  一个主按钮「一键变身」，写清预计耗时
 *
 * 选择、参数、标签页、当前照片都随手存成草稿：刷新、切页、关掉再开都回到原样。
 */
import { h, icon, toast, chooseFile, reduced, dayOf } from '../core/dom.js';
import { go } from '../core/nav.js';
import { on } from '../core/bus.js';
import { PRESETS, presetById, defaultsOf, toggleDetail, captionOf, DETAIL_GROUPS, KNOBS, inCategory } from '../presets.js';
import { applyTheme } from '../core/theme.js';
import { draft, saveDraft, pref, setPref, addSource, source as sourceById, sourceUrl, sourceBlob, works, resultUrl, work as workById, note, saveWork } from '../core/data.js';
import { create, watch, stop, retry, isRunning } from '../core/generate.js';
import { prepare, decode, lightOf } from '../core/image.js';
import { personArt, samples, cover } from '../core/assets.js';
import { studio as server } from '../core/api.js';
import { pills, styleCard, compare, progressBox, saveImage, shareTikTok, kindBadge, etaText } from '../ui/parts.js';
import { sheet } from '../ui/sheet.js';
import { reveal, burst, buzz, firstLook } from '../ui/fx.js';
import { openExamples } from '../ui/examples.js';
import { T, level } from '../copy.js';

export function studioScreen() {
  const d0 = draft('studio') || {};
  let presetId = presetById(d0.preset) ? d0.preset : pref('preset', 'princess');
  let params = loadParams(presetId, d0.preset === presetId ? d0.params : null);
  let format = /** @type {'avatar' | 'portrait'} */ (d0.format || pref('format', 'avatar'));
  let tab = d0.tab || 'style', cat = d0.cat || 'hot';
  let src = /** @type {import('../core/data.js').Source | null} */ (sourceById(d0.source || ''));
  let shown = d0.shown || '';
  let unwatch = () => {};

  function loadParams(/** @type {string} */ id, /** @type {any} */ given) {
    const p = /** @type {any} */ (presetById(id));
    return { ...defaultsOf(p), ...(given || pref('params.' + id, {})), details: [...((given || pref('params.' + id, {})).details || p.defaults.details)] };
  }
  const keep = () => {
    setPref('params.' + presetId, params);
    saveDraft('studio', { source: src?.id || '', preset: presetId, params, format, tab, cat, shown });
  };

  // ── 顶栏 ──
  const bar = h('header.bar.bar--root', null,
    h('button.chip', { type: 'button', onclick: () => go('gallery'), 'aria-label': T.gallery }, h('span', { html: icon('gallery') }), h('span', null, T.gallery)),
    h('h1.bar__title', null, T.studio),
    h('button.avatar', { type: 'button', onclick: () => go('me'), 'aria-label': T.me }, h('span', { html: icon('user') })));

  // ── 画面 ──
  const before = /** @type {HTMLImageElement} */ (h('img.frame__before', { alt: '原图' }));
  const pre = /** @type {HTMLImageElement} */ (h('img.frame__pre', { alt: '' }));
  const after = /** @type {HTMLImageElement} */ (h('img.frame__after', { alt: '成片' }));
  const prog = progressBox(() => shown && stop(shown));
  const hintChip = h('button.frame__chip', { type: 'button', 'aria-label': '看这个风格的样张', onclick: () => openExamples(presetId, { onUse: id => pickStyle(id) }) });
  const tip = h('p.frame__tip', { 'aria-live': 'polite' });
  const badges = h('div.frame__badges');
  const changeBtn = h('button.frame__change', { type: 'button', onclick: () => pickPhoto() }, h('span', { html: icon('image') }), T.change);
  const failBox = h('div.frame__fail', { hidden: true });
  const next = h('div.next', { hidden: true },
    nextBtn('sliders', T.tweak, () => setTab('tune')), nextBtn('palette', T.another, () => setTab('style')),
    nextBtn('download', T.save, () => withShown(async w => saveImage(w, await resultUrl(w)))),
    nextBtn('send', T.tiktok, () => withShown(async w => shareTikTok(w, await resultUrl(w)))));
  const frameBox = h('div.frame__img', null, before, pre, after);
  const frame = h('div.frame', { data: { format } }, frameBox, hintChip, badges, changeBtn, prog, failBox, tip);
  const cmp = compare(frameBox, before, after);
  const versions = h('div.versions', { role: 'listbox', 'aria-label': '版本' });
  const empty = emptyState();
  const canvas = h('div.studio__canvas', null, empty, frame, versions);

  // ── 面板 ──
  const tabBtns = /** @type {Record<string, HTMLElement>} */ ({});
  const seg = h('div.seg', { role: 'tablist', 'aria-label': '创作选项' }, ...['style', 'tune', 'detail'].map(k => (tabBtns[k] = h('button.seg__opt', { type: 'button', role: 'tab', onclick: () => setTab(k) }, T.tabs[/** @type {'style'} */ (k)]))));
  const body = h('div.panel__body');
  const panel = h('div.panel', null, seg, body);

  // ── 主按钮 ──
  const goLabel = h('b.cta__label'), goSub = h('span.cta__sub');
  const goBtn = h('button.cta', { type: 'button', onclick: () => make() }, h('span.cta__ico', { html: icon('sparkle') }), h('span.cta__text', null, goLabel, goSub));
  const dock = h('div.studio__dock', null, goBtn, next);
  const modes = h('nav.modes.modes--solid', { 'aria-label': '模式' },
    h('button.modes__opt', { type: 'button', onclick: () => go('live') }, T.live),
    h('button.modes__opt', { type: 'button', 'aria-current': 'page' }, T.studio));

  const el = h('section.screen.studio', { 'aria-label': T.studio }, bar, canvas, panel, dock, modes);

  function nextBtn(/** @type {any} */ ic, /** @type {string} */ label, /** @type {() => void} */ run) {
    return h('button.next__btn', { type: 'button', onclick: run }, h('span', { html: icon(ic) }), h('span', null, label));
  }
  function withShown(/** @type {(w: any) => Promise<void>} */ fn) {
    const w = workById(shown); if (!w || w.state !== 'done') return;
    fn(w).catch(e => toast(e?.message || '没成功，再试一次'));
  }

  // ── 没有照片时 ──
  function emptyState() {
    const demo = h('div.drop__demo', { 'aria-hidden': 'true' },
      h('img.drop__a', { src: personArt('mei', 'm'), alt: '' }), h('span.drop__arrow', { html: icon('sparkle') }), h('img.drop__b', { alt: '' }));
    return h('div.drop', null, demo,
      h('h2.drop__title', null, T.noPhoto), h('p.drop__line', null, T.noPhotoLine),
      h('div.drop__acts', null,
        h('button.btn.btn--main.btn--lg', { type: 'button', onclick: () => pickPhoto() }, h('span', { html: icon('upload') }), T.upload),
        h('button.btn.btn--ghost', { type: 'button', onclick: () => pickSample() }, h('span', { html: icon('user') }), T.sample)),
      h('ul.drop__tips', null, h('li', null, '正脸、看镜头'), h('li', null, '光线均匀'), h('li', null, '照片只进你的私人空间')));
  }

  // ── 选照片 ──
  async function pickPhoto() {
    const f = await chooseFile();
    if (!f) return;
    try {
      const { blob, w, h: hh } = await prepare(f);
      useSource(await addSource(blob, { w, h: hh }));
    } catch (e) { toast(/** @type {any} */ (e)?.message || '这张图打不开，换一张试试'); }
  }
  function pickSample() {
    sheet(close => [
      h('p.sheet__text', null, '没有合适的自拍？先用示例人物玩一下（都是生成的虚构人物）。'),
      h('div.samples', null, ...samples().map(who => h('button.sample', { type: 'button', 'aria-label': '示例 ' + who, onclick: async () => {
        close();
        const blob = await fetch(personArt(who)).then(r => r.blob());
        useSource(await addSource(blob, { sample: who }));
      } }, h('img', { src: personArt(who, 'm'), alt: '', loading: 'lazy' })))),
    ], { title: T.sample });
  }
  /** @param {import('../core/data.js').Source} s */
  async function useSource(s) {
    src = s; shown = ''; dirty = false;
    keep(); render();
    if (!reduced) frame.animate([{ opacity: .4, transform: 'scale(.97)' }, { opacity: 1, transform: 'none' }], { duration: 320, easing: 'cubic-bezier(.2,.8,.2,1)' });
    checkPhoto(s);
  }
  /** 构图小贴士：亮度 + 能不能找到正脸（本机识别，不上传）。 */
  async function checkPhoto(/** @type {import('../core/data.js').Source} */ s) {
    tip.textContent = '';
    try {
      const blob = await sourceBlob(s); if (!blob) return;
      const bmp = await decode(blob);
      const { mean } = lightOf(/** @type {any} */ (bmp));
      if (mean < .22) { tip.textContent = T.tipLight; tip.dataset.tone = 'warn'; return; }
      const { findFace } = await import('../live/tracker.js');
      const c = document.createElement('canvas'), k = Math.min(1, 640 / Math.max(bmp.width, bmp.height));
      c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
      /** @type {CanvasRenderingContext2D} */ (c.getContext('2d')).drawImage(/** @type {any} */ (bmp), 0, 0, c.width, c.height);
      const face = await findFace(c);
      if (src?.id !== s.id) return;
      if (!face) { tip.textContent = T.tipNoFace; tip.dataset.tone = 'warn'; }
      else if (face.width < .18) { tip.textContent = '脸有点小，靠近一点或裁一下会更好'; tip.dataset.tone = 'warn'; }
      else { tip.textContent = T.tipGood; tip.dataset.tone = 'ok'; setTimeout(() => { if (tip.dataset.tone === 'ok') tip.textContent = ''; }, 3500); }
    } catch { /* 识别不了就不提示 */ }
  }

  // ── 标签页 ──
  function setTab(/** @type {string} */ k) { tab = k; keep(); paintPanel(); editing(); }
  /** 用户开始改设置了：底部从「下一步」换回主按钮。 */
  let dirty = false;   // 看着成片又改了设置：底部该是「一键变身」，而不是「下一步」
  function editing() { dirty = true; if (!next.hidden) { next.hidden = true; goBtn.hidden = false; paintCta(); } }
  function paintPanel() {
    for (const [k, b] of Object.entries(tabBtns)) b.setAttribute('aria-selected', String(k === tab));
    body.replaceChildren(...(tab === 'style' ? styleTab() : tab === 'tune' ? tuneTab() : detailTab()));
    body.scrollTop = 0;
  }
  function styleTab() {
    if (!inCategory(cat).some(p => p.id === presetId)) cat = presetById(presetId)?.cat || 'hot';
    const row = h('div.cards');
    const fill = () => { row.replaceChildren(...inCategory(cat).map(p => styleCard(p.id, { selected: p.id === presetId, onPick: pickStyle }))); requestAnimationFrame(() => row.querySelector('[aria-pressed="true"]')?.scrollIntoView({ inline: 'center', block: 'nearest' })); };
    fill();
    return [pills(cat, c => { cat = c; keep(); fill(); }), row];
  }
  function pickStyle(/** @type {string} */ id) {
    if (id === presetId) { openExamples(id, { onUse: x => pickStyle(x) }); return; }   // 再点一下当前的风格：看它的样张
    presetId = id; params = loadParams(id, null);
    setPref('preset', id); editing();
    applyTheme(id); keep(); paintPanel(); paintFrame(); paintCta();
    body.querySelector(`[data-style="${id}"]`)?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: reduced ? 'auto' : 'smooth' });
  }
  function tuneTab() {
    const knob = (/** @type {any} */ k) => {
      const val = h('b.knob__val', null, level(params[k.id]) + ' · ' + params[k.id]);
      const r = /** @type {HTMLInputElement} */ (h('input.range', { type: 'range', min: '0', max: '100', step: '5', value: String(params[k.id]), 'aria-label': k.label }));
      r.style.setProperty('--v', params[k.id] + '%');
      r.addEventListener('input', () => { params[k.id] = Number(r.value); val.textContent = level(params[k.id]) + ' · ' + r.value; r.style.setProperty('--v', r.value + '%'); });
      r.addEventListener('change', () => { keep(); editing(); });
      return h('label.knob', null, h('span.knob__head', null, h('span.knob__name', null, k.label), val), r, h('span.knob__ends', null, h('span', null, k.low), h('span', null, k.high)));
    };
    const segOf = (/** @type {string} */ label, /** @type {[string, string][]} */ opts, /** @type {string} */ now, /** @type {(v: string) => void} */ set) => h('div.opt', null, h('span.opt__name', null, label),
      h('div.seg.seg--sm', { role: 'radiogroup', 'aria-label': label }, ...opts.map(([v, t]) => h('button.seg__opt', { type: 'button', role: 'radio', 'aria-checked': String(v === now), onclick: (/** @type {Event} */ e) => { set(v); const g = /** @type {HTMLElement} */ (e.currentTarget).parentElement; g?.querySelectorAll('button').forEach(b => b.setAttribute('aria-checked', String(b === e.currentTarget))); } }, t))));
    return [
      h('div.knobs', null, ...KNOBS.map(knob)),
      segOf('画幅', [['avatar', T.format.avatar], ['portrait', T.format.portrait]], format, v => { format = /** @type {any} */ (v); setPref('format', v); frame.dataset.format = v; keep(); }),
      server.live ? segOf('画质', [['quick', T.pace.quick], ['fine', T.pace.fine], ['deep', T.pace.deep]], pref('pace', 'fine'), v => { setPref('pace', v); paintCta(); toast(T.paceLine[/** @type {'fine'} */ (v)]); }) : null,
    ].filter(Boolean);
  }
  function detailTab() {
    const p = /** @type {any} */ (presetById(presetId));
    const groups = DETAIL_GROUPS.map(g => h('div.dgroup', null, h('span.dgroup__name', null, g.label),
      h('div.chips', { role: 'group', 'aria-label': g.label }, ...p.details.filter((/** @type {any} */ x) => x.group === g.id).map((/** @type {any} */ x) =>
        h('button.chip2', { type: 'button', data: { id: x.id }, 'aria-pressed': String(params.details.includes(x.id)), onclick: () => {
          params.details = toggleDetail(p, params.details, x.id); keep(); editing();
          body.querySelectorAll('.chip2').forEach(b => b.setAttribute('aria-pressed', String(params.details.includes(/** @type {HTMLElement} */ (b).dataset.id))));
        } }, x.label)))));
    const say = h('button.say', { type: 'button', onclick: () => words() }, h('span', { html: icon('chat') }), params.words ? h('q', null, params.words) : h('span.say__hint', null, T.wordsHint));
    return [...groups, h('div.dgroup', null, h('span.dgroup__name', null, T.words), say)];
  }
  /** 补一句：卡片贴在屏幕上方，软键盘弹出也挡不住、顶不崩。 */
  function words() {
    const field = /** @type {HTMLTextAreaElement} */ (h('textarea.say__field', { rows: 3, maxlength: 200, placeholder: T.wordsHint, 'aria-label': T.words, enterkeyhint: 'done' }));
    field.value = params.words || '';
    const { close } = sheet(c => [field, h('div.sheet__acts', null,
      h('button.btn.btn--ghost', { type: 'button', onclick: () => { field.value = ''; } }, '清空'),
      h('button.btn.btn--main', { type: 'button', onclick: () => c() }, T.done))],
    { title: T.words, cls: 'sheet--top', onClose: () => { params.words = field.value.trim(); keep(); if (tab === 'detail') paintPanel(); } });
    field.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); close(); } });
    setTimeout(() => field.focus({ preventScroll: true }), 80);
  }

  // ── 画面状态 ──
  async function render() {
    el.dataset.has = src ? 'photo' : 'none';
    empty.hidden = !!src; frame.hidden = !src; versions.hidden = !src;
    const b = /** @type {HTMLImageElement | null} */ (empty.querySelector('.drop__b'));
    if (b) b.src = cover(presetId, 'm').art;
    if (!src) { next.hidden = true; goBtn.hidden = false; paintCta(); return; }
    before.src = await sourceUrl(src);
    paintVersions(); paintFrame(); paintCta();
  }
  function paintFrame() {
    const p = /** @type {any} */ (presetById(presetId));
    frame.dataset.frame = p.theme.frame; frame.dataset.format = format;
    const w = shown ? workById(shown) : null;
    hintChip.replaceChildren(h('img', { src: cover(presetId, 't').art, alt: '' }), h('span', null, h('b', null, p.name), h('span', null, p.line)), h('i.frame__chipmore', null, '样张'));
    unwatch();
    failBox.hidden = true; prog.hidden = true; next.hidden = true; goBtn.hidden = false; badges.replaceChildren();
    frame.dataset.state = w ? w.state : 'photo';
    after.classList.remove('is-in'); pre.classList.remove('is-in');
    if (!w) { cmp.set(1); frame.classList.add('is-photo'); return; }
    frame.classList.remove('is-photo');
    if (w.state === 'done') showDone(w, firstLook(w));
    else if (w.state === 'working' || isRunning(w.id)) {
      prog.hidden = false;
      unwatch = watch(w.id, (pr, ww) => {
        prog.update(pr);
        if (pr.partial && pre.dataset.src !== pr.partial) { pre.dataset.src = pr.partial; const im = new Image(); im.onload = () => { pre.src = pr.partial || ''; pre.classList.add('is-in'); }; im.src = pr.partial; }
        if (ww.state !== 'working') { paintCta(); paintVersions(); if (ww.state === 'done') showDone(ww, firstLook(ww)); else showFail(ww); }
      });
    } else showFail(w);
  }
  async function showDone(/** @type {any} */ w, fresh) {
    prog.hidden = true; frame.dataset.state = 'done';
    const url = await resultUrl(w);
    await new Promise(r => { after.onload = r; after.onerror = r; after.src = url; });
    after.classList.add('is-in');
    if (w.preset !== presetId) hintChip.querySelector('b')?.replaceChildren(presetById(w.preset)?.name || '');
    badges.replaceChildren(...[kindBadge(w)].filter(Boolean));
    if (!dirty) { next.hidden = false; goBtn.hidden = true; }
    if (fresh) { reveal(frameBox, after, 1000); burst(frame, w.preset); buzz([16, 60, 24]); toast(T.doneSaved, { action: { label: T.seeIt, run: () => go('work', { id: w.id }) }, tone: 'ok', ms: 3600 }); }
    else cmp.set(1);
  }
  function showFail(/** @type {any} */ w) {
    prog.hidden = true; failBox.hidden = false; frame.dataset.state = w.state;
    failBox.replaceChildren(h('b', null, w.state === 'stopped' ? '已取消' : T.failed), h('p', null, w.error || ''),
      h('button.btn.btn--main.btn--sm', { type: 'button', onclick: () => { retry(w); paintFrame(); paintCta(); } }, h('span', { html: icon('refresh') }), T.retry));
  }
  function paintVersions() {
    if (!src) return;
    const list = works().filter(w => w.source === src?.id).slice(0, 20);
    versions.hidden = !list.length;
    versions.replaceChildren(
      h('button.ver.ver--src', { type: 'button', 'aria-pressed': String(!shown), 'aria-label': '原图', onclick: () => { shown = ''; keep(); paintVersions(); paintFrame(); } }, h('img', { src: before.src, alt: '' }), h('span', null, '原图')),
      ...list.map(w => {
        const b = h('button.ver', { type: 'button', 'aria-pressed': String(w.id === shown), data: { state: w.state }, 'aria-label': (presetById(w.preset)?.name || '') + ' 版本', onclick: () => { shown = w.id; dirty = false; keep(); paintVersions(); paintFrame(); } },
          h('img', { alt: '' }), h('span', null, presetById(w.preset)?.name || ''));
        resultUrl(w).then(u => { const im = /** @type {HTMLImageElement} */ (b.querySelector('img')); if (u) im.src = u; else im.src = before.src; });
        return b;
      }));
  }
  function paintCta() {
    const p = /** @type {any} */ (presetById(presetId));
    const w = shown ? workById(shown) : null;
    const busy = !!w && (w.state === 'working' || isRunning(w.id));
    goBtn.toggleAttribute('disabled', busy);
    goBtn.dataset.state = !src ? 'upload' : busy ? 'busy' : 'go';
    goLabel.textContent = !src ? T.upload : busy ? '出片中…' : (w && w.state === 'done' && w.preset === presetId ? T.again : T.go);
    goSub.textContent = !src ? T.noPhotoLine : p.name + ' · ' + etaText();
    /** @type {HTMLElement} */ (goBtn.querySelector('.cta__ico')).innerHTML = icon(!src ? 'upload' : 'sparkle');
  }

  // ── 生成 ──
  async function make() {
    if (!src) { pickPhoto(); return; }
    const prev = works().find(w => w.source === src?.id);
    const why = describeChange(prev);
    const w = await create({ source: src.id, preset: presetId, params, format, mode: 'studio', parent: prev?.id, why });
    shown = w.id; dirty = false; keep();
    paintVersions(); paintFrame(); paintCta();
  }
  /** 这一版和上一版比改了什么（记进创作轨迹）。 */
  function describeChange(/** @type {any} */ prev) {
    const p = /** @type {any} */ (presetById(presetId));
    if (!prev) return '上传精修 · ' + captionOf(p, params);
    const bits = [];
    if (prev.preset !== presetId) bits.push('换成「' + p.name + '」');
    for (const k of KNOBS) if (prev.params?.[k.id] !== params[k.id] && prev.preset === presetId) bits.push(k.label + ' ' + prev.params?.[k.id] + '→' + params[k.id]);
    if (prev.preset === presetId) {
      const was = new Set(prev.params?.details || []);
      for (const x of params.details) if (!was.has(x)) bits.push('+' + p.details.find((/** @type {any} */ d) => d.id === x)?.label);
      for (const x of was) if (!params.details.includes(x)) bits.push('−' + p.details.find((/** @type {any} */ d) => d.id === x)?.label);
    }
    if ((params.words || '') !== (prev.params?.words || '') && params.words) bits.push('补一句：' + params.words);
    return bits.length ? bits.join(' · ') : '再来一张 · ' + p.name;
  }

  const offs = [on('finished', (/** @type {any} */ w) => { if (!el.hidden) { paintVersions(); paintCta(); if (w?.id === shown && frame.dataset.state === 'working') paintFrame(); } }), on('works', () => { if (!el.hidden && src) paintVersions(); })];
  void offs; void dayOf; void PRESETS; void note; void saveWork;

  paintPanel();
  return {
    el, keep: true,
    shown() {
      // 从结果页「微调细节」过来：草稿里带着那张照片和风格
      const d = draft('studio');
      if (d && (d.source !== (src?.id || '') || d.preset !== presetId || d.from)) {
        if (d.source && sourceById(d.source)) src = sourceById(d.source);
        if (presetById(d.preset)) { presetId = d.preset; params = loadParams(presetId, d.params); }
        if (d.tab) tab = d.tab;
        format = d.format || format;
        shown = d.from && workById(d.from)?.source === src?.id ? d.from : (d.shown || '');
        saveDraft('studio', { ...d, from: '' });
        paintPanel();
      }
      applyTheme(presetId); setPref('preset', presetId);
      render();
    },
  };
}
