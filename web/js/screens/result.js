/**
 * 拍后结果页：全屏成片。
 *   生成中  先垫上镜头里那一帧（即时预览），再换成过程图，最后平滑切到高精成片；三段进度 + 随时取消
 *   生成后  按住看原图；底部一排风格，点一下不用重拍直接换；微调细节 / 更多 / 保存相册 / 去发 TikTok / 重新拍
 *   更多    高清重出、多来几张、多角度、部位精修、对话微调、分享卡
 *   撤回    右上角「撤回一步」回到换风格之前的那一版（还能恢复）
 */
import { h, icon, toast, holdable } from '../core/dom.js';
import { go, back } from '../core/nav.js';
import { presetById, inCategory, captionOf } from '../presets.js';
import { applyTheme } from '../core/theme.js';
import { work as workById, works, resultUrl, source as sourceById, sourceUrl, saveDraft, saveWork, note, setPref, pref } from '../core/data.js';
import { create, watch, stop, retry, isRunning } from '../core/generate.js';
import { on } from '../core/bus.js';
import { progressBox, saveImage, shareTikTok, kindBadge, styleDot, topBar, opLabel } from '../ui/parts.js';
import { openCard } from '../ui/card.js';
import { openExamples } from '../ui/examples.js';
import { sheet } from '../ui/sheet.js';
import { shotOf, previewOf } from '../core/shots.js';
import { reveal, burst, buzz, firstLook } from '../ui/fx.js';
import { studio } from '../core/api.js';
import { T } from '../copy.js';

/** @typedef {import('../core/data.js').Work} Work */

/** 撤回过的版本（可以恢复）。换到别的版本时，结果页会重新建一次，所以记在这里。 */
let redo = /** @type {string[]} */ ([]);

export function resultScreen(/** @type {Record<string, string>} */ params) {
  let id = params.id || '';
  let unwatch = () => {};
  const before = /** @type {HTMLImageElement} */ (h('img.res__before', { alt: '原图' }));
  const pre = /** @type {HTMLImageElement} */ (h('img.res__pre', { alt: '' }));
  const art = /** @type {HTMLImageElement} */ (h('img.res__art', { alt: '' }));
  const prog = progressBox(() => stop(id));
  const fail = h('div.res__fail', { hidden: true });
  const badge = h('div.res__badges');
  const holdHint = h('span.res__hint', null, h('span', { html: icon('eye') }), T.hold);
  const sibs = h('div.res__sibs', { role: 'listbox', 'aria-label': '这一组的几张', hidden: true });
  const stageEl = h('div.res__stage', { tabindex: '0', 'aria-label': '成片，按住看原图' }, before, pre, art, prog, fail, badge, holdHint, sibs);
  holdable(stageEl, onHold => stageEl.classList.toggle('is-before', onHold && el.dataset.state === 'done'), 120);

  const styles = h('div.res__styles', { role: 'listbox', 'aria-label': T.another });
  const acts = h('div.res__acts', null,
    act('camera', T.retake, () => go('live')),
    act('sliders', T.tweak, () => toStudio('tune')),
    act('more', '更多', () => more()),
    act('download', T.save, () => withDone(async w => saveImage(w, await resultUrl(w)))),
    act('send', T.tiktok, () => withDone(async w => shareTikTok(w, await resultUrl(w))), true));
  const titleEl = h('span');
  const undoBtn = h('button.ibtn', { type: 'button', 'aria-label': T.undo, title: T.undo, html: icon('undo'), onclick: () => undo() });
  const redoBtn = h('button.ibtn', { type: 'button', 'aria-label': T.redo, title: T.redo, html: icon('redo'), onclick: () => redoStep() });
  const bar = topBar('', [undoBtn, redoBtn, h('button.bar__link', { type: 'button', onclick: () => go('gallery') }, T.gallery)], () => back('live'));
  bar.querySelector('.bar__title')?.append(titleEl);
  const el = h('section.screen.result', { 'aria-label': '变身结果' }, bar, stageEl,
    h('div.res__dock', null, h('p.res__label', null, T.another, h('span', null, '同一张照片，点一下就换')), styles, acts));

  function act(/** @type {any} */ ic, /** @type {string} */ label, /** @type {() => void} */ run, main = false) {
    return h('button.act' + (main ? '.act--main' : ''), { type: 'button', onclick: run }, h('span.act__ico', { html: icon(ic) }), h('span.act__label', null, label));
  }
  function withDone(/** @type {(w: Work) => Promise<void>} */ fn) {
    const w = workById(id);
    if (!w || w.state !== 'done') { toast('还在出片，等一下下'); return; }
    fn(w).catch(e => toast(e?.message || '没成功，再试一次'));
  }
  /** 带着这一版去上传精修，打开对应的工具。 */
  function toStudio(/** @type {string} */ tab) {
    const w = workById(id); if (!w) return;
    if (w.state !== 'done' && tab !== 'tune') { toast('等这张出完再精修'); return; }
    saveDraft('studio', { source: w.source, preset: w.preset, params: w.params, format: w.format === 'portrait' ? 'portrait' : 'avatar', tab, from: w.id });
    go('studio');
  }
  /** 「更多」：每一项都是在这一版的基础上接着玩。 */
  function more() {
    const w = workById(id); if (!w) return;
    const ready = w.state === 'done';
    const tile = (/** @type {any} */ ic, /** @type {string} */ name, /** @type {string} */ line, /** @type {() => void} */ run, off = false) =>
      h('button.mitem', { type: 'button', disabled: off, onclick: () => { close(); run(); } }, h('span.mitem__ico', { html: icon(ic) }), h('b.mitem__name', null, name), h('span.mitem__line', null, line));
    const { close } = sheet(() => [h('div.morelist', null,
      tile('hd', '高清重出', '画质拉满再出一张', () => hd(), !studio.live),
      tile('layers', '多来几张', '一次 3 张随便挑', () => batch('vary'), !ready),
      tile('rotate', '多角度', '侧脸、四分之三', () => batch('angles'), !ready),
      tile('face', '部位精修', '刘海发色，点哪改哪', () => toStudio('parts'), !ready),
      tile('chat', '对话微调', '一句话说怎么改', () => toStudio('chat'), !ready),
      tile('card', '分享卡', '竖版海报带原图', () => openCard(w), !ready)),
      ready ? null : h('p.sheet__text', null, '这张还没出好，出好之后这些都能用')], { title: '更多玩法' });
  }
  async function hd() {
    const w = workById(id); if (!w) return;
    const pace = pref('pace', 'fine') === 'deep' ? 'deep' : 'fine';
    const next = await create({ source: w.source, preset: w.preset, params: w.params, format: w.format, mode: w.mode, op: /** @type {any} */ (w.op || 'restyle'), base: w.base, text: w.prompt, pace, parent: w.id, why: '高清重出 · ' + (presetById(w.preset)?.name || '') });
    jump(next.id, '高清重出');
  }
  async function batch(/** @type {'vary' | 'angles'} */ op) {
    const w = workById(id); if (!w || w.state !== 'done') return;
    const next = await create({ source: w.source, preset: w.preset, params: w.params, format: w.format, mode: w.mode, op, base: w.id, n: 3, text: '', parent: w.id, say: op === 'vary' ? '多来几张' : '换几个角度看看', why: op === 'vary' ? '多来几张' : '多角度' });
    jump(next.id, op === 'vary' ? '多来几张' : '多角度');
  }
  /** 换到另一版（记一步，能撤回）。 */
  function jump(/** @type {string} */ to, /** @type {string} */ what) {
    redo = [];
    go('result', { id: to }, { replace: true });
    void what;
  }
  function undo() {
    const w = workById(id), parent = w?.parent ? workById(w.parent) : null;
    if (!w || !parent) { toast('已经是最早的一版了'); return; }
    redo.push(w.id);
    go('result', { id: parent.id }, { replace: true });
    toast(T.undone + '：回到「' + opLabel(parent) + '」', { action: { label: T.redo, run: () => redoStep() } });
  }
  function redoStep() {
    const to = redo.pop();
    if (!to || !workById(to)) { toast('没有可以恢复的了'); return; }
    go('result', { id: to }, { replace: true });
    toast(T.redone);
  }
  function paintUndo(/** @type {Work} */ w) {
    undoBtn.toggleAttribute('disabled', !(w.parent && workById(w.parent)));
    redoBtn.hidden = !redo.length;
  }

  async function show() {
    unwatch();
    // 刚按下快门：先显示拍下的那一帧和第一阶段进度，作品建好后无缝接上
    const shot = id.startsWith('shot') ? shotOf(id) : null;
    if (shot) {
      el.dataset.state = 'working'; prog.hidden = false; fail.hidden = true; sibs.hidden = true;
      pre.src = shot.canvas.toDataURL('image/jpeg', .7);
      prog.update({ stage: 0, value: .04, text: T.sending, eta: 10000, started: performance.now(), got: 0, of: 1 });
      try {
        const real = await shot.work;
        if (!el.isConnected) return;
        id = real;
        history.replaceState(history.state, '', '#/result/' + real);
      } catch (e) {
        failed({ state: 'failed', error: /** @type {any} */ (e)?.message || '拍照没成功，再试一次' });
        return;
      }
    }
    const w = workById(id);
    if (!w) { fail.hidden = false; fail.replaceChildren(h('p', null, '这张作品找不到了'), h('button.btn.btn--main', { type: 'button', onclick: () => go('gallery') }, '去' + T.gallery)); prog.hidden = true; return; }
    const p = presetById(w.preset);
    applyTheme(w.preset); setPref('preset', w.preset);
    titleEl.textContent = w.op && w.op !== 'restyle' ? opLabel(w) : p?.name || '';
    el.dataset.style = w.preset;
    paintUndo(w);
    const base = w.base ? workById(w.base) : null;
    before.src = base ? await resultUrl(base) : await sourceUrl(sourceById(w.source));
    const quick = previewOf(w.id);
    if (!shot) { pre.onerror = () => { pre.onerror = null; pre.src = before.src; }; pre.src = quick || before.src; }
    art.classList.remove('is-in'); art.removeAttribute('src');
    paintStyles(w.preset);
    paintSibs(w);
    if (w.state === 'done') await done(w, firstLook(w));
    else if (w.state === 'working' || isRunning(w.id)) {
      el.dataset.state = 'working'; prog.hidden = false; fail.hidden = true;
      unwatch = watch(w.id, (pr, ww) => {
        prog.update(pr);
        if (pr.partial && pre.dataset.src !== pr.partial && ww.op !== 'vary' && ww.op !== 'angles') { pre.dataset.src = pr.partial; const im = new Image(); im.onload = () => { pre.src = pr.partial || ''; pre.classList.add('is-partial'); }; im.src = pr.partial; }
        if (ww.state !== 'working') { if (ww.state === 'done') done(ww, firstLook(ww)); else failed(ww); }
        paintSibs(ww);
      });
    } else failed(w);
  }
  async function done(/** @type {Work} */ w, fresh = false) {
    el.dataset.state = 'done'; prog.hidden = true; fail.hidden = true;
    const url = await resultUrl(w);
    const im = new Image();
    im.onload = () => {
      art.src = url;
      if (fresh) { art.classList.add('is-in'); reveal(stageEl, art, 1100); burst(stageEl, w.preset); buzz([16, 60, 24]); }
      else requestAnimationFrame(() => art.classList.add('is-in'));
    };
    im.src = url;
    badge.replaceChildren(...[kindBadge(w), w.ms ? h('span.badge', null, '用时 ' + Math.max(1, Math.round(w.ms / 1000)) + ' 秒') : null].filter(Boolean));
    if (!sessionStorage.getItem('hjx.toasted.' + w.id)) { sessionStorage.setItem('hjx.toasted.' + w.id, '1'); toast(T.doneSaved, { action: { label: T.seeIt, run: () => go('gallery') }, tone: 'ok', ms: 3200 }); }
  }
  function failed(/** @type {any} */ w) {
    el.dataset.state = 'failed'; prog.hidden = true; fail.hidden = false;
    fail.replaceChildren(h('b', null, w.state === 'stopped' ? '已取消' : T.failed), h('p', null, w.error || ''),
      h('div.res__failacts', null, w.id ? h('button.btn.btn--main', { type: 'button', onclick: () => { retry(w); show(); } }, h('span', { html: icon('refresh') }), T.retry) : null,
        w.parent ? h('button.btn.btn--ghost', { type: 'button', onclick: () => undo() }, h('span', { html: icon('undo') }), T.undo) : h('button.btn.btn--ghost', { type: 'button', onclick: () => go('live') }, T.retake)));
  }
  /** 一次出了好几张（多来几张 / 多角度）：画面下方一排小图，点哪张看哪张。 */
  function paintSibs(/** @type {Work} */ w) {
    if (!w.batch) { sibs.hidden = true; sibs.replaceChildren(); return; }
    const group = works().filter(x => x.batch === w.batch).sort((a, b) => (a.index || 0) - (b.index || 0));
    sibs.hidden = group.length < 2;
    sibs.replaceChildren(...group.map(x => {
      const b = h('button.res__sib', { type: 'button', role: 'option', 'aria-selected': String(x.id === id), data: { state: x.state === 'done' ? 'done' : isRunning(x.id) ? 'working' : x.state }, 'aria-label': '第 ' + ((x.index || 0) + 1) + ' 张', onclick: () => { if (x.id !== id) go('result', { id: x.id }, { replace: true }); } }, h('img', { alt: '' }));
      if (x.state === 'done') resultUrl(x).then(u => { /** @type {HTMLImageElement} */ (b.querySelector('img')).src = u; });
      return b;
    }));
  }
  /** 底部风格条：同分类的放前面，点一下用同一张照片重新变身（不用重拍）。 */
  function paintStyles(/** @type {string} */ now) {
    const p = presetById(now);
    const near = p ? inCategory(p.cat).map(x => x.id) : [];
    const order = [...new Set([now, ...near, ...inCategory('hot').map(x => x.id)])].slice(0, 12);
    styles.replaceChildren(...order.map(sid => {
      const d = styleDot(sid);
      d.setAttribute('aria-selected', String(sid === now));
      d.addEventListener('click', () => switchTo(sid));
      return d;
    }));
    requestAnimationFrame(() => styles.querySelector('[aria-selected="true"]')?.scrollIntoView({ inline: 'center', block: 'nearest' }));
  }
  async function switchTo(/** @type {string} */ sid) {
    const w = workById(id);
    if (!w) return;
    if (sid === w.preset) { openExamples(sid); return; }   // 点当前这个：看它的样张
    const p = presetById(sid); if (!p) return;
    const params = { ...p.defaults, details: [...p.defaults.details], strength: w.params.strength };
    // 换风格永远从原图出发（不在上一版的画风上叠加），出片最干净
    const next = await create({ source: w.source, preset: sid, params, format: w.format === 'photo' ? 'portrait' : w.format, mode: w.mode, parent: w.id, pace: w.mode === 'live' ? pref('livePace', 'quick') : undefined, why: '换个风格 · ' + captionOf(p, params) });
    note(w, 'style', '换成「' + p.name + '」'); saveWork(w);
    jump(next.id, '换成「' + p.name + '」');
  }
  // 兜底：没挂上进度的情况下完成了，就重画一次（正在揭晓的不打断）
  const off = on('finished', (/** @type {any} */ w) => { if (!el.hidden && w?.batch && workById(id)?.batch === w.batch) paintSibs(/** @type {Work} */ (workById(id))); if (w?.id === id && !el.hidden && el.dataset.state !== 'done') show(); });

  return {
    el,
    shown(/** @type {Record<string, string>} */ p) { id = p.id || id; show(); },
    hidden() { unwatch(); off(); },
  };
}
