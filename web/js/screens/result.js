/**
 * 拍后结果页：全屏成片。
 *   生成中  先垫上镜头里那一帧（即时预览），再换成过程图，最后平滑切到高精成片；三段进度 + 随时取消
 *   生成后  按住看原图；底部一排风格，点一下不用重拍直接换；微调细节 / 保存相册 / 去发 TikTok / 重新拍
 */
import { h, icon, toast, holdable } from '../core/dom.js';
import { go, back } from '../core/nav.js';
import { presetById, inCategory, captionOf } from '../presets.js';
import { applyTheme } from '../core/theme.js';
import { work as workById, resultUrl, source as sourceById, sourceUrl, saveDraft, saveWork, note, setPref } from '../core/data.js';
import { create, watch, stop, retry, isRunning } from '../core/generate.js';
import { on } from '../core/bus.js';
import { progressBox, saveImage, shareTikTok, kindBadge, styleDot, topBar } from '../ui/parts.js';
import { shotOf, previewOf } from '../core/shots.js';
import { reveal, burst, buzz, firstLook } from '../ui/fx.js';
import { T } from '../copy.js';

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
  const stageEl = h('div.res__stage', { tabindex: '0', 'aria-label': '成片，按住看原图' }, before, pre, art, prog, fail, badge, holdHint);
  holdable(stageEl, onHold => stageEl.classList.toggle('is-before', onHold), 120);

  const styles = h('div.res__styles', { role: 'listbox', 'aria-label': T.another });
  const acts = h('div.res__acts', null,
    act('camera', T.retake, () => go('live')),
    act('sliders', T.tweak, () => tweak()),
    act('download', T.save, () => withDone(async w => saveImage(w, await resultUrl(w)))),
    act('send', T.tiktok, () => withDone(async w => shareTikTok(w, await resultUrl(w))), true));
  const titleEl = h('span');
  const bar = topBar('', [h('button.bar__link', { type: 'button', onclick: () => go('gallery') }, T.gallery)], () => back('live'));
  bar.querySelector('.bar__title')?.append(titleEl);
  const el = h('section.screen.result', { 'aria-label': '变身结果' }, bar, stageEl,
    h('div.res__dock', null, h('p.res__label', null, T.another, h('span', null, '同一张照片，点一下就换')), styles, acts));

  function act(/** @type {any} */ ic, /** @type {string} */ label, /** @type {() => void} */ run, main = false) {
    return h('button.act' + (main ? '.act--main' : ''), { type: 'button', onclick: run }, h('span.act__ico', { html: icon(ic) }), h('span.act__label', null, label));
  }
  function withDone(/** @type {(w: any) => Promise<void>} */ fn) {
    const w = workById(id);
    if (!w || w.state !== 'done') { toast('还在出片，等一下下'); return; }
    fn(w).catch(e => toast(e?.message || '没成功，再试一次'));
  }
  function tweak() {
    const w = workById(id); if (!w) return;
    saveDraft('studio', { source: w.source, preset: w.preset, params: w.params, format: 'avatar', tab: 'detail', from: w.id });
    go('studio');
  }

  async function show() {
    unwatch();
    // 刚按下快门：先显示拍下的那一帧和第一阶段进度，作品建好后无缝接上
    const shot = id.startsWith('shot') ? shotOf(id) : null;
    if (shot) {
      el.dataset.state = 'working'; prog.hidden = false; fail.hidden = true;
      pre.src = shot.canvas.toDataURL('image/jpeg', .7);
      prog.update({ stage: 0, value: .04, text: T.sending, eta: 10000, started: performance.now() });
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
    titleEl.textContent = p?.name || '';
    el.dataset.style = w.preset;
    before.src = await sourceUrl(sourceById(w.source));
    const quick = previewOf(w.id);
    if (!shot) { pre.onerror = () => { pre.onerror = null; pre.src = before.src; }; pre.src = quick || before.src; }
    art.classList.remove('is-in'); art.removeAttribute('src');
    paintStyles(w.preset);
    if (w.state === 'done') await done(w, firstLook(w));
    else if (w.state === 'working' || isRunning(w.id)) {
      el.dataset.state = 'working'; prog.hidden = false; fail.hidden = true;
      unwatch = watch(w.id, (pr, ww) => {
        prog.update(pr);
        if (pr.partial && pre.dataset.src !== pr.partial) { pre.dataset.src = pr.partial; const im = new Image(); im.onload = () => { pre.src = pr.partial || ''; pre.classList.add('is-partial'); }; im.src = pr.partial; }
        if (ww.state !== 'working') { if (ww.state === 'done') done(ww, firstLook(ww)); else failed(ww); }
      });
    } else failed(w);
  }
  async function done(/** @type {any} */ w, fresh = false) {
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
        h('button.btn.btn--ghost', { type: 'button', onclick: () => go('live') }, T.retake)));
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
  }
  async function switchTo(/** @type {string} */ sid) {
    const w = workById(id);
    if (!w || sid === w.preset) return;
    const p = presetById(sid); if (!p) return;
    const params = { ...p.defaults, details: [...p.defaults.details], strength: w.params.strength };
    const next = await create({ source: w.source, preset: sid, params, format: w.format, mode: 'live', parent: w.id, why: '换个风格 · ' + captionOf(p, params) });
    note(w, 'style', '换成「' + p.name + '」'); saveWork(w);
    go('result', { id: next.id }, { replace: true });
  }
  // 兜底：没挂上进度的情况下完成了，就重画一次（正在揭晓的不打断）
  const off = on('finished', (/** @type {any} */ w) => { if (w?.id === id && !el.hidden && el.dataset.state !== 'done') show(); });

  return {
    el,
    shown(/** @type {Record<string, string>} */ p) { id = p.id || id; show(); },
    hidden() { unwatch(); off(); },
  };
}
