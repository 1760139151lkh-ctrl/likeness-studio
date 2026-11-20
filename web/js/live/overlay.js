/**
 * 镜头上的 AR 层：跟着脸走的贴纸（皇冠、猫耳、小龙头套、斗笠、步摇…）、每个风格自己的画框/HUD/粒子。
 * 贴纸是生成的透明图（img/stickers/），画框和粒子是矢量即时绘制，所以清晰、轻量。
 */
import { sticker } from '../core/assets.js';
import { presetById } from '../presets.js';

/** 头部贴纸怎么戴：宽度（相对脸宽）、底边离发际线抬高多少（相对脸长）。 */
const WEAR = {
  tiara: { w: .95, lift: .1 }, 'gothic-crown': { w: 1.05, lift: .08 }, 'dragon-hood': { w: 1.45, lift: -.04 }, 'cat-ears': { w: 1.45, lift: .04 },
  'dog-ears': { w: 1.6, lift: -.06 }, beanie: { w: 1.38, lift: -.1 }, 'hero-visor': { w: 1.1, lift: -.06 }, 'robot-antenna': { w: 1.1, lift: -.04 },
  'magic-tiara': { w: .95, lift: .08 }, 'fight-band': { w: 1.15, lift: -.2 }, 'straw-hat': { w: 1.75, lift: -.14 }, 'cat-headset': { w: 1.7, lift: -.58 },
  douli: { w: 2, lift: -.16 }, buyao: { w: 1.05, lift: .02 }, 'flower-clip': { w: .85, lift: .02 },
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
    x.drawImage(im, -w / 2, -h, w, h);
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
    if (ov === 'wave' || ov === 'deco') {   // 浮世木刻：头后的朱红日轮；南洋月份牌：装饰艺术的放射光
      const cx = f ? f.center.x : W / 2, cy = f ? f.center.y - f.height * .1 : H * .4, r = f ? f.height * .95 : H * .28;
      x.save();
      if (ov === 'wave') { x.fillStyle = 'rgba(200,70,44,.32)'; x.beginPath(); x.arc(cx, cy, r, 0, 7); x.fill(); }
      else { x.strokeStyle = 'rgba(232,196,120,.35)'; x.lineWidth = 2 * k; for (let i = 0; i < 24; i++) { const a = Math.PI + (i / 23) * Math.PI; x.beginPath(); x.moveTo(cx + Math.cos(a) * r * .9, cy + Math.sin(a) * r * .9); x.lineTo(cx + Math.cos(a) * r * 2.2, cy + Math.sin(a) * r * 2.2); x.stroke(); } }
      x.restore();
      return;
    }
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
    const up = ['hearts', 'bubbles', 'candy', 'paws', 'orbs', 'sparkle', 'stars', 'embers', 'dust', 'glints', 'doodles'].includes(kind);
    bits.push({ kind, x: Math.random() * W, y: up ? H + 20 : -20, vx: (Math.random() - .5) * .4, vy: up ? -(.4 + Math.random() * .9) : (kind === 'rain' ? 9 + Math.random() * 6 : .6 + Math.random()),
      s: kind === 'rain' ? 1 : .6 + Math.random() * .8, r: Math.random() * 6, vr: (Math.random() - .5) * .02, life: 1, hue: Math.random() });
  }
  function particles(/** @type {string} */ ov, /** @type {number} */ t, /** @type {number} */ W, /** @type {number} */ H, /** @type {number} */ k) {
    const kind = { hearts: 'hearts', bubbles: 'bubbles', candy: 'candy', paws: 'paws', orbs: 'orbs', sparkle: 'sparkle', rain: 'rain', gothic: 'petals', energy: 'sparkle', magic: 'stars', breeze: 'leaves', stream: 'hearts', aura: 'embers',
      robot: 'bubbles', bamboo: 'bamboo', ink: 'peach', flowers: 'peach', tarot: 'stars', hk: 'dust', deco: 'glints', doodle: 'doodles', wave: 'snow' }[ov];
    if (!kind) { bits = []; return; }
    const want = kind === 'rain' ? 70 : kind === 'orbs' ? 10 : kind === 'snow' || kind === 'dust' ? 36 : 14;
    bits = bits.filter(b => b.kind === kind);
    if (bits.length < want && Math.random() < (kind === 'rain' ? .9 : kind === 'snow' || kind === 'dust' ? .3 : .12)) spawn(kind, W, H);
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
      else if (kind === 'bamboo') { x.rotate(.6); x.fillStyle = (b.hue || 0) > .5 ? 'rgba(74,140,92,.85)' : 'rgba(46,96,64,.8)'; x.beginPath(); x.ellipse(0, 0, s * .55, s * .1, 0, 0, 7); x.fill(); }
      else if (kind === 'peach') { x.fillStyle = (b.hue || 0) > .5 ? 'rgba(255,183,207,.9)' : 'rgba(255,214,228,.9)'; x.beginPath(); x.moveTo(0, -s * .3); x.quadraticCurveTo(s * .3, -s * .1, 0, s * .3); x.quadraticCurveTo(-s * .3, -s * .1, 0, -s * .3); x.fill(); }
      else if (kind === 'dust') { x.fillStyle = `rgba(255,${190 + Math.round((b.hue || 0) * 50)},140,.55)`; x.beginPath(); x.arc(0, 0, s * .09, 0, 7); x.fill(); }
      else if (kind === 'glints') { x.fillStyle = 'rgba(232,196,120,.9)'; x.beginPath(); x.moveTo(0, -s * .3); x.lineTo(s * .1, 0); x.lineTo(0, s * .3); x.lineTo(-s * .1, 0); x.closePath(); x.fill(); }
      else if (kind === 'doodles') { x.strokeStyle = (b.hue || 0) > .5 ? 'rgba(224,122,95,.85)' : 'rgba(61,142,185,.85)'; x.lineWidth = 1.6 * k; x.beginPath(); for (let i = 0; i <= 5; i++) { const a = i * Math.PI * 4 / 5 - Math.PI / 2; x.lineTo(Math.cos(a) * s * .3, Math.sin(a) * s * .3); } x.stroke(); }
      else if (kind === 'snow') { x.fillStyle = 'rgba(255,255,255,.85)'; x.beginPath(); x.arc(0, 0, s * .08, 0, 7); x.fill(); }
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
    } else if (ov === 'energy') {   // 特摄英雄：脸周围的能量环 + 胸口能量核
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
    } else if (ov === 'robot') {   // Q版机器人：圆角电视框 + 四颗螺丝
      x.strokeStyle = 'rgba(56,182,255,.92)'; x.lineWidth = 12 * k; rr(m, top, W - m * 2, H - top - 190 * k, 54 * k); x.stroke();
      for (const [px, py] of [[m + 26 * k, top + 26 * k], [W - m - 26 * k, top + 26 * k], [m + 26 * k, H - 216 * k], [W - m - 26 * k, H - 216 * k]]) {
        x.fillStyle = '#ffd23f'; x.beginPath(); x.arc(px, py, 8 * k, 0, 7); x.fill();
        x.strokeStyle = 'rgba(120,80,0,.7)'; x.lineWidth = 2 * k; x.beginPath(); x.moveTo(px - 4 * k, py - 4 * k); x.lineTo(px + 4 * k, py + 4 * k); x.stroke();
      }
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
    } else if ((ov === 'sparkle' || ov === 'flowers') && f) {   // 动漫主角 / 少女漫画：眼神光点
      if (ov === 'flowers') { const g = x.createRadialGradient(W / 2, H * .45, H * .25, W / 2, H * .45, H * .7); g.addColorStop(0, 'rgba(255,200,230,0)'); g.addColorStop(1, 'rgba(255,170,215,.35)'); x.fillStyle = g; x.fillRect(0, 0, W, H); }
      const s = img('sparkle'); if (s) for (const e of [f.eyeL, f.eyeR]) { const sz = f.width * .16 * (0.8 + .2 * Math.sin(t / 200)); x.drawImage(s, e.x - sz / 2 + f.width * .05, e.y - sz / 2 - f.width * .05, sz, sz); }
    } else if (ov === 'bamboo') {   // 武侠侠客：水墨笔触的四角 + 脚下的雾
      inkCorners('rgba(30,40,32,.8)', m, top, W, H, k);
      const g = x.createLinearGradient(0, H * .62, 0, H); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(235,240,232,.45)'); x.fillStyle = g; x.fillRect(0, H * .62, W, H * .38);
    } else if (ov === 'ink') {   // 丹青仙袂：金色祥云 + 朱红印章 + 宣纸的墨晕
      cloudSwirl(m + 34 * k, top + 30 * k, 18 * k, k); cloudSwirl(W - m - 34 * k, top + 30 * k, 18 * k, k, -1);
      const g = x.createLinearGradient(0, H * .7, 0, H); g.addColorStop(0, 'rgba(245,239,226,0)'); g.addColorStop(1, 'rgba(245,239,226,.5)'); x.fillStyle = g; x.fillRect(0, H * .7, W, H * .3);
      seal(W - m - 40 * k, H - 236 * k, 30 * k);
    } else if (ov === 'tarot') {   // 星运塔罗：金色双线卡牌框 + 顶上的月
      x.strokeStyle = 'rgba(217,181,82,.95)'; x.shadowColor = 'rgba(243,217,138,.8)'; x.shadowBlur = 10 * k; x.lineWidth = 2.5 * k;
      rr(m, top, W - m * 2, H - top - 190 * k, 18 * k); x.stroke(); x.lineWidth = 1 * k; rr(m + 7 * k, top + 7 * k, W - m * 2 - 14 * k, H - top - 204 * k, 12 * k); x.stroke();
      x.fillStyle = '#f3d98a'; x.font = `${24 * k}px serif`; x.textAlign = 'center'; x.fillText('☾', W / 2, top + 30 * k);
      x.font = `${14 * k}px serif`; for (const [px, py] of [[m + 20 * k, top + 26 * k], [W - m - 20 * k, top + 26 * k], [m + 20 * k, H - 206 * k], [W - m - 20 * k, H - 206 * k]]) x.fillText('✦', px, py);
    } else if (ov === 'vhs') {   // 复古番剧：录像带的 PLAY、时间码和跑动的跟踪条
      x.fillStyle = '#fff'; x.font = `${26 * k}px VT323, monospace`; x.textAlign = 'left'; x.shadowColor = '#ff4fd8'; x.shadowBlur = 0;
      x.fillText('▶ PLAY', m + 4 * k, top + 26 * k);
      const s2 = Math.floor((t - started) / 1000); x.fillText('SP ' + String(Math.floor(s2 / 60)).padStart(2, '0') + ':' + String(s2 % 60).padStart(2, '0'), m + 4 * k, H - 210 * k);
      const band = ((t / 9) % (H + 80 * k)) - 40 * k; const g = x.createLinearGradient(0, band - 30 * k, 0, band + 30 * k);
      g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(.5, 'rgba(255,255,255,.12)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, band - 30 * k, W, 60 * k);
    } else if (ov === 'hk') {   // 港风电影：一角的暖色漏光 + 两侧红绿霓虹
      const pulse = .75 + .25 * Math.sin(t / 900);
      let g = x.createRadialGradient(W, top, 0, W, top, W * .9); g.addColorStop(0, `rgba(255,140,60,${.38 * pulse})`); g.addColorStop(1, 'rgba(255,140,60,0)'); x.fillStyle = g; x.fillRect(0, 0, W, H);
      g = x.createLinearGradient(0, 0, W * .25, 0); g.addColorStop(0, 'rgba(232,67,79,.28)'); g.addColorStop(1, 'rgba(232,67,79,0)'); x.fillStyle = g; x.fillRect(0, 0, W * .25, H);
      g = x.createLinearGradient(W, 0, W * .75, 0); g.addColorStop(0, 'rgba(63,208,160,.22)'); g.addColorStop(1, 'rgba(63,208,160,0)'); x.fillStyle = g; x.fillRect(W * .75, 0, W * .25, H);
    } else if (ov === 'gilt') {   // 古典油画：鎏金画框
      const g = x.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#f3d48a'); g.addColorStop(.5, '#a07a2c'); g.addColorStop(1, '#f0cf7e');
      x.strokeStyle = g; x.lineWidth = 14 * k; rr(m, top, W - m * 2, H - top - 190 * k, 4 * k); x.stroke();
      x.strokeStyle = 'rgba(80,55,15,.85)'; x.lineWidth = 2 * k; rr(m + 9 * k, top + 9 * k, W - m * 2 - 18 * k, H - top - 208 * k, 2 * k); x.stroke();
    } else if (ov === 'doodle') {   // 绘本水彩：会「抖」的手绘边框（像手绘动画的线）
      const seed = Math.floor(t / 160); x.strokeStyle = 'rgba(59,49,39,.75)'; x.lineWidth = 2.4 * k; x.lineJoin = 'round';
      wobble(m, top, W - m * 2, H - top - 190 * k, seed, k);
    } else if (ov === 'pop') {   // 波普艺术：角落的网点 + 开场的 POP!
      for (const [ox, oy, sx, sy] of [[0, top - 20 * k, 1, 1], [W, H - 190 * k, -1, -1]]) for (let i = 0; i < 9; i++) for (let j = 0; j < 9 - i; j++) {
        x.fillStyle = 'rgba(255,45,111,.55)'; x.beginPath(); x.arc(ox + sx * (i * 14 + 8) * k, oy + sy * (j * 14 + 8) * k, (5 - (i + j) * .45) * k, 0, 7); x.fill();
      }
      if (t - started < 2600) { const sc = Math.min(1, (t - started) / 220); x.save(); x.translate(W - m - 70 * k, top + 70 * k); x.rotate(-.2); x.scale(sc, sc); burstStar(46 * k, '#ffe14d'); x.fillStyle = '#111'; x.font = `900 ${26 * k}px system-ui, sans-serif`; x.textAlign = 'center'; x.fillText('POP!', 0, 9 * k); x.restore(); }
    } else if (ov === 'wave') {   // 浮世木刻：底部的青海波
      x.strokeStyle = 'rgba(43,76,126,.55)'; x.lineWidth = 2 * k; const r0 = 22 * k, yb = H - 190 * k;
      for (let row = 0; row < 3; row++) for (let cx2 = -r0 + (row % 2) * r0; cx2 < W + r0; cx2 += r0 * 2) for (const rr2 of [r0, r0 * .7, r0 * .4]) { x.beginPath(); x.arc(cx2, yb - row * r0 * .6 + r0, rr2, Math.PI, 0); x.stroke(); }
    } else if (ov === 'deco') {   // 南洋月份牌：装饰艺术的阶梯角框
      x.strokeStyle = 'rgba(184,70,58,.85)'; x.lineWidth = 2.5 * k; rr(m, top, W - m * 2, H - top - 190 * k, 6 * k); x.stroke();
      x.strokeStyle = 'rgba(62,138,126,.85)'; x.lineWidth = 1.5 * k;
      for (const [cx2, cy2, sx, sy] of [[m, top, 1, 1], [W - m, top, -1, 1], [m, H - 190 * k, 1, -1], [W - m, H - 190 * k, -1, -1]]) for (let i = 1; i <= 3; i++) { x.beginPath(); x.moveTo(cx2 + sx * i * 9 * k, cy2 + sy * 40 * k); x.lineTo(cx2 + sx * i * 9 * k, cy2 + sy * i * 9 * k); x.lineTo(cx2 + sx * 40 * k, cy2 + sy * i * 9 * k); x.stroke(); }
    } else if (ov === 'tiles') {   // 娘惹风华：一圈娘惹花砖
      const sz = 26 * k, cols = ['#e05a7a', '#2ea39b', '#f2c14e'];
      const tile = (/** @type {number} */ px, /** @type {number} */ py, /** @type {number} */ i) => { x.fillStyle = 'rgba(255,255,255,.88)'; x.fillRect(px, py, sz, sz); x.fillStyle = cols[i % 3]; x.beginPath(); x.arc(px + sz / 2, py + sz / 2, sz * .28, 0, 7); x.fill(); x.fillStyle = cols[(i + 1) % 3]; for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) { x.beginPath(); x.arc(px + dx * sz, py + dy * sz, sz * .22, 0, 7); x.fill(); } };
      let i = 0; for (let px = 0; px < W; px += sz) tile(px, top - 22 * k, i++);
      for (let py = top - 22 * k + sz; py < H - 190 * k; py += sz) { tile(0, py, i++); tile(W - sz, py, i++); }
    } else if (ov === 'bubbles' || ov === 'candy' || ov === 'paws') {   // 贴纸白边感：粗圆角描边
      x.strokeStyle = 'rgba(255,255,255,.9)'; x.lineWidth = 8 * k; rr(m, top, W - m * 2, H - top - 190 * k, 34 * k); x.stroke();
    }
    x.restore();
  }
  /** 水墨笔触的角：粗起细收。 */
  function inkCorners(/** @type {string} */ col, /** @type {number} */ m, /** @type {number} */ top, /** @type {number} */ W, /** @type {number} */ H, /** @type {number} */ k) {
    const b = H - 190 * k; x.fillStyle = col;
    for (const [cx, cy, sx, sy] of [[m, top, 1, 1], [W - m, top, -1, 1], [m, b, 1, -1], [W - m, b, -1, -1]]) {
      x.beginPath(); x.moveTo(cx, cy + sy * 70 * k); x.quadraticCurveTo(cx - sx * 3 * k, cy, cx + sx * 70 * k, cy - sy * 2 * k); x.lineTo(cx + sx * 64 * k, cy + sy * 3 * k); x.quadraticCurveTo(cx + sx * 6 * k, cy + sy * 5 * k, cx + sx * 4 * k, cy + sy * 70 * k); x.closePath(); x.fill();
    }
  }
  /** 金色祥云：一个回卷的涡纹。 */
  function cloudSwirl(/** @type {number} */ cx, /** @type {number} */ cy, /** @type {number} */ r, /** @type {number} */ k, dir = 1) {
    x.save(); x.strokeStyle = 'rgba(184,145,58,.9)'; x.lineWidth = 2.2 * k; x.lineCap = 'round'; x.beginPath();
    for (let a = 0; a < Math.PI * 3.2; a += .15) { const rr3 = r * (1 - a / (Math.PI * 3.6)); x.lineTo(cx + dir * Math.cos(a) * rr3, cy + Math.sin(a) * rr3); }
    x.stroke(); x.beginPath(); x.arc(cx + dir * r * 1.5, cy + r * .4, r * .55, Math.PI, Math.PI * 2.2); x.stroke(); x.restore();
  }
  /** 朱红印章「秀」。 */
  function seal(/** @type {number} */ px, /** @type {number} */ py, /** @type {number} */ s) {
    x.save(); x.fillStyle = 'rgba(200,55,45,.92)'; rr(px, py, s, s, s * .12); x.fill();
    x.strokeStyle = 'rgba(255,245,232,.7)'; x.lineWidth = s * .05; rr(px + s * .1, py + s * .1, s * .8, s * .8, s * .08); x.stroke();
    x.fillStyle = '#fff5e8'; x.font = `700 ${s * .62}px "STKaiti","KaiTi","Noto Serif SC",serif`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('秀', px + s / 2, py + s * .54); x.restore();
  }
  /** 手绘的抖动框：每隔一小会儿换一次抖动，像逐帧手绘的线。 */
  function wobble(/** @type {number} */ X, /** @type {number} */ Y, /** @type {number} */ w, /** @type {number} */ h, /** @type {number} */ seed, /** @type {number} */ k) {
    const j = (/** @type {number} */ i) => (Math.sin(i * 12.9898 + seed * 78.233) * 43758.5453 % 1) * 3 * k;
    const pts = []; const n = 14;
    for (let i = 0; i <= n; i++) pts.push([X + w * i / n + j(i), Y + j(i + 50)]);
    for (let i = 1; i <= n; i++) pts.push([X + w + j(i + 100), Y + h * i / n + j(i + 150)]);
    for (let i = 1; i <= n; i++) pts.push([X + w - w * i / n + j(i + 200), Y + h + j(i + 250)]);
    for (let i = 1; i < n; i++) pts.push([X + j(i + 300), Y + h - h * i / n + j(i + 350)]);
    x.beginPath(); pts.forEach(([px, py], i) => (i ? x.lineTo(px, py) : x.moveTo(px, py))); x.closePath(); x.stroke();
  }
  /** 漫画爆炸星。 */
  function burstStar(/** @type {number} */ r, /** @type {string} */ col) {
    x.fillStyle = col; x.strokeStyle = '#111'; x.lineWidth = 3; x.beginPath();
    for (let i = 0; i < 24; i++) { const a = i * Math.PI / 12, d = i % 2 ? r * .62 : r; x.lineTo(Math.cos(a) * d, Math.sin(a) * d); }
    x.closePath(); x.fill(); x.stroke();
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
