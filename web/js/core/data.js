/**
 * 你的私人空间：作品、原图、收藏的风格、草稿和偏好。
 *
 * 一切改动先落到本机（IndexedDB），立刻生效；有服务器时再静默同步到你账号的私有空间。所以刷新、切页、换台设备、
 * 甚至清了浏览器缓存再登录，作品和创作轨迹都还在。访客态的作品在登录时会整体归到你的账号下。
 */
import { allRecords, putRecord, getBlob, putBlob, dropBlob, getMeta, setMeta, clearRecords, keepSafe } from './db.js';
import { studio, upload, pull, push } from './api.js';
import { emit } from './bus.js';
import { uid } from './dom.js';

/** @typedef {{ t: number, kind: 'make' | 'style' | 'tweak' | 'say' | 'save' | 'share' | 'fav' | 'fail', text: string, preset?: string }} Step */
/**
 * @typedef {{ id: string, preset: string, params: any, format: 'avatar' | 'portrait', source: string, mode: 'live' | 'studio',
 *   state: 'working' | 'done' | 'failed' | 'stopped', job?: string, asset?: string, w?: number, h?: number, ms?: number,
 *   kind: 'render' | 'simulated' | 'preview' | 'example', prompt?: string, error?: string, fav?: boolean, parent?: string, attempt?: number,
 *   createdAt: number, updatedAt: number, trail: Step[] }} Work
 */
/** @typedef {{ id: string, asset?: string, w?: number, h?: number, sample?: string, createdAt: number, updatedAt: number }} Source */

const mem = { works: new Map(), sources: new Map(), favs: new Map(), drafts: new Map(), prefs: new Map() };
const urls = new Map();
const uploads = new Map();

export async function boot() {
  const known = await getMeta('account');
  const now = studio.account?.id || 'local';
  // 换了账号（在别处退出又登录了别人）：本机缓存属于上一个人，清掉，从新账号的私有空间拉回来
  if (known && known !== now && studio.live) { await clearRecords(); await setMeta('cursor', 0); }
  await setMeta('account', now);
  for (const r of await allRecords()) if (!r.deleted && mem[r.coll]) mem[r.coll].set(r.id, r.data);
  if (studio.live) syncSoon(0);
  addEventListener('online', () => syncSoon(0));
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') syncSoon(300); else flush(); });
}

// ── 通用写入：本机立刻生效，标记待同步 ──
async function write(/** @type {keyof typeof mem} */ coll, /** @type {any} */ data, deleted = false) {
  const updated = Date.now();
  if (deleted) mem[coll].delete(data.id); else mem[coll].set(data.id, data);
  await putRecord({ coll, id: data.id, data, updated, deleted, dirty: true });
  emit(coll, data);
  syncSoon();
}

// ── 作品 ──
export const works = () => /** @type {Work[]} */ ([...mem.works.values()]).sort((a, b) => b.createdAt - a.createdAt);
export const work = (/** @type {string} */ id) => /** @type {Work | null} */ (mem.works.get(id) || null);
export async function saveWork(/** @type {Work} */ w) { w.updatedAt = Date.now(); await write('works', w); keepSafe(); return w; }
export async function deleteWork(/** @type {string} */ id) {
  const w = work(id); if (!w) return;
  await write('works', { id }, true);
  dropBlob('w:' + id);
  forgetUrl('w:' + id);
}
/** 在作品的创作轨迹里记一笔。 @param {Work} w @param {Step['kind']} kind @param {string} text */
export function note(w, kind, text, preset = '') { w.trail = [...(w.trail || []), { t: Date.now(), kind, text, ...(preset ? { preset } : {}) }].slice(-60); }
export async function setResult(/** @type {Work} */ w, /** @type {Blob} */ blob) { await putBlob('w:' + w.id, blob); forgetUrl('w:' + w.id); }

/** 作品成片的地址：本机有就用本机的，否则用私有空间里的那份。 */
export async function resultUrl(/** @type {Work} */ w) { return (await localUrl('w:' + w.id)) || (w.asset || ''); }

// ── 原图 ──
export const source = (/** @type {string} */ id) => /** @type {Source | null} */ (mem.sources.get(id) || null);
export const sources = () => /** @type {Source[]} */ ([...mem.sources.values()]).sort((a, b) => b.createdAt - a.createdAt);
/**
 * 收下一张原图（已经压缩过）。有服务器时立刻开始在后台上传——等用户选好风格点下去时，图早就在服务器上了。
 * @param {Blob} blob @param {{ sample?: string, w?: number, h?: number }} [o]
 */
export async function addSource(blob, o = {}) {
  /** @type {Source} */ const s = { id: uid('s'), createdAt: Date.now(), updatedAt: Date.now(), ...(o.sample ? { sample: o.sample } : {}), w: o.w, h: o.h };
  await putBlob('s:' + s.id, blob);
  await write('sources', s);
  if (studio.live) ensureUploaded(s).catch(() => {});
  return s;
}
export async function sourceUrl(/** @type {Source | null} */ s) { return s ? ((await localUrl('s:' + s.id)) || s.asset || '') : ''; }
export const sourceBlob = (/** @type {Source} */ s) => getBlob('s:' + s.id);
/** 确保原图已在服务器上，返回它在私有空间里的 id。 @param {Source} s @returns {Promise<string>} */
export function ensureUploaded(s) {
  if (s.asset) return Promise.resolve(s.asset.split('/').pop() || '');
  if (!uploads.has(s.id)) {
    uploads.set(s.id, (async () => {
      let blob = await getBlob('s:' + s.id);
      if (!blob && s.asset) blob = await fetch(s.asset).then(r => r.blob());
      if (!blob) throw new Error('原图找不到了，重新选一张吧');
      const a = await upload(blob);
      s.asset = a.url; s.w = a.w; s.h = a.h;
      await write('sources', s);
      return a.id;
    })());
    uploads.get(s.id).catch(() => uploads.delete(s.id));
  }
  return uploads.get(s.id);
}
/** 服务器重启后图丢了：清掉记号，下次重新上传。 */
export function forgetUpload(/** @type {Source} */ s) { delete s.asset; uploads.delete(s.id); }

// ── 收藏的风格 ──
export const isFav = (/** @type {string} */ preset) => mem.favs.has(preset);
export const favs = () => [...mem.favs.values()].sort((a, b) => b.at - a.at).map(f => f.id);
export async function toggleFav(/** @type {string} */ preset) {
  if (isFav(preset)) await write('favs', { id: preset }, true);
  else await write('favs', { id: preset, at: Date.now() });
  return isFav(preset);
}

// ── 草稿与偏好 ──
export const draft = (/** @type {string} */ id) => mem.drafts.get(id) || null;
const draftTimers = new Map();
/** 草稿随手存（300ms 防抖），关掉页面也不会丢。 */
export function saveDraft(/** @type {string} */ id, /** @type {any} */ data) {
  mem.drafts.set(id, { ...data, id });
  clearTimeout(draftTimers.get(id));
  draftTimers.set(id, setTimeout(() => write('drafts', { ...data, id, at: Date.now() }), 300));
}
export const pref = (/** @type {string} */ k, /** @type {any} */ d) => (mem.prefs.get('prefs')?.[k] ?? d);
export function setPref(/** @type {string} */ k, /** @type {any} */ v) {
  const p = { ...(mem.prefs.get('prefs') || { id: 'prefs' }), [k]: v };
  mem.prefs.set('prefs', p);
  try { localStorage.setItem('hjx.' + k, JSON.stringify(v)); } catch { /* 隐私模式 */ }
  write('prefs', p);
}

// ── 本机图片地址（每个 Blob 只建一次）──
async function localUrl(/** @type {string} */ key) {
  if (urls.has(key)) return urls.get(key);
  const b = await getBlob(key);
  if (!b) return '';
  const u = URL.createObjectURL(b);
  urls.set(key, u);
  return u;
}
function forgetUrl(/** @type {string} */ key) { const u = urls.get(key); if (u) URL.revokeObjectURL(u); urls.delete(key); }

// ── 同步 ──
let timer = 0, running = /** @type {Promise<void> | null} */ (null), again = false;
export function syncSoon(ms = 800) {
  if (!studio.live) return;
  clearTimeout(timer);
  timer = window.setTimeout(() => { sync().catch(() => {}); }, ms);
}
/** 离开页面前把没同步的赶紧送出去。 */
function flush() { if (studio.live) sync().catch(() => {}); }
export async function sync() {
  if (!studio.live) return;
  if (running) { again = true; return running; }
  running = (async () => {
    try {
      const dirty = (await allRecords()).filter(r => r.dirty);
      for (let i = 0; i < dirty.length; i += 150) {
        const batch = dirty.slice(i, i + 150);
        await push(batch.map(r => ({ coll: r.coll, id: r.id, data: r.deleted ? {} : r.data, updated: r.updated, deleted: !!r.deleted })));
        for (const r of batch) await putRecord({ ...r, dirty: false });
      }
      let cursor = Number(await getMeta('cursor')) || 0, changed = new Set();
      for (let page = 0; page < 20; page++) {
        const got = await pull(cursor);
        for (const r of got.records) {
          if (!mem[r.coll]) continue;
          const mine = mem[r.coll].get(r.id);
          if (mine && (mine.updatedAt || 0) > (r.data?.updatedAt || 0) && !r.deleted) continue;
          if (r.deleted) mem[r.coll].delete(r.id); else mem[r.coll].set(r.id, r.data);
          await putRecord({ coll: r.coll, id: r.id, data: r.data, updated: r.updated, deleted: r.deleted, dirty: false });
          changed.add(r.coll);
        }
        cursor = got.cursor;
        if (got.records.length < 1000) break;
      }
      await setMeta('cursor', cursor);
      for (const c of changed) emit(c, null);
      emit('synced', Date.now());
    } finally {
      running = null;
      if (again) { again = false; syncSoon(200); }
    }
  })();
  return running;
}

/** 换账号（登录别人 / 退出）：本机缓存清空，从新账号的私有空间重新拉。 */
export async function switchAccount(/** @type {any} */ account, /** @type {{ keepLocal?: boolean }} */ o = {}) {
  studio.account = account;
  if (!o.keepLocal) {
    await clearRecords();
    for (const m of Object.values(mem)) m.clear();
    for (const k of [...urls.keys()]) forgetUrl(k);
    uploads.clear();
  }
  await setMeta('account', account?.id || 'local');
  await setMeta('cursor', 0);
  await sync().catch(() => {});
  for (const c of Object.keys(mem)) emit(c, null);
  emit('account', account);
}
