/**
 * 人脸关键点追踪（MediaPipe Face Landmarker，478 个点，全部在手机本地跑，画面不出设备）。
 * 优先用 GPU，不行就退到 CPU；模型和运行时都在 vendor/ 里，离线也能用。追踪结果做了平滑，贴纸不抖。
 */
import { asset, hushVision } from '../core/dom.js';

const VENDOR = () => new URL(asset('vendor/mediapipe/'), location.href).href;
let loading = /** @type {Promise<any> | null} */ (null);

/** 静音 MediaPipe 自己的日志。 */
const quiet = hushVision;

export function loadTracker(/** @type {'VIDEO' | 'IMAGE'} */ mode = 'VIDEO') {
  loading ||= (async () => {
    quiet();
    const base = VENDOR();
    const vision = await import(/* @vite-ignore */ base + 'vision_bundle.mjs');
    const files = await vision.FilesetResolver.forVisionTasks(base + 'wasm');
    const make = (/** @type {string} */ delegate) => vision.FaceLandmarker.createFromOptions(files, {
      baseOptions: { modelAssetPath: base + 'face_landmarker.task', delegate }, runningMode: mode, numFaces: 1,
      minFaceDetectionConfidence: .45, minTrackingConfidence: .45 });
    try { return await make('GPU'); } catch { return await make('CPU'); }
  })();
  loading.catch(() => { loading = null; });
  return loading;
}

/** @typedef {{ x: number, y: number }} Pt */
/**
 * 一张脸的关键信息（源图归一化坐标，y 向下）。
 * @typedef {{ pts: Pt[], center: Pt, eyeL: Pt, eyeR: Pt, nose: Pt, top: Pt, chin: Pt, cheekL: Pt, cheekR: Pt, width: number, height: number, roll: number, seen: number }} Face
 */

/** 从 478 个点里取出贴纸和变形要用的那几个。 @param {Pt[]} lm @param {number} aspect 源图宽/高 */
export function summarise(lm, aspect) {
  const p = (/** @type {number} */ i) => lm[i];
  const eyeL = lm[468] || mid(p(33), p(133)), eyeR = lm[473] || mid(p(263), p(362));
  const top = p(10), chin = p(152), cheekL = p(234), cheekR = p(454), nose = p(1);
  const dx = (eyeR.x - eyeL.x) * aspect, dy = eyeR.y - eyeL.y;
  return {
    pts: lm, eyeL, eyeR, nose, top, chin, cheekL, cheekR,
    center: { x: (top.x + chin.x) / 2, y: (top.y + chin.y) / 2 },
    width: Math.hypot((cheekR.x - cheekL.x) * aspect, cheekR.y - cheekL.y),
    height: Math.hypot((chin.x - top.x) * aspect, chin.y - top.y),
    roll: Math.atan2(dy, dx), seen: performance.now(),
  };
}
const mid = (/** @type {Pt} */ a, /** @type {Pt} */ b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

/** 平滑：新的一帧和上一帧按比例混合，越快的移动跟得越紧。 @param {Face | null} prev @param {Face} next */
export function smoothFace(prev, next) {
  if (!prev || next.seen - prev.seen > 400) return next;
  const move = Math.hypot(next.center.x - prev.center.x, next.center.y - prev.center.y) / Math.max(.05, next.width);
  const k = Math.min(1, .35 + move * 2.5);
  const lerp = (/** @type {Pt} */ a, /** @type {Pt} */ b) => ({ x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k });
  return { ...next, center: lerp(prev.center, next.center), eyeL: lerp(prev.eyeL, next.eyeL), eyeR: lerp(prev.eyeR, next.eyeR), nose: lerp(prev.nose, next.nose),
    top: lerp(prev.top, next.top), chin: lerp(prev.chin, next.chin), cheekL: lerp(prev.cheekL, next.cheekL), cheekR: lerp(prev.cheekR, next.cheekR),
    width: prev.width + (next.width - prev.width) * k, height: prev.height + (next.height - prev.height) * k, roll: prev.roll + (next.roll - prev.roll) * k };
}

/** 静态照片里找脸（上传精修用来给构图建议）。 @param {CanvasImageSource & { width: number, height: number }} img */
export async function findFace(img) {
  const { loadImageTracker } = { loadImageTracker: imageTracker };
  const t = await loadImageTracker();
  const res = t.detect(img);
  const lm = res?.faceLandmarks?.[0];
  return lm?.length ? summarise(lm, img.width / img.height) : null;
}
let imageLoading = /** @type {Promise<any> | null} */ (null);
function imageTracker() {
  imageLoading ||= (async () => {
    quiet();
    const base = VENDOR();
    const vision = await import(/* @vite-ignore */ base + 'vision_bundle.mjs');
    const files = await vision.FilesetResolver.forVisionTasks(base + 'wasm');
    return vision.FaceLandmarker.createFromOptions(files, { baseOptions: { modelAssetPath: base + 'face_landmarker.task', delegate: 'CPU' }, runningMode: 'IMAGE', numFaces: 1 });
  })();
  imageLoading.catch(() => { imageLoading = null; });
  return imageLoading;
}
