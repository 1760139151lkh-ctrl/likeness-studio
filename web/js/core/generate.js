/**
 * 一次变身的全过程，实时变身和上传精修共用：
 *
 *   生成前  作品立刻建档（state: working），原图早已在后台传好
 *   生成中  三个阶段（识别人像特征 → 注入风格光影 → 精雕艺术细节）+ 按预计耗时推进的进度 + 过程预览图，随时可取消
 *   生成后  成片落到本机与私有空间，作品库立刻能看到；失败给出原因和重试
 *
 * 页面关掉时还在生成的作品，下次打开会自动接上服务器上的任务，不会丢、也不会重复生成。
 */
import { studio, startTurn, follow, cancelJob, fetchBlob } from './api.js';
import { work as workById, works, saveWork, setResult, note, source as sourceById, ensureUploaded, forgetUpload, sourceBlob, pref } from './data.js';
import { presetById, promptFor, captionOf } from '../presets.js';
import { hasArt, styleArt } from './assets.js';
import { emit } from './bus.js';
import { uid, sleep } from './dom.js';
import { T } from '../copy.js';

/** @typedef {import('./data.js').Work} Work */
/** @typedef {{ stage: number, value: number, text: string, partial?: string, eta: number, started: number }} Progress */

/** 正在进行的任务：页面换来换去，界面随时可以重新挂上来看进度。 */
const running = new Map();

/**
 * 新建一件作品并开始生成。
 * @param {{ source: string, preset: string, params: any, format: 'avatar' | 'portrait', mode: 'live' | 'studio', parent?: string, why?: string }} o
 */
export async function create(o) {
  const p = presetById(o.preset);
  if (!p) throw new Error('unknown style');
  const now = Date.now();
  /** @type {Work} */
  const w = { id: uid('w'), preset: o.preset, params: { ...o.params, details: [...(o.params.details || [])] }, format: o.format, source: o.source, mode: o.mode,
    state: 'working', kind: studio.mode === 'live' ? 'render' : studio.mode === 'simulator' ? 'simulated' : 'preview', createdAt: now, updatedAt: now, trail: [],
    prompt: promptFor(p, o.params, { format: o.format }), ...(o.parent ? { parent: o.parent } : {}) };
  note(w, 'make', o.why || (o.mode === 'live' ? '实时变身 · ' : '') + captionOf(p, o.params), o.preset);
  await saveWork(w);
  run(w);
  return w;
}

/** 重试一件失败/取消的作品（同样的设置）。任务同步登记，界面紧接着就能挂上它的进度。 */
export function retry(/** @type {Work} */ w) {
  // 新的一次尝试要有新的提交号：服务器把同一个提交号的重发当成同一个任务（防断网重复生成），包括已取消的那个
  w.attempt = (w.attempt || 0) + 1;
  w.state = 'working'; delete w.error; delete w.job;
  note(w, 'make', '重试 · ' + (presetById(w.preset)?.name || ''), w.preset);
  run(w);
  saveWork(w);
}

/** 挂上某件作品的进度（已结束的会立刻回调一次结束）。返回取消挂载的函数。 @param {string} id @param {(p: Progress, w: Work) => void} fn */
export function watch(id, fn) {
  const r = running.get(id);
  if (r) { r.listeners.add(fn); fn(r.progress, r.work); return () => r.listeners.delete(fn); }
  return () => {};
}
export const isRunning = (/** @type {string} */ id) => running.has(id);

/** 取消。 */
export function stop(/** @type {string} */ id) {
  const r = running.get(id); if (!r) return;
  r.ctrl.abort();
  if (r.work.job) cancelJob(r.work.job);
}

/** @param {Work} w */
function run(w, resumeJob = '') {
  const ctrl = new AbortController();
  const eta = studio.live ? studio.eta(pref('pace', 'fine')) : 2600;
  const r = { work: w, ctrl, listeners: new Set(), progress: /** @type {Progress} */ ({ stage: 0, value: .02, text: studio.live ? T.sending : T.stages[0], eta, started: performance.now() }) };
  running.set(w.id, r);
  emit('running', w.id);
  const tell = (/** @type {Partial<Progress>} */ patch) => {
    Object.assign(r.progress, patch);
    for (const fn of r.listeners) fn(r.progress, w);
  };
  // 进度条：在阶段的区间里按预计耗时平滑推进，事件到了就跳到对应位置，绝不倒退
  const BANDS = [[.02, .28], [.3, .82], [.84, .97]];
  const tick = setInterval(() => {
    const t = performance.now() - r.progress.started, [lo, hi] = BANDS[r.progress.stage];
    const curve = 1 - Math.exp(-t / Math.max(1500, r.progress.eta) * 2.2);
    const v = Math.max(r.progress.value, Math.min(hi, lo + (.97 - lo) * curve));
    tell({ value: v });
  }, 160);

  (async () => {
    const started = performance.now();
    try {
      if (studio.live) await live(w, r, tell, resumeJob);
      else await offline(w, tell, ctrl.signal);
      w.ms = Math.round(performance.now() - started);
      tell({ stage: 2, value: 1, text: '出片啦' });   // 先把进度推满，状态在 finally 里只宣布一次
      w.state = 'done';
    } catch (e) {
      const cancelled = ctrl.signal.aborted || e?.cancelled;
      w.state = cancelled ? 'stopped' : 'failed';
      w.error = cancelled ? T.stopped : (e?.message || T.failed) + (e?.hint ? '。' + e.hint : '');
      note(w, 'fail', cancelled ? '取消了' : '没成功：' + (e?.message || ''));
    } finally {
      clearInterval(tick);
      await saveWork(w);
      running.delete(w.id);
      for (const fn of r.listeners) fn(r.progress, w);
      emit('finished', w);
    }
  })();
}

/** @param {Work} w @param {any} r @param {(p: Partial<Progress>) => void} tell */
async function live(w, r, tell, resumeJob = '') {
  let job = resumeJob;
  if (!job) {
    const s = sourceById(w.source);
    if (!s) throw new Error('原图找不到了，重新选一张吧');
    let asset;
    try { asset = await ensureUploaded(s); } catch (e) { throw Object.assign(new Error('照片上传失败'), { hint: '检查一下网络再试' }); }
    if (r.ctrl.signal.aborted) throw { cancelled: true };
    tell({ text: T.queued });
    const p = presetById(w.preset);
    let res;
    try {
      res = await startTurn({ id: turnId(w), prompt: w.prompt || '', asset, pace: pref('pace', 'fine'), aspect: w.format === 'portrait' ? 'portrait' : 'square', preset: w.preset, voice: [T.doneSaved] });
    } catch (e) {
      if (e.status === 409) { forgetUpload(s); asset = await ensureUploaded(s); res = await startTurn({ id: turnId(w), prompt: w.prompt || '', asset, pace: pref('pace', 'fine'), aspect: w.format === 'portrait' ? 'portrait' : 'square', preset: w.preset }); }
      else throw e;
    }
    void p;
    job = res.job; w.job = job;
    r.progress.eta = res.eta || r.progress.eta;
    saveWork(w);
  }
  if (r.ctrl.signal.aborted) { cancelJob(job); throw { cancelled: true }; }
  for await (const ev of follow(job, { signal: r.ctrl.signal })) {
    if (ev.type === 'stage') {
      const stage = ev.stage === 'read' ? 0 : ev.stage === 'finish' ? 2 : 1;
      tell({ stage: Math.max(stage, r.progress.stage), text: T.stages[Math.max(stage, r.progress.stage)], ...(stage === 1 && r.progress.stage < 1 ? { started: performance.now() } : {}) });
    } else if (ev.type === 'partial') {
      tell({ stage: Math.max(1, r.progress.stage), partial: ev.url, text: T.waits[1] });
    } else if (ev.type === 'result') {
      tell({ stage: 2, text: T.stages[2], partial: ev.url });
      w.asset = ev.url; w.w = ev.w; w.h = ev.h;
      w.kind = ev.provenance?.kind === 'simulated' ? 'simulated' : 'render';
      fetchBlob(ev.url).then(b => setResult(w, b)).then(() => emit('works', w)).catch(() => {});
    }
  }
  if (!w.asset) throw new Error('服务器没给成片');
}

const turnId = (/** @type {Work} */ w) => w.id + (w.attempt ? '.' + w.attempt : '');

/** 演示版：示例人物直接给预先生成的样张；你自己的照片用本机滤镜出一张本地预览。 */
async function offline(/** @type {Work} */ w, /** @type {(p: Partial<Progress>) => void} */ tell, /** @type {AbortSignal} */ signal) {
  const steps = [[0, 520], [1, 900], [2, 700]];
  for (const [stage, ms] of steps) {
    if (signal.aborted) throw { cancelled: true };
    tell({ stage, text: T.stages[stage] });
    await sleep(ms);
  }
  if (signal.aborted) throw { cancelled: true };
  const s = sourceById(w.source);
  let blob;
  let kind = /** @type {Work['kind']} */ ('preview');
  if (s?.sample && hasArt(w.preset, s.sample)) { blob = await fetch(styleArt(w.preset, s.sample)).then(x => x.blob()); kind = 'example'; }
  else {
    const src = s && await sourceBlob(s);
    if (!src) throw new Error('原图找不到了，重新选一张吧');
    const { stylizeStill } = await import('../live/renderer.js');
    blob = await stylizeStill(src, w.preset, w.params.strength / 100, w.format);
  }
  await setResult(w, blob);
  w.kind = kind;
}

/** 页面关掉时还在生成的：有任务号就接上；没有（还没发出去）就标为中断，可一键重试。 */
export async function resumeAll() {
  for (const w of works()) {
    if (w.state !== 'working' || running.has(w.id)) continue;
    if (studio.live && w.job) run(w, w.job);
    else { w.state = 'stopped'; w.error = '上次没生成完，点重试接着来'; await saveWork(w); }
  }
}
export { workById };
