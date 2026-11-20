/**
 * 实时风格化渲染（WebGL）：一次绘制完成调色、赛璐璐/色阶、描边、网点、像素化、跟脸走的大头/大眼变形、磨皮、
 * 霓虹轮廓光、柔光溢散、扫描线和颗粒。每个风格只是一组参数（presets.js 的 live 字段），所以 17 个世界共用一条管线。
 *
 * 同一个渲染器也能把一张静态照片渲成「本地预览」（演示版没有工作室时用）。
 */
import { presetById } from '../presets.js';

const VERT = `attribute vec2 p; varying vec2 v; void main(){ v = p * .5 + .5; gl_Position = vec4(p, 0., 1.); }`;
const FRAG = `
precision highp float;
varying vec2 v;
uniform sampler2D tex;
uniform vec2 res;            // canvas pixels
uniform vec2 texel;          // 1 / texture size
uniform vec4 crop;           // texture uv of the visible area: offset.xy, scale.zw
uniform float mirror, mixv, split, time;
uniform vec3 grade, rimA, rimB;
uniform float sat, contrast, lift, warmth, grain, vignette, bloom, posterize, edge, halftone, pixel, bulge, eyes, smooth, rim, scan;
uniform vec4 face;           // centre (uv), radius (uv of height), has face
uniform vec4 eyesAt;         // left eye uv, right eye uv

vec2 toTex(vec2 uv){ vec2 t = crop.xy + uv * crop.zw; if (mirror > .5) t.x = 1. - t.x; return t; }
vec3 at(vec2 uv){ return texture2D(tex, toTex(uv)).rgb; }
float luma(vec3 c){ return dot(c, vec3(.299, .587, .114)); }
float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233)) + time * 13.7) * 43758.5453); }

vec2 bulgeAt(vec2 uv, vec2 c, float r, float k){
  vec2 d = (uv - c) * vec2(res.x / res.y, 1.);
  float l = length(d);
  if (l >= r || k <= 0.) return uv;
  float f = 1. - k * (1. - (l / r) * (l / r));
  return c + (uv - c) * f;
}

void main(){
  vec2 uv = v;
  vec3 raw = at(uv);
  // ── 变形：跟脸走的大头 / 大眼 ──
  vec2 w = uv;
  if (face.w > .5) {
    w = bulgeAt(w, face.xy, face.z * 1.9, bulge * .55);
    w = bulgeAt(w, eyesAt.xy, face.z * .32, eyes * .45);
    w = bulgeAt(w, eyesAt.zw, face.z * .32, eyes * .45);
  } else if (bulge > 0.) {
    w = bulgeAt(w, vec2(.5, .58), .42, bulge * .45);
  }
  if (pixel > 0.) { float cells = mix(260., 46., pixel); vec2 g = vec2(cells * res.x / res.y, cells); w = (floor(w * g) + .5) / g; }
  vec3 c = at(w);
  vec2 px = vec2(1. / res.y) * 1.6;
  // ── 磨皮：保边的近邻平均 ──
  if (smooth > 0.) {
    vec3 sum = c; float ws = 1.;
    for (int i = 0; i < 8; i++) {
      float a = float(i) * .785398;
      vec2 o = vec2(cos(a), sin(a)) * px * 2.4;
      vec3 s = at(w + o);
      float k = exp(-dot(s - c, s - c) * 38.);
      sum += s * k; ws += k;
    }
    c = mix(c, sum / ws, smooth);
  }
  // ── 描边（索贝尔）──
  float lx = luma(at(w + vec2(px.x, 0.))) - luma(at(w - vec2(px.x, 0.)));
  float ly = luma(at(w + vec2(0., px.y))) - luma(at(w - vec2(0., px.y)));
  float e = clamp(length(vec2(lx, ly)) * 4.2, 0., 1.);
  // ── 色阶（赛璐璐 / 黏土）──
  if (posterize > 0.) { float lv = mix(24., 4., posterize); c = mix(c, floor(c * lv + .5) / lv, posterize); }
  // ── 调色 ──
  c = c + lift * (1. - c);
  c = (c - .5) * contrast + .5;
  float L = luma(c);
  c = mix(vec3(L), c, sat);
  c.r += warmth * .08; c.b -= warmth * .08;
  c *= grade;
  // ── 网点 ──
  if (halftone > 0.) {
    float cell = 7.;
    vec2 q = mat2(.7071, -.7071, .7071, .7071) * (uv * res);
    vec2 g = fract(q / cell) - .5;
    float dark = 1. - luma(c);
    float dotv = smoothstep(dark * .62, dark * .62 - .08, length(g));
    vec3 ink = mix(vec3(1.), vec3(.07), 1. - dotv);
    c = mix(c, mix(ink, c * ink, .35), halftone);
  }
  c *= 1. - edge * smoothstep(.18, .55, e) * .9;
  // ── 霓虹轮廓光：左边一个色、右边一个色，落在亮部与边缘 ──
  if (rim > 0.) {
    float side = smoothstep(.0, 1., uv.x);
    vec3 rc = mix(rimA, rimB, side);
    float lit = smoothstep(.12, .7, luma(raw)) * (.35 + e * 1.4);
    c += rc * lit * rim * .55;
    c = mix(c, c * mix(rimA, rimB, side) * 1.6, rim * .18);
  }
  // ── 柔光溢散 ──
  if (bloom > 0.) {
    vec3 b = vec3(0.);
    for (int i = 0; i < 8; i++) {
      float a = float(i) * .785398 + .39;
      vec3 s = at(w + vec2(cos(a), sin(a)) * px * 9.);
      b += max(s - .62, 0.);
    }
    c += b / 8. * bloom * 2.4;
  }
  // ── 扫描线、暗角、颗粒 ──
  if (scan > 0.) c *= 1. - scan * .22 * (.5 + .5 * sin(uv.y * res.y * 1.4));
  vec2 vd = (uv - .5) * vec2(1.1, 1.);
  c *= 1. - vignette * smoothstep(.25, .85, length(vd));
  if (grain > 0.) c += (hash(uv * res) - .5) * grain * .16;
  c = clamp(c, 0., 1.);
  vec3 outc = mix(raw, c, mixv);
  if (split >= 0. && uv.x < split) outc = raw;
  if (split >= 0. && abs(uv.x - split) < 1.2 / res.x) outc = vec3(1.);
  gl_FragColor = vec4(outc, 1.);
}`;

const ZERO = { grade: [1, 1, 1], sat: 1, contrast: 1, lift: 0, warmth: 0, grain: 0, vignette: 0, bloom: 0, posterize: 0, edge: 0, halftone: 0, pixel: 0, bulge: 0, eyes: 0, smooth: 0, rim: [0, 0, 0, 0, 0, 0], scan: 0 };

/**
 * @param {HTMLCanvasElement} canvas
 */
export function createRenderer(canvas) {
  const gl = /** @type {WebGLRenderingContext | null} */ (canvas.getContext('webgl', { premultipliedAlpha: false, preserveDrawingBuffer: true, antialias: false, powerPreference: 'high-performance' }));
  if (!gl) return null;
  const sh = (/** @type {number} */ type, /** @type {string} */ src) => {
    const s = /** @type {WebGLShader} */ (gl.createShader(type)); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) || 'shader');
    return s;
  };
  const prog = /** @type {WebGLProgram} */ (gl.createProgram());
  gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
  gl.useProgram(prog);
  const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const texture = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, texture);
  for (const [k, val] of [[gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE], [gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR]]) gl.texParameteri(gl.TEXTURE_2D, k, val);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  /** @type {Record<string, WebGLUniformLocation | null>} */
  const u = {};
  for (const name of ['tex', 'res', 'texel', 'crop', 'mirror', 'mixv', 'split', 'time', 'grade', 'rimA', 'rimB', 'sat', 'contrast', 'lift', 'warmth', 'grain', 'vignette', 'bloom', 'posterize', 'edge', 'halftone', 'pixel', 'bulge', 'eyes', 'smooth', 'rim', 'scan', 'face', 'eyesAt']) u[name] = gl.getUniformLocation(prog, name);

  let params = { ...ZERO }, target = { ...ZERO }, strength = .8, mirror = true, split = -1;
  let srcW = 1, srcH = 1;
  /** @type {{ cx: number, cy: number, r: number, el: number[], er: number[] } | null} */ let face = null;
  /** The visible part of the source (object-fit: cover), as texture uv. */
  let crop = [0, 0, 1, 1];

  function fitCover() {
    const W = canvas.width, H = canvas.height, s = Math.max(W / srcW, H / srcH);
    const sx = W / s / srcW, sy = H / s / srcH;
    crop = [(1 - sx) / 2, (1 - sy) / 2, sx, sy];
  }

  return {
    gl,
    /** 换风格：参数在几帧内平滑过渡，不跳。 */
    setPreset(/** @type {string} */ id) { const p = presetById(id); target = { ...ZERO, ...(p?.live || {}) }; },
    setStrength(/** @type {number} */ v) { strength = v; },
    setMirror(/** @type {boolean} */ m) { mirror = m; },
    setSplit(/** @type {number} */ x) { split = x; },
    /** @param {{ cx: number, cy: number, r: number, el: number[], er: number[] } | null} f 画布 uv（y 向上） */
    setFace(f) { face = f; },
    /** 画布坐标 ↔ 源图坐标的换算，给贴纸层用。 */
    get crop() { return crop; },
    get mirror() { return mirror; },
    /** @param {TexImageSource} src @param {number} w @param {number} h @param {number} t */
    draw(src, w, h, t, ease = .18) {
      if (w !== srcW || h !== srcH) { srcW = w; srcH = h; fitCover(); }
      // ease each number toward the style's own
      for (const k of Object.keys(ZERO)) {
        const a = /** @type {any} */ (params)[k], b = /** @type {any} */ (target)[k];
        /** @type {any} */ (params)[k] = Array.isArray(a) ? a.map((x, i) => x + (b[i] - x) * ease) : a + (b - a) * ease;
      }
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      try { gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, src); } catch { return; }
      const P = params;
      gl.uniform2f(u.res, canvas.width, canvas.height);
      gl.uniform2f(u.texel, 1 / srcW, 1 / srcH);
      gl.uniform4f(u.crop, crop[0], crop[1], crop[2], crop[3]);
      gl.uniform1f(u.mirror, mirror ? 1 : 0);
      gl.uniform1f(u.mixv, strength);
      gl.uniform1f(u.split, split);
      gl.uniform1f(u.time, (t / 1000) % 100);
      gl.uniform3f(u.grade, P.grade[0], P.grade[1], P.grade[2]);
      gl.uniform3f(u.rimA, P.rim[0], P.rim[1], P.rim[2]);
      gl.uniform3f(u.rimB, P.rim[3], P.rim[4], P.rim[5]);
      gl.uniform1f(u.rim, Math.max(...P.rim) > .01 ? 1 : 0);
      for (const k of ['sat', 'contrast', 'lift', 'warmth', 'grain', 'vignette', 'bloom', 'posterize', 'edge', 'halftone', 'pixel', 'bulge', 'eyes', 'smooth', 'scan']) gl.uniform1f(u[k], /** @type {any} */ (P)[k]);
      if (face) { gl.uniform4f(u.face, face.cx, face.cy, face.r, 1); gl.uniform4f(u.eyesAt, face.el[0], face.el[1], face.er[0], face.er[1]); }
      else { gl.uniform4f(u.face, .5, .5, .2, 0); gl.uniform4f(u.eyesAt, .4, .55, .6, .55); }
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    },
    resize(/** @type {number} */ w, /** @type {number} */ h) { if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; fitCover(); } },
    /** 立刻到位（静态照片用，不要过渡）。 */
    snap() { params = JSON.parse(JSON.stringify(target)); },
    destroy() { gl.getExtension('WEBGL_lose_context')?.loseContext(); },
  };
}

/**
 * 把一张照片按风格渲成本地预览（演示版无工作室时用）。
 * @param {Blob} blob @param {string} preset @param {number} strength 0–1 @param {'avatar' | 'portrait'} format
 */
export async function stylizeStill(blob, preset, strength, format) {
  const bitmap = await createImageBitmap(blob, { imageOrientation: 'from-image' });
  // WebGL ignores UNPACK_FLIP_Y for ImageBitmap uploads: hand it a canvas, which it does flip like a video frame
  // and crop it to the format first, keeping the upper part (where a face is), not the exact middle
  const want = format === 'portrait' ? 2 / 3 : 1, have = bitmap.width / bitmap.height;
  const cw = have > want ? Math.round(bitmap.height * want) : bitmap.width, ch = have > want ? bitmap.height : Math.round(bitmap.width / want);
  const sx = Math.round((bitmap.width - cw) / 2), sy = Math.round(Math.max(0, Math.min(bitmap.height - ch, (bitmap.height - ch) * .28)));
  const bmp = document.createElement('canvas'); bmp.width = cw; bmp.height = ch;
  /** @type {CanvasRenderingContext2D} */ (bmp.getContext('2d')).drawImage(bitmap, sx, sy, cw, ch, 0, 0, cw, ch); bitmap.close();
  const W = format === 'portrait' ? 768 : 896, H = format === 'portrait' ? 1152 : 896;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const r = createRenderer(c);
  if (!r) {
    const x = /** @type {CanvasRenderingContext2D} */ (c.getContext('2d'));
    const s = Math.max(W / bmp.width, H / bmp.height);
    x.drawImage(bmp, (W - bmp.width * s) / 2, (H - bmp.height * s) / 2, bmp.width * s, bmp.height * s);
  } else {
    r.setMirror(false); r.setPreset(preset); r.snap(); r.setStrength(Math.max(.35, strength));
    r.draw(bmp, bmp.width, bmp.height, performance.now(), 1);
  }
  const out = await new Promise(res => c.toBlob(b => res(b), 'image/jpeg', .9));
  r?.destroy();
  return /** @type {Blob} */ (out);
}
