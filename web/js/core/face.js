/**
 * 一张图里的脸，在手机本地读出来（MediaPipe 478 个关键点 + 一个只认头发的小分割模型），画面不出设备。
 * 由此得到「部位精修」要用的每个部位：在哪儿（遮罩：白色 = 可以改）、手指点到的是哪个部位、在画面上怎么高亮。
 *
 * 移植自旧版 Lookbook 的 studio/face.js（刘海、眉毛、眼妆、唇妆、胡子、发色），新增腮红、耳饰、头饰与表情的区域。
 * 找不到脸（例如很夸张的卡通成片）时返回 null，界面会改用「对话」或「圈选」。
 */
import { asset, hushVision } from './dom.js';

const VENDOR = () => new URL(asset('vendor/mediapipe/'), location.href).href;

/** 脸的外轮廓（从额头顶开始绕一圈）。 */
export const OVAL = [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109];
const BROWS = [[70, 63, 105, 66, 107, 55, 65, 52, 53, 46], [300, 293, 334, 296, 336, 285, 295, 282, 283, 276]];
const EYES = [[33, 246, 161, 160, 159, 158, 157, 173, 133, 155, 154, 153, 145, 144, 163, 7], [263, 466, 388, 387, 386, 385, 384, 398, 362, 382, 381, 380, 374, 373, 390, 249]];
export const LIPS = [61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291, 375, 321, 405, 314, 17, 84, 181, 91, 146];

/** @typedef {{ x: number, y: number }} Pt */
/** @typedef {{ pts: Pt[], w: number, h: number, box: [number, number, number, number] }} Face 像素坐标的点，box 是脸轮廓的外框 */

let kit = /** @type {Promise<{ vision: any, files: any }> | null} */ (null);
function visionKit() {
  kit ||= import(/* @vite-ignore */ VENDOR() + 'vision_bundle.mjs').then(async vision => ({ vision, files: await vision.FilesetResolver.forVisionTasks(VENDOR() + 'wasm') }));
  kit.catch(() => { kit = null; });
  return kit;
}
/** 静音 MediaPipe 自己的日志。 */
const quiet = hushVision;
let landmarker = /** @type {Promise<any> | null} */ (null);
function stillLandmarker() {
  landmarker ||= (async () => {
    quiet();
    const { vision, files } = await visionKit();
    return vision.FaceLandmarker.createFromOptions(files, { baseOptions: { modelAssetPath: VENDOR() + 'face_landmarker.task', delegate: 'CPU' }, runningMode: 'IMAGE', numFaces: 1, minFaceDetectionConfidence: .35 });
  })();
  landmarker.catch(() => { landmarker = null; });
  return landmarker;
}
let segmenter = /** @type {Promise<any> | null} */ (null);
function hairModel() {
  segmenter ||= (async () => {
    quiet();
    const { vision, files } = await visionKit();
    return vision.ImageSegmenter.createFromOptions(files, { baseOptions: { modelAssetPath: VENDOR() + 'hair_segmenter.tflite', delegate: 'CPU' }, runningMode: 'IMAGE', outputCategoryMask: false, outputConfidenceMasks: true });
  })();
  segmenter.catch(() => { segmenter = null; });
  return segmenter;
}

export const make = (/** @type {number} */ w, /** @type {number} */ h) => { const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; };
const at = (/** @type {Face} */ f, /** @type {number[]} */ idx) => idx.map(i => f.pts[i]);

/** 一张图（的缩小版）：读脸用。最长边 768，够准也够快。 @param {CanvasImageSource & { width?: number, height?: number, naturalWidth?: number, naturalHeight?: number }} img */
export function canvasFrom(img, longest = 768) {
  const w0 = /** @type {any} */ (img).naturalWidth || img.width || 1, h0 = /** @type {any} */ (img).naturalHeight || img.height || 1;
  const k = Math.min(1, longest / Math.max(w0, h0));
  const c = make(w0 * k, h0 * k);
  /** @type {CanvasRenderingContext2D} */ (c.getContext('2d', { willReadFrequently: true })).drawImage(img, 0, 0, c.width, c.height);
  return c;
}

const faces = new WeakMap();
/** 图里的脸（像素坐标，按这张 canvas 的尺寸），找不到就是 null。 @param {HTMLCanvasElement} c @returns {Promise<Face | null>} */
export function faceOf(c) {
  if (!faces.has(c)) faces.set(c, (async () => {
    try {
      const lm = await stillLandmarker();
      const res = lm.detect(c);
      const raw = res?.faceLandmarks?.[0];
      if (!raw?.length) return null;
      const pts = raw.map((/** @type {any} */ p) => ({ x: p.x * c.width, y: p.y * c.height }));
      const xs = OVAL.map(i => pts[i].x), ys = OVAL.map(i => pts[i].y), x0 = Math.min(...xs), y0 = Math.min(...ys);
      return /** @type {Face} */ ({ pts, w: c.width, h: c.height, box: [x0, y0, Math.max(...xs) - x0, Math.max(...ys) - y0] });
    } catch { return null; }
  })());
  return faces.get(c);
}

const hairs = new WeakMap();
/** 图里的头发（白色 = 头发，分割模型自己的尺寸），没有就是 null。 @param {HTMLCanvasElement} c @returns {Promise<HTMLCanvasElement | null>} */
export function hairOf(c) {
  if (!hairs.has(c)) hairs.set(c, (async () => {
    try {
      const seg = await hairModel();
      return await new Promise(resolve => seg.segment(c, (/** @type {any} */ res) => {
        const masks = res?.confidenceMasks, m = masks?.[masks.length - 1];
        if (!m) { resolve(null); return; }
        resolve(hairMask(m.getAsFloat32Array(), m.width, m.height));
      }));
    } catch { return null; }
  })());
  return hairs.get(c);
}
/** @param {Float32Array} data @param {number} w @param {number} h */
function hairMask(data, w, h) {
  const out = make(w, h), x = /** @type {CanvasRenderingContext2D} */ (out.getContext('2d')), img = x.createImageData(w, h);
  let count = 0;
  for (let i = 0; i < data.length; i++) {
    const v = Math.max(0, Math.min(1, (data[i] - .28) / .3));
    img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = 255;
    img.data[i * 4 + 3] = v * 255;
    if (v > .5) count++;
  }
  if (count / data.length <= .004) return null;
  x.putImageData(img, 0, 0);
  const soft = make(w, h), sx = /** @type {CanvasRenderingContext2D} */ (soft.getContext('2d', { willReadFrequently: true }));
  sx.filter = 'blur(' + Math.max(1, w / 160).toFixed(1) + 'px)'; sx.drawImage(out, 0, 0); sx.filter = 'none';
  const clean = sx.getImageData(0, 0, w, h);
  for (let i = 3; i < clean.data.length; i += 4) clean.data[i] = Math.max(0, Math.min(255, (clean.data[i] - 70) * 1.6));
  sx.putImageData(clean, 0, 0);
  return soft;
}

/** 一个形状从中心向外扩 k 倍。 @param {Pt[]} s @param {number} k */
function grow(s, k, ky = k) {
  const cx = s.reduce((a, p) => a + p.x, 0) / s.length, cy = s.reduce((a, p) => a + p.y, 0) / s.length;
  return s.map(p => ({ x: cx + (p.x - cx) * (1 + k), y: cy + (p.y - cy) * (1 + ky) }));
}
/** 椭圆（多边形近似）。 */
const ellipse = (/** @type {Pt} */ c, /** @type {number} */ rx, /** @type {number} */ ry, n = 28) => Array.from({ length: n }, (_, i) => ({ x: c.x + Math.cos(i / n * Math.PI * 2) * rx, y: c.y + Math.sin(i / n * Math.PI * 2) * ry }));

/**
 * 脸上每个部位的形状（像素坐标）：这个部位可以改的地方。
 * @param {Face} f @returns {Record<string, Pt[][]>}
 */
export function shapesOf(f) {
  const [bx, by, bw, bh] = f.box, oval = at(f, OVAL), up = bh * .3;
  const brows = BROWS.map(b => at(f, b)), eyes = EYES.map(e => at(f, e));
  // 刘海落下的地方：头顶到眉毛下沿、两侧太阳穴到颧骨
  const top = at(f, [162, 21, 54, 103, 67, 109, 10, 338, 297, 332, 284, 251, 389]).map(p => ({ x: p.x + (p.x - (bx + bw / 2)) * .12, y: p.y - up }));
  const browLow = (/** @type {Pt[]} */ b) => b.slice(5).map(p => ({ x: p.x, y: p.y + bh * .025 }));
  const right = at(f, [389, 356, 454]).map(p => ({ x: p.x + bw * .06, y: p.y })), left = at(f, [234, 127, 162]).map(p => ({ x: p.x - bw * .06, y: p.y }));
  const bangs = [...top, ...right, { x: f.pts[263].x + bw * .04, y: f.pts[263].y }, ...browLow(brows[1]).reverse(), ...browLow(brows[0]), { x: f.pts[33].x - bw * .04, y: f.pts[33].y }, ...left];
  // 胡子：鼻子以下的脸和下巴下面的脖子
  const jaw = at(f, [234, 93, 132, 58, 172, 136, 150, 149, 176, 148, 152, 377, 400, 378, 379, 365, 397, 288, 361, 323, 454]);
  const beard = [...jaw.slice(0, 10), ...jaw.slice(10, 11).map(p => ({ x: p.x, y: p.y + bh * .22 })), ...jaw.slice(11), ...at(f, [322, 2, 92]).map(p => ({ x: p.x, y: p.y - bh * .01 }))];
  // 腮红：颧骨下方的两团
  const cheeks = [ellipse(f.pts[50], bw * .14, bh * .085), ellipse(f.pts[280], bw * .14, bh * .085)];
  // 耳饰：耳垂附近（脸轮廓外侧、耳朵高度往下）
  const earL = { x: f.pts[234].x - bw * .06, y: f.pts[234].y + bh * .16 }, earR = { x: f.pts[454].x + bw * .06, y: f.pts[454].y + bh * .16 };
  const ears = [ellipse(earL, bw * .13, bh * .2), ellipse(earR, bw * .13, bh * .2)];
  // 头饰：额头上方到头顶上方一大块
  const crown = at(f, [234, 127, 162, 21, 54, 103, 67, 109, 10, 338, 297, 332, 284, 251, 389, 356, 454]);
  const head = [...crown.map(p => ({ x: bx + bw / 2 + (p.x - (bx + bw / 2)) * 1.35, y: p.y - bh * .02 })).reverse(), ...crown.map(p => ({ x: bx + bw / 2 + (p.x - (bx + bw / 2)) * 1.45, y: p.y - bh * .62 }))];
  // 眼镜：两眼连眉一条带
  const glasses = [grow([...at(f, [70, 63, 105, 66, 107, 9, 336, 296, 334, 293, 300]), ...at(f, [446, 261, 448, 449, 450, 451, 452, 453, 464, 413, 168, 189, 244, 233, 232, 231, 230, 229, 228, 31, 226])], .12, .25)];
  return {
    bangs: [bangs], brows: brows.map(b => grow(b, .45, 1.1)), eyes: eyes.map(e => grow(e, .55, 1.4)), lips: [grow(at(f, LIPS), .18, .3)], beard: [beard],
    blush: cheeks, ears, head: [head], glasses, face: [grow(oval, .04, .04)],
  };
}

/**
 * 头发遮罩里去掉：眉毛、下半张脸（有胡子时连胡子一起）。头发分割模型会把它们也当成头发，但染发不该染到。
 * @param {CanvasRenderingContext2D} x @param {Face} f @param {boolean} beard @param {number} [k] 遮罩相对这张脸的图的倍数
 */
function clearNotHair(x, f, beard, k = 1) {
  const s = shapesOf(f), path = (/** @type {Pt[]} */ pts) => { x.beginPath(); pts.forEach((p, i) => (i ? x.lineTo(p.x * k, p.y * k) : x.moveTo(p.x * k, p.y * k))); x.closePath(); };
  x.save(); x.globalCompositeOperation = 'destination-out'; x.fillStyle = x.strokeStyle = '#fff'; x.lineJoin = 'round';
  for (const b of s.beard) { path(beard ? b : [...b.slice(2, 19), ...b.slice(21)]); x.fill(); if (beard) { x.lineWidth = f.box[2] * k * .36; x.stroke(); } }
  for (const b of BROWS.map(i => grow(at(f, i), .12, .55))) { path(b); x.fill(); }
  x.restore();
}
/** 有没有胡子：下巴比颧骨暗很多。 @param {HTMLCanvasElement} pic @param {Face} f */
function bearded(pic, f) {
  const x = /** @type {CanvasRenderingContext2D} */ (pic.getContext('2d', { willReadFrequently: true })), kx = pic.width / f.w, ky = pic.height / f.h, r = Math.max(1, Math.round(f.box[2] * kx * .025));
  const lum = (/** @type {Pt} */ p) => {
    const d = x.getImageData(Math.round(p.x * kx) - r, Math.round(p.y * ky) - r, 2 * r + 1, 2 * r + 1).data; let s = 0;
    for (let k = 0; k < d.length; k += 4) s += .2126 * d[k] + .7152 * d[k + 1] + .0722 * d[k + 2];
    return s / (d.length / 4);
  };
  const mid = (/** @type {number} */ a, /** @type {number} */ b) => ({ x: (f.pts[a].x + f.pts[b].x) / 2, y: (f.pts[a].y + f.pts[b].y) / 2 });
  try { return lum(mid(17, 152)) < (lum(f.pts[50]) + lum(f.pts[280])) / 2 * .6; } catch { return false; }
}

/** 部位的「形状」名：发色和发型都用头发（分割模型），其他用脸上的形状。 */
const SHAPE = /** @type {Record<string, string>} */ ({ bangs: 'bangs', brows: 'brows', eyes: 'eyes', lips: 'lips', beard: 'beard', blush: 'blush', colour: 'hair', cut: 'hair', earrings: 'ears', glasses: 'glasses', headwear: 'head', expression: 'face' });
export const regionOf = (/** @type {string} */ part) => SHAPE[part] || '';

/**
 * 一个部位的遮罩（白色 = 可以改，边缘柔化），尺寸 = 这张 canvas。头发用分割模型；没有就 null。
 * @param {HTMLCanvasElement} picture @param {Face} f @param {string} part
 * @returns {Promise<HTMLCanvasElement | null>}
 */
export async function maskOf(picture, f, part) {
  const w = picture.width, h = picture.height, c = make(w, h), x = /** @type {CanvasRenderingContext2D} */ (c.getContext('2d'));
  const kind = regionOf(part);
  if (kind === 'hair') {
    const hair = await hairOf(picture); if (!hair) return null;
    x.drawImage(hair, 0, 0, w, h);
    x.globalCompositeOperation = 'destination-out'; x.filter = 'blur(' + Math.max(1.5, w / 200).toFixed(1) + 'px)'; x.fillStyle = '#fff';
    clearNotHair(x, f, bearded(picture, f));
    x.globalCompositeOperation = 'source-over'; x.filter = 'none';
    if (part === 'cut') {   // 换发型：头发周围也要留出空间（变长、变蓬）
      const grown = make(w, h), gx = /** @type {CanvasRenderingContext2D} */ (grown.getContext('2d'));
      gx.filter = 'blur(' + Math.max(4, w / 30).toFixed(1) + 'px)'; for (let i = 0; i < 3; i++) gx.drawImage(c, 0, 0); gx.filter = 'none';
      const [bx, by, bw, bh] = f.box;   // 加上肩膀以上头部两侧，长发可以长到这里
      gx.fillStyle = '#fff'; gx.beginPath(); gx.ellipse(bx + bw / 2, by + bh * .55, bw * 1.15, bh * 1.25, 0, 0, Math.PI * 2); gx.fill();
      gx.globalCompositeOperation = 'destination-out'; gx.beginPath(); gx.ellipse(bx + bw / 2, by + bh * .62, bw * .42, bh * .44, 0, 0, Math.PI * 2); gx.fill();
      return grown;
    }
    return c;
  }
  const shapes = shapesOf(f)[kind]; if (!shapes) return null;
  x.filter = 'blur(' + Math.max(1.5, w / 260).toFixed(1) + 'px)'; x.fillStyle = '#fff';
  for (const s of shapes) { x.beginPath(); s.forEach((p, i) => (i ? x.lineTo(p.x, p.y) : x.moveTo(p.x, p.y))); x.closePath(); x.fill(); }
  return c;
}

/** @param {Pt[]} s @param {number} px @param {number} py */
function inside(s, px, py) {
  let on = false;
  for (let i = 0, j = s.length - 1; i < s.length; j = i++) { const a = s[i], b = s[j]; if ((a.y > py) !== (b.y > py) && px < (b.x - a.x) * (py - a.y) / (b.y - a.y) + a.x) on = !on; }
  return on;
}
/**
 * 手指点到的部位（这张 canvas 的像素坐标）：先找最小的（眉毛优先于额头）；脸上方是头发。
 * @param {Face} f @param {number} px @param {number} py @returns {string | null}
 */
export function partAt(f, px, py) {
  const s = shapesOf(f);
  const order = /** @type {[string, string][]} */ ([['eyes', 'eyes'], ['brows', 'brows'], ['lips', 'lips'], ['blush', 'blush'], ['bangs', 'bangs'], ['beard', 'beard'], ['ears', 'earrings'], ['face', 'expression']]);
  for (const [shape, part] of order) if (s[shape]?.some(sh => inside(sh, px, py))) return part;
  const [bx, by, bw, bh] = f.box;
  if (py < by + bh * .2 && px > bx - bw * .45 && px < bx + bw * 1.45) return 'colour';
  return null;
}

/**
 * 在画面上描一个部位的轮廓（高亮「只改这里」）。坐标从读脸用的 canvas 换算到显示尺寸。
 * @param {CanvasRenderingContext2D} x @param {Face} f @param {string} part @param {number} sx @param {number} sy @param {number} t
 */
export function outline(x, f, part, sx, sy, t) {
  const kind = regionOf(part);
  if (!kind || kind === 'hair') return false;
  const shapes = shapesOf(f)[kind] || [];
  x.save();
  x.lineWidth = 2; x.setLineDash([7, 6]); x.lineDashOffset = -t / 40;
  x.strokeStyle = 'rgba(255,255,255,.95)'; x.shadowColor = 'rgba(0,0,0,.5)'; x.shadowBlur = 4;
  x.fillStyle = 'rgba(255,255,255,.12)';
  for (const s of shapes) {
    x.beginPath(); s.forEach((p, i) => (i ? x.lineTo(p.x * sx, p.y * sy) : x.moveTo(p.x * sx, p.y * sy))); x.closePath();
    x.fill(); x.stroke();
  }
  x.restore();
  return true;
}
