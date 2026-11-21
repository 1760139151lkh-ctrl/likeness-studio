/**
 * 部位精修：在画面上这一版（或原图）的基础上，只改脸上的某几处——其余每一个像素都原样保留。
 *
 *   选部位  点脸上想改的地方（本机认脸，画面不出设备），或者点上面的部位胶囊
 *   选样子  每个部位一排选项（颜色类是色板），再加一个程度档位（长度、浓淡、质地…）和可选的一句话
 *   即时看  发色、唇色、腮红直接在手机上染好给你看；刘海、眉形这类形状改动用虚线圈出位置
 *   圈选    脸以外的任何地方：手指涂出来，说一句要改成什么
 *   参考图  「照着这张改」：借参考图里的发型、妆容（不借脸）
 *   出片    「精修这 N 处」：每一处一块遮罩，一起发出去，出来就是新的一版，随时能撤回
 *
 * 继承旧版 Lookbook / Mirror 的部位、遮罩与「Try on」，Desk 的 Pin 涂抹，Mirror 的 Draw on it 与 A reference。
 */
import { h, icon, toast, chooseFile } from '../core/dom.js';
import { PARTS, partById, optionOf, labelOf, togglePick, regionText, noteOf } from '../parts.js';
import { canvasFrom, faceOf, maskOf, partAt, outline, shapesOf, regionOf } from '../core/face.js';
import { prepare } from '../core/image.js';
import { paintTint } from './tint.js';
import { createBrush, coverMap } from './brush.js';
import { etaText } from '../ui/parts.js';
import { T } from '../copy.js';

const toBlob = (/** @type {HTMLCanvasElement} */ c) => new Promise((res, rej) => c.toBlob(b => (b ? res(b) : rej(new Error('遮罩导出失败'))), 'image/png'));

export function partsPanel(/** @type {any} */ ctx) {
  let active = '', open = false, raf = 0, paintWords = '', scrolledTo = '';
  /** 当前画面那张图的「读脸」结果。 @type {{ key: string, canvas: HTMLCanvasElement, face: any, masks: Map<string, HTMLCanvasElement | null> } | null} */
  let read = null;
  let reading = /** @type {Promise<void> | null} */ (null);
  /** @type {{ blob: Blob, url: string } | null} */ let ref = null;
  const brush = createBrush(ctx.brushC, { onChange: () => paintFoot() });

  // ── 界面 ──
  const hint = h('p.pp__hint', { 'aria-live': 'polite' });
  const pills = h('div.pp__parts', { role: 'tablist', 'aria-label': '部位' });
  const opts = h('div.pp__opts');
  const extra = h('div.pp__extra');
  const picked = h('div.pp__picked', { 'aria-label': '已选的部位' });
  const refRow = h('div.pp__ref');
  const body = h('div.tp.tp--pad.pp', null, hint, pills, opts, extra, picked, refRow);
  const cta = ctx.cta('精修', '', () => apply(), 'wand');
  const foot = h('div.pp__foot', null, cta);

  const map = () => {
    const img = ctx.shownImage(), r = ctx.frameBox.getBoundingClientRect();
    return coverMap(r.width, r.height, img.naturalWidth || 1, img.naturalHeight || 1);
  };

  // ── 读脸（每张图只读一次）──
  function readImage() {
    const img = ctx.shownImage(), key = img.currentSrc || img.src || '';
    if (!key || !img.naturalWidth) { read = null; return Promise.resolve(); }
    if (read?.key === key) return Promise.resolve();
    if (reading && /** @type {any} */ (reading).key === key) return reading;
    hint.textContent = '正在认脸…（在你手机上，不上传）';
    const job = (async () => {
      const canvas = canvasFrom(img, 768);
      const face = await faceOf(canvas);
      if ((img.currentSrc || img.src) !== key) return;
      read = { key, canvas, face, masks: new Map() };
      if (open) { paintHint(); paintOverlay(); await warmMasks(); paintOverlay(); }
    })();
    reading = Object.assign(job, { key });
    job.finally(() => { if (reading === job) reading = null; });
    return job;
  }
  async function maskFor(/** @type {string} */ part) {
    if (!read?.face) return null;
    if (!read.masks.has(part)) read.masks.set(part, await maskOf(read.canvas, read.face, part).catch(() => null));
    return read.masks.get(part) || null;
  }
  async function warmMasks() { for (const k of ctx.S.picks) await maskFor(k.part); }

  // ── 画面上的提示层：选中部位的虚线轮廓、已选几处的小标签、颜色的即时预览 ──
  function fitCanvas(/** @type {HTMLCanvasElement} */ c) {
    const r = ctx.frameBox.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1);
    const w = Math.max(1, Math.round(r.width * dpr)), hh = Math.max(1, Math.round(r.height * dpr));
    if (c.width !== w || c.height !== hh) { c.width = w; c.height = hh; }
    return dpr;
  }
  function paintOverlay() {
    const mk = /** @type {CanvasRenderingContext2D} */ (ctx.markC.getContext('2d'));
    if (!open) { mk.clearRect(0, 0, ctx.markC.width, ctx.markC.height); ctx.tintC.hidden = true; return; }
    const dpr = fitCanvas(ctx.markC); fitCanvas(ctx.tintC);
    mk.clearRect(0, 0, ctx.markC.width, ctx.markC.height);
    // 颜色类：即时染色
    const img = ctx.shownImage();
    const m = map();
    const shown = read?.face ? paintTintFit(img, m, dpr) : false;
    ctx.tintC.hidden = !shown;
    if (!read?.face || active === 'paint') return;
    const kx = (m.s * dpr) * (img.naturalWidth / read.canvas.width);
    mk.save(); mk.translate(m.ox * dpr, m.oy * dpr);
    const t = performance.now();
    const parts = new Set([...(active ? [active] : []), ...ctx.S.picks.map((/** @type {any} */ k) => k.part)]);
    for (const part of parts) {
      if (regionOf(part) === 'hair') { hairGlow(mk, part, kx, part === active); continue; }
      outline(mk, read.face, part, kx, kx, part === active ? t : 0);
    }
    // 小标签：每一处选了什么
    mk.font = `700 ${12 * dpr}px system-ui, sans-serif`; mk.textAlign = 'center'; mk.textBaseline = 'middle';
    const shapes = shapesOf(read.face);
    for (const k of ctx.S.picks) {
      const kind = regionOf(k.part), sh = kind === 'hair' ? shapes.bangs : shapes[kind];
      if (!sh?.length) continue;
      const pts = sh.flat(); let cx = pts.reduce((a, p) => a + p.x, 0) / pts.length, cy = Math.min(...pts.map(p => p.y));
      if (kind === 'hair') cy -= read.face.box[3] * .25;
      const text = optionOf(k)?.label || '';
      const x = cx * kx, y = cy * kx - 14 * dpr, w = mk.measureText(text).width + 16 * dpr;
      mk.fillStyle = 'rgba(20,14,28,.78)'; mk.beginPath(); mk.roundRect(x - w / 2, y - 11 * dpr, w, 22 * dpr, 11 * dpr); mk.fill();
      mk.fillStyle = '#fff'; mk.fillText(text, x, y + 1);
    }
    mk.restore();
  }
  /** 头发类（发色、发型）没有轮廓线：把头发遮罩淡淡地亮出来。 */
  function hairGlow(/** @type {CanvasRenderingContext2D} */ mk, /** @type {string} */ part, /** @type {number} */ kx, /** @type {boolean} */ on) {
    // 已经挑了颜色：染出来的样子本身就标出了这一块，不再叠一层强调色（会把颜色带偏）
    if (ctx.S.picks.some((/** @type {any} */ k) => k.part === part && partById(part)?.kind === 'swatch')) return;
    const m = read?.masks.get(part);
    if (!m) { maskFor(part).then(() => open && paintOverlay()); return; }
    mk.save(); mk.globalAlpha = on ? .3 : .16;
    const tint = document.createElement('canvas'); tint.width = m.width; tint.height = m.height;
    const tx = /** @type {CanvasRenderingContext2D} */ (tint.getContext('2d'));
    tx.drawImage(m, 0, 0); tx.globalCompositeOperation = 'source-in'; tx.fillStyle = getComputedStyle(ctx.frame).getPropertyValue('--accent').trim() || '#ff3d8b'; tx.fillRect(0, 0, m.width, m.height);
    mk.drawImage(tint, 0, 0, m.width * kx * (read?.canvas.width || 1) / m.width, m.height * kx * (read?.canvas.height || 1) / m.height);
    mk.restore();
  }
  /** 染好的那一张：只在图、选择或遮罩变了时重新染（逐像素染色不便宜），动画的每一帧只是把它贴上去。 */
  let tinted = /** @type {{ key: string, read: any, canvas: HTMLCanvasElement, ok: boolean } | null} */ (null);
  /** 颜色预览按图片在框里的摆放画。 */
  function paintTintFit(/** @type {HTMLImageElement} */ img, /** @type {any} */ m, /** @type {number} */ dpr) {
    const masks = /** @type {Map<string, HTMLCanvasElement | null>} */ (read?.masks || new Map());
    const key = [img.currentSrc || img.src, img.naturalWidth, JSON.stringify(ctx.S.picks), [...masks].map(([k, v]) => k + (v ? '+' : '-')).join(',')].join('|');
    if (!tinted || tinted.key !== key || tinted.read !== read) {
      const full = document.createElement('canvas');
      full.width = read?.canvas.width || 1; full.height = read?.canvas.height || 1;
      tinted = { key, read, canvas: full, ok: paintTint(full, img, ctx.S.picks, masks) };
    }
    const tx = /** @type {CanvasRenderingContext2D} */ (ctx.tintC.getContext('2d'));
    tx.clearRect(0, 0, ctx.tintC.width, ctx.tintC.height);
    if (!tinted.ok) return false;
    tx.drawImage(tinted.canvas, m.ox * dpr, m.oy * dpr, img.naturalWidth * m.s * dpr, img.naturalHeight * m.s * dpr);
    return true;
  }
  function loop() {
    cancelAnimationFrame(raf);
    const step = () => { if (!open) return; paintOverlay(); raf = requestAnimationFrame(step); };
    // 只有选中了形状类部位时才需要动画（虚线流动）；其余静态画一次就好
    if (active && active !== 'paint' && regionOf(active) !== 'hair') raf = requestAnimationFrame(step); else paintOverlay();
  }

  // ── 点图选部位 ──
  function onTap(/** @type {MouseEvent} */ e) {
    if (!open || active === 'paint') return;
    if (!read?.face) { if (!reading) toast('这张图里没认出正脸，用「圈选」自己涂出要改的地方吧', { action: { label: '圈选', run: () => setActive('paint') } }); return; }
    const r = ctx.frameBox.getBoundingClientRect(), m = map(), img = ctx.shownImage();
    const k = read.canvas.width / img.naturalWidth;
    const x = (e.clientX - r.left - m.ox) / m.s * k, y = (e.clientY - r.top - m.oy) / m.s * k;
    const part = partAt(read.face, x, y);
    if (part) { setActive(part); toast('选中了「' + partById(part)?.label + '」，下面挑个样子'); }
    else toast('这里不是脸上的部位，可以用「圈选」涂出来', { action: { label: '圈选', run: () => setActive('paint') } });
  }

  // ── 面板内容 ──
  function setActive(/** @type {string} */ id) {
    active = active === id && id !== 'paint' ? '' : id;
    brush.enable(active === 'paint');
    ctx.frame.dataset.mode = active === 'paint' ? 'paint' : 'parts';
    paint(); loop();
    if (active && active !== 'paint') maskFor(active).then(() => open && paintOverlay());
  }
  function paintHint() {
    if (active === 'paint') hint.textContent = '用手指在图上涂出要改的地方，再说一句要改成什么';
    else if (!read && reading) hint.textContent = '正在认脸…（在你手机上，不上传）';
    else if (read && !read.face) hint.textContent = '这张图里没认出正脸（太夸张的画风会这样）：用「圈选」涂出要改的地方';
    else if (!active) hint.textContent = ctx.S.picks.length ? '可以继续加别的部位，挑好了点下面的按钮' : '点一下脸上想改的地方，或者从下面选个部位';
    else hint.textContent = partById(active)?.hint || '';
  }
  function paint() {
    paintHint();
    const picks = ctx.S.picks;
    pills.replaceChildren(...PARTS.map(p => h('button.pp__part', { type: 'button', role: 'tab', 'aria-selected': String(active === p.id), data: { has: String(picks.some((/** @type {any} */ k) => k.part === p.id)) }, onclick: () => setActive(p.id) }, p.label)),
      h('button.pp__part.pp__part--paint', { type: 'button', role: 'tab', 'aria-selected': String(active === 'paint'), onclick: () => setActive('paint') }, h('span', { html: icon('brush') }), '圈选'));
    if (scrolledTo !== active) { scrolledTo = active; requestAnimationFrame(() => pills.querySelector('[aria-selected="true"]')?.scrollIntoView({ inline: 'center', block: 'nearest' })); }
    opts.replaceChildren(); extra.replaceChildren();
    if (active === 'paint') paintBrushTools();
    else if (active) {
      const p = /** @type {import('../parts.js').Part} */ (partById(active)), mine = picks.find((/** @type {any} */ k) => k.part === active);
      opts.append(h('div.pp__optrow' + (p.kind === 'swatch' ? '.is-swatch' : ''), { role: 'group', 'aria-label': p.label },
        ...p.options.map(o => h('button.pp__opt', { type: 'button', 'aria-pressed': String(mine?.option === o.id), onclick: () => choose(o.id) },
          o.hex ? h('i.pp__sw', { style: { background: o.hex } }) : null, h('span', null, o.label)))));
      if (p.tune) {
        const now = mine?.tune ?? p.tune.start;
        extra.append(h('div.opt.opt--tight', null, h('span.opt__name', null, p.tune.label),
          h('div.seg.seg--sm', { role: 'radiogroup', 'aria-label': p.tune.label }, ...p.tune.steps.map((s, i) => h('button.seg__opt', { type: 'button', role: 'radio', 'aria-checked': String(i === now), disabled: !mine, onclick: () => tuneTo(i) }, s.label)))));
      }
      if (mine) {
        const say = /** @type {HTMLInputElement} */ (h('input.pp__say', { type: 'text', maxlength: 80, placeholder: '还想怎样？比如：再自然一点（可不填）', 'aria-label': '补一句', enterkeyhint: 'done', value: mine.say || '' }));
        say.addEventListener('change', () => { const v = say.value.trim(); if (v !== (mine.say || '')) ctx.setPicks(picks.map((/** @type {any} */ k) => (k.part === active ? { ...k, say: v } : k)), labelOf(mine) + ' · 补一句'); });
        say.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); say.blur(); } });
        extra.append(say);
      }
    }
    picked.replaceChildren(...(picks.length ? [h('span.pp__pickedname', null, '已选')] : []), ...picks.map((/** @type {any} */ k) => h('button.pp__tok', { type: 'button', 'aria-label': '去掉 ' + labelOf(k), onclick: () => { ctx.setPicks(picks.filter((/** @type {any} */ x) => x.part !== k.part), '去掉「' + labelOf(k) + '」'); paint(); loop(); } },
      h('span', null, labelOf(k)), h('span', { html: icon('close') }))));
    refRow.replaceChildren(ref
      ? h('div.pp__refon', null, h('img', { src: ref.url, alt: '参考图' }), h('span', null, '照着这张的发型、妆容改（不借脸）'), h('button.ibtn', { type: 'button', 'aria-label': '去掉参考图', html: icon('close'), onclick: () => { URL.revokeObjectURL(ref?.url || ''); ref = null; paint(); } }))
      : h('button.pp__refadd', { type: 'button', onclick: () => addRef() }, h('span', { html: icon('image') }), '照着参考图改（可选）'));
    paintFoot();
  }
  function paintBrushTools() {
    const sizes = [['细', .035], ['中', .06], ['粗', .1]];
    const say = /** @type {HTMLInputElement} */ (h('input.pp__say', { type: 'text', maxlength: 120, placeholder: '涂的地方改成什么？比如：换成一束玫瑰', 'aria-label': '这里改成什么', enterkeyhint: 'done', value: paintWords }));
    say.addEventListener('input', () => { paintWords = say.value; paintFoot(); });
    say.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); say.blur(); } });
    opts.append(h('div.pp__brush', null,
      h('div.seg.seg--sm', { role: 'radiogroup', 'aria-label': '笔刷大小' }, ...sizes.map(([label, v]) => h('button.seg__opt', { type: 'button', role: 'radio', 'aria-checked': String(Math.abs(/** @type {number} */ (v) - (/** @type {any} */ (brush)).size) < .001 || (label === '中' && !(/** @type {any} */ (brush)).size)), onclick: (/** @type {Event} */ e) => { brush.setSize(/** @type {number} */ (v)); (/** @type {any} */ (brush)).size = v; /** @type {HTMLElement} */ (e.currentTarget).parentElement?.querySelectorAll('button').forEach(b => b.setAttribute('aria-checked', String(b === e.currentTarget))); } }, label))),
      h('button.pp__tool', { type: 'button', 'aria-pressed': String(brush.erase), onclick: (/** @type {Event} */ e) => { brush.setErase(!brush.erase); /** @type {HTMLElement} */ (e.currentTarget).setAttribute('aria-pressed', String(brush.erase)); } }, h('span', { html: icon('eraser') }), '擦除'),
      h('button.pp__tool', { type: 'button', onclick: () => brush.undo() }, h('span', { html: icon('undo') }), '撤一笔'),
      h('button.pp__tool', { type: 'button', onclick: () => brush.clear() }, h('span', { html: icon('trash') }), '清空')));
    extra.append(say);
  }
  function choose(/** @type {string} */ option) {
    const k = { part: active, option };
    const had = ctx.S.picks.find((/** @type {any} */ x) => x.part === active && x.option === option);
    const next = togglePick(ctx.S.picks, k);
    const now = next.find(x => x.part === active);
    ctx.setPicks(next, had ? '去掉「' + labelOf(had) + '」' : labelOf(/** @type {any} */ (now)));
    maskFor(active).then(() => { paint(); loop(); });
  }
  function tuneTo(/** @type {number} */ i) {
    const picks = ctx.S.picks.map((/** @type {any} */ k) => (k.part === active ? { ...k, tune: i } : k));
    const now = picks.find((/** @type {any} */ k) => k.part === active);
    ctx.setPicks(picks, labelOf(now));
    paint(); loop();
  }
  async function addRef() {
    const f = await chooseFile(); if (!f) return;
    try { const { blob } = await prepare(f, 1024); ref = { blob, url: URL.createObjectURL(blob) }; paint(); toast('加好参考图了：会照着它的发型 / 妆容改'); }
    catch { toast('这张图打不开，换一张试试'); }
  }
  function paintFoot() {
    const picks = ctx.S.picks, w = ctx.shownWork(), busy = !!w && w.state === 'working';
    const label = /** @type {HTMLElement} */ (cta.querySelector('.cta__label')), sub = /** @type {HTMLElement} */ (cta.querySelector('.cta__sub'));
    if (active === 'paint') {
      cta.toggleAttribute('disabled', brush.empty);
      label.textContent = brush.empty ? '先涂出要改的地方' : '改这一块';
      sub.textContent = (paintWords.trim() ? '「' + paintWords.trim().slice(0, 14) + '」 · ' : '') + etaText();
    } else {
      cta.toggleAttribute('disabled', !picks.length);
      label.textContent = picks.length ? `精修这 ${picks.length} 处` : '先选一处要改的';
      sub.textContent = picks.length ? '其余地方一个像素都不动 · ' + etaText() : (w ? '在「当前这一版」上改' : '在原图上改');
    }
    if (busy) sub.textContent = '上一张还在出，也可以先挑下一处';
  }

  // ── 出片 ──
  async function apply() {
    const w = ctx.shownWork(), styled = !!w && w.state === 'done';
    const img = ctx.shownImage();
    if (active === 'paint') {
      if (brush.empty) return;
      const blob = await brush.mask(img.naturalWidth, img.naturalHeight, map());
      const words = paintWords.trim();
      const text = [
        'Change only the painted area' + (words ? ': ' + words : ', improving it so it fits the picture') + '.',
        'Keep everything outside it exactly as it is: the same person, face, pose, clothes, light and background.',
        styled ? "Match the picture's existing art style, palette and lighting exactly, so the change looks painted in." : 'Keep it a natural, photorealistic photo.',
      ].join(' ');
      cta.setAttribute('disabled', '');
      const made = await ctx.ask({ op: 'region', pins: [{ note: words || 'improve this area', mask: blob }], text, parts: ['圈选' + (words ? '：' + words : '')], label: '圈选改图' + (words ? '：' + words : ''), ...(ref ? { refs: [{ blob: ref.blob, role: 'look', label: '参考图' }] } : {}) });
      if (made) { brush.clear(); paintWords = ''; paint(); }
      return;
    }
    const picks = ctx.S.picks;
    if (!picks.length) return;
    await readImage();
    if (!read?.face) { toast('没认出正脸，改不了部位；用「圈选」涂出来也行', { action: { label: '圈选', run: () => setActive('paint') } }); return; }
    cta.setAttribute('disabled', '');
    const pins = [];
    for (const k of picks) {
      const m = await maskFor(k.part);
      if (!m) { toast('「' + partById(k.part)?.label + '」这块没认清，先跳过它'); continue; }
      pins.push({ note: noteOf(k), mask: await toBlob(m) });
    }
    if (!pins.length) { paintFoot(); return; }
    const labels = picks.map((/** @type {any} */ k) => labelOf(k));
    const text = regionText(picks, { styled }) + (ref ? ' Take the look of those parts (cut, colour, make-up) from the reference picture, never its face or person.' : '');
    await ctx.ask({ op: 'region', pins, text, parts: labels, label: '部位精修：' + labels.join('、'), ...(ref ? { refs: [{ blob: ref.blob, role: 'look', label: '参考图' }] } : {}) });
    active = ''; paint(); loop();
  }

  return {
    body, foot,
    shown() {
      open = true;
      ctx.frame.dataset.mode = active === 'paint' ? 'paint' : 'parts';
      ctx.frameBox.addEventListener('click', onTap);
      brush.enable(active === 'paint');
      paint();
      readImage().then(() => { paint(); loop(); });
      loop();
    },
    hidden() {
      open = false; cancelAnimationFrame(raf);
      delete ctx.frame.dataset.mode;
      ctx.frameBox.removeEventListener('click', onTap);
      brush.enable(false);
      paintOverlay();
    },
    repaint() { if (!open) return; paint(); readImage().then(() => { paint(); loop(); }); },
    paintCta() { if (open) paintFoot(); },
    fit() { brush.fit(); },
    overlay() { if (open) paintOverlay(); },
  };
}
