/**
 * 镜头上的 AR 层：跟着脸走的贴纸（皇冠、猫耳、小龙头套、毛线帽、英雄头冠…）、每个风格自己的画框/HUD/粒子。
 * 贴纸是生成的透明图（img/stickers/），画框和粒子是矢量即时绘制，所以清晰、轻量。
 */
import { sticker } from '../core/assets.js';
import { presetById } from '../presets.js';

/** 头部贴纸怎么戴：宽度（相对脸宽）、底边离发际线抬高多少（相对脸长）。 */
const WEAR = {
  tiara: { w: .95, lift: .1 }, 'gothic-crown': { w: 1.05, lift: .08 }, 'nailong-hood': { w: 1.5, lift: .02 }, 'cat-ears': { w: 1.45, lift: .04 },
  'dog-ears': { w: 1.6, lift: -.06 }, beanie: { w: 1.38, lift: -.1 }, 'ultra-crest': { w: .62, lift: .02 },
  'take-copter': { w: .5, lift: .14 }, 'magic-tiara': { w: .95, lift: .08 }, 'ninja-band': { w: 1.12, lift: -.2 },
  'leaf-umbrella': { w: 1.55, lift: .02 }, 'cat-headset': { w: 1.7, lift: -.58 },
};
const images = new Map();
function img(/** @type {string} */ name) {
  if (!images.has(name)) { const i = new Image(); i.decoding = 'async'; const src = sticker(name); if (src) i.src = src; images.set(name, i); }
  const i = images.get(name);
  return i.complete && i.naturalWidth ? i : null;
}

/** @typedef {{ x: number, y: number, vx: number, vy: number, s: number, r: number, vr: number, life: number, kind: string, hue?: number }} Bit */

export function createOverlay(/** @type {HTMLCanvasElement} */ canvas) {
  const x = /** @type {CanvasRenderingContext2D} */ (canvas.getContext('2d'));
  /** @type {Bit[]} */ let bits = [];
  let preset = '', strength = .8, started = performance.now();
  const stamp = (() => { const d = new Date(); return `'${String(d.getFullYear()).slice(2)} ${String(d.getMonth() + 1).padStart(2, '0')} ${String(d.getDate()).padStart(2, '0')}`; })();

  /**
   * @param {any} face 画布像素坐标的脸：{ top, chin, eyeL, eyeR, nose, center, width, height, roll } 或 null
   * @param {number} t
   */
  function draw(face, t) {
    const W = canvas.width, H = canvas.height, p = presetById(preset);
    x.clearRect(0, 0, W, H);
    if (!p) return;
    const k = W / 400;   // 以 400px 宽为基准缩放线宽和字号
    x.save();
    x.globalAlpha = .35 + .65 * strength;
    const ov = p.live.overlay;
    behind(ov, face, t, W, H, k);
    particles(ov, t, W, H, k);
    if (face && p.live.sticker) wear(p.live.sticker, face);
    if (face && ov === 'paws') whiskers(face, k);
    if (face && ov === 'dora') dora(face, k);
    frame(ov, face, t, W, H, k);
    x.restore();
  }

  /** 头部贴纸。 */
  function wear(/** @type {string} */ name, /** @type {any} */ f) {
    const im = img(name), how = WEAR[name] || { w: 1.2, lift: 0 };
    if (!im) return;
    const w = f.width * how.w, h = w * im.naturalHeight / im.naturalWidth;
    const up = { x: Math.sin(f.roll), y: -Math.cos(f.roll) };
    const ax = f.top.x + up.x * f.height * how.lift, ay = f.top.y + up.y * f.height * how.lift;
    x.save();
    x.translate(ax, ay); x.rotate(f.roll);
    if (name === 'take-copter') {   // 竹蜻蜓：叶片左右翻转，像在转
      const spin = .25 + .75 * Math.abs(Math.cos(performance.now() / 70));
      x.drawImage(im, 0, 0, im.naturalWidth, im.naturalHeight * .45, -w / 2 * spin, -h, w * spin, h * .45);
      x.drawImage(im, 0, im.naturalHeight * .45, im.naturalWidth, im.naturalHeight * .55, -w / 2, -h * .55, w, h * .55);
    } else x.drawImage(im, -w / 2, -h, w, h);
    x.restore();
  }
  /** 蓝胖子：红鼻子 + 六根胡须。 */
  function dora(/** @type {any} */ f, /** @type {number} */ k) {
    x.save();
    x.translate(f.nose.x, f.nose.y); x.rotate(f.roll);
    const r = f.width * .075;
    const g = x.createRadialGradient(-r * .3, -r * .3, r * .1, 0, 0, r); g.addColorStop(0, '#ff8a80'); g.addColorStop(1, '#d32f2f');
    x.fillStyle = g; x.strokeStyle = '#3b1a1a'; x.lineWidth = 1.6 * k; x.beginPath(); x.arc(0, -f.height * .01, r, 0, 7); x.fill(); x.stroke();
    x.fillStyle = 'rgba(255,255,255,.85)'; x.beginPath(); x.arc(-r * .35, -f.height * .01 - r * .35, r * .22, 0, 7); x.fill();
    x.strokeStyle = 'rgba(30,20,20,.75)'; x.lineWidth = 2 * k; x.lineCap = 'round';
    for (const side of [-1, 1]) for (let i = -1; i <= 1; i++) {
      x.beginPath(); x.moveTo(side * f.width * .16, f.height * .08 + i * f.height * .04); x.lineTo(side * f.width * .44, f.height * .06 + i * f.height * .07); x.stroke();
    }
    x.restore();
  }
  function whiskers(/** @type {any} */ f, /** @type {number} */ k) {
    x.save();
    x.translate(f.nose.x, f.nose.y); x.rotate(f.roll);
    x.fillStyle = '#ff8fab'; x.beginPath(); x.ellipse(0, -f.height * .01, f.width * .05, f.width * .035, 0, 0, Math.PI * 2); x.fill();
    x.strokeStyle = 'rgba(80,50,50,.55)'; x.lineWidth = 1.6 * k; x.lineCap = 'round';
    for (const side of [-1, 1]) for (let i = -1; i <= 1; i++) {
      x.beginPath(); x.moveTo(side * f.width * .12, f.height * .05 + i * f.height * .035);
      x.quadraticCurveTo(side * f.width * .3, f.height * .04 + i * f.height * .05, side * f.width * .42, f.height * .02 + i * f.height * .08); x.stroke();
    }
    x.restore();
  }

  /** 画在脸后面一层的效果（漫画放射线、爆炸背光）。 */
  function behind(/** @type {string} */ ov, /** @type {any} */ f, /** @type {number} */ t, /** @type {number} */ W, /** @type {number} */ H, /** @type {number} */ k) {
    if (ov === 'aura') { aura(f, t, W, H, k); return; }
    if (ov !== 'speed' && ov !== 'burst') return;
    const cx = f ? f.center.x : W / 2, cy = f ? f.center.y : H * .42, r0 = f ? f.height * .78 : H * .26;
    x.save();
    const n = ov === 'speed' ? 64 : 22, spin = ov === 'burst' ? t / 4000 : 0;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + spin + (ov === 'speed' ? Math.sin(i * 7.3) * .04 : 0);
      if (ov === 'speed') {
        const len = H * (.35 + .4 * ((Math.sin(i * 12.9 + t / 90) + 1) / 2));
        x.strokeStyle = 'rgba(0,0,0,.55)'; x.lineWidth = (1 + (i % 3)) * k;
        x.beginPath(); x.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0); x.lineTo(cx + Math.cos(a) * (r0 + len), cy + Math.sin(a) * (r0 + len)); x.stroke();
      } else if (i % 2 === 0) {
        x.fillStyle = 'rgba(255,90,54,.28)';
        x.beginPath(); x.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
        x.lineTo(cx + Math.cos(a - .12) * H, cy + Math.sin(a - .12) * H); x.lineTo(cx + Math.cos(a + .12) * H, cy + Math.sin(a + .12) * H); x.closePath(); x.fill();
      }
    }
    x.restore();
  }

  /** 热血少年：头后燃起的斗气 + 速度线。 */
  function aura(/** @type {any} */ f, /** @type {number} */ t, /** @type {number} */ W, /** @type {number} */ H, /** @type {number} */ k) {
    const cx = f ? f.center.x : W / 2, cy = f ? f.center.y : H * .42, r = f ? f.height * .75 : H * .25;
    x.save();
    for (let i = 0; i < 44; i++) {
      const a = (i / 44) * Math.PI * 2, wob = Math.sin(t / 120 + i * 1.7) * .5 + .5;
      const len = r * (.5 + .9 * wob);
      const g = x.createLinearGradient(cx + Math.cos(a) * r, cy + Math.sin(a) * r, cx + Math.cos(a) * (r + len), cy + Math.sin(a) * (r + len));
      g.addColorStop(0, 'rgba(255,210,63,.75)'); g.addColorStop(.5, 'rgba(255,106,26,.45)'); g.addColorStop(1, 'rgba(255,60,20,0)');
      x.strokeStyle = g; x.lineWidth = (5 + 6 * wob) * k; x.lineCap = 'round';
      x.beginPath(); x.moveTo(cx + Math.cos(a) * r * .95, cy + Math.sin(a) * r * .95);
      x.quadraticCurveTo(cx + Math.cos(a + .12) * (r + len * .5), cy + Math.sin(a + .12) * (r + len * .5) - len * .25, cx + Math.cos(a) * (r + len), cy + Math.sin(a) * (r + len) - len * .4);
      x.stroke();
    }
    x.strokeStyle = 'rgba(255,255,255,.35)'; x.lineWidth = 1.5 * k;
    for (let i = 0; i < 26; i++) {
      const yy = ((i * 97 + t / 3) % H), xx = (i * 151) % W;
      if (Math.hypot(xx - cx, yy - cy) < r * 1.2) continue;
      x.beginPath(); x.moveTo(xx, yy); x.lineTo(xx, yy + 60 * k); x.stroke();
    }
    x.restore();
  }

  function spawn(/** @type {string} */ kind, /** @type {number} */ W, /** @type {number} */ H) {
    const up = ['hearts', 'bubbles', 'candy', 'paws', 'orbs', 'sparkle', 'stars', 'embers'].includes(kind);
    bits.push({ kind, x: Math.random() * W, y: up ? H + 20 : -20, vx: (Math.random() - .5) * .4, vy: up ? -(.4 + Math.random() * .9) : (kind === 'rain' ? 9 + Math.random() * 6 : .6 + Math.random()),
      s: kind === 'rain' ? 1 : .6 + Math.random() * .8, r: Math.random() * 6, vr: (Math.random() - .5) * .02, life: 1, hue: Math.random() });
  }
  function particles(/** @type {string} */ ov, /** @type {number} */ t, /** @type {number} */ W, /** @type {number} */ H, /** @type {number} */ k) {
    const kind = { hearts: 'hearts', bubbles: 'bubbles', candy: 'candy', paws: 'paws', orbs: 'orbs', sparkle: 'sparkle', rain: 'rain', gothic: 'petals', energy: 'sparkle', magic: 'stars', breeze: 'leaves', stream: 'hearts', dora: 'bubbles', aura: 'embers' }[ov];
    if (!kind) { bits = []; return; }
    const want = kind === 'rain' ? 70 : kind === 'orbs' ? 10 : 14;
    bits = bits.filter(b => b.kind === kind);
    if (bits.length < want && Math.random() < (kind === 'rain' ? .9 : .12)) spawn(kind, W, H);
    for (const b of bits) {
      b.x += b.vx * k; b.y += b.vy * k; b.r += b.vr;
      if (b.y < -60 || b.y > H + 60) b.life = 0;
      x.save(); x.translate(b.x, b.y); x.rotate(kind === 'rain' ? .18 : b.r);
      const s = b.s * 22 * k;
      if (kind === 'hearts') { const im = img('heart'); if (im) { x.globalAlpha *= .85; x.drawImage(im, -s / 2, -s / 2, s, s); } else heart(s, '#ff8fb3'); }
      else if (kind === 'bubbles') { x.strokeStyle = 'rgba(255,255,255,.75)'; x.lineWidth = 1.5 * k; x.fillStyle = 'rgba(255,214,90,.18)'; x.beginPath(); x.arc(0, 0, s * .6, 0, 7); x.fill(); x.stroke(); x.fillStyle = 'rgba(255,255,255,.8)'; x.beginPath(); x.arc(-s * .2, -s * .2, s * .12, 0, 7); x.fill(); }
      else if (kind === 'candy' || kind === 'paws' || kind === 'sparkle') { const im = img(kind === 'candy' ? 'candy' : kind === 'paws' ? 'paw' : 'sparkle'); if (im) x.drawImage(im, -s / 2, -s / 2, s, s); }
      else if (kind === 'orbs') { const g = x.createRadialGradient(0, 0, 0, 0, 0, s * 1.6); g.addColorStop(0, 'rgba(255,214,140,.55)'); g.addColorStop(1, 'rgba(255,214,140,0)'); x.fillStyle = g; x.beginPath(); x.arc(0, 0, s * 1.6, 0, 7); x.fill(); }
      else if (kind === 'rain') { x.strokeStyle = (b.hue || 0) > .5 ? 'rgba(34,230,255,.45)' : 'rgba(255,43,214,.4)'; x.lineWidth = 1.2 * k; x.beginPath(); x.moveTo(0, 0); x.lineTo(0, 18 * k); x.stroke(); }
      else if (kind === 'petals') { x.fillStyle = 'rgba(70,10,40,.7)'; x.beginPath(); x.ellipse(0, 0, s * .32, s * .18, 0, 0, 7); x.fill(); }
      else if (kind === 'stars') { star(s * .5, (b.hue || 0) > .5 ? '#fff6a8' : '#ffc2ef'); }
      else if (kind === 'leaves') { x.fillStyle = (b.hue || 0) > .6 ? 'rgba(120,180,90,.85)' : (b.hue || 0) > .3 ? 'rgba(230,200,120,.85)' : 'rgba(255,255,255,.8)'; if ((b.hue || 0) > .3) { x.beginPath(); x.ellipse(0, 0, s * .34, s * .14, 0, 0, 7); x.fill(); } else { x.beginPath(); x.arc(0, 0, s * .12, 0, 7); x.fill(); for (let i = 0; i < 6; i++) { x.rotate(1.047); x.fillRect(0, -.5 * k, s * .3, k); } } }
      else if (kind === 'embers') { x.fillStyle = (b.hue || 0) > .5 ? 'rgba(255,210,63,.9)' : 'rgba(255,106,26,.85)'; x.beginPath(); x.arc(0, 0, s * .1, 0, 7); x.fill(); }
      x.restore();
    }
    bits = bits.filter(b => b.life > 0);
  }
  function star(/** @type {number} */ r, /** @type {string} */ col) {
    x.fillStyle = col; x.shadowColor = col; x.shadowBlur = 8; x.beginPath();
    for (let i = 0; i < 10; i++) { const a = i * Math.PI / 5 - Math.PI / 2, d = i % 2 ? r * .45 : r; x.lineTo(Math.cos(a) * d, Math.sin(a) * d); }
    x.closePath(); x.fill(); x.shadowBlur = 0;
  }
  function heart(/** @type {number} */ s, /** @type {string} */ col) {
    x.fillStyle = col; x.beginPath(); x.moveTo(0, s * .3);
    x.bezierCurveTo(-s * .6, -s * .1, -s * .25, -s * .6, 0, -s * .25); x.bezierCurveTo(s * .25, -s * .6, s * .6, -s * .1, 0, s * .3); x.fill();
  }

  /** 每个风格自己的画框 / HUD。 */
  function frame(/** @type {string} */ ov, /** @type {any} */ f, /** @type {number} */ t, /** @type {number} */ W, /** @type {number} */ H, /** @type {number} */ k) {
    const m = 14 * k, top = 104 * k;   // 画框从顶部栏和分类胶囊下面开始，不压字
    x.save();
    if (ov === 'hearts') {   // 梦幻公主：玫瑰金拱形画框 + 拱顶蝴蝶结
      x.strokeStyle = 'rgba(201,162,90,.9)'; x.lineWidth = 3 * k; x.shadowColor = 'rgba(255,190,210,.8)'; x.shadowBlur = 10 * k;
      arch(m, top, W - m * 2, H - top - m);
      x.lineWidth = 1.2 * k; arch(m + 8 * k, top + 8 * k, W - m * 2 - 16 * k, H - top - m - 16 * k);
      const bow = img('bow'); if (bow) { const bw = 70 * k; x.shadowBlur = 0; x.drawImage(bow, W / 2 - bw / 2, top - 22 * k, bw, bw * bow.naturalHeight / bow.naturalWidth); }
    } else if (ov === 'gothic') {   // 暗黑哥特：银色尖拱
      x.strokeStyle = 'rgba(207,210,223,.75)'; x.lineWidth = 2.4 * k;
      x.beginPath(); x.moveTo(m, H - m); x.lineTo(m, H * .36); x.quadraticCurveTo(m, top + 10 * k, W / 2, top - 6 * k); x.quadraticCurveTo(W - m, top + 10 * k, W - m, H * .36); x.lineTo(W - m, H - m); x.stroke();
    } else if (ov === 'energy') {   // 光之巨人：脸周围的能量环 + 胸口能量核
      if (f) {
        const r = f.height * .78;
        x.strokeStyle = 'rgba(79,215,255,.85)'; x.lineWidth = 3 * k; x.shadowColor = '#4fd7ff'; x.shadowBlur = 16 * k;
        x.setLineDash([24 * k, 14 * k]); x.lineDashOffset = -t / 20;
        x.beginPath(); x.arc(f.center.x, f.center.y, r, 0, Math.PI * 2); x.stroke(); x.setLineDash([]);
        const cx = f.chin.x - Math.sin(f.roll) * f.height * .95, cy = f.chin.y + Math.cos(f.roll) * f.height * .95;
        const pulse = .6 + .4 * Math.sin(t / 260);
        const g = x.createRadialGradient(cx, cy, 0, cx, cy, 26 * k); g.addColorStop(0, `rgba(220,250,255,${pulse})`); g.addColorStop(.5, `rgba(79,215,255,${.8 * pulse})`); g.addColorStop(1, 'rgba(79,215,255,0)');
        x.fillStyle = g; x.beginPath(); x.arc(cx, cy, 26 * k, 0, 7); x.fill();
      }
      corners('rgba(255,59,71,.9)', 3 * k, 28 * k, m, top);
    } else if (ov === 'hud') {   // 机甲驾驶员：锁定框 + 旋转刻度 + 数据
      x.strokeStyle = 'rgba(52,225,255,.9)'; x.fillStyle = 'rgba(52,225,255,.9)'; x.lineWidth = 2 * k; x.shadowColor = '#34e1ff'; x.shadowBlur = 8 * k;
      if (f) {
        const r = f.height * .7, cx = f.center.x, cy = f.center.y;
        const b = r * .9, L = r * .28;
        for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { x.beginPath(); x.moveTo(cx + sx * b, cy + sy * (b - L)); x.lineTo(cx + sx * b, cy + sy * b); x.lineTo(cx + sx * (b - L), cy + sy * b); x.stroke(); }
        x.lineWidth = 1.2 * k;
        for (let i = 0; i < 3; i++) { const a = t / 900 + i * 2.1; x.beginPath(); x.arc(cx, cy, r * 1.12, a, a + .9); x.stroke(); }
        x.font = `${11 * k}px "Space Grotesk", monospace`; x.fillText('SYNC ' + (96 + Math.round(Math.sin(t / 700) * 3)) + '%', cx + b + 6 * k, cy - b + 10 * k); x.fillText('LOCK', cx + b + 6 * k, cy - b + 26 * k);
      }
      const sy = (t / 12) % H; x.globalAlpha *= .35; x.fillRect(0, sy, W, 2 * k);
    } else if (ov === 'box') {   // 盲盒手办：包装盒窗口
      x.strokeStyle = 'rgba(123,97,255,.95)'; x.lineWidth = 10 * k; rr(m, top + 34 * k, W - m * 2, H - top - 34 * k - m, 28 * k); x.stroke();
      x.fillStyle = 'rgba(123,97,255,.95)'; rr(W / 2 - 80 * k, top, 160 * k, 36 * k, 14 * k); x.fill();
      x.fillStyle = '#fff'; x.font = `700 ${15 * k}px system-ui, sans-serif`; x.textAlign = 'center'; x.fillText('哈基秀 · 隐藏款', W / 2, top + 24 * k);
    } else if (ov === 'fight') {   // 街机格斗家：血条 + READY
      x.fillStyle = 'rgba(0,0,0,.45)'; x.fillRect(m, top, W - m * 2, 22 * k);
      x.fillStyle = '#ffcc00'; x.fillRect(m + 4 * k, top + 4 * k, (W - m * 2) * .42, 14 * k); x.fillStyle = '#ff3d6e'; x.fillRect(W / 2 + 20 * k, top + 4 * k, (W - m * 2) * .42 - 24 * k, 14 * k);
      x.font = `${22 * k}px VT323, monospace`; x.fillStyle = '#fff'; x.textAlign = 'center'; x.fillText('99', W / 2, top + 18 * k);
      x.textAlign = 'left'; x.fillText('1P', m, top + 44 * k);
      if (((t - started) / 600 | 0) % 2 === 0 && t - started < 4000) { x.font = `${54 * k}px VT323, monospace`; x.fillStyle = '#ffcc00'; x.textAlign = 'center'; x.shadowColor = '#ff3d6e'; x.shadowBlur = 0; x.fillText('READY?', W / 2, H * .3); }
    } else if (ov === 'ccd') {   // 复古CCD：橙色日期戳
      x.font = `${30 * k}px VT323, monospace`; x.fillStyle = '#ff9a2f'; x.shadowColor = 'rgba(255,120,30,.9)'; x.shadowBlur = 8 * k; x.textAlign = 'right';
      x.fillText(stamp, W - m - 6 * k, H - m - 120 * k);
    } else if (ov === 'film') {   // 清新胶片：两侧齿孔
      x.fillStyle = 'rgba(20,18,14,.55)'; x.fillRect(0, 0, 18 * k, H); x.fillRect(W - 18 * k, 0, 18 * k, H);
      x.fillStyle = 'rgba(255,250,235,.85)';
      for (let y = (t / 40) % (26 * k); y < H; y += 26 * k) { rr(5 * k, y, 8 * k, 12 * k, 2 * k); x.fill(); rr(W - 13 * k, y, 8 * k, 12 * k, 2 * k); x.fill(); }
    } else if (ov === 'rain') {   // 赛博霓虹：霓虹灯管框
      const g = x.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#ff2bd6'); g.addColorStop(1, '#22e6ff');
      x.strokeStyle = g; x.lineWidth = 3 * k; x.shadowColor = '#ff2bd6'; x.shadowBlur = 14 * k; rr(m, top, W - m * 2, H - top - 190 * k, 22 * k); x.stroke();
    } else if (ov === 'dots') {   // 蓝胖子：复古电视圆角框
      x.strokeStyle = 'rgba(30,136,229,.9)'; x.lineWidth = 12 * k; rr(m, top, W - m * 2, H - top - 190 * k, 60 * k); x.stroke();
      x.fillStyle = '#ffd23f'; for (const [px, py] of [[m + 30 * k, top + 30 * k], [W - m - 30 * k, top + 30 * k]]) { x.beginPath(); x.arc(px, py, 7 * k, 0, 7); x.fill(); }
    } else if (ov === 'magic') {   // 魔法少女：脚下旋转的魔法阵 + 星月框
      const cx = f ? f.center.x : W / 2, cy = f ? f.chin.y + f.height * .55 : H * .7, r = (f ? f.width : W * .4) * 1.1;
      x.save(); x.translate(cx, cy); x.scale(1, .32); x.rotate(t / 1600);
      x.strokeStyle = 'rgba(255,170,230,.85)'; x.shadowColor = '#ff8fe0'; x.shadowBlur = 14 * k; x.lineWidth = 2.5 * k;
      for (const ring of [r, r * .78]) { x.beginPath(); x.arc(0, 0, ring, 0, 7); x.stroke(); }
      x.beginPath(); for (let i = 0; i <= 5; i++) { const a = i * Math.PI * 4 / 5 - Math.PI / 2; x.lineTo(Math.cos(a) * r * .78, Math.sin(a) * r * .78); } x.stroke();
      x.restore();
      x.strokeStyle = 'rgba(123,140,255,.8)'; x.lineWidth = 2 * k; rr(m, top, W - m * 2, H - top - 190 * k, 34 * k); x.stroke();
      x.fillStyle = '#ffd86b'; x.font = `${26 * k}px serif`; x.textAlign = 'center'; x.fillText('☾', m + 22 * k, top + 34 * k); x.fillText('✦', W - m - 22 * k, top + 34 * k);
    } else if (ov === 'aura') {   // 热血少年：画面边缘的斩击痕
      x.strokeStyle = 'rgba(255,240,220,.85)'; x.lineWidth = 3 * k; x.lineCap = 'round';
      for (const [a, b2, c, d2] of [[m, top + 60 * k, m + 70 * k, top], [W - m - 80 * k, H - 200 * k, W - m, H - 260 * k]]) { x.beginPath(); x.moveTo(a, b2); x.lineTo(c, d2); x.stroke(); }
    } else if (ov === 'breeze') {   // 治愈手绘：柔和的午后光
      const g = x.createRadialGradient(W * .85, top, 0, W * .85, top, W * .9); g.addColorStop(0, 'rgba(255,240,190,.35)'); g.addColorStop(1, 'rgba(255,240,190,0)');
      x.fillStyle = g; x.fillRect(0, 0, W, H);
    } else if (ov === 'stream') {   // 虚拟主播：直播界面
      x.fillStyle = '#ff2e63'; rr(m, top, 58 * k, 24 * k, 6 * k); x.fill();
      x.fillStyle = '#fff'; x.font = `800 ${13 * k}px "Space Grotesk", system-ui`; x.textAlign = 'left'; x.fillText('● LIVE', m + 7 * k, top + 17 * k);
      x.fillStyle = 'rgba(0,0,0,.4)'; rr(m + 64 * k, top, 86 * k, 24 * k, 6 * k); x.fill();
      x.fillStyle = '#fff'; x.fillText('👁 ' + (12800 + Math.floor((t - started) / 90)).toLocaleString(), m + 72 * k, top + 17 * k);
      x.strokeStyle = 'rgba(41,211,255,.85)'; x.shadowColor = '#29d3ff'; x.shadowBlur = 10 * k; x.lineWidth = 2.5 * k; rr(m, top + 32 * k, W - m * 2, H - top - 222 * k, 24 * k); x.stroke();
    } else if (ov === 'dora') {   // 蓝胖子：复古电视圆角框 + 金色小铃铛
      x.strokeStyle = 'rgba(30,136,229,.9)'; x.lineWidth = 12 * k; rr(m, top, W - m * 2, H - top - 190 * k, 60 * k); x.stroke();
      x.fillStyle = '#ffd23f'; x.beginPath(); x.arc(W / 2, H - 190 * k + 4 * k, 12 * k, 0, 7); x.fill(); x.strokeStyle = '#8a6a00'; x.lineWidth = 2 * k; x.stroke();
    } else if (ov === 'sparkle' && f) {   // 动漫主角：眼神光点
      const s = img('sparkle'); if (s) for (const e of [f.eyeL, f.eyeR]) { const sz = f.width * .16 * (0.8 + .2 * Math.sin(t / 200)); x.drawImage(s, e.x - sz / 2 + f.width * .05, e.y - sz / 2 - f.width * .05, sz, sz); }
    } else if (ov === 'bubbles' || ov === 'candy' || ov === 'paws') {   // 贴纸白边感：粗圆角描边
      x.strokeStyle = 'rgba(255,255,255,.9)'; x.lineWidth = 8 * k; rr(m, top, W - m * 2, H - top - 190 * k, 34 * k); x.stroke();
    }
    x.restore();
  }
  function rr(/** @type {number} */ X, /** @type {number} */ Y, /** @type {number} */ w, /** @type {number} */ h, /** @type {number} */ r) { x.beginPath(); x.roundRect(X, Y, w, h, r); }
  function arch(/** @type {number} */ X, /** @type {number} */ Y, /** @type {number} */ w, /** @type {number} */ h) {
    const r = w / 2; x.beginPath(); x.moveTo(X, Y + h); x.lineTo(X, Y + r); x.arc(X + r, Y + r, r, Math.PI, 0); x.lineTo(X + w, Y + h); x.stroke();
  }
  function corners(/** @type {string} */ col, /** @type {number} */ lw, /** @type {number} */ L, /** @type {number} */ m, /** @type {number} */ top) {
    const W = canvas.width, H = canvas.height, b = H - 190 * (W / 400); x.strokeStyle = col; x.lineWidth = lw;
    for (const [cx, cy, sx, sy] of [[m, top, 1, 1], [W - m, top, -1, 1], [m, b, 1, -1], [W - m, b, -1, -1]]) { x.beginPath(); x.moveTo(cx, cy + sy * L); x.lineTo(cx, cy); x.lineTo(cx + sx * L, cy); x.stroke(); }
  }

  return {
    draw,
    setPreset(/** @type {string} */ id) { if (id !== preset) { preset = id; bits = []; started = performance.now(); const p = presetById(id); if (p?.live.sticker) img(p.live.sticker); for (const n of ['heart', 'bow', 'candy', 'paw', 'sparkle']) img(n); } },
    setStrength(/** @type {number} */ v) { strength = v; },
    resize(/** @type {number} */ w, /** @type {number} */ h) { if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; } },
  };
}
