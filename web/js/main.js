/**
 * 哈基秀：启动顺序
 *   1. 同时：问工作室是谁（和你的账号）、读资产清单、打开本地存储
 *   2. 读回你的私人空间（作品、草稿、偏好），套上上次的风格主题
 *   3. 按地址打开页面（刷新后回到原地）；第一次来先看 3 秒引导
 *   4. 接上页面关闭时还没生成完的作品
 */
import { connect, studio } from './core/api.js';
import { loadManifest } from './core/assets.js';
import { ready } from './core/db.js';
import { boot, pref, setPref, addSource, sources } from './core/data.js';
import { define, start, go, setRootPref } from './core/nav.js';
import { emit } from './core/bus.js';
import { applyTheme } from './core/theme.js';
import { resumeAll, create } from './core/generate.js';
import { personArt } from './core/assets.js';
import { presetById, defaultsOf } from './presets.js';
import { liveScreen } from './screens/live.js';
import { studioScreen } from './screens/studio.js';
import { resultScreen } from './screens/result.js';
import { galleryScreen } from './screens/gallery.js';
import { workScreen } from './screens/work.js';
import { meScreen } from './screens/me.js';
import { onboard } from './screens/onboard.js';
import { watchKeyboard } from './core/keyboard.js';

// 页面要走了（刷新、跳到别处）：还没下载完的东西（例如认脸模型）会被浏览器取消，Safari 会把这报成一个错误。
// 这时候的错误不是错误，不往控制台报；三秒后还没走（例如只是唤起了别的 App），恢复正常。
let leaving = false;
const leave = () => { leaving = true; setTimeout(() => { leaving = false; }, 3000); };
addEventListener('pagehide', leave);
addEventListener('beforeunload', leave);
addEventListener('pageshow', () => { leaving = false; });
addEventListener('unhandledrejection', e => { if (leaving) e.preventDefault(); });
addEventListener('error', e => { if (leaving) e.preventDefault(); });
// 认脸模型下载到一半页面走了：Safari 掐断下载后，模型加载器会换一种方式再下一次，而页面卸载时这一下必然被拦下，
// 还会在控制台留下一条错误。所以页面在走的时候，模型文件的下载失败就停在那儿（不报错、不重试），反正这一页马上就没了。
{
  const realFetch = window.fetch.bind(window);
  const hang = () => new Promise(() => {});
  window.fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (!url.includes('/vendor/mediapipe/')) return realFetch(input, init);
    let res;
    try { res = await realFetch(input, init); } catch (err) { if (leaving) return hang(); throw err; }
    if (!res.body) return res;
    const reader = res.body.getReader();
    return new Response(new ReadableStream({
      async pull(ctrl) {
        try { const { done, value } = await reader.read(); if (done) ctrl.close(); else ctrl.enqueue(value); }
        catch (err) { if (leaving) return hang(); ctrl.error(err); }
      },
      cancel: reason => reader.cancel(reason),
    }), { status: res.status, statusText: res.statusText, headers: res.headers });
  };
}

await Promise.all([connect(), loadManifest(), ready()]);
await boot();
const stage = /** @type {HTMLElement} */ (document.getElementById('stage'));
watchKeyboard(stage);
applyTheme(pref('preset', 'princess'));

define('live', liveScreen);
define('studio', studioScreen);
define('result', resultScreen);
define('gallery', galleryScreen);
define('work', workScreen);
define('me', meScreen);
setRootPref(pref('root', 'live'));
addEventListener('hashchange', () => { const r = location.hash.replace(/^#\/?/, '').split('/')[0]; if (r === 'live' || r === 'studio') setPref('root', r); });

const first = !pref('onboarded', false) && !new URLSearchParams(location.search).has('skipintro');
start(first ? 'live' : pref('root', 'live'));
if (first) {
  onboard({
    onShoot: () => { setPref('camAsked', true); go('live', {}, { replace: true }); emit('cam:start'); },
    onSample: async () => {
      // 一键试玩范例：用示例人物 Mei + 当前风格直接出一张
      const id = pref('preset', 'princess');
      const have = sources().find(s => s.sample === 'mei');
      const src = have || await addSource(await fetch(personArt('mei')).then(r => r.blob()), { sample: 'mei' });
      const p = /** @type {any} */ (presetById(id));
      const w = await create({ source: src.id, preset: id, params: defaultsOf(p), format: 'portrait', mode: 'live', why: '示例试玩 · ' + p.name });
      go('result', { id: w.id });
    },
    onSkip: () => {},
  });
}
resumeAll().catch(() => {});

/** 静态资源缓存（第二次打开秒开）。 */
if ('serviceWorker' in navigator && location.protocol !== 'file:' && !navigator.webdriver) navigator.serviceWorker.register('sw.js').catch(() => {});

Object.assign(window, { hajixiu: { studio, go } });
