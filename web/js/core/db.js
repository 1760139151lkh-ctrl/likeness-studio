/**
 * 本地存储（IndexedDB）：图片原样存成 Blob，记录存成 JSON。刷新、切页、关掉再开都还在。
 *
 *   blobs    id → Blob（原图、成片、过程预览）
 *   records  "coll:id" → { coll, id, data, updated, deleted, dirty }（作品、原图记录、收藏、草稿、偏好）
 *   meta     key → value（同步游标、当前账号）
 */
const NAME = 'hajixiu', VERSION = 1;
let opening = /** @type {Promise<IDBDatabase> | null} */ (null);
/** 隐私模式等打不开 IndexedDB 时，退回到内存，保证功能可用（并提示用户）。 */
const memory = { blobs: new Map(), records: new Map(), meta: new Map() };
export let durable = true;

function open() {
  opening ||= new Promise((resolve, reject) => {
    let req;
    try { req = indexedDB.open(NAME, VERSION); } catch (e) { reject(e); return; }
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('blobs')) db.createObjectStore('blobs');
      if (!db.objectStoreNames.contains('records')) db.createObjectStore('records');
      if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta');
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('blocked'));
  });
  opening.catch(() => { durable = false; });
  return opening;
}

/** @template T @param {'blobs' | 'records' | 'meta'} store @param {IDBTransactionMode} mode @param {(s: IDBObjectStore) => IDBRequest<T> | void} fn @returns {Promise<T>} */
async function tx(store, mode, fn) {
  let db;
  try { db = await open(); } catch { return /** @type {any} */ (undefined); }
  return new Promise((resolve, reject) => {
    const t = db.transaction(store, mode), req = fn(t.objectStore(store));
    t.oncomplete = () => resolve(req ? req.result : undefined);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}

const fallback = (/** @type {'blobs' | 'records' | 'meta'} */ s) => memory[s];

export async function getBlob(/** @type {string} */ id) {
  if (!id) return null;
  if (!durable) return fallback('blobs').get(id) || null;
  return (await tx('blobs', 'readonly', s => s.get(id))) || fallback('blobs').get(id) || null;
}
export async function putBlob(/** @type {string} */ id, /** @type {Blob} */ blob) {
  fallback('blobs').set(id, blob);
  if (durable) await tx('blobs', 'readwrite', s => { s.put(blob, id); }).catch(() => {});
  return id;
}
export async function dropBlob(/** @type {string} */ id) {
  fallback('blobs').delete(id);
  if (durable) await tx('blobs', 'readwrite', s => { s.delete(id); }).catch(() => {});
}

/** @typedef {{ coll: string, id: string, data: any, updated: number, deleted?: boolean, dirty?: boolean }} Rec */
/** @returns {Promise<Rec[]>} */
export async function allRecords() {
  if (!durable) return [...fallback('records').values()];
  const rows = await tx('records', 'readonly', s => s.getAll());
  return /** @type {Rec[]} */ (rows || [...fallback('records').values()]);
}
export async function putRecord(/** @type {Rec} */ r) {
  fallback('records').set(r.coll + ':' + r.id, r);
  if (durable) await tx('records', 'readwrite', s => { s.put(r, r.coll + ':' + r.id); }).catch(() => {});
}
export async function clearRecords() {
  fallback('records').clear(); fallback('blobs').clear();
  if (durable) { await tx('records', 'readwrite', s => { s.clear(); }).catch(() => {}); await tx('blobs', 'readwrite', s => { s.clear(); }).catch(() => {}); }
}
export async function getMeta(/** @type {string} */ k) {
  if (!durable) return fallback('meta').get(k);
  const v = await tx('meta', 'readonly', s => s.get(k)).catch(() => undefined);
  return v === undefined ? fallback('meta').get(k) : v;
}
export async function setMeta(/** @type {string} */ k, /** @type {any} */ v) {
  fallback('meta').set(k, v);
  if (durable) await tx('meta', 'readwrite', s => { s.put(v, k); }).catch(() => {});
}

/** 让浏览器尽量别清掉这里的数据（有作品之后再申请）。 */
let asked = false;
export function keepSafe() { if (asked) return; asked = true; navigator.storage?.persist?.().catch(() => {}); }
export const persisted = async () => !!(await navigator.storage?.persisted?.().catch(() => false));
export async function ready() { try { await open(); } catch { durable = false; } return durable; }
