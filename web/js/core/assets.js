/**
 * 全站图片资产的地址：每个风格的样张（大图/卡片/头像缩略）、示例人物原图、风格背景氛围图、贴纸。
 * 清单由 tools/process_assets.py 生成；服务器会把它内联进页面，静态版则去取 img/manifest.json。
 */
import { asset } from './dom.js';
import { presetById } from '../presets.js';

/** @type {{ people: string[], styles: Record<string, string[]>, bg: string[], stickers: Record<string, { w: number, h: number }> }} */
let manifest = { people: [], styles: {}, bg: [], stickers: {} };

export async function loadManifest() {
  try {
    const inline = document.getElementById('asset-manifest');
    manifest = inline ? JSON.parse(inline.textContent || '{}') : await fetch(asset('img/manifest.json')).then(r => r.json());
  } catch { /* 没有清单也能用：图会按约定路径去找 */ }
  manifest.people ||= []; manifest.styles ||= {}; manifest.bg ||= []; manifest.stickers ||= {};
}

/** 某个风格下某个人的样张。size：'' 大图，'m' 卡片，'t' 头像缩略。 */
export const styleArt = (/** @type {string} */ preset, /** @type {string} */ who, size = '') => asset(`img/styles/${preset}/${who}${size ? '-' + size : ''}.webp`);
export const personArt = (/** @type {string} */ who, size = '') => asset(`img/people/${who}${size ? '-' + size : ''}.webp`);
export const bgArt = (/** @type {string} */ id) => (manifest.bg.includes(id) ? asset(`img/bg/${id}.webp`) : '');
export const sticker = (/** @type {string} */ name) => (manifest.stickers[name] ? asset(`img/stickers/${name}.webp`) : '');
export const stickerSize = (/** @type {string} */ name) => manifest.stickers[name] || { w: 1, h: 1 };
export const hasArt = (/** @type {string} */ preset, /** @type {string} */ who) => (manifest.styles[preset] || []).includes(who);

/** 风格的封面：主推人物的样张（没有就用 mei 的）。 */
export function cover(/** @type {string} */ preset, size = 'm') {
  const p = presetById(preset);
  const who = p && hasArt(preset, p.hero) ? p.hero : 'mei';
  return { art: styleArt(preset, who, size), before: personArt(who, 'm'), who };
}
/** 首屏引导与轮播图标统一用同一张脸（mei）贯穿所有风格，「同一个人，三十多个世界」一眼就懂。 */
export const icon = (/** @type {string} */ preset) => styleArt(preset, hasArt(preset, 'mei') ? 'mei' : (presetById(preset)?.hero || 'mei'), 't');
export const samples = () => manifest.people.length ? manifest.people : ['mei', 'aiman', 'priya', 'jun', 'nur', 'kai'];
/** 这个风格有哪些人的样张。 */
export const examplesOf = (/** @type {string} */ preset) => manifest.styles[preset] || [];
