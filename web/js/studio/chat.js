/**
 * 对话微调：像跟修图师聊天一样，一句一句地改。每一句都在「画面上这一版」的基础上改，改出来就是新的一版；
 * 工作室会回一句话，再给三个「接着改」的点子。整条对话就是这张照片的创作链：点任何一张缩略图，就回到那一版接着改。
 *
 *   输入框  贴着键盘上沿（页面不被挤、不被顶上去），回车发送，最长四行
 *   参考图  「照着这张改」：借造型 / 借画风 / 当背景 / 加进来
 *   快捷    多来几张、多角度、换背景、去杂物
 *
 * 继承旧版 Desk 的对话、回复与建议、参考图角色，旧版 Mirror 的「Every angle」「Variations」。
 */
import { h, icon, toast, chooseFile, reduced } from '../core/dom.js';
import { chainOf, resultUrl, draft, saveDraft } from '../core/data.js';
import { isRunning, retry, watch } from '../core/generate.js';
import { prepare } from '../core/image.js';
import { etaText, opLabel } from '../ui/parts.js';
import { presetById } from '../presets.js';

/** @typedef {import('../core/data.js').Work} Work */
const ROLES = /** @type {const} */ ([['look', '借造型'], ['style', '借画风'], ['backdrop', '当背景'], ['with', '加进来']]);
const STARTERS = ['背景换成海边日落', '加点闪闪发光的星星', '换成灿烂的笑容', '衣服换成白色西装', '头发再长一点', '整体再梦幻一点', '加一只小猫在肩上', '换成夜景霓虹'];

export function chatPanel(/** @type {any} */ ctx) {
  /** @type {{ blob: Blob, url: string, role: string } | null} */ let ref = null;
  let open = false, unwatch = () => {};
  const thread = h('div.chat__thread', { role: 'log', 'aria-label': '对话记录' });
  const qbtn = (/** @type {string} */ label, /** @type {string} */ ico, /** @type {() => void} */ run) => h('button.chat__q', { type: 'button', onclick: run }, h('span', { html: icon(/** @type {any} */ (ico)) }), h('span', null, label));
  const quick = h('div.chat__quick', { role: 'group', 'aria-label': '快捷' },
    qbtn('多来几张', 'layers', () => vary()), qbtn('多角度', 'rotate', () => angles()),
    qbtn('换背景', 'image', () => fill('背景换成')), qbtn('去杂物', 'eraser', () => fill('把背景里的路人和杂物都去掉')));
  const ideas = h('div.chat__ideas', { role: 'group', 'aria-label': '接着改' });
  const field = /** @type {HTMLTextAreaElement} */ (h('textarea.chat__field', { rows: 1, maxlength: 400, placeholder: '想怎么改？直接说', 'aria-label': '想怎么改', enterkeyhint: 'send' }));
  const attach = h('button.chat__attach', { type: 'button', 'aria-label': '加参考图', title: '加参考图', html: icon('image'), onclick: () => addRef() });
  const send = h('button.chat__send', { type: 'button', 'aria-label': '发送', title: '发送', html: icon('send'), onclick: () => submit() });
  const refBar = h('div.chat__ref', { hidden: true });
  const hint = h('p.chat__hint');
  const composer = h('div.chat__composer', null, refBar, ideas, h('div.chat__row', null, attach, field, send), hint);
  const body = h('div.tp.tp--split.chat', null, thread, quick);

  field.value = draft('chat')?.text || '';
  const grow = () => { field.style.height = 'auto'; field.style.height = Math.min(field.scrollHeight, 4 * 24 + 18) + 'px'; };
  field.addEventListener('input', () => { grow(); paintSend(); saveDraft('chat', { text: field.value }); });
  field.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); submit(); } });

  function paintSend() {
    const ok = !!field.value.trim();
    send.toggleAttribute('disabled', !ok);
    send.classList.toggle('is-ready', ok);
    const w = ctx.shownWork();
    hint.textContent = (w && w.state === 'done' ? '在「' + opLabel(w) + '」这一版上改' : w ? '在它的上一版上改' : '在原图上改') + ' · ' + etaText();
  }
  function fill(/** @type {string} */ text) {
    field.value = text; grow(); paintSend(); saveDraft('chat', { text });
    send.classList.remove('is-pulse'); void send.offsetWidth; send.classList.add('is-pulse');
    if (text.endsWith('换成')) { field.focus({ preventScroll: true }); field.setSelectionRange(text.length, text.length); }
  }

  // ── 对话记录：每一版 = 你说的一句 + 工作室的回答（缩略图 + 一句话）──
  function paintThread() {
    const src = ctx.sourceObj(); if (!src) { thread.replaceChildren(); return; }
    /** @type {Work[][]} */ const groups = [];
    for (const w of chainOf(src.id).slice(-36)) {
      const last = groups.at(-1);
      if (w.batch && last && last[0].batch === w.batch) last.push(w); else groups.push([w]);
    }
    const kids = [h('div.msg.msg--sys', null, '这张照片的每一次改动都在这里，点缩略图回到那一版接着改')];
    for (const g of groups) {
      const w = g[0];
      kids.push(h('div.msg.msg--me', null, h('p', null, saidOf(w))));
      const thumbs = g.map(x => {
        const busy = x.state === 'working' || isRunning(x.id);
        const b = h('button.msg__thumb', { type: 'button', 'aria-pressed': String(x.id === ctx.S.shown), data: { state: busy ? 'working' : x.state }, 'aria-label': '看这一版',
          // 点别的版本：换过去；点的就是正在看的这版：收起面板，整张大图看
          onclick: () => (x.id === ctx.S.shown ? ctx.closePanel() : ctx.showVersion(x.id)) }, h('img', { alt: '' }));
        if (x.state === 'done') resultUrl(x).then(u => { /** @type {HTMLImageElement} */ (b.querySelector('img')).src = u; });
        return b;
      });
      const busy = g.some(x => x.state === 'working' || isRunning(x.id)), failed = g.every(x => x.state === 'failed' || x.state === 'stopped');
      const words = busy ? (g.length > 1 ? `正在出 ${g.length} 张…` : '收到，正在改…') : failed ? (w.error || '这次没成功') : (w.reply || '改好啦，看看喜不喜欢');
      kids.push(h('div.msg.msg--ai' + (failed ? '.is-failed' : ''), null,
        h('div.msg__thumbs', { data: { n: String(g.length) } }, ...thumbs),
        h('p', null, words),
        failed ? h('button.btn.btn--ghost.btn--sm', { type: 'button', onclick: () => { for (const x of g) retry(x); paintThread(); } }, h('span', { html: icon('refresh') }), '重试') : null));
    }
    thread.replaceChildren(...kids);
    requestAnimationFrame(() => { thread.scrollTop = thread.scrollHeight; });
    paintIdeas();
  }
  /** 那一版是怎么来的，用「你说的话」写出来。 */
  function saidOf(/** @type {Work} */ w) {
    if (w.say) return w.say;
    if (w.op === 'region') return '精修：' + (w.parts || []).join('、');
    if (w.op === 'vary') return '多来几张';
    if (w.op === 'angles') return '换几个角度看看';
    return '一键变身「' + (presetById(w.preset)?.name || '') + '」';
  }
  function paintIdeas() {
    const src = ctx.sourceObj();
    const lastDone = src ? chainOf(src.id).filter(w => w.state === 'done' && w.ideas?.length).at(-1) : null;
    const list = lastDone?.ideas?.length ? lastDone.ideas : pickStarters();
    ideas.replaceChildren(h('span.chat__ideaslabel', null, lastDone?.ideas?.length ? '接着改' : '试试'), ...list.slice(0, 3).map(t => h('button.chip2.chip2--idea', { type: 'button', onclick: () => fill(t) }, t)));
  }
  let starters = /** @type {string[]} */ ([]);
  function pickStarters() {
    if (!starters.length) starters = [...STARTERS].sort(() => Math.random() - .5).slice(0, 3);
    return starters;
  }

  // ── 参考图 ──
  async function addRef() {
    const f = await chooseFile(); if (!f) return;
    try {
      const { blob } = await prepare(f, 1024);
      if (ref) URL.revokeObjectURL(ref.url);
      ref = { blob, url: URL.createObjectURL(blob), role: 'look' };
      paintRef();
    } catch { toast('这张图打不开，换一张试试'); }
  }
  function paintRef() {
    refBar.hidden = !ref;
    if (!ref) { refBar.replaceChildren(); return; }
    const r = ref;
    refBar.replaceChildren(h('img', { src: r.url, alt: '参考图' }),
      h('div.chat__roles', { role: 'radiogroup', 'aria-label': '这张参考图用来' }, ...ROLES.map(([id, label]) => h('button.chip2', { type: 'button', role: 'radio', 'aria-checked': String(r.role === id), onclick: () => { r.role = id; paintRef(); } }, label))),
      h('button.ibtn.chat__unref', { type: 'button', 'aria-label': '去掉参考图', html: icon('close'), onclick: () => { URL.revokeObjectURL(r.url); ref = null; paintRef(); } }));
  }

  // ── 发出去 ──
  async function submit() {
    const words = field.value.trim();
    if (!words) { field.focus({ preventScroll: true }); return; }
    const base = ctx.shownWork(), styled = !!base && base.state === 'done';
    const text = words + (styled ? '\n(Keep the picture\'s current art style, palette and light, unless the words ask otherwise.)' : '');
    const refs = ref ? [{ blob: ref.blob, role: ref.role, label: ROLES.find(r => r[0] === ref?.role)?.[1] || '参考图' }] : [];
    field.value = ''; grow(); saveDraft('chat', { text: '' }); paintSend();
    if (ref) { URL.revokeObjectURL(ref.url); ref = null; paintRef(); }
    field.blur();
    const w = await ctx.ask({ op: 'edit', text, say: words, label: '对话：' + (words.length > 14 ? words.slice(0, 14) + '…' : words), refs });
    if (!w) { field.value = words; grow(); paintSend(); return; }
    starters = [];
    paintThread(); follow(w);
  }
  async function vary() {
    const base = ctx.shownWork();
    if (!base || base.state !== 'done') { toast('先出一张，再来多几张'); return; }
    const w = await ctx.ask({ op: 'vary', n: 3, text: '', say: '多来几张', label: '多来几张' });
    if (w) { paintThread(); follow(w); }
  }
  async function angles() {
    const base = ctx.shownWork();
    if (!base || base.state !== 'done') { toast('先出一张，再看多角度'); return; }
    const w = await ctx.ask({ op: 'angles', n: 3, text: '', say: '换几个角度看看', label: '多角度' });
    if (w) { paintThread(); follow(w); }
  }
  /** 对话里实时显示进度（到了就换成缩略图和回复）。 */
  function follow(/** @type {Work} */ w) {
    unwatch();
    let last = '';
    unwatch = watch(w.id, (_p, ww) => { if (!open) return; if (ww.state !== last) { last = ww.state; if (ww.state !== 'working') paintThread(); } });
  }
  void reduced;

  return {
    body, foot: composer,
    shown() { open = true; paintThread(); paintRef(); paintSend(); requestAnimationFrame(grow); },
    hidden() { open = false; unwatch(); if (document.activeElement === field) field.blur(); },
    repaint() { if (open) { paintThread(); paintSend(); } },
    paintCta() { if (open) paintSend(); },
  };
}
