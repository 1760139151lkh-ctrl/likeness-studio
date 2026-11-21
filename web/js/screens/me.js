/**
 * 我的：账号与私人空间。访客也能用（作品存在这台设备并同步到访客空间），注册时访客账号原地升级，
 * 登录已有账号时访客的作品整体归过去。还有画质设置、重看新手引导、隐私说明。
 */
import { h, icon, toast, chooseFile } from '../core/dom.js';
import { go } from '../core/nav.js';
import { on } from '../core/bus.js';
import { studio, signup, login, logout, rename, me as fetchMe } from '../core/api.js';
import { works, favs, pref, setPref, resultUrl, switchAccount, sync, exportBackup, importBackup } from '../core/data.js';
import { download } from '../core/image.js';
import { persisted, durable } from '../core/db.js';
import { topBar } from '../ui/parts.js';
import { sheet, focusSoon } from '../ui/sheet.js';
import { T } from '../copy.js';

export function meScreen() {
  const body = h('div.me__scroll');
  const el = h('section.screen.me', { 'aria-label': T.me }, topBar(T.me), body);

  async function paint() {
    const a = studio.account;
    const member = a?.kind === 'member';
    const all = works(), done = all.filter(w => w.state === 'done');
    const face = h('span.me__face', { html: icon('user') });
    if (done[0]) resultUrl(done[0]).then(u => { if (u) face.replaceChildren(h('img', { src: u, alt: '' })); });
    const safe = await persisted();
    const card = h('div.me__card', null, face,
      h('div.me__who', null,
        h('b.me__name', null, member ? (a.nickname || a.handle) : T.guest),
        h('span.me__handle', null, member ? '@' + a.handle : studio.live ? '访客空间' : '本机演示版'),
        h('p.me__line', null, !studio.live ? T.offlineAccount : member ? T.memberLine : T.guestLine)));
    const authActs = !studio.live ? null : member
      ? h('div.me__acts', null, h('button.btn.btn--ghost', { type: 'button', onclick: () => renameBox() }, '改昵称'), h('button.btn.btn--ghost', { type: 'button', onclick: () => doLogout() }, h('span', { html: icon('logout') }), T.signOut))
      : h('div.me__acts', null, h('button.btn.btn--main', { type: 'button', onclick: () => authBox('signup') }, T.signUp), h('button.btn.btn--ghost', { type: 'button', onclick: () => authBox('login') }, T.signIn));
    const stats = h('ul.me__stats', null,
      stat(all.length, '作品', () => go('gallery')), stat(favs().length, '收藏风格', () => { sessionStorage.setItem('hjx.galleryTab', 'favs'); go('gallery'); }),
      stat(all.reduce((n, w) => n + (w.trail?.length || 0), 0), '创作记录', () => go('gallery')));
    const paceNow = pref('pace', 'fine');
    const paceSeg = h('div.seg.seg--sm', { role: 'radiogroup', 'aria-label': '画质' }, ...['quick', 'fine', 'deep'].map(k => h('button.seg__opt', { type: 'button', role: 'radio', 'aria-checked': String(k === paceNow), onclick: () => { setPref('pace', k); toast(T.pace[/** @type {'fine'} */ (k)] + ' · ' + T.paceLine[/** @type {'fine'} */ (k)]); paint(); } }, T.pace[/** @type {'fine'} */ (k)])));
    const taste = String(pref('taste', '') || '');
    const rows = h('div.me__rows', null,
      studio.live ? row('bolt', '出片画质', paceSeg) : null,
      h('button.me__row', { type: 'button', onclick: () => tasteBox() }, h('span.me__rowico', { html: icon('heart') }), h('span.me__rowname', null, '我的口味'), h('span.me__val', null, taste || '没设置'), h('span', { html: icon('chevron') })),
      row('file', '备份', h('span.me__pair', null,
        h('button.btn.btn--ghost.btn--sm', { type: 'button', onclick: () => backupNow() }, '导出'),
        h('button.btn.btn--ghost.btn--sm', { type: 'button', onclick: () => restore() }, '导入'))),
      row('shield', '存储', h('span.me__note', null, !durable ? '这个浏览器不允许本地存储（隐私模式？），关掉页面作品会丢' : safe ? '已开启持久存储，浏览器不会清理' : studio.live ? '本机 + 私人空间同步' : '只存在这台设备')),
      h('button.me__row', { type: 'button', onclick: () => { setPref('onboarded', false); go('live'); location.reload(); } }, h('span.me__rowico', { html: icon('sparkle') }), h('span.me__rowname', null, '重看新手引导'), h('span', { html: icon('chevron') })),
      h('button.me__row', { type: 'button', onclick: () => privacy() }, h('span.me__rowico', { html: icon('lock') }), h('span.me__rowname', null, '隐私说明'), h('span', { html: icon('chevron') })));
    body.replaceChildren(card, authActs, stats, rows, h('p.me__foot', null, T.brand + ' · ' + T.slogan));
  }
  const stat = (/** @type {number} */ n, /** @type {string} */ label, /** @type {() => void} */ run) => h('li', null, h('button', { type: 'button', onclick: run }, h('b', null, String(n)), h('span', null, label)));
  const row = (/** @type {any} */ ic, /** @type {string} */ name, /** @type {any} */ right) => h('div.me__row', null, h('span.me__rowico', { html: icon(ic) }), h('span.me__rowname', null, name), right);

  /** 注册 / 登录。表单放在屏幕上方的卡片里，软键盘弹出也不挡输入框。 */
  function authBox(/** @type {'signup' | 'login'} */ mode) {
    const handle = /** @type {HTMLInputElement} */ (h('input.field__input', { type: 'text', autocomplete: 'username', autocapitalize: 'none', spellcheck: 'false', maxlength: 20, placeholder: T.handleHint, enterkeyhint: 'next' }));
    const pw = /** @type {HTMLInputElement} */ (h('input.field__input', { type: 'password', autocomplete: mode === 'signup' ? 'new-password' : 'current-password', maxlength: 64, placeholder: T.pwHint, enterkeyhint: mode === 'signup' ? 'next' : 'go' }));
    const nick = /** @type {HTMLInputElement} */ (h('input.field__input', { type: 'text', maxlength: 24, placeholder: '大家怎么称呼你（可不填）', enterkeyhint: 'go' }));
    const err = h('p.field__err', { role: 'alert' });
    const submit = h('button.btn.btn--main.btn--wide', { type: 'submit' }, mode === 'signup' ? T.signUp : T.signIn);
    const form = h('form.auth', { onsubmit: async (/** @type {Event} */ e) => {
      e.preventDefault(); err.textContent = ''; submit.setAttribute('disabled', '');
      try {
        await sync().catch(() => {});   // 访客的作品先送到服务器，登录时才能整体归过去
        if (mode === 'signup') {
          const r = await signup({ handle: handle.value, password: pw.value, nickname: nick.value });
          await switchAccount(r.account, { keepLocal: true });
          toast(T.joined, { tone: 'ok' });
        } else {
          const r = await login({ handle: handle.value, password: pw.value });
          await switchAccount(r.account, { keepLocal: true });
          toast(r.moved ? T.merged(r.moved) : T.welcomeBack, { tone: 'ok' });
        }
        close(); paint();
      } catch (x) { err.textContent = /** @type {any} */ (x)?.message || '没成功，再试一次'; }
      finally { submit.removeAttribute('disabled'); }
    } },
    h('label.field', null, h('span.field__name', null, T.handle), handle),
    h('label.field', null, h('span.field__name', null, T.password), pw),
    mode === 'signup' ? h('label.field', null, h('span.field__name', null, T.nickname), nick) : null,
    err, submit,
    h('p.auth__note', null, mode === 'signup' ? '注册后，你现在的作品和记录会直接归到新账号里。' : '登录后，这台设备上的访客作品会自动归到你的账号。'),
    h('button.auth__switch', { type: 'button', onclick: () => { close(); setTimeout(() => authBox(mode === 'signup' ? 'login' : 'signup'), 280); } }, mode === 'signup' ? '已有账号？去登录' : '还没账号？注册一个'));
    const { close } = sheet(() => [form], { title: mode === 'signup' ? '注册哈基秀' : '登录哈基秀', cls: 'sheet--top' });
    focusSoon(handle);
  }
  /** 我的口味：每次出片都会带上的长期偏好（旧版 Rooms 的 taste note）。 */
  function tasteBox() {
    const field = /** @type {HTMLTextAreaElement} */ (h('textarea.say__field', { rows: 3, maxlength: 200, placeholder: '比如：保留我的痣和雀斑、皮肤别磨太白、不要露肩、头巾保持原样', 'aria-label': '我的口味', enterkeyhint: 'done' }));
    field.value = String(pref('taste', '') || '');
    const { close } = sheet(c => [
      h('p.sheet__text', null, '每一次出片都会记着这几句（除非你那次另外说了）。'),
      field,
      h('div.sheet__acts', null,
        h('button.btn.btn--ghost', { type: 'button', onclick: () => { setPref('taste', ''); c(); paint(); toast('已清空我的口味'); } }, '清空'),
        h('button.btn.btn--main', { type: 'button', onclick: () => { setPref('taste', field.value.trim().slice(0, 200)); c(); paint(); toast('记住了，之后每张都会照着来', { tone: 'ok' }); } }, '记住'))], { title: '我的口味', cls: 'sheet--top' });
    void close;
    focusSoon(field);
  }
  /** 备份：整个私人空间打包成一个文件（作品、原图、收藏、草稿、偏好、自创风格）。 */
  async function backupNow() {
    toast('正在打包…');
    try {
      const blob = await exportBackup();
      const url = URL.createObjectURL(blob);
      download(url, 'hajixiu-backup-' + new Date().toISOString().slice(0, 10) + '.json');
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      toast('备份好了：' + Math.max(1, Math.round(blob.size / 1024 / 1024)) + ' MB，换手机时导入就能找回', { tone: 'ok', ms: 3600 });
    } catch (e) { toast(/** @type {any} */ (e)?.message || '备份没成功，再试一次'); }
  }
  async function restore() {
    const f = await chooseFile({ accept: 'application/json,.json' });
    if (!f) return;
    try { const n = await importBackup(f); toast(n ? '找回了 ' + n + ' 条记录' : '都已经在了，没有要补的', { tone: 'ok' }); paint(); }
    catch (e) { toast(/** @type {any} */ (e)?.message || '这个文件读不出来'); }
  }
  function renameBox() {
    const field = /** @type {HTMLInputElement} */ (h('input.field__input', { type: 'text', maxlength: 24, value: studio.account?.nickname || '', enterkeyhint: 'done' }));
    const { close } = sheet(c => [h('label.field', null, h('span.field__name', null, T.nickname), field), h('div.sheet__acts', null, h('button.btn.btn--main', { type: 'button', onclick: async () => {
      try { const r = await rename(field.value); studio.account = r.account; c(); paint(); toast('改好了'); } catch (e) { toast(/** @type {any} */ (e)?.message || '没改成'); }
    } }, T.done))], { title: '改昵称', cls: 'sheet--top' });
    void close;
    focusSoon(field);
  }
  async function doLogout() {
    await sync().catch(() => {});
    await logout().catch(() => {});
    const r = await fetchMe().catch(() => null);   // 新的访客会话
    await switchAccount(r?.account || null);
    toast('已退出，作品都安全地留在你的账号里');
    paint();
  }
  function privacy() {
    sheet(() => [h('div.prose', null,
      h('p', null, '📷 实时变身的镜头画面和人脸追踪都在你的手机上完成，不会上传。'),
      h('p', null, '🖼️ 只有你按下快门或点「一键变身」的那张照片，会传到你自己的私人空间用来生成，别的账号看不到。'),
      h('p', null, '🔒 每个账号（包括访客）都有独立的私人空间：作品、原图、收藏和创作轨迹互相隔离。'),
      h('p', null, '🗑️ 在作品详情里可以随时删除作品。'))], { title: '隐私说明' });
  }
  const offs = [on('account', () => { if (el.isConnected) paint(); }), on('works', () => { if (el.isConnected) paint(); })];
  return { el, shown: () => paint(), hidden: () => offs.forEach(f => f()) };
}
