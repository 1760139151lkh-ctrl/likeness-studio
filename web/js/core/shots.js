/**
 * 快门之后的「乐观」交接：先带着刚拍下的那一帧跳到结果页（零等待），照片压缩、存档、上传和发起生成在后台继续，
 * 作品建好后结果页无缝接上它的真实进度。
 */
/** @type {Map<string, { canvas: HTMLCanvasElement, work: Promise<string> }>} */
const shots = new Map();
export function holdShot(/** @type {string} */ token, /** @type {HTMLCanvasElement} */ canvas, /** @type {Promise<string>} */ work) {
  shots.set(token, { canvas, work });
  work.finally(() => setTimeout(() => shots.delete(token), 60000)).catch(() => {});
}
export const shotOf = (/** @type {string} */ token) => shots.get(token) || null;

/** 快门那一帧的即时预览，按作品记着（只在这次打开里有效：blob 地址刷新后就失效，所以不进 sessionStorage）。 */
const previews = new Map();
export const setPreview = (/** @type {string} */ id, /** @type {string} */ url) => previews.set(id, url);
export const previewOf = (/** @type {string} */ id) => previews.get(id) || '';
