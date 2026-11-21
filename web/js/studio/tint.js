/**
 * 部位精修的即时预览：发色、唇色、腮红这些「颜色类」的改动，在手机上按遮罩直接染上去——点一下就看到，不用等生成。
 * 形状类的改动（刘海、发型、眉形…）只能交给生图模型，画面上用虚线描出要改的那一块，并标上选了什么。
 */
import { partById, optionOf } from '../parts.js';

const make = (/** @type {number} */ w, /** @type {number} */ h) => { const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; };

const ctx2d = (/** @type {HTMLCanvasElement} */ c) => /** @type {CanvasRenderingContext2D} */ (c.getContext('2d', { willReadFrequently: true }));

/**
 * 头发染色：逐个像素保留发丝原来的明暗起伏（纹理），把颜色和整体亮度换成目标色——黑发染樱花粉也是粉的，不会发紫发黑。
 * how：0 全染 · 1 挑染（一缕一缕）· 2 渐变（发根自然，越往下越浓）· 3 内层（下面那一层透出来）
 */
function dyeHair(/** @type {CanvasRenderingContext2D} */ x, /** @type {HTMLCanvasElement} */ mask, /** @type {string} */ hex, /** @type {number} */ how) {
  const W = x.canvas.width, H = x.canvas.height;
  const work = make(W, H), wx = ctx2d(work);
  wx.drawImage(x.canvas, 0, 0);
  const px = wx.getImageData(0, 0, W, H), d = px.data;
  const mk = make(W, H), mx = ctx2d(mk);
  mx.drawImage(mask, 0, 0, W, H);
  const md = mx.getImageData(0, 0, W, H).data;
  const weight = (/** @type {number} */ i) => md[i + 3] * Math.max(md[i], md[i + 1], md[i + 2]) / 65025;
  // 这片头发平均多亮、从哪儿到哪儿（渐变和内层要用）
  let sum = 0, wsum = 0, top = H, bottom = 0, left = W, right = 0;
  for (let i = 0, p = 0; p < W * H; p++, i += 4) {
    const a = weight(i);
    if (a < .02) continue;
    const y = (p / W) | 0, xx = p % W;
    sum += a * (.299 * d[i] + .587 * d[i + 1] + .114 * d[i + 2]); wsum += a;
    if (y < top) top = y;
    if (y > bottom) bottom = y;
    if (xx < left) left = xx;
    if (xx > right) right = xx;
  }
  if (!wsum) return;
  const mean = Math.max(10, sum / wsum), span = Math.max(1, bottom - top), wide = Math.max(1, right - left);
  const n = parseInt(hex.slice(1), 16), tr = (n >> 16) & 255, tg = (n >> 8) & 255, tb = n & 255;
  for (let i = 0, p = 0; p < W * H; p++, i += 4) {
    let a = weight(i);
    if (a < .02) continue;
    const X = p % W, Y = (p / W) | 0, t = (Y - top) / span;
    if (how === 1) {   // 挑染：头发宽度里六七缕，微微斜、宽窄不一
      const u = (X - left) / wide;
      const s = Math.sin(u * 44 + 2.6 * Math.sin(u * 11.7) + t * 2.4) + .45 * Math.sin(u * 97 + t * 6.1);
      a *= s > 1.05 ? .88 : s > .7 ? (s - .7) / .35 * .88 : .04;
    }
    else if (how === 2) a *= Math.min(1, Math.max(.06, (t - .28) / .42));
    else if (how === 3) a *= t > .5 ? .92 : .14;
    // 暗处按比例压暗，亮处往白里提（不是乘上去：乘过头会先把红色顶满，颜色就偏紫了）
    const k = (.299 * d[i] + .587 * d[i + 1] + .114 * d[i + 2]) / mean;
    const dark = Math.max(.32, Math.min(1, k)), lift = Math.min(.42, Math.max(0, k - 1) * .3);
    a *= .9;
    d[i] += (tr * dark + (255 - tr) * lift - d[i]) * a;
    d[i + 1] += (tg * dark + (255 - tg) * lift - d[i + 1]) * a;
    d[i + 2] += (tb * dark + (255 - tb) * lift - d[i + 2]) * a;
  }
  x.putImageData(px, 0, 0);
}

/**
 * 在 out 上画出「染过的」样子：先画原图，再按每一处颜色类的选择叠上去。没有颜色类的选择时返回 false（不用显示预览层）。
 * @param {HTMLCanvasElement} out 预览层（和显示的图同尺寸）
 * @param {CanvasImageSource} image 原图（当前这一版）
 * @param {import('../parts.js').Pick[]} picks
 * @param {Map<string, HTMLCanvasElement | null>} masks 部位 → 遮罩（白 = 这一块）
 */
export function paintTint(out, image, picks, masks) {
  const swatches = picks.filter(k => partById(k.part)?.kind === 'swatch' && optionOf(k)?.hex && masks.get(k.part));
  const x = ctx2d(out);
  const W = out.width, H = out.height;
  x.clearRect(0, 0, W, H);
  if (!swatches.length) return false;
  x.drawImage(image, 0, 0, W, H);
  for (const k of swatches) {
    const hex = /** @type {string} */ (optionOf(k)?.hex), m = /** @type {HTMLCanvasElement} */ (masks.get(k.part));
    if (k.part === 'colour') { dyeHair(x, m, hex, k.tune ?? 0); continue; }
    const layer = make(W, H), lx = /** @type {CanvasRenderingContext2D} */ (layer.getContext('2d'));
    lx.drawImage(m, 0, 0, W, H);
    lx.globalCompositeOperation = 'source-in';
    lx.fillStyle = hex; lx.fillRect(0, 0, W, H);
    x.save();
    if (k.part === 'lips') {
      const finish = k.tune ?? 1;
      x.globalCompositeOperation = 'multiply'; x.globalAlpha = .5; x.drawImage(layer, 0, 0);
      x.globalCompositeOperation = 'color'; x.globalAlpha = .55; x.drawImage(layer, 0, 0);
      if (finish === 1) { x.globalCompositeOperation = 'screen'; x.globalAlpha = .12; x.drawImage(layer, 0, 0); }   // 水光
    } else {
      const amount = [.22, .34, .48][k.tune ?? 1] || .34;
      x.globalCompositeOperation = 'multiply'; x.globalAlpha = amount; x.drawImage(layer, 0, 0);
      x.globalCompositeOperation = 'color'; x.globalAlpha = amount * .7; x.drawImage(layer, 0, 0);
    }
    x.restore();
  }
  return true;
}
