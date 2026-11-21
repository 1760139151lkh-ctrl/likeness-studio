/**
 * 上传精修：艺术头像深度创作台。一次上传，无限换装与精雕。
 *
 *   画面   当前这一版（或原图）。拖动分割线 / 按住，看它是从哪一版改来的；生成中是三段进度；部位精修和圈选直接在图上点、涂
 *   版本   同一张照片做过的所有版本按时间排成一条创作链，点哪版看哪版，在哪版上接着改
 *   工具   风格 · 微调 · 细节 · 部位 · 对话：点一下向上展开成宽敞的面板（图片同步缩小、始终看得见）；「收起」或返回手势收回
 *   主按钮 一键变身（面板里换成对应的动作：精修这几处 / 发送）
 *   撤回   换风格、拖滑块、加减细节、选部位、换版本、换照片……每一步都能撤回 / 恢复，刷新后也还在
 */
import { h, icon, toast, chooseFile, reduced } from '../core/dom.js';
import { go, overlay } from '../core/nav.js';
import { on } from '../core/bus.js';
import { presetById, defaultsOf, captionOf, KNOBS } from '../presets.js';
import { applyTheme } from '../core/theme.js';
import { draft, saveDraft, pref, setPref, addSource, source as sourceById, sourceUrl, sourceBlob, resultUrl, work as workById, chainOf } from '../core/data.js';
import { create, watch, stop, retry, isRunning } from '../core/generate.js';
import { prepare, decode, lightOf } from '../core/image.js';
import { personArt, samples, cover } from '../core/assets.js';
import { compare, progressBox, saveImage, shareTikTok, kindBadge, etaText, opBadge } from '../ui/parts.js';
import { sheet, sheetOpen } from '../ui/sheet.js';
import { reveal, burst, buzz, firstLook } from '../ui/fx.js';
import { openExamples } from '../ui/examples.js';
import { createUndo } from '../core/undo.js';
import { stylePanel, tunePanel, detailPanel } from '../studio/panels.js';
import { partsPanel } from '../studio/parts.js';
import { chatPanel } from '../studio/chat.js';
import { T } from '../copy.js';

/** @typedef {import('../core/data.js').Work} Work */
const TOOLS = /** @type {const} */ ([
  { id: 'style', label: '风格', ico: 'palette' }, { id: 'tune', label: '微调', ico: 'sliders' }, { id: 'detail', label: '细节', ico: 'sparkle' },
  { id: 'parts', label: '部位', ico: 'face' }, { id: 'chat', label: '对话', ico: 'chat' },
]);

export function studioScreen() {
  // ── 状态（S 里的每一样都能撤回）──
  const d0 = draft('studio') || {};
  const S = {
    source: d0.source && sourceById(d0.source) ? String(d0.source) : '',
    shown: '',
    preset: presetById(d0.preset) ? String(d0.preset) : pref('preset', 'princess'),
    params: /** @type {any} */ (null),
    format: /** @type {'avatar' | 'portrait'} */ (d0.format === 'portrait' ? 'portrait' : d0.format === 'avatar' ? 'avatar' : pref('format', 'avatar')),
    picks: /** @type {import('../parts.js').Pick[]} */ (Array.isArray(d0.picks) ? d0.picks : []),
  };
  S.shown = d0.shown && workById(d0.shown)?.source === S.source ? String(d0.shown) : '';
  S.params = loadParams(S.preset, d0.preset === S.preset ? d0.params : null);
  let tool = /** @type {string} */ (d0.panel || ''), cat = d0.cat || 'hot', unwatch = () => {}, closeOverlay = /** @type {(() => void) | null} */ (null);

  function loadParams(/** @type {string} */ id, /** @type {any} */ given) {
    const p = /** @type {any} */ (presetById(id)), saved = given || pref('params.' + id, {});
    return { ...defaultsOf(p), ...saved, details: [...(saved.details || p.defaults.details)] };
  }
  const undo = createUndo({
    snapshot: () => ({ source: S.source, shown: S.shown, preset: S.preset, params: S.params, format: S.format, picks: S.picks }),
    restore: s => { Object.assign(S, s); if (S.source && !sourceById(S.source)) S.source = ''; if (S.shown && !workById(S.shown)) S.shown = ''; afterChange(); },
    onChange: () => paintUndo(),
  });
  const keep = () => {
    setPref('params.' + S.preset, S.params); setPref('preset', S.preset); setPref('format', S.format);
    saveDraft('studio', { ...S, panel: tool, cat, undo: undo.dump() });
  };
  /** 记一步（能撤回），存草稿。 @param {string} label */
  const commit = (label) => { undo.commit(label); keep(); };

  // ── 顶栏 ──
  const bar = h('header.bar.bar--root', null,
    h('button.chip', { type: 'button', onclick: () => go('gallery'), 'aria-label': T.gallery }, h('span', { html: icon('gallery') }), h('span', null, T.gallery)),
    h('h1.bar__title', null, T.studio),
    h('button.avatar', { type: 'button', onclick: () => go('me'), 'aria-label': T.me }, h('span', { html: icon('user') })));

  // ── 画面 ──
  const before = /** @type {HTMLImageElement} */ (h('img.frame__before', { alt: '原图' }));
  const pre = /** @type {HTMLImageElement} */ (h('img.frame__pre', { alt: '' }));
  const after = /** @type {HTMLImageElement} */ (h('img.frame__after', { alt: '成片' }));
  const tintC = /** @type {HTMLCanvasElement} */ (h('canvas.frame__tint', { 'aria-hidden': 'true' }));
  const markC = /** @type {HTMLCanvasElement} */ (h('canvas.frame__mark', { 'aria-hidden': 'true' }));
  const brushC = /** @type {HTMLCanvasElement} */ (h('canvas.frame__brush', { 'aria-label': '涂出要改的地方' }));
  const prog = progressBox(() => S.shown && stop(S.shown));
  const failBox = h('div.frame__fail', { hidden: true });
  const frameBox = h('div.frame__img', null, before, pre, after, tintC, markC, brushC, prog, failBox);
  const cmp = compare(frameBox, before, after, { enabled: () => tool !== 'parts' && !!S.shown && workById(S.shown)?.state === 'done' });
  const styleChip = h('button.hud__chip', { type: 'button', 'aria-label': '看这个风格的样张', onclick: () => openExamples(S.preset, { onUse: id => ctx.pickStyle(id) }) });
  const changeBtn = h('button.hud__btn', { type: 'button', onclick: () => pickPhoto(), 'aria-label': T.change }, h('span', { html: icon('image') }), h('span', null, '换图'));
  const undoBtn = h('button.hud__ub', { type: 'button', 'aria-label': T.undo, title: T.undo, onclick: () => doUndo(), html: icon('undo') });
  const redoBtn = h('button.hud__ub', { type: 'button', 'aria-label': T.redo, title: T.redo, onclick: () => doRedo(), html: icon('redo') });
  const saveMini = h('button.hud__btn', { type: 'button', onclick: () => withShown(async w => saveImage(w, await resultUrl(w))) }, h('span', { html: icon('download') }), h('span', null, '保存'));
  const shareMini = h('button.hud__btn.hud__btn--main', { type: 'button', onclick: () => withShown(async w => shareTikTok(w, await resultUrl(w))) }, h('span', { html: icon('send') }), h('span', null, '发 TikTok'));
  const tip = h('p.hud__tip', { 'aria-live': 'polite' });
  const badges = h('div.hud__badges');
  const hud = h('div.frame__hud', null,
    h('div.hud__row', null, styleChip, h('span.hud__gap'), changeBtn),
    h('div.hud__mid', null, badges, tip),
    h('div.hud__row', null, h('div.hud__undo', null, undoBtn, redoBtn), h('span.hud__gap'), saveMini, shareMini));
  const frame = h('div.frame', null, h('div.frame__fit', null, frameBox), hud);
  const versions = h('div.versions', { role: 'listbox', 'aria-label': '版本' });
  const empty = emptyState();
  const canvas = h('div.studio__canvas', null, empty, frame, versions);

  // ── 工具条 + 面板 ──
  const toolBtns = /** @type {Record<string, HTMLElement>} */ ({});
  const toolRow = h('div.tools', { role: 'tablist', 'aria-label': '创作工具' },
    ...TOOLS.map(t => (toolBtns[t.id] = h('button.tool2', { type: 'button', role: 'tab', data: { tool: t.id }, onclick: () => (tool === t.id ? closePanel() : openPanel(t.id)) },
      h('span.tool2__ico', { html: icon(/** @type {any} */ (t.ico)) }), h('span.tool2__label', null, t.label)))),
    h('button.tools__fold', { type: 'button', onclick: () => closePanel(), 'aria-label': '收起面板' }, h('span', { html: icon('chevronDown') }), h('span', null, '收起')));
  const panelBody = h('div.tpanel__body');
  const panelFoot = h('div.tpanel__foot');
  const tpanel = h('section.tpanel.kb-lift', null, panelBody, panelFoot);
  const goLabel = h('b.cta__label'), goSub = h('span.cta__sub');
  const goBtn = h('button.cta', { type: 'button', onclick: () => ctx.make() }, h('span.cta__ico', { html: icon('sparkle') }), h('span.cta__text', null, goLabel, goSub));
  const dock = h('div.studio__dock', null, toolRow, tpanel, h('div.dock__cta', null, goBtn));
  const modes = h('nav.modes.modes--solid', { 'aria-label': '模式' },
    h('button.modes__opt', { type: 'button', onclick: () => go('live') }, T.live),
    h('button.modes__opt', { type: 'button', 'aria-current': 'page' }, T.studio));
  const el = h('section.screen.studio', { 'aria-label': T.studio }, bar, canvas, dock, modes);

  // ── 面板之间共用的「上下文」──
  const ctx = {
    S, el, frame, frameBox, before, after, tintC, markC, brushC, tip,
    get cat() { return cat; }, set cat(v) { cat = v; keep(); },
    commit, keep,
    /** 现在画面上的那一版（没有就是原图）。 */
    shownWork: () => (S.shown ? workById(S.shown) : null),
    sourceObj: () => (S.source ? sourceById(S.source) : null),
    /** 画面上正显示的那张图（部位精修 / 圈选就在它上面改）。 */
    shownImage: () => (S.shown && workById(S.shown)?.state === 'done' ? after : before),
    pickStyle(/** @type {string} */ id) {
      if (id === S.preset) { openExamples(id, { onUse: x => ctx.pickStyle(x) }); return; }   // 再点一下当前的：看它的样张
      const was = presetById(S.preset)?.name;
      S.preset = id; S.params = loadParams(id, null);
      applyTheme(id);
      commit('换成「' + presetById(id)?.name + '」' + (was ? '（原来是「' + was + '」）' : ''));
      paintAll();
    },
    /** 改参数（滑块松手时调一次）。 @param {Record<string, any>} patch @param {string} label */
    setParams(patch, label) { Object.assign(S.params, patch); commit(label); paintCta(); paintChip(); },
    setFormat(/** @type {'avatar' | 'portrait'} */ v) { S.format = v; commit('画幅：' + T.format[v]); paintCanvas(); paintCta(); },
    resetParams() { S.params = { ...defaultsOf(/** @type {any} */ (presetById(S.preset))), words: '' }; commit('重置成「' + presetById(S.preset)?.name + '」的默认'); paintAll(); },
    setPicks(/** @type {import('../parts.js').Pick[]} */ picks, /** @type {string} */ label) { S.picks = picks; commit(label); },
    /** 整体换风格（一键变身）。 */
    make,
    /** 部位精修 / 对话 / 多来几张 / 多角度：都在画面上这一版的基础上改。 @param {Partial<import('../core/generate.js').Ask> & { label: string }} o */
    async ask(o) {
      const src = ctx.sourceObj(); if (!src) { pickPhoto(); return null; }
      // 在画面上那张图的基础上改：这一版出好了就是它；还在出 / 没成功，就是它的上一版（也就是画面上显示的那张）
      const shown = ctx.shownWork();
      const base = shown ? (shown.state === 'done' ? shown : shown.base ? workById(shown.base) : null) : null;
      const usable = base && base.state === 'done' ? base : null;
      const w = await create({ source: src.id, preset: usable?.preset || S.preset, params: usable?.params || S.params, format: usable ? usable.format : 'photo', mode: 'studio',
        base: usable?.id || '', parent: shown?.id || chainOf(src.id).at(-1)?.id, why: o.label, ...o });
      S.shown = w.id; S.picks = o.op === 'region' ? [] : S.picks;
      commit(o.label);
      paintVersions(); paintCanvas(); paintCta();
      return w;
    },
    showVersion(/** @type {string} */ id) { showVersion(id); },
    paintCanvas: () => paintCanvas(), paintCta: () => paintCta(), paintVersions: () => paintVersions(),
    closePanel: () => closePanel(),
    pickPhoto: () => pickPhoto(),
    /** 面板底部的主按钮（和收起时的一样好认）。 */
    cta(/** @type {string} */ label, /** @type {string} */ sub, /** @type {() => void} */ run, ico = 'sparkle') {
      const b = h('button.cta', { type: 'button', onclick: run }, h('span.cta__ico', { html: icon(/** @type {any} */ (ico)) }), h('span.cta__text', null, h('b.cta__label', null, label), h('span.cta__sub', null, sub)));
      return b;
    },
  };
  const panels = /** @type {Record<string, any>} */ ({ style: stylePanel(ctx), tune: tunePanel(ctx), detail: detailPanel(ctx), parts: partsPanel(ctx), chat: chatPanel(ctx) });

  function withShown(/** @type {(w: Work) => Promise<void>} */ fn) {
    const w = ctx.shownWork(); if (!w || w.state !== 'done') return;
    fn(w).catch(e => toast(e?.message || '没成功，再试一次'));
  }

  // ── 面板开合 ──
  function openPanel(/** @type {string} */ id, instant = false) {
    if (!ctx.sourceObj() && (id === 'parts' || id === 'chat')) { toast(T.noPhoto + '，' + (id === 'parts' ? '才能精修部位' : '才能对话微调'), { action: { label: T.upload, run: () => pickPhoto() } }); return; }
    const was = tool;
    if (was && was !== id) panels[was]?.hidden?.();
    tool = id; keep();
    if (!closeOverlay) closeOverlay = overlay(() => { closeOverlay = null; collapse(); });
    const p = panels[id];
    panelBody.replaceChildren(p.body);
    panelFoot.replaceChildren(...(p.foot ? [p.foot] : []));
    el.dataset.panel = id;
    for (const [k, b] of Object.entries(toolBtns)) { b.setAttribute('aria-selected', String(k === id)); }
    p.shown?.();
    if (!instant && !reduced && !was) tpanel.animate([{ opacity: 0, transform: 'translateY(24px)' }, { opacity: 1, transform: 'none' }], { duration: 280, easing: 'cubic-bezier(.2,.8,.2,1)' });
    requestAnimationFrame(() => { brushFit(); paintCanvasOverlays(); });
  }
  function closePanel() { if (closeOverlay) closeOverlay(); else collapse(); }
  function collapse() {
    if (!tool) return;
    panels[tool]?.hidden?.();
    tool = ''; keep();
    delete el.dataset.panel;
    for (const b of Object.values(toolBtns)) b.setAttribute('aria-selected', 'false');
    panelBody.replaceChildren(); panelFoot.replaceChildren();
    if (/** @type {HTMLElement | null} */ (document.activeElement)?.closest('.tpanel')) /** @type {HTMLElement} */ (document.activeElement).blur();
    paintCta();
    requestAnimationFrame(() => { brushFit(); paintCanvasOverlays(); });
  }
  const brushFit = () => panels.parts?.fit?.();
  const paintCanvasOverlays = () => panels.parts?.overlay?.();

  // ── 没有照片时 ──
  function emptyState() {
    const demoB = /** @type {HTMLImageElement} */ (h('img.drop__b', { alt: '' }));
    const demo = h('div.drop__demo', { 'aria-hidden': 'true' }, h('img.drop__a', { src: personArt('mei', 'm'), alt: '' }), h('span.drop__arrow', { html: icon('sparkle') }), demoB);
    return h('div.drop', null, demo,
      h('h2.drop__title', null, T.noPhoto), h('p.drop__line', null, '一次上传，所有风格随便换，脸上每一处都能单独精修'),
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
      useSource(await addSource(blob, { w, h: hh }), '换了一张照片');
    } catch (e) { toast(/** @type {any} */ (e)?.message || '这张图打不开，换一张试试'); }
  }
  function pickSample() {
    sheet(close => [
      h('p.sheet__text', null, '没有合适的自拍？先用示例人物玩一下（都是生成的虚构人物，不是真人）。'),
      h('div.samples', null, ...samples().map(who => h('button.sample', { type: 'button', 'aria-label': '示例 ' + who, onclick: async () => {
        close();
        const blob = await fetch(personArt(who)).then(r => r.blob());
        useSource(await addSource(blob, { sample: who }), '用示例人物');
      } }, h('img', { src: personArt(who, 'm'), alt: '', loading: 'lazy' })))),
    ], { title: T.sample });
  }
  /** @param {import('../core/data.js').Source} s @param {string} label */
  function useSource(s, label) {
    S.source = s.id; S.shown = ''; S.picks = [];
    commit(label);
    paintAll();
    if (!reduced) frame.animate([{ opacity: .4, transform: 'scale(.97)' }, { opacity: 1, transform: 'none' }], { duration: 320, easing: 'cubic-bezier(.2,.8,.2,1)' });
    checkPhoto(s);
  }
  /** 构图小贴士：亮度 + 能不能找到正脸（本机识别，不上传）。 */
  async function checkPhoto(/** @type {import('../core/data.js').Source} */ s) {
    tip.textContent = ''; delete tip.dataset.tone;
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
      if (S.source !== s.id || S.shown) return;
      if (!face) { tip.textContent = T.tipNoFace; tip.dataset.tone = 'warn'; }
      else if (face.width < .18) { tip.textContent = '脸有点小，靠近一点或裁一下会更好'; tip.dataset.tone = 'warn'; }
      else { tip.textContent = T.tipGood; tip.dataset.tone = 'ok'; setTimeout(() => { if (tip.dataset.tone === 'ok') { tip.textContent = ''; delete tip.dataset.tone; } }, 3500); }
    } catch { /* 识别不了就不提示 */ }
  }

  // ── 撤回 / 恢复 ──
  function doUndo() {
    const label = undo.undo();
    if (label) toast(T.undone + '：' + label, { action: { label: T.redo, run: () => doRedo() } });
    else toast('没有可以撤回的了');
  }
  function doRedo() {
    const label = undo.redo();
    if (label) toast(T.redone + '：' + label, { action: { label: T.undo, run: () => doUndo() } });
  }
  function paintUndo() {
    undoBtn.toggleAttribute('disabled', !undo.canUndo); redoBtn.toggleAttribute('disabled', !undo.canRedo);
    undoBtn.title = undo.canUndo ? T.undo + '：' + undo.nextUndo : T.undo;
    redoBtn.title = undo.canRedo ? T.redo + '：' + undo.nextRedo : T.redo;
  }
  /** 撤回 / 恢复之后：把画面、面板、主题都对上。 */
  function afterChange() {
    applyTheme(S.preset); keep();
    paintAll();
    if (tool) panels[tool]?.shown?.();
  }

  // ── 画面状态 ──
  function paintAll() { paintChip(); paintVersions(); paintCanvas(); paintCta(); if (tool) panels[tool]?.repaint?.(); }
  function paintChip() {
    const p = /** @type {any} */ (presetById(S.preset)), w = ctx.shownWork(), q = presetById(w?.preset || S.preset) || p;
    styleChip.replaceChildren(h('img', { src: cover(q.id, 't').art, alt: '' }), h('span', null, h('b', null, q.name), h('span', null, q.line)), h('i.hud__more', null, '样张'));
  }
  async function setImg(/** @type {HTMLImageElement} */ img, /** @type {string} */ url) {
    if (!url) { img.removeAttribute('src'); return; }
    if (img.getAttribute('src') === url) return;
    await new Promise(r => { img.onload = r; img.onerror = r; img.src = url; });
  }
  const ratio = (/** @type {number} */ r) => frame.style.setProperty('--ar', String(Math.max(.56, Math.min(1.6, r || 1))));
  async function paintCanvas() {
    const src = ctx.sourceObj();
    el.dataset.has = src ? 'photo' : 'none';
    empty.hidden = !!src; frame.hidden = !src; versions.hidden = !src;
    const demoB = /** @type {HTMLImageElement | null} */ (empty.querySelector('.drop__b'));
    if (demoB) demoB.src = cover(S.preset, 'm').art;
    unwatch(); unwatch = () => {};
    if (!src) return;
    const w = ctx.shownWork(), baseW = w?.base ? workById(w.base) : null;
    frame.dataset.frame = /** @type {any} */ (presetById(w?.preset || S.preset))?.theme.frame || '';
    failBox.hidden = true; prog.hidden = true;
    after.classList.remove('is-in'); pre.classList.remove('is-in');
    badges.replaceChildren();
    const beforeUrl = baseW ? await resultUrl(baseW) : await sourceUrl(src);
    await setImg(before, beforeUrl);
    if (!w) {
      frame.dataset.state = 'photo';
      ratio(before.naturalWidth / before.naturalHeight);
      cmp.set(1); after.removeAttribute('src');
      paintHud(); paintCanvasOverlays();
      return;
    }
    if (tip.dataset.tone !== 'warn') { tip.textContent = ''; delete tip.dataset.tone; }
    frame.dataset.state = w.state === 'working' || isRunning(w.id) ? 'working' : w.state;
    if (w.state === 'done') await showDone(w, firstLook(w));
    else if (w.state === 'working' || isRunning(w.id)) {
      ratio(w.op === 'restyle' ? (w.format === 'portrait' ? 2 / 3 : 1) : before.naturalWidth / before.naturalHeight);
      prog.hidden = false; cmp.set(1);
      quickLook(w);
      unwatch = watch(w.id, (pr, ww) => {
        prog.update(pr);
        if (pr.partial && pre.dataset.src !== pr.partial) { pre.dataset.src = pr.partial; const im = new Image(); im.onload = () => { pre.src = pr.partial || ''; pre.classList.add('is-in'); }; im.src = pr.partial; }
        if (ww.state !== 'working' && ww.id === S.shown) { paintCta(); paintVersions(); if (ww.state === 'done') { frame.dataset.state = 'done'; showDone(ww, firstLook(ww)); } else showFail(ww); }
      });
    } else showFail(w);
    paintHud(); paintCanvasOverlays();
  }
  /** 生成中先垫一张本机即时预览（风格的大致感觉），等的时候不是一片空白。 */
  async function quickLook(/** @type {Work} */ w) {
    pre.removeAttribute('src'); delete pre.dataset.src;
    if (w.op !== 'restyle' || reduced) return;
    try {
      const s = sourceById(w.source); const blob = s && await sourceBlob(s); if (!blob) return;
      const { stylizeStill } = await import('../live/renderer.js');
      const out = await stylizeStill(blob, w.preset, Math.max(.6, (w.params?.strength || 70) / 100), w.format === 'portrait' ? 'portrait' : 'avatar');
      if (S.shown !== w.id || pre.dataset.src) return;
      pre.src = URL.createObjectURL(out); pre.classList.add('is-in', 'is-quick');
    } catch { /* 预览不了就不预览 */ }
  }
  async function showDone(/** @type {Work} */ w, /** @type {boolean} */ fresh) {
    prog.hidden = true; frame.dataset.state = 'done';
    pre.classList.remove('is-in', 'is-quick');
    const url = await resultUrl(w);
    await setImg(after, url);
    ratio(after.naturalWidth / after.naturalHeight || (w.w && w.h ? w.w / w.h : 1));
    after.classList.add('is-in');
    badges.replaceChildren(...[kindBadge(w, true)].filter(Boolean));
    if (fresh) { reveal(frameBox, after, 1000); burst(frame, w.preset); buzz([16, 60, 24]); toast(T.doneSaved, { action: { label: T.seeIt, run: () => go('work', { id: w.id }) }, tone: 'ok', ms: 3600 }); }
    cmp.set(1);
    paintHud(); paintCanvasOverlays();
    if (tool) panels[tool]?.repaint?.();
  }
  function showFail(/** @type {Work} */ w) {
    prog.hidden = true; failBox.hidden = false; frame.dataset.state = w.state;
    failBox.replaceChildren(h('b', null, w.state === 'stopped' ? '已取消' : T.failed), h('p', null, w.error || ''),
      h('div.frame__failacts', null,
        h('button.btn.btn--main.btn--sm', { type: 'button', onclick: () => { retry(w); paintCanvas(); paintVersions(); paintCta(); } }, h('span', { html: icon('refresh') }), T.retry),
        h('button.btn.btn--ghost.btn--sm', { type: 'button', onclick: () => doUndo() }, h('span', { html: icon('undo') }), '撤回一步')));
    paintHud();
  }
  function paintHud() {
    const w = ctx.shownWork(), done = !!w && w.state === 'done', busy = !!w && (w.state === 'working' || isRunning(w.id));
    saveMini.hidden = !done; shareMini.hidden = !done;
    changeBtn.hidden = busy;
    styleChip.hidden = busy;
    frame.classList.toggle('is-photo', !w);
  }
  function showVersion(/** @type {string} */ id) {
    if (id === S.shown) return;
    const w = id ? workById(id) : null;
    S.shown = id;
    commit(id ? '看「' + (opName(w)) + '」这一版' : '看原图');
    paintVersions(); paintCanvas(); paintCta();
    if (tool) panels[tool]?.repaint?.();
  }
  const opName = (/** @type {Work | null} */ w) => !w ? '原图' : w.op === 'region' ? '部位精修' : w.op === 'edit' ? '对话微调' : w.op === 'vary' ? '多来几张' : w.op === 'angles' ? '多角度' : presetById(w.preset)?.name || '';
  function paintVersions() {
    const src = ctx.sourceObj(); if (!src) return;
    const list = chainOf(src.id).slice(-40);
    const srcBtn = h('button.ver.ver--src', { type: 'button', 'aria-pressed': String(!S.shown), 'aria-label': '原图', onclick: () => showVersion('') }, h('img', { alt: '' }), h('span', null, '原图'));
    sourceUrl(src).then(u => { /** @type {HTMLImageElement} */ (srcBtn.querySelector('img')).src = u; });
    versions.replaceChildren(srcBtn, ...list.map(w => {
      const b = h('button.ver', { type: 'button', 'aria-pressed': String(w.id === S.shown), data: { state: isRunning(w.id) ? 'working' : w.state, op: w.op || 'restyle' }, 'aria-label': opName(w) + ' 版本', onclick: () => showVersion(w.id) },
        h('img', { alt: '' }), opBadge(w), h('span', null, opName(w)));
      resultUrl(w).then(async u => { const im = /** @type {HTMLImageElement} */ (b.querySelector('img')); im.src = u || await sourceUrl(src); });
      return b;
    }));
    requestAnimationFrame(() => versions.querySelector('[aria-pressed="true"]')?.scrollIntoView({ inline: 'nearest', block: 'nearest', behavior: reduced ? 'auto' : 'smooth' }));
  }
  function paintCta() {
    const p = /** @type {any} */ (presetById(S.preset)), src = ctx.sourceObj(), w = ctx.shownWork();
    const busy = !!w && (w.state === 'working' || isRunning(w.id));
    const same = !!w && w.op === 'restyle' && w.state === 'done' && w.preset === S.preset && JSON.stringify(w.params) === JSON.stringify(S.params) && w.format === S.format;
    goBtn.toggleAttribute('disabled', busy && w?.op === 'restyle');
    goBtn.dataset.state = !src ? 'upload' : busy ? 'busy' : 'go';
    goLabel.textContent = !src ? T.upload : busy && w?.op === 'restyle' ? '出片中…' : same ? T.again : T.go;
    goSub.textContent = !src ? '正脸、光线均匀，出片最好看' : p.name + ' · ' + etaText();
    /** @type {HTMLElement} */ (goBtn.querySelector('.cta__ico')).innerHTML = icon(!src ? 'upload' : 'sparkle');
    for (const pnl of Object.values(panels)) pnl.paintCta?.();
  }

  // ── 生成：一键变身（整体换风格，永远从原图出发，最干净）──
  async function make() {
    const src = ctx.sourceObj();
    if (!src) { pickPhoto(); return; }
    const p = /** @type {any} */ (presetById(S.preset));
    const last = chainOf(src.id).filter(w => w.op === 'restyle' || !w.op).at(-1);
    const w = await create({ source: src.id, preset: S.preset, params: S.params, format: S.format, mode: 'studio', parent: ctx.shownWork()?.id || last?.id, why: describeChange(last) });
    S.shown = w.id;
    commit('出片：' + p.name);
    paintVersions(); paintCanvas(); paintCta();
    if (tool === 'style' || tool === 'tune' || tool === 'detail') panels[tool]?.repaint?.();
  }
  /** 这一版和上一版比改了什么（记进创作轨迹）。 */
  function describeChange(/** @type {Work | undefined} */ prev) {
    const p = /** @type {any} */ (presetById(S.preset));
    if (!prev) return '上传精修 · ' + captionOf(p, S.params);
    const bits = [];
    if (prev.preset !== S.preset) bits.push('换成「' + p.name + '」');
    else {
      for (const k of KNOBS) if (prev.params?.[k.id] !== S.params[k.id]) bits.push(k.label + ' ' + prev.params?.[k.id] + '→' + S.params[k.id]);
      const was = new Set(prev.params?.details || []);
      for (const x of S.params.details) if (!was.has(x)) bits.push('+' + p.details.find((/** @type {any} */ d) => d.id === x)?.label);
      for (const x of was) if (!S.params.details.includes(x)) bits.push('−' + p.details.find((/** @type {any} */ d) => d.id === x)?.label);
    }
    if ((S.params.words || '') !== (prev.params?.words || '') && S.params.words) bits.push('补一句：' + S.params.words);
    return bits.length ? bits.join(' · ') : '再来一张 · ' + p.name;
  }

  const offs = [
    on('finished', (/** @type {any} */ w) => { if (!el.hidden && w?.source === S.source) { paintVersions(); paintCta(); if (w?.id === S.shown && frame.dataset.state === 'working') paintCanvas(); if (tool) panels[tool]?.repaint?.(); } }),
    on('works', () => { if (!el.hidden && S.source) { paintVersions(); if (tool === 'chat') panels.chat.repaint(); } }),
  ];
  void offs;
  new ResizeObserver(() => { brushFit(); paintCanvasOverlays(); }).observe(frameBox);
  // 电脑上：Esc 收起面板（有抽屉开着时先关抽屉）；Ctrl/⌘+Z 撤回，Ctrl/⌘+Shift+Z 恢复（不在输入框里时）
  document.addEventListener('keydown', e => {
    if (el.hidden || sheetOpen()) return;
    const typing = /** @type {HTMLElement | null} */ (document.activeElement)?.matches?.('input, textarea, [contenteditable="true"]');
    if (e.key === 'Escape' && tool) { e.preventDefault(); if (typing) /** @type {HTMLElement} */ (document.activeElement).blur(); else closePanel(); return; }
    if (!typing && (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); if (e.shiftKey) doRedo(); else doUndo(); }
  });

  undo.load(d0.undo);   // 上次的撤回记录（刷新后照样能撤回）
  paintUndo();
  return {
    el, keep: true,
    shown() {
      // 从结果页 / 作品详情过来：草稿里带着那张照片、那一版和要打开的工具
      const d = draft('studio');
      if (d?.from) {
        const w = workById(d.from);
        if (w) {
          S.source = w.source; S.shown = w.id; S.preset = w.preset; S.params = loadParams(w.preset, w.params);
          if (w.format === 'avatar' || w.format === 'portrait') S.format = w.format;
          commit('接着改「' + opName(w) + '」');
        }
        saveDraft('studio', { ...d, from: '' });
        if (d.tab && panels[d.tab]) { applyTheme(S.preset); paintAll(); openPanel(d.tab); return; }
      } else if (d?.preset && d.preset !== S.preset && presetById(d.preset)) {
        S.preset = d.preset; S.params = loadParams(d.preset, null); commit('选了「' + presetById(d.preset)?.name + '」');
      }
      applyTheme(S.preset);
      paintAll();
      if (tool && panels[tool] && !el.dataset.panel) openPanel(tool, true);
    },
    hidden() { if (tool) panels[tool]?.hidden?.(); },
  };
}
