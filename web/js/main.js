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
