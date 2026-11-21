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
import { setCustom } from '../presets.js';

/** @typedef {{ t: number, kind: 'make' | 'style' | 'tweak' | 'say' | 'save' | 'share' | 'fav' | 'fail', text: string, preset?: string }} Step */
/**
 * 一件作品（一个版本）。op 说明它是怎么来的；base 是它在哪一版的基础上改的（空 = 原图）；parent 是创作轨迹里的上一步。
 * @typedef {{ id: string, preset: string, params: any, format: 'avatar' | 'portrait' | 'photo', source: string, mode: 'live' | 'studio',
 *   op?: string, base?: string, batch?: string, index?: number, say?: string, reply?: string, ideas?: string[], parts?: string[], refs?: string[], pace?: string, turn?: any,
 *   state: 'working' | 'done' | 'failed' | 'stopped', job?: string, asset?: string, w?: number, h?: number, ms?: number,
 *   kind: 'render' | 'simulated' | 'preview' | 'example', prompt?: string, error?: string, fav?: boolean, parent?: string, attempt?: number,
 *   createdAt: number, updatedAt: number, trail: Step[] }} Work
 */
/** @typedef {{ id: string, asset?: string, w?: number, h?: number, sample?: string, createdAt: number, updatedAt: number }} Source */

const mem = { works: new Map(), sources: new Map(), favs: new Map(), drafts: new Map(), prefs: new Map(), styles: new Map() };
const urls = new Map();
const uploads = new Map();

export async function boot() {
  const known = await getMeta('account');
  const now = studio.account?.id || 'local';
  // 换了账号（在别处退出又登录了别人）：本机缓存属于上一个人，清掉，从新账号的私有空间拉回来
  if (known && known !== now && studio.live) { await clearRecords(); await setMeta('cursor', 0); forgetLocalDrafts(); }
  await setMeta('account', now);
  for (const r of await allRecords()) if (!r.deleted && mem[r.coll]) mem[r.coll].set(r.id, r.data);
  recoverDrafts();
  setCustom([...mem.styles.values()]);
  if (studio.live) syncSoon(0);
  addEventListener('online', () => syncSoon(0));
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') syncSoon(300); else flush(); });
}

// ── 通用写入：本机立刻生效，标记待同步 ──
async function write(/** @type {keyof typeof mem} */ coll, /** @type {any} */ data, deleted = false) {
  const updated = Date.now();
  if (deleted) mem[coll].delete(data.id); else mem[coll].set(data.id, data);
  await putRecord({ coll, id: data.id, data, updated, deleted, dirty: true });
  if (coll === 'styles') setCustom([...mem.styles.values()]);
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

/** 作品成片的图片本身（本机有就用本机的，否则从私有空间取回）。 @param {Work} w @returns {Promise<Blob | null>} */
export async function workBlob(w) {
  const local = await getBlob('w:' + w.id);
  if (local) return local;
  if (!w.asset) return null;
  try { const b = await fetch(w.asset).then(r => (r.ok ? r.blob() : null)); if (b) await putBlob('w:' + w.id, b); return b; } catch { return null; }
}
/** 同一张照片的所有版本（创作链），从旧到新。 @param {string} sourceId */
export const chainOf = (sourceId) => works().filter(w => w.source === sourceId).sort((a, b) => a.createdAt - b.createdAt);

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

// ── 自创风格 ──
export const styles = () => [...mem.styles.values()];
export async function saveStyle(/** @type {any} */ p) { await write('styles', { ...p, custom: true, updatedAt: Date.now() }); }
export async function deleteStyle(/** @type {string} */ id) { await write('styles', { id }, true); }

// ── 草稿与偏好 ──
export const draft = (/** @type {string} */ id) => mem.drafts.get(id) || null;
const draftTimers = new Map();
const LS = 'hjx.draft.';
/**
 * 草稿随手存，关掉页面、刷新都不会丢：先同步记一份在 localStorage（立刻落地，刷新那一下也来得及），
 * 再 300ms 防抖写进 IndexedDB 并同步到你的私人空间。
 */
export function saveDraft(/** @type {string} */ id, /** @type {any} */ data) {
  const rec = { ...data, id, at: Date.now() };
  mem.drafts.set(id, rec);
  try { localStorage.setItem(LS + id, JSON.stringify(rec)); } catch { /* 隐私模式或存满了：还有 IndexedDB */ }
  clearTimeout(draftTimers.get(id)?.t);
  const save = () => { draftTimers.delete(id); return write('drafts', rec); };
  draftTimers.set(id, { t: setTimeout(save, 300), save });
}
/** localStorage 里比 IndexedDB 更新的草稿（上次刷新前最后那几下）补回来。 */
function recoverDrafts() {
  try {
    for (const k of Object.keys(localStorage)) {
      if (!k.startsWith(LS)) continue;
      const rec = JSON.parse(localStorage.getItem(k) || 'null'), have = rec?.id ? mem.drafts.get(rec.id) : null;
      if (rec?.id && (!have || (rec.at || 0) > (have.at || 0))) { mem.drafts.set(rec.id, rec); write('drafts', rec); }
    }
  } catch { /* 读不了就算了 */ }
}
function forgetLocalDrafts() { try { for (const k of Object.keys(localStorage)) if (k.startsWith(LS)) localStorage.removeItem(k); } catch { /* 无所谓 */ } }
function flushDrafts() { for (const d of [...draftTimers.values()]) { clearTimeout(d.t); d.save(); } }
addEventListener('pagehide', flushDrafts);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flushDrafts(); });
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
      if (changed.has('styles')) setCustom([...mem.styles.values()]);
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
    setCustom([]);
    forgetLocalDrafts();
    for (const k of [...urls.keys()]) forgetUrl(k);
    uploads.clear();
  }
  await setMeta('account', account?.id || 'local');
  await setMeta('cursor', 0);
  await sync().catch(() => {});
  for (const c of Object.keys(mem)) emit(c, null);
  emit('account', account);
}

// ── 备份与恢复（旧版「你的空间」的备份文件，搬过来了）──
const blobToData = (/** @type {Blob} */ b) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = () => rej(r.error); r.readAsDataURL(b); });
/** 把整个私人空间打包成一个文件：作品、原图、收藏、草稿、偏好、自创风格，连同图片本身。 @returns {Promise<Blob>} */
export async function exportBackup() {
  const out = { app: 'hajixiu', version: 1, at: Date.now(), records: /** @type {any[]} */ ([]), blobs: /** @type {Record<string, string>} */ ({}) };
  for (const [coll, m] of Object.entries(mem)) for (const data of m.values()) out.records.push({ coll, data });
  for (const w of works()) { const b = await getBlob('w:' + w.id); if (b) out.blobs['w:' + w.id] = await blobToData(b); }
  for (const s of sources()) { const b = await getBlob('s:' + s.id); if (b) out.blobs['s:' + s.id] = await blobToData(b); }
  return new Blob([JSON.stringify(out)], { type: 'application/json' });
}
/** 读回一个备份：只补上没有的或更新的，不覆盖更新的本机记录。 @param {Blob} file @returns {Promise<number>} 补回了多少条 */
export async function importBackup(file) {
  const got = JSON.parse(await file.text());
  if (got?.app !== 'hajixiu' || !Array.isArray(got.records)) throw new Error('这不是哈基秀的备份文件');
  let n = 0;
  for (const [key, url] of Object.entries(got.blobs || {})) {
    if (await getBlob(key)) continue;
    const b = await fetch(String(url)).then(r => r.blob()).catch(() => null);
    if (b) await putBlob(key, b);
  }
  for (const r of got.records) {
    const coll = /** @type {keyof typeof mem} */ (r.coll);
    if (!mem[coll] || !r.data?.id) continue;
    const mine = mem[coll].get(r.data.id);
    if (mine && (mine.updatedAt || mine.at || 0) >= (r.data.updatedAt || r.data.at || 0)) continue;
    await write(coll, r.data); n++;
  }
  for (const c of Object.keys(mem)) emit(c, null);
  return n;
}
