/** 一条小小的事件总线：数据变了、页面换了，谁关心谁来听。 */
const topics = new Map();
export function on(/** @type {string} */ topic, /** @type {(data?: any) => void} */ fn) {
  if (!topics.has(topic)) topics.set(topic, new Set());
  topics.get(topic).add(fn);
  return () => topics.get(topic)?.delete(fn);
}
export function emit(/** @type {string} */ topic, /** @type {any} */ data = undefined) {
  for (const fn of topics.get(topic) || []) { try { fn(data); } catch (e) { console.error(e); } }
}
