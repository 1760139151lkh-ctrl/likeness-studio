/**
 * 圈选：手指在图上涂出要改的地方——可以换笔刷大小、擦掉、撤回一笔、清空。
 * 画面上是半透明的高亮；发出去的是一张遮罩（白 = 要改）。旧版 Desk 的「Pin / 涂抹」和 Mirror 的「Draw on it」合在这里。
 */
/** @typedef {{ pts: { x: number, y: number }[], size: number, erase: boolean }} Stroke 坐标是 0–1（相对图片） */

/** @param {HTMLCanvasElement} canvas 盖在图片上的那一层 @param {{ onChange?: () => void }} [o] */
export function createBrush(canvas, o = {}) {
  /** @type {Stroke[]} */ let strokes = [];
  let size = .06, erase = false, on = false;
  /** @type {Stroke | null} */ let live = null;
  const x = /** @type {CanvasRenderingContext2D} */ (canvas.getContext('2d'));

  function fit() {
    const r = canvas.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1);
    const w = Math.max(1, Math.round(r.width * dpr)), h = Math.max(1, Math.round(r.height * dpr));
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    draw();
  }
  /** 把所有笔画画到一个 2D 上下文里（显示用或遮罩用）。 */
  function render(/** @type {CanvasRenderingContext2D} */ c, /** @type {number} */ W, /** @type {number} */ H, /** @type {string} */ ink) {
    c.clearRect(0, 0, W, H);
    c.lineCap = 'round'; c.lineJoin = 'round';
    for (const s of [...strokes, ...(live ? [live] : [])]) {
      c.globalCompositeOperation = s.erase ? 'destination-out' : 'source-over';
      c.strokeStyle = ink; c.fillStyle = ink;
      c.lineWidth = s.size * Math.min(W, H);
      if (s.pts.length === 1) { c.beginPath(); c.arc(s.pts[0].x * W, s.pts[0].y * H, c.lineWidth / 2, 0, Math.PI * 2); c.fill(); continue; }
      c.beginPath();
      s.pts.forEach((p, i) => (i ? c.lineTo(p.x * W, p.y * H) : c.moveTo(p.x * W, p.y * H)));
      c.stroke();
    }
    c.globalCompositeOperation = 'source-over';
  }
  function draw() {
    const accent = getComputedStyle(canvas).getPropertyValue('--accent').trim() || '#ff3d8b';
    x.save();
    render(x, canvas.width, canvas.height, accent);
    // 半透明：看得见底下的图
    x.globalCompositeOperation = 'source-in'; x.fillStyle = accent; x.globalAlpha = .5; x.fillRect(0, 0, canvas.width, canvas.height);
    x.restore();
  }
  const at = (/** @type {PointerEvent} */ e) => { const r = canvas.getBoundingClientRect(); return { x: Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)), y: Math.max(0, Math.min(1, (e.clientY - r.top) / r.height)) }; };
  canvas.addEventListener('pointerdown', e => {
    if (!on) return;
    e.preventDefault(); canvas.setPointerCapture(e.pointerId);
    live = { pts: [at(e)], size, erase };
    draw();
  });
  canvas.addEventListener('pointermove', e => {
    if (!on || !live) return;
    const p = at(e), last = live.pts[live.pts.length - 1];
    if (Math.hypot(p.x - last.x, p.y - last.y) > .004) { live.pts.push(p); draw(); }
  });
  const end = () => { if (!live) return; strokes.push(live); live = null; draw(); o.onChange?.(); };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);

  return {
    fit,
    /** 开 / 关涂抹（关掉时画面上的涂抹仍然留着，直到清空）。 */
    enable(/** @type {boolean} */ v) { on = v; canvas.classList.toggle('is-painting', v); fit(); },
    setSize(/** @type {number} */ v) { size = v; },
    setErase(/** @type {boolean} */ v) { erase = v; },
    get erase() { return erase; },
    undo() { strokes.pop(); draw(); o.onChange?.(); },
    clear() { strokes = []; draw(); o.onChange?.(); },
    get empty() { return !strokes.some(s => !s.erase); },
    get count() { return strokes.length; },
    /**
     * 遮罩（白 = 要改，透明 = 不动），按图片本身的尺寸。map 是图片在画面上的摆放（object-fit: cover）。
     * @param {number} W @param {number} H @param {{ s: number, ox: number, oy: number, bw: number, bh: number }} map
     * @returns {Promise<Blob>}
     */
    mask(W, H, map) {
      const box = document.createElement('canvas'); box.width = Math.max(1, Math.round(map.bw)); box.height = Math.max(1, Math.round(map.bh));
      render(/** @type {CanvasRenderingContext2D} */ (box.getContext('2d')), box.width, box.height, '#fff');
      const c = document.createElement('canvas'); c.width = W; c.height = H;
      const mx = /** @type {CanvasRenderingContext2D} */ (c.getContext('2d'));
      mx.filter = 'blur(' + Math.max(2, Math.round(Math.min(W, H) / 160)) + 'px)';
      mx.drawImage(box, -map.ox / map.s, -map.oy / map.s, map.bw / map.s, map.bh / map.s);
      return new Promise((res, rej) => c.toBlob(b => (b ? res(b) : rej(new Error('遮罩导出失败'))), 'image/png'));
    },
  };
}

/** 图片按 object-fit: cover 放进一个框时的摆放：缩放 s、偏移 ox / oy（框的像素）。 */
export function coverMap(/** @type {number} */ bw, /** @type {number} */ bh, /** @type {number} */ iw, /** @type {number} */ ih) {
  const s = Math.max(bw / Math.max(1, iw), bh / Math.max(1, ih));
  return { s, ox: (bw - iw * s) / 2, oy: (bh - ih * s) / 2, bw, bh };
}
