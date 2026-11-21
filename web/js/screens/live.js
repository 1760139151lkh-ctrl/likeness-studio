/**
 * 实时变身：打开就是 9:16 取景器，对着自己立刻看到风格加持。
 *
 *   顶部   作品库 · 分类胶囊 · 我的
 *   右侧   翻转 / 强度 / 对比 / 精修（四个最高频动作，图标配短字）
 *   底部   风格轮播（真图圆头像）+ 居中主快门；最下面是「实时变身 | 上传精修」模式切换
 *
 * 镜头里是本机实时渲染的轻量预览（WebGL 风格化 + 人脸追踪贴纸）；按下快门，原图交给工作室生成高精成片。
 * 摄像头权限被拒或没有摄像头时，取景器里直接给出原因，并一键引导去「上传精修」。
 */
import { h, icon, toast, clamp, reduced, uid } from '../core/dom.js';
import { holdShot, setPreview } from '../core/shots.js';
import { go } from '../core/nav.js';
import { on } from '../core/bus.js';
import { inCategory, presetById, defaultsOf } from '../presets.js';
import { applyTheme } from '../core/theme.js';
import { pref, setPref, addSource, isFav, toggleFav, works, resultUrl } from '../core/data.js';
import { create } from '../core/generate.js';
import { prepare, canvasOf, blobOf } from '../core/image.js';
import { createCamera, cameraPermission } from '../live/camera.js';
import { createRenderer } from '../live/renderer.js';
import { createOverlay } from '../live/overlay.js';
import { loadTracker, summarise, smoothFace } from '../live/tracker.js';
import { pills, styleDot } from '../ui/parts.js';
import { warp, buzz } from '../ui/fx.js';
import { openExamples } from '../ui/examples.js';
import { T } from '../copy.js';

export function liveScreen() {
  let cat = pref('liveCat', 'hot');
  let current = pref('preset', 'princess');
  let strength = pref('liveStrength', .85);
  let splitOn = false, split = .5, running = false, raf = 0, tracker = /** @type {any} */ (null), face = /** @type {any} */ (null), lastDetect = 0, detecting = false;
  let stopTimer = 0;

  // ── 取景器 ──
  const video = /** @type {HTMLVideoElement} */ (h('video.live__video', { playsinline: true, muted: true, autoplay: true, 'aria-hidden': 'true' }));
  const gl = /** @type {HTMLCanvasElement} */ (h('canvas.live__gl', { 'aria-label': '实时取景' }));
  const fx = /** @type {HTMLCanvasElement} */ (h('canvas.live__fx', { 'aria-hidden': 'true' }));
  const flash = h('div.live__flash', { 'aria-hidden': 'true' });
  const guide = h('div.live__guide', { 'aria-hidden': 'true' }, h('span.live__oval'), h('span.live__guidetext', null, T.faceLost));
  const splitBar = h('div.live__split', { 'aria-hidden': 'true' }, h('span.live__splitlabel.is-l', null, '原图'), h('span.live__splitlabel.is-r', null, '变身'));
  const gateText = h('p.gate__text', null, T.camAsk);
  const gateBtn = h('button.btn.btn--main', { type: 'button', onclick: () => startCam(true) }, h('span', { html: icon('camera') }), T.camOn);
  const gate = h('div.gate', null,
    h('div.gate__art', { 'aria-hidden': 'true' }, h('span', { html: icon('camera') })),
    gateText, gateBtn,
    h('button.btn.btn--ghost', { type: 'button', onclick: () => go('studio') }, h('span', { html: icon('upload') }), '去' + T.studio));
  const view = h('div.live__view', null, video, gl, fx, guide, splitBar, flash, gate);
  const camera = createCamera(video);
  const renderer = createRenderer(gl);
  const overlay = createOverlay(fx);

  // ── 顶部 ──
  const galleryBtn = h('button.chip.chip--glass', { type: 'button', onclick: () => go('gallery'), 'aria-label': T.gallery }, h('span.chip__thumb'), h('span', null, T.gallery));
  const meBtn = h('button.avatar', { type: 'button', onclick: () => go('me'), 'aria-label': T.me }, h('span', { html: icon('user') }));
  const catPills = pills(cat, id => { cat = id; setPref('liveCat', id); fill(); }, 'pills--glass');
  let warpTimer = 0, settled = '';
  const top = h('header.live__top', null, h('div.live__row', null, galleryBtn, h('span.live__brand', null, T.brand), meBtn), catPills);

  // ── 右侧工具条 ──
  const tool = (/** @type {any} */ ic, /** @type {string} */ label, /** @type {() => void} */ run, key = '') => h('button.tool', { type: 'button', onclick: run, 'aria-label': label, data: { tool: key } }, h('span.tool__ico', { html: icon(ic) }), h('span.tool__label', null, label));
  const strengthRange = /** @type {HTMLInputElement} */ (h('input.vrange', { type: 'range', min: '0', max: '100', value: String(Math.round(strength * 100)), 'aria-label': T.knobs.strength }));
  const strengthVal = h('b.pop__val', null, Math.round(strength * 100) + '');
  const strengthPop = h('div.pop', { hidden: true, role: 'dialog', 'aria-label': T.knobs.strength }, h('span.pop__title', null, T.knobs.strength), strengthVal, strengthRange);
  strengthRange.addEventListener('input', () => { strength = Number(strengthRange.value) / 100; strengthVal.textContent = strengthRange.value; renderer?.setStrength(strength); overlay.setStrength(strength); });
  strengthRange.addEventListener('change', () => setPref('liveStrength', strength));
  const tools = h('aside.live__tools', { 'aria-label': '工具' },
    tool('flip', T.flip, () => flipCam(), 'flip'),
    tool('bolt', T.strength, () => { strengthPop.hidden = !strengthPop.hidden; toolState(); }, 'strength'),
    tool('compare', T.compare, () => { splitOn = !splitOn; split = .5; renderer?.setSplit(splitOn ? split : -1); view.classList.toggle('is-split', splitOn); toolState(); if (splitOn) toast('左边原图，右边变身；拖动分割线对比'); }, 'compare'),
    tool('sliders', T.toStudio, () => go('studio'), 'studio'));
  function toolState() {
    tools.querySelector('[data-tool="strength"]')?.setAttribute('aria-pressed', String(!strengthPop.hidden));
    tools.querySelector('[data-tool="compare"]')?.setAttribute('aria-pressed', String(splitOn));
  }
  // drag the split line
  view.addEventListener('pointerdown', e => {
    if (!splitOn) return;
    const r = view.getBoundingClientRect();
    const move = (/** @type {PointerEvent} */ ev) => { split = clamp((ev.clientX - r.left) / r.width, .05, .95); renderer?.setSplit(split); splitBar.style.left = split * 100 + '%'; };
    move(e); view.setPointerCapture(e.pointerId);
    const up = () => { view.removeEventListener('pointermove', move); view.removeEventListener('pointerup', up); };
    view.addEventListener('pointermove', move); view.addEventListener('pointerup', up);
  });

  // ── 底部：风格轮播 + 快门 ──
  const name = h('b.live__name'), hook = h('span.live__hook');
  const favBtn = h('button.live__fav', { type: 'button', onclick: async () => { const on = await toggleFav(current); syncFav(); toast(on ? '已收藏「' + presetById(current)?.name + '」' : '已取消收藏'); } });
  const track = h('div.carousel__track', { role: 'listbox', 'aria-label': '风格' });
  const shutterImg = /** @type {HTMLImageElement} */ (h('img', { alt: '' }));
  const shutter = h('button.shutter', { type: 'button', 'aria-label': T.go + '（拍照）', onclick: () => shoot() }, h('span.shutter__ring'), h('span.shutter__face', null, shutterImg));
  const coach = h('div.coach', { hidden: true, role: 'note' }, '选个风格，点这里就变身', h('button.coach__x', { type: 'button', 'aria-label': T.close, html: icon('close'), onclick: () => dismissCoach() }));
  const carousel = h('div.carousel', null, track, shutter, coach);
  const modes = h('nav.modes', { 'aria-label': '模式' },
    h('button.modes__opt', { type: 'button', 'aria-current': 'page' }, T.live),
    h('button.modes__opt', { type: 'button', onclick: () => go('studio') }, T.studio));
  const bottom = h('footer.live__bottom', null, h('div.live__caption', null, h('button.live__label', { type: 'button', 'aria-label': '看样张', onclick: () => openExamples(current) }, name, hook), favBtn), carousel, modes);

  const el = h('section.screen.live', { 'aria-label': T.live }, view, top, tools, strengthPop, bottom);

  // ── 轮播 ──
  /** @type {HTMLElement[]} */ let dots = [];
  function fill() {
    const list = inCategory(cat);
    dots = list.map(p => styleDot(p.id));
    track.replaceChildren(h('span.carousel__pad'), ...dots, h('span.carousel__pad'));
    dots.forEach(d => d.addEventListener('click', () => { if (d.dataset.style === current) shoot(); else center(d.dataset.style || '', true); }));
    if (!list.some(p => p.id === current)) select(list[0].id);
    requestAnimationFrame(() => center(current, false));
  }
  let steering = '', steerTimer = 0;
  function center(/** @type {string} */ id, smooth) {
    const d = dots.find(x => x.dataset.style === id); if (!d) return;
    // 滑向点中的那个风格时，途经的风格不算选中：主题不会一路闪过去
    steering = smooth && !reduced ? id : '';
    clearTimeout(steerTimer); steerTimer = window.setTimeout(() => { steering = ''; }, 900);
    track.scrollTo({ left: d.offsetLeft + d.offsetWidth / 2 - track.clientWidth / 2, behavior: smooth && !reduced ? 'smooth' : 'auto' });
    select(id);
  }
  let scrollRaf = 0;
  track.addEventListener('scroll', () => {
    cancelAnimationFrame(scrollRaf);
    scrollRaf = requestAnimationFrame(() => {
      const mid = track.scrollLeft + track.clientWidth / 2;
      let best = dots[0], bd = Infinity;
      for (const d of dots) { const c = d.offsetLeft + d.offsetWidth / 2, dd = Math.abs(c - mid); if (dd < bd) { bd = dd; best = d; } }
      if (steering) { if (best?.dataset.style === steering) { steering = ''; } return; }
      if (best && best.dataset.style !== current) select(best.dataset.style || '');
    });
  }, { passive: true });
  function select(/** @type {string} */ id) {
    const p = presetById(id); if (!p) return;
    current = id; setPref('preset', id);
    // 停在一个新世界上：标题卡从快门处晕开（滑动途中不打扰）
    clearTimeout(warpTimer);
    warpTimer = window.setTimeout(() => { if (current === id && settled && settled !== id && !el.hidden) { warp(view, id); buzz(8); } settled = id; }, 280);
    dots.forEach(d => d.setAttribute('aria-selected', String(d.dataset.style === id)));
    name.textContent = p.name; hook.textContent = p.line;
    shutterImg.src = /** @type {HTMLImageElement} */ (dots.find(d => d.dataset.style === id)?.querySelector('img'))?.src || '';
    renderer?.setPreset(id); overlay.setPreset(id);
    applyTheme(id);
    syncFav();
  }
  function syncFav() { const f = isFav(current); favBtn.innerHTML = icon(f ? 'heartFill' : 'heart'); favBtn.setAttribute('aria-label', f ? '取消收藏' : T.fav); favBtn.setAttribute('aria-pressed', String(f)); }

  // ── 摄像头 ──
  async function startCam(asked = false) {
    clearTimeout(stopTimer);
    if (camera.on) { el.dataset.cam = 'on'; loop(); return; }
    const perm = await cameraPermission();
    if (perm === 'denied') { gateFor('denied'); return; }
    if (perm !== 'granted' && !asked && !pref('camAsked', false)) { gateFor('ask'); return; }
    el.dataset.cam = 'starting'; gateText.textContent = T.camStarting;
    try {
      await camera.start();
      setPref('camAsked', true);
      el.dataset.cam = 'on';
      renderer?.setMirror(camera.facing === 'user');
      loop();
      warmTracker();
      showCoach();
    } catch (e) { gateFor(/** @type {any} */ (e).reason || 'busy'); }
  }
  /** @param {'ask' | 'denied' | 'none' | 'busy'} why */
  function gateFor(why) {
    el.dataset.cam = why;
    gateText.textContent = why === 'ask' ? T.camAsk : why === 'denied' ? T.camDenied : why === 'none' ? T.camNone : '摄像头被别的应用占用了，关掉再试';
    gateBtn.hidden = why === 'denied' || why === 'none';
    if (why === 'denied' || why === 'none') toast(why === 'denied' ? T.camDenied : T.camNone, { ms: 4200, action: { label: '去' + T.studio, run: () => go('studio') } });
  }
  async function flipCam() {
    try { await camera.flip(); renderer?.setMirror(camera.facing === 'user'); face = null; }
    catch { toast('这台设备只有一个摄像头'); }
  }
  async function warmTracker() {
    if (tracker) return;
    try { tracker = await loadTracker('VIDEO'); } catch { tracker = null; }
  }

  // ── 渲染循环 ──
  function loop() {
    if (running) return;
    running = true;
    // 慢设备自适应：读脸花得越久，读得越疏；画一帧太慢就降一点分辨率——界面始终跟手
    let detectCost = 0, every = 30, drawCost = 0, scale = 1, frames = 0;
    const frame = (/** @type {number} */ t) => {
      if (!running) return;
      raf = requestAnimationFrame(frame);
      if (!camera.ready) return;
      if (++frames % 30 === 0) scale = drawCost > 22 ? Math.max(.5, scale * .85) : drawCost < 8 && scale < 1 ? Math.min(1, scale / .85) : scale;
      const r = gl.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 1.75) * scale;
      const W = Math.round(r.width * dpr), H = Math.round(r.height * dpr);
      renderer?.resize(W, H); overlay.resize(W, H);
      // face: read at most ~30 times a second, never two at once
      if (tracker && !detecting && t - lastDetect > every) {
        // 读脸放到下一个任务里做：画面先画出来，中间有点击也能先响应
        detecting = true; lastDetect = t;
        setTimeout(() => {
          if (!running || !camera.ready) { detecting = false; return; }
          const s0 = performance.now();
          try {
            const res = tracker.detectForVideo(video, s0);
            const lm = res?.faceLandmarks?.[0];
            face = lm?.length ? smoothFace(face, summarise(lm, video.videoWidth / video.videoHeight)) : (face && s0 - face.seen < 300 ? face : null);
          } catch { /* a dropped frame */ }
          detecting = false;
          detectCost = detectCost * .8 + (performance.now() - s0) * .2;
          every = Math.max(30, Math.min(300, detectCost * 3));
        }, 0);
      }
      const d0 = performance.now();
      const f = face && toCanvas(face, W, H);
      renderer?.setFace(f ? { cx: f.center.x / W, cy: 1 - f.center.y / H, r: f.height / H, el: [f.eyeL.x / W, 1 - f.eyeL.y / H], er: [f.eyeR.x / W, 1 - f.eyeR.y / H] } : null);
      renderer?.draw(video, video.videoWidth, video.videoHeight, t);
      overlay.draw(f, t);
      drawCost = drawCost * .9 + (performance.now() - d0) * .1;
      el.classList.toggle('has-face', !!f);
    };
    raf = requestAnimationFrame(frame);
  }
  /** 源图归一化坐标 → 画布像素（考虑 cover 裁切与镜像）。 */
  function toCanvas(/** @type {any} */ fc, /** @type {number} */ W, /** @type {number} */ H) {
    const crop = renderer ? renderer.crop : [0, 0, 1, 1], mir = renderer ? renderer.mirror : true;
    const pt = (/** @type {{ x: number, y: number }} */ p) => ({ x: ((mir ? 1 - p.x : p.x) - crop[0]) / crop[2] * W, y: (p.y - crop[1]) / crop[3] * H });
    const eL = pt(fc.eyeL), eR = pt(fc.eyeR);
    const [a, b] = eL.x <= eR.x ? [eL, eR] : [eR, eL];
    const top = pt(fc.top), chin = pt(fc.chin);
    return { center: pt(fc.center), eyeL: a, eyeR: b, nose: pt(fc.nose), top, chin, roll: Math.atan2(b.y - a.y, b.x - a.x),
      width: Math.hypot(pt(fc.cheekR).x - pt(fc.cheekL).x, pt(fc.cheekR).y - pt(fc.cheekL).y), height: Math.hypot(chin.x - top.x, chin.y - top.y) };
  }
  function pause() { running = false; cancelAnimationFrame(raf); }

  // ── 拍照 → 出片 ──
  let shooting = false;
  async function shoot() {
    if (shooting) return;
    dismissCoach();
    if (!camera.ready) { if (el.dataset.cam === 'ask') startCam(true); else toast(T.camAsk, { action: { label: '去' + T.studio, run: () => go('studio') } }); return; }
    shooting = true;
    try {
      if (!reduced) { flash.classList.remove('is-on'); void flash.offsetWidth; flash.classList.add('is-on'); }
      buzz(18);
      shutter.classList.add('is-busy');
      // 原图（给模型的干净照片）：按取景框裁成竖版，前置镜头保持镜像，和你看到的一样
      const vw = video.videoWidth, vh = video.videoHeight, aspect = 2 / 3;
      const cw = Math.min(vw, vh * aspect), ch = cw / aspect;
      const raw = canvasOf(Math.round(cw), Math.round(ch)), rx = /** @type {CanvasRenderingContext2D} */ (raw.getContext('2d'));
      if (camera.facing === 'user') { rx.translate(raw.width, 0); rx.scale(-1, 1); }
      rx.drawImage(video, (vw - cw) / 2, (vh - ch) / 2, cw, ch, 0, 0, raw.width, raw.height);
      // 即时预览（镜头里看到的样子，含贴纸）：结果页立刻拿它垫着，出片前零等待
      const pv = canvasOf(gl.width, gl.height), px = /** @type {CanvasRenderingContext2D} */ (pv.getContext('2d'));
      px.drawImage(gl, 0, 0); px.drawImage(fx, 0, 0);
      const presetNow = current, p = /** @type {any} */ (presetById(presetNow));
      const params = { ...defaultsOf(p), ...(pref('params.' + presetNow, {})), strength: Math.round(strength * 100) };
      const token = uid('shot');
      const work = (async () => {
        const { blob, w, h: hh } = await prepare(await blobOf(raw, 'image/jpeg', .92));
        const src = await addSource(blob, { w, h: hh });
        const w0 = await create({ source: src.id, preset: presetNow, params, format: 'portrait', mode: 'live', pace: pref('livePace', 'quick') });
        blobOf(pv, 'image/jpeg', .8).then(b => setPreview(w0.id, URL.createObjectURL(b))).catch(() => {});
        return w0.id;
      })();
      holdShot(token, pv, work);
      go('result', { id: token });
      await work;
    } catch (e) { toast('拍照没成功：' + (/** @type {any} */ (e)?.message || '再试一次')); }
    finally { shooting = false; shutter.classList.remove('is-busy'); }
  }

  // ── 新手气泡：第一次进来指一下快门 ──
  function showCoach() { if (!pref('coached', false)) { coach.hidden = false; setTimeout(dismissCoach, 7000); } }
  function dismissCoach() { if (!coach.hidden) { coach.hidden = true; setPref('coached', true); } }

  async function paintGalleryThumb() {
    const last = works().find(w => w.state === 'done');
    const thumb = /** @type {HTMLElement} */ (galleryBtn.querySelector('.chip__thumb'));
    const url = last ? await resultUrl(last) : '';
    thumb.style.backgroundImage = url ? `url("${url}")` : '';
    thumb.innerHTML = url ? '' : icon('gallery');
  }
  on('works', () => { if (!el.hidden) paintGalleryThumb(); });
  on('cam:start', () => startCam(true));

  fill();
  return {
    el, keep: true,
    shown() {
      el.hidden = false;
      // 从「拍同款」或别处选了风格过来：轮播直接停在它上面
      const want = pref('preset', current);
      if (want !== current && presetById(want)) {
        if (!inCategory(cat).some(p => p.id === want)) { cat = presetById(want)?.cat || 'hot'; catPills.set(cat); fill(); }
        current = want; requestAnimationFrame(() => center(want, false));
      }
      settled = settled || current;
      applyTheme(current);
      syncFav(); paintGalleryThumb(); toolState();
      startCam();
    },
    hidden() {
      pause();
      strengthPop.hidden = true;
      // 切走一会儿就关掉摄像头省电；很快回来则不用重新授权/启动
      clearTimeout(stopTimer);
      stopTimer = window.setTimeout(() => { camera.stop(); el.dataset.cam = 'off'; }, 15000);
    },
  };
}
