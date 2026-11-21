/**
 * 上线前的逐项验收（任务书第 7 节）：
 *   · 每个滑块真的改变了东西，并且刷新后还在
 *   · 切换工具（风格 · 微调 · 细节 · 部位 · 对话）零高度跳动
 *   · 软键盘弹出不把布局顶崩、输入框不被挡（两种浏览器行为都测：缩小视口 / 只缩可见区域）
 *   · 刘海和底部横条的安全区里没有可点的东西
 *   · 每个风格卡、每个细节选项、每个抽屉（关闭的四种方式）都有反应
 *   · 每个页面的每个按钮都点一遍：都有反馈，没有报错
 *   · 首屏与切页够快
 */
import { test, expect } from '@playwright/test';
import { open, useSample, camera, tool, cta, make, keyboardUp, keyboardDown } from './kit.mjs';
import { PRESETS } from '../../web/js/presets.js';

test('首屏与切页够快', async ({ page }) => {
  const t0 = Date.now();
  await page.goto('/?skipintro#/studio');
  await expect(page.locator('html')).toHaveAttribute('data-screen', 'studio');
  const first = Date.now() - t0;
  const times = [];
  for (const route of ['#/gallery', '#/me', '#/studio', '#/live']) {
    const t = Date.now();
    await page.evaluate(r => { location.hash = r; }, route);
    await expect(page.locator('html')).toHaveAttribute('data-screen', route.slice(2));
    times.push(Date.now() - t);
  }
  console.log('首屏', first, 'ms · 切页', times.join(' / '), 'ms');
  expect(first).toBeLessThan(4000);
  for (const t of times) expect(t).toBeLessThan(800);
});

test('实时变身的强度滑块真的改变画面，并记住', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', '假摄像头只在 Chromium 上可用');
  await open(page);
  await camera(page);
  await expect(page.locator('.live')).toHaveAttribute('data-cam', 'on');
  await page.waitForTimeout(1500);
  const frame = () => page.evaluate(() => {
    const c = /** @type {HTMLCanvasElement} */ (document.querySelector('.live__gl'));
    const t = document.createElement('canvas'); t.width = 48; t.height = 80;
    t.getContext('2d').drawImage(c, 0, 0, 48, 80);
    return Array.from(t.getContext('2d').getImageData(0, 0, 48, 80).data);
  });
  await page.locator('.tool[data-tool="strength"]').click();
  await expect(page.locator('.pop')).toBeVisible();
  await page.locator('.vrange').fill('0');
  await expect(page.locator('.pop__val')).toHaveText('0');
  await page.waitForTimeout(600);
  const plain = await frame();
  await page.locator('.vrange').fill('100');
  await expect(page.locator('.pop__val')).toHaveText('100');
  await page.waitForTimeout(600);
  const styled = await frame();
  const diff = plain.reduce((s, v, i) => s + Math.abs(v - styled[i]), 0) / plain.length;
  expect(diff, '强度 0 和 100 的画面应明显不同').toBeGreaterThan(4);
  await page.locator('.vrange').fill('35');
  await page.locator('.vrange').dispatchEvent('change');
  await page.reload();
  await camera(page);
  await page.locator('.tool[data-tool="strength"]').click();
  await expect(page.locator('.pop__val')).toHaveText('35');
});

test('上传精修的四个滑块：数值、档位、刷新后还在，并写进创作轨迹', async ({ page }) => {
  await useSample(page, 0);
  await tool(page, '微调');
  const want = { 风格强度: '95', 保留像貌: '40', 细节丰富度: '20', 美颜微调: '70' };
  for (const [name, v] of Object.entries(want)) {
    const knob = page.locator('.knob', { hasText: name });
    await knob.locator('input').fill(v);
    await knob.locator('input').dispatchEvent('change');
    await expect(knob.locator('.knob__val')).toContainText(v);
  }
  await make(page);
  await page.reload();
  await tool(page, '微调');
  for (const [name, v] of Object.entries(want)) await expect(page.locator('.knob', { hasText: name }).locator('.knob__val')).toContainText(v);
  // 再改一个，出第二版：轨迹里要写清楚改了什么
  const k = page.locator('.knob', { hasText: '风格强度' }).locator('input');
  await k.fill('60'); await k.dispatchEvent('change');
  await make(page);
  await page.locator('.hud__btn', { hasText: '保存' }).waitFor();
  await page.evaluate(() => { location.hash = '#/gallery'; });
  await page.locator('.tile').first().click();
  await expect(page.locator('.trail')).toContainText('风格强度 95→60');
});

test('前后对比滑块：键盘和拖动都能对比，按住看原图', async ({ page }) => {
  await useSample(page, 2);
  await make(page);
  await page.waitForTimeout(1300);
  const box = page.locator('.frame__img');
  await page.locator('.cmp__range').focus();
  for (let i = 0; i < 5; i++) await page.keyboard.press('ArrowLeft');
  await expect(box).toHaveClass(/is-split/);
  const cmp = await box.evaluate(el => parseFloat(getComputedStyle(el).getPropertyValue('--cmp')));
  expect(cmp).toBeLessThan(100);
});

for (const [w, h] of [[390, 844], [360, 640], [1280, 800]]) {
  test(`切换工具零高度跳动 · ${w}×${h}`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    await useSample(page, 3);
    const measure = () => page.evaluate(() => {
      const base = /** @type {HTMLElement} */ (document.querySelector('.studio')).getBoundingClientRect().top;
      const r = (/** @type {string} */ s) => document.querySelector(s)?.getBoundingClientRect();
      return [r('.tpanel')?.height, r('.frame__fit')?.height, (r('.frame__fit')?.top || 0) - base, (r('.tpanel')?.top || 0) - base].map(v => Math.round(v || 0));
    });
    /** 动画（面板滑出、照片让位）走完后的样子：没有还在跑的过渡动画，并且连着两次量都一样。 */
    const settled = async () => {
      await page.waitForFunction(() => !document.getAnimations().some(a => a instanceof CSSTransition && a.playState === 'running'), null, { timeout: 10000 }).catch(() => {});
      let last = await measure();
      for (let i = 0; i < 30; i++) {
        await page.waitForTimeout(200);
        const now = await measure();
        if (JSON.stringify(now) === JSON.stringify(last)) return now;
        last = now;
      }
      return last;
    };
    await tool(page, '风格');
    const base = await settled();
    for (const t of ['微调', '细节', '部位', '对话', '风格']) {
      await tool(page, t);
      expect(await measure(), `切到「${t}」的那一刻：面板、照片的位置与高度不变`).toEqual(base);
      expect(await settled(), `切到「${t}」之后：面板、照片的位置与高度不变`).toEqual(base);
    }
  });
}

test('软键盘弹出：布局不被顶崩，输入框始终可见', async ({ page }) => {
  await useSample(page, 1);
  const stageH = await page.locator('#stage').evaluate(el => el.getBoundingClientRect().height);
  const screen = /** @type {{ width: number, height: number }} */ (page.viewportSize()), KB = 320, top = screen.height - KB;
  /** 两种浏览器：旧式（整个视口缩小）与新式（interactive-widget=resizes-visual，只缩可见区域）。 */
  const check = async (/** @type {string} */ field, /** @type {'layout' | 'visual'} */ how) => {
    await page.locator(field).focus();
    await page.waitForTimeout(200);
    if (how === 'layout') await page.setViewportSize({ width: screen.width, height: top });
    else await keyboardUp(page, KB);
    await page.waitForTimeout(600);
    const after = await page.locator('#stage').evaluate(el => el.getBoundingClientRect().height);
    expect(after, '舞台高度保持不变，键盘盖在上面而不是把页面挤扁').toBeGreaterThanOrEqual(stageH - 1);
    const rect = () => page.locator(field).evaluate(el => el.getBoundingClientRect().toJSON());
    await expect.poll(async () => (await rect()).bottom, { message: field + ' 在键盘上方', timeout: 4000 }).toBeLessThanOrEqual(top + 1);
    expect((await rect()).top, field + ' 没被顶出屏幕').toBeGreaterThanOrEqual(0);
    expect(await page.evaluate(() => document.scrollingElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await expect(page.locator('.screen:not([hidden]) .bar').first(), '顶栏还在原处').toBeInViewport();
    if (how === 'layout') await page.setViewportSize(screen);
    else await keyboardDown(page);
    await page.locator(field).blur();
    await page.waitForTimeout(400);
  };
  for (const how of /** @type {const} */ (['layout', 'visual'])) {
    await tool(page, '细节');
    await check('.say__field', how);
    await tool(page, '对话');
    await check('.chat__field', how);
  }
  await tool(page, '细节');
  await page.locator('.say__field').fill('蝴蝶结换成红色');
  await page.locator('.say__field').press('Enter');
  await expect(page.locator('.say__field')).toHaveValue('蝴蝶结换成红色');
  await page.evaluate(() => { location.hash = '#/me'; });
  await page.getByRole('button', { name: '登录', exact: true }).click();
  await check('.auth input >> nth=1', 'layout');
  await page.keyboard.press('Escape');
  const final = await page.locator('#stage').evaluate(el => el.getBoundingClientRect().height);
  expect(final).toBeGreaterThanOrEqual(stageH - 1);
});

test('刘海与底部横条的安全区里没有可点的东西', async ({ page }) => {
  const SAT = 47, SAB = 34, H = 844;
  await page.addInitScript(([t, b]) => {
    const s = document.createElement('style');
    s.textContent = `:root:root { --sat: ${t}px; --sab: ${b}px; }`;
    document.addEventListener('DOMContentLoaded', () => document.head.append(s));
  }, [SAT, SAB]);
  const clear = async (/** @type {string} */ where) => {
    const bad = await page.evaluate(([t, b, h]) => {
      const out = [];
      for (const el of document.querySelectorAll('button, [role="button"], input, .toast')) {
        const r = el.getBoundingClientRect();
        if (!r.width || !r.height || el.closest('[hidden], .scrim') || getComputedStyle(el).visibility === 'hidden' || getComputedStyle(el).opacity === '0') continue;
        if (el.closest('.cards, .pills, .carousel__track, .res__styles, .versions, .sgrid, .tpanel__body, .pp__parts, .chat__quick, .chat__ideas, .gal__scroll, .me__scroll, .work__scroll, .work__chain')) continue;   // 滚动区里的内容可以滚到栏下面
        if (el.closest('.studio, .ob__view') && !el.closest('.bar, .tools, .tpanel__foot, .dock__cta, .modes, .frame__hud')) continue;
        if (r.top < t - 1 || r.bottom > h - b + 1) out.push((el.className || el.tagName) + ' ' + Math.round(r.top) + '–' + Math.round(r.bottom));
      }
      return out;
    }, [SAT, SAB, H]);
    if (bad.length) console.log(where, bad);
    expect(bad, where + ' 的安全区').toEqual([]);
  };
  await page.goto('/');
  await expect(page.locator('.ob')).toBeVisible();
  await clear('首次引导');
  await page.getByRole('button', { name: '跳过' }).click();
  await clear('实时变身');
  await useSample(page, 0);
  await clear('上传精修');
  await make(page);
  await page.waitForTimeout(400);
  await clear('上传精修·出片后');
  for (const t of ['风格', '部位', '对话']) { await tool(page, t); await page.waitForTimeout(300); await clear('上传精修·' + t); }
  for (const r of ['#/gallery', '#/me']) { await page.evaluate(x => { location.hash = x; }, r); await page.waitForTimeout(400); await clear(r); }
  await page.evaluate(() => { location.hash = '#/gallery'; }); await page.locator('.tile').first().click(); await page.waitForTimeout(500);
  await clear('作品详情');
});

test('每个风格卡都能选中并换上它的世界；每个细节选项都能开关', async ({ page, browserName }) => {
  test.setTimeout(browserName === 'webkit' ? 1_200_000 : 300_000);
  await useSample(page, 4);
  await tool(page, '风格');
  for (const cat of ['搞怪', '角色变身', '梦幻主题', '二次元', '氛围出片', '艺术画风']) {
    await page.locator('.tpanel .pill', { hasText: cat }).click();
    for (const p of PRESETS.filter(x => x.cat === { 搞怪: 'fun', 角色变身: 'role', 梦幻主题: 'dream', 二次元: 'acg', 氛围出片: 'mood', 艺术画风: 'art' }[cat])) {
      const card = page.locator(`.scard[data-style="${p.id}"]`);
      if ((await card.getAttribute('aria-selected')) !== 'true') await card.click();
      await expect(page.locator('html')).toHaveAttribute('data-theme', p.id);
      await expect(card).toHaveAttribute('aria-selected', 'true');
      await expect(page.locator('.hud__chip b')).toHaveText(p.name);
      // 细节：每个都能开、能关（同组互斥的会把同组另一个关掉）
      await tool(page, '细节');
      const chips = page.locator('.dgroup .chip2');
      const n = await chips.count();
      expect(n).toBe(8);
      for (let i = 0; i < n; i++) {
        const c = chips.nth(i), was = await c.getAttribute('aria-pressed');
        await c.click();
        await expect(c).toHaveAttribute('aria-pressed', was === 'true' ? 'false' : 'true');
        await c.click();
      }
      await tool(page, '风格');
    }
  }
});

test('每个抽屉都能用 ✕、点遮罩、Esc 和返回手势关掉，且不离开当前页', async ({ page }) => {
  await useSample(page, 5);
  const drawers = {
    样张: { at: '#/studio', open: () => page.locator('.hud__chip').click() },
    我的口味: { at: '#/me', open: () => page.locator('.me__row', { hasText: '我的口味' }).click() },
    登录: { at: '#/me', open: () => page.getByRole('button', { name: '登录', exact: true }).click() },
    隐私说明: { at: '#/me', open: () => page.locator('.me__row', { hasText: '隐私说明' }).click() },
  };
  for (const [name, d] of Object.entries(drawers)) {
    for (const how of ['✕', '遮罩', 'Esc', '返回手势']) {
      await page.evaluate(r => { location.hash = r; }, d.at); await page.waitForTimeout(300);
      await d.open();
      await expect(page.locator('.sheet.is-in'), name + ' 打开').toBeVisible();
      if (how === '✕') await page.locator('.sheet .sheet__close').click();
      if (how === '遮罩') await page.locator('.scrim').click({ position: { x: 8, y: 8 } });
      if (how === 'Esc') await page.keyboard.press('Escape');
      if (how === '返回手势') await page.goBack();
      await expect(page.locator('.sheet'), `${name} 用${how}关掉`).toHaveCount(0);
      await expect(page, `${name} 关掉后还在原页`).toHaveURL(new RegExp(d.at.replace('/', '\\/') + '$'));
    }
  }
});

/**
 * 遍历器：每个页面的每个可见按钮都点一下（每次都从同样的状态开始），要么换了页、要么界面有变化（抽屉/提示/状态）、
 * 要么弹出选文件或下载。点完不能有任何脚本错误。
 */
/**
 * 每个页面的每个按钮都点一遍：都要有反馈（换了页面、弹出抽屉、页面上有变化或打开选图），且没有任何报错。
 * 按钮按「名字 + 第几个同名」认，点完如果离开了页面或开了一层，就重新打开这一页再点下一个。
 */
const CRAWL = /** @type {Record<string, { hash: (work: string) => string, open?: (page: import('@playwright/test').Page) => Promise<unknown>, chromiumOnly?: boolean }>} */ ({
  result: { hash: w => `#/result/${w}` },
  // 风格面板记得你上次看的分类、作品库记得上次的分组：点过别的之后，重新打开时先回到起点
  'studio·风格': { hash: () => '#/studio', open: async p => { await tool(p, '风格'); await p.locator('.tpanel .pill', { hasText: '热门' }).click(); } },
  'studio·微调': { hash: () => '#/studio', open: p => tool(p, '微调') },
  'studio·细节': { hash: () => '#/studio', open: p => tool(p, '细节') },
  'studio·部位': { hash: () => '#/studio', open: async p => { await tool(p, '部位'); await p.waitForTimeout(1500); } },
  'studio·对话': { hash: () => '#/studio', open: p => tool(p, '对话') },
  gallery: { hash: () => '#/gallery', open: async p => { await p.locator('.gal__seg .seg__opt[data-k="works"]').click(); await p.locator('.tile').first().waitFor({ timeout: 15000 }); } },
  work: { hash: w => `#/work/${w}` },
  me: { hash: () => '#/me' },
  live: { hash: () => '#/live', open: async p => { await camera(p); await p.locator('.live .pill', { hasText: '热门' }).click({ timeout: 15000 }); await p.waitForTimeout(800); }, chromiumOnly: true },
});
for (const [name, spec] of Object.entries(CRAWL)) {
  test(`每个按钮都有反馈、没有报错 · ${name}`, async ({ page, browserName }) => {
    test.skip(!!spec.chromiumOnly && browserName !== 'chromium', '只有 Chromium 有假摄像头');
    test.setTimeout(browserName === 'webkit' ? 1_200_000 : 600_000);
    const errors = /** @type {string[]} */ ([]);
    page.on('pageerror', e => errors.push(e.message));
    page.on('filechooser', fc => fc.setFiles('web/img/people/jun.webp').catch(() => {}));
    page.on('download', () => {});
    page.on('dialog', d => d.dismiss());
    await page.addInitScript(() => {
      /**
       * 屏幕上看得见、能点的按钮。认法：有无障碍名字的按名字，没有的按「样式 + 第几个」
       * （按钮上的字会变，例如主按钮带着风格名和预计秒数、灵感按钮每次出片都换新的）。
       */
      /** @type {any} */ (window).__buttons = () => {
        const seen = /** @type {Record<string, number>} */ ({});
        return [...document.querySelectorAll('.screen:not([hidden]) button:not([aria-current="page"])')].filter(b => {
          const r = b.getBoundingClientRect(), s = getComputedStyle(b);
          return r.width && r.height && !b.closest('[hidden], .prog') && s.visibility !== 'hidden' && s.opacity !== '0' && !(/** @type {HTMLButtonElement} */ (b).disabled) && r.bottom > 0 && r.top < innerHeight;
        }).map(b => {
          const aria = b.getAttribute('aria-label'), cls = String(b.className).split(' ')[0] || 'button';
          const base = aria ? 'a:' + aria : 'c:' + cls;
          const n = seen[base] = (seen[base] || 0) + 1;
          return { b, key: base + '#' + n, label: (aria || b.textContent || '').trim().slice(0, 14) || cls };
        });
      };
    });
    await useSample(page, 1);
    await make(page);
    const workId = await page.evaluate(async () => (await new Promise(r => { const q = indexedDB.open('hajixiu'); q.onsuccess = () => { const t = q.result.transaction('records').objectStore('records').getAll(); t.onsuccess = () => r(t.result); }; })).find((/** @type {any} */ x) => x.coll === 'works' && !x.deleted).id);
    let loads = 0;
    const setup = async () => {
      const hash = spec.hash(workId);
      await page.goto(`/?skipintro&crawl=${++loads}${hash}`);
      await expect(page.locator('html')).toHaveAttribute('data-screen', hash.slice(2).split('/')[0]);
      await spec.open?.(page);
      await page.waitForTimeout(400);
    };
    const mark = (/** @type {string} */ key) => page.evaluate(k => {
      const x = /** @type {any} */ (window).__buttons().find((/** @type {any} */ x) => x.key === k);
      if (x) x.b.dataset.qa = 'next';
      return !!x;
    }, key);
    await setup();
    const found = await page.evaluate(() => /** @type {any} */ (window).__buttons().map((/** @type {any} */ x) => [x.key, x.label]));
    const keys = found.map((/** @type {string[]} */ x) => x[0]), labels = new Map(found);
    const report = /** @type {string[]} */ ([]);
    let ok = 0, dirty = false;
    // 上一下点出来的图还在生成时先等它出完：出完那一刻面板会重画（例如「接着改」换成新的），别点在半空
    const settle = () => page.waitForFunction(() => !document.querySelector('.screen:not([hidden]) [data-state="working"]'), null, { timeout: 30000 }).catch(() => {});
    for (const key of keys) {
      const label = labels.get(key) || key;
      if (dirty) { await setup(); dirty = false; }
      await settle();
      if (!(await mark(key))) { await setup(); if (!(await mark(key))) { report.push(`${name} · ${label}：重新打开后找不到了`); continue; } }
      const before = await page.evaluate(() => { const w = /** @type {any} */ (window); w.__mut = 0; new MutationObserver(m => { w.__mut += m.length; }).observe(document.body, { subtree: true, childList: true, attributes: true, characterData: true }); return location.href; });
      let chooser = false;
      const fc = page.waitForEvent('filechooser', { timeout: 900 }).then(() => { chooser = true; }).catch(() => {});
      const tap = () => page.locator('[data-qa="next"]').click({ timeout: name === 'live' ? 15000 : 4000 });
      // 按钮刚好被重画（换成了同位置的新按钮）：重新认一次再点
      await tap().catch(async () => { await settle(); if (await mark(key)) await tap(); else throw new Error('按钮不见了'); }).catch(e => report.push(`${name} · ${label}：点不到（${e.message.split('\n')[0]}）`));
      await fc;
      await page.waitForTimeout(name === 'live' ? 1500 : 250);
      const after = await page.evaluate(() => ({ href: location.href, mut: /** @type {any} */ (window).__mut, layer: !!document.querySelector('.sheet, .scrim') }));
      await page.evaluate(() => document.querySelector('[data-qa="next"]')?.removeAttribute('data-qa')).catch(() => {});
      if (after.href !== before || after.mut > 0 || chooser) ok++;
      else report.push(`${name} · ${label}：点了没有任何反馈`);
      dirty = after.href !== before || after.layer || chooser;
    }
    console.log(`${name}：${ok}/${keys.length} 个按钮有反馈（重新打开 ${loads} 次）`);
    expect(report).toEqual([]);
    expect(errors).toEqual([]);
  });
}
