/**
 * 图片处理：上传前在手机上先压缩（最长边 1280、JPEG），几 MB 的原图变成两三百 KB，上传快好几倍；
 * 方向按照片自带的 EXIF 转正。
 */

/** @param {Blob} blob @returns {Promise<ImageBitmap | HTMLImageElement>} */
export async function decode(blob) {
  try { return await createImageBitmap(blob, { imageOrientation: 'from-image' }); }
  catch {
    const url = URL.createObjectURL(blob);
    try {
      const img = new Image(); img.decoding = 'async'; img.src = url;
      await img.decode();
      return img;
    } finally { setTimeout(() => URL.revokeObjectURL(url), 1000); }
  }
}

export const canvasOf = (/** @type {number} */ w, /** @type {number} */ h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
/** @param {HTMLCanvasElement} c @returns {Promise<Blob>} */
export const blobOf = (c, type = 'image/jpeg', q = .88) => new Promise((resolve, reject) => c.toBlob(b => (b ? resolve(b) : reject(new Error('图片导出失败'))), type, q));

/**
 * 压缩成适合生成的尺寸：最长边 1280，JPEG 0.88。
 * @param {Blob} file @returns {Promise<{ blob: Blob, w: number, h: number }>}
 */
export async function prepare(file, longest = 1280) {
  const bmp = await decode(file);
  const w0 = 'naturalWidth' in bmp ? bmp.naturalWidth : bmp.width, h0 = 'naturalHeight' in bmp ? bmp.naturalHeight : bmp.height;
  if (!w0 || !h0) throw new Error('这张图打不开，换一张试试');
  const s = Math.min(1, longest / Math.max(w0, h0));
  const c = canvasOf(Math.round(w0 * s), Math.round(h0 * s));
  const x = /** @type {CanvasRenderingContext2D} */ (c.getContext('2d'));
  x.imageSmoothingQuality = 'high';
  x.drawImage(bmp, 0, 0, c.width, c.height);
  if ('close' in bmp) bmp.close();
  return { blob: await blobOf(c, 'image/jpeg', .88), w: c.width, h: c.height };
}

/** 一张图的平均亮度与反差（0–1），用来提醒「光线太暗」。 @param {CanvasImageSource} src */
export function lightOf(src, w = 48, h = 64) {
  const c = canvasOf(w, h), x = /** @type {CanvasRenderingContext2D} */ (c.getContext('2d', { willReadFrequently: true }));
  x.drawImage(src, 0, 0, w, h);
  const d = x.getImageData(0, 0, w, h).data;
  let sum = 0, sq = 0;
  for (let i = 0; i < d.length; i += 4) { const l = (d[i] * .3 + d[i + 1] * .59 + d[i + 2] * .11) / 255; sum += l; sq += l * l; }
  const n = d.length / 4, mean = sum / n;
  return { mean, spread: Math.sqrt(Math.max(0, sq / n - mean * mean)) };
}

/** 下载一张图（桌面端或不支持分享时）。 */
export function download(/** @type {string} */ url, /** @type {string} */ name) {
  const a = document.createElement('a');
  a.href = url; a.download = name; a.rel = 'noopener';
  document.body.append(a); a.click(); a.remove();
}
