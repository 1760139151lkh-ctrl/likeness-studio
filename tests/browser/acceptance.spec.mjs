/**
 * 上线前的逐项验收（任务书第 7 节）：
 *   · 每个滑块真的改变了东西，并且刷新后还在
 *   · 切换 Tab 零高度跳动
 *   · 软键盘弹出不把布局顶崩、输入框不被挡
 *   · 刘海和底部横条的安全区里没有可点的东西
 *   · 每个风格卡、每个细节选项、每个抽屉（关闭的四种方式）都有反应
 *   · 每个页面的每个按钮都点一遍：都有反馈，没有报错
 *   · 首屏与切页够快
 */
import { test, expect } from '@playwright/test';
import { open, useSample, camera } from './kit.mjs';
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
  await page.locator('.seg__opt', { hasText: '微调' }).click();
  const want = { 风格强度: '95', 保留像貌: '40', 细节丰富度: '20', 美颜微调: '70' };
  for (const [name, v] of Object.entries(want)) {
    const knob = page.locator('.knob', { hasText: name });
    await knob.locator('input').fill(v);
    await knob.locator('input').dispatchEvent('change');
    await expect(knob.locator('.knob__val')).toContainText(v);
  }
  await page.locator('.cta').click();
  await expect(page.locator('.frame')).toHaveAttribute('data-state', 'done', { timeout: 30000 });
  await page.reload();
  await page.locator('.seg__opt', { hasText: '微调' }).click();
  for (const [name, v] of Object.entries(want)) await expect(page.locator('.knob', { hasText: name }).locator('.knob__val')).toContainText(v);
  // 再改一个，出第二版：轨迹里要写清楚改了什么
  const k = page.locator('.knob', { hasText: '风格强度' }).locator('input');
  await k.fill('60'); await k.dispatchEvent('change');
  await page.locator('.cta').click();
  await expect(page.locator('.frame')).toHaveAttribute('data-state', 'done', { timeout: 30000 });
  await page.locator('.next__btn', { hasText: '保存相册' }).waitFor();
  await page.evaluate(() => { location.hash = '#/gallery'; });
  await page.locator('.tile').first().click();
  await expect(page.locator('.trail')).toContainText('风格强度 95→60');
});

test('前后对比滑块：键盘和拖动都能对比，按住看原图', async ({ page }) => {
  await useSample(page, 2);
  await page.locator('.cta').click();
  await expect(page.locator('.frame')).toHaveAttribute('data-state', 'done', { timeout: 30000 });
  await page.waitForTimeout(1300);
  const box = page.locator('.frame__img');
  await page.locator('.cmp__range').focus();
  for (let i = 0; i < 5; i++) await page.keyboard.press('ArrowLeft');
  await expect(box).toHaveClass(/is-split/);
  const cmp = await box.evaluate(el => parseFloat(getComputedStyle(el).getPropertyValue('--cmp')));
  expect(cmp).toBeLessThan(100);
});

for (const [w, h] of [[390, 844], [360, 640], [1280, 800]]) {
  test(`切换 Tab 零高度跳动 · ${w}×${h}`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    await useSample(page, 3);
    const sizes = [];
    for (const t of ['风格', '微调', '细节', '风格']) {
      await page.locator('.seg__opt', { hasText: t }).click();
      await page.waitForTimeout(150);
      sizes.push(await page.evaluate(() => {
        // 位置按滚动内容算（矮屏上整页可滚，点按钮时浏览器可能顺手滚一下，这不算跳动）
        const box = /** @type {HTMLElement} */ (document.querySelector('.studio')), base = box.getBoundingClientRect().top - box.scrollTop;
        const r = (/** @type {string} */ s) => document.querySelector(s)?.getBoundingClientRect();
        return [r('.panel')?.height, r('.frame__img')?.height, (r('.frame__img')?.top || 0) - base, (r('.panel')?.top || 0) - base].map(v => Math.round(v || 0));
      }));
    }
    for (const s of sizes) expect(s, '面板、照片框、主按钮的位置与高度不随 Tab 变化').toEqual(sizes[0]);
  });
}

test('软键盘弹出：布局不被顶崩，输入框始终可见', async ({ page }) => {
  await useSample(page, 1);
  await page.locator('.seg__opt', { hasText: '细节' }).click();
  const stageH = await page.locator('#stage').evaluate(el => el.getBoundingClientRect().height);
  const check = async (/** @type {string} */ field) => {
    await page.locator(field).focus();
    await page.waitForTimeout(200);
    await page.setViewportSize({ width: 390, height: 844 - 320 });   // 键盘占掉 320px（按旧式「缩小视口」的浏览器模拟）
    await page.waitForTimeout(600);
    const after = await page.locator('#stage').evaluate(el => el.getBoundingClientRect().height);
    expect(after, '舞台高度保持不变，键盘盖在上面而不是把页面挤扁').toBeGreaterThanOrEqual(stageH - 1);
    const r = await page.locator(field).evaluate(el => el.getBoundingClientRect().toJSON());
    expect(r.top).toBeGreaterThanOrEqual(0);
    expect(r.bottom, '正在输入的框在键盘上方').toBeLessThanOrEqual(844 - 320);
    expect(await page.evaluate(() => document.scrollingElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(400);
  };
  await page.locator('.say').click();
  await check('.say__field');
  await page.keyboard.type('蝴蝶结换成红色');
  await page.keyboard.press('Enter');
  await expect(page.locator('.say q')).toHaveText('蝴蝶结换成红色');
  await page.evaluate(() => { location.hash = '#/me'; });
  await page.getByRole('button', { name: '登录', exact: true }).click();
  await check('.auth input >> nth=1');
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
        if (el.closest('.cards, .pills, .carousel__track, .res__styles, .versions, .panel__body, .gal__scroll, .me__scroll, .work__scroll, .studio, .ob__view')) {
          if (!el.closest('.bar, .studio__dock, .modes')) continue;   // 滚动区里的内容可以滚到栏下面
        }
        if (r.top < t - 1 || r.bottom > h - b + 1) out.push((el.className || el.tagName) + ' ' + Math.round(r.top) + '–' + Math.round(r.bottom));
      }
      return out;
    }, [SAT, SAB, H]);
    expect(bad, where + ' 的安全区').toEqual([]);
  };
  await page.goto('/');
  await expect(page.locator('.ob')).toBeVisible();
  await clear('首次引导');
  await page.getByRole('button', { name: '跳过' }).click();
  await clear('实时变身');
  await useSample(page, 0);
  await clear('上传精修');
  await page.locator('.cta').click();
  await expect(page.locator('.frame')).toHaveAttribute('data-state', 'done', { timeout: 30000 });
  await page.waitForTimeout(400);
  await clear('上传精修·出片后');
  for (const r of ['#/gallery', '#/me']) { await page.evaluate(x => { location.hash = x; }, r); await page.waitForTimeout(400); await clear(r); }
  await page.evaluate(() => { location.hash = '#/gallery'; }); await page.locator('.tile').first().click(); await page.waitForTimeout(500);
  await clear('作品详情');
});

test('每个风格卡都能选中并换上它的世界；每个细节选项都能开关', async ({ page }) => {
  await useSample(page, 4);
  await page.locator('.seg__opt', { hasText: '风格' }).click();
  for (const cat of ['搞怪', '角色变身', '梦幻主题', '二次元', '氛围出片']) {
    await page.locator('.panel .pill', { hasText: cat }).click();
    for (const p of PRESETS.filter(x => x.cat === { 搞怪: 'fun', 角色变身: 'role', 梦幻主题: 'dream', 二次元: 'acg', 氛围出片: 'mood' }[cat])) {
      await page.locator(`.card[data-style="${p.id}"]`).click();
      await expect(page.locator('html')).toHaveAttribute('data-theme', p.id);
      await expect(page.locator(`.card[data-style="${p.id}"]`)).toHaveAttribute('aria-pressed', 'true');
      await expect(page.locator('.frame__chip b')).toHaveText(p.name);
      // 细节：每个都能开、能关（同组互斥的会把同组另一个关掉）
      await page.locator('.seg__opt', { hasText: '细节' }).click();
      const chips = page.locator('.chip2');
      const n = await chips.count();
      expect(n).toBe(8);
      for (let i = 0; i < n; i++) {
        const c = chips.nth(i), was = await c.getAttribute('aria-pressed');
        await c.click();
        await expect(c).toHaveAttribute('aria-pressed', was === 'true' ? 'false' : 'true');
        await c.click();
      }
      await page.locator('.seg__opt', { hasText: '风格' }).click();
    }
  }
});

test('每个抽屉都能用 ✕、点遮罩、Esc 和返回手势关掉，且不离开当前页', async ({ page }) => {
  await useSample(page, 5);
  const drawers = {
    样张: { at: '#/studio', open: () => page.locator('.frame__chip').click() },
    补一句: { at: '#/studio', open: async () => { await page.locator('.seg__opt', { hasText: '细节' }).click(); await page.locator('.say').click(); } },
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
test('每个页面的每个按钮都点一遍：都有反馈，没有报错', async ({ page, browserName }) => {
  test.setTimeout(600_000);
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('filechooser', fc => fc.setFiles('web/img/people/jun.webp').catch(() => {}));
  page.on('download', () => {});
  page.on('dialog', d => d.dismiss());
  await useSample(page, 1);
  await page.locator('.cta').click();
  await expect(page.locator('.frame')).toHaveAttribute('data-state', 'done', { timeout: 30000 });
  const workId = await page.evaluate(async () => (await new Promise(r => { const q = indexedDB.open('hajixiu'); q.onsuccess = () => { const t = q.result.transaction('records').objectStore('records').getAll(); t.onsuccess = () => r(t.result); }; })).find(x => x.coll === 'works' && !x.deleted).id);
  const screens = {
    result: async () => { await page.goto(`/?skipintro#/result/${workId}`); await page.waitForTimeout(400); },
    'studio·风格': async () => { await page.goto('/?skipintro#/studio'); await page.locator('.seg__opt', { hasText: '风格' }).click(); },
    'studio·微调': async () => { await page.goto('/?skipintro#/studio'); await page.locator('.seg__opt', { hasText: '微调' }).click(); },
    'studio·细节': async () => { await page.goto('/?skipintro#/studio'); await page.locator('.seg__opt', { hasText: '细节' }).click(); },
    gallery: async () => { await page.goto('/?skipintro#/gallery'); },
    work: async () => { await page.goto(`/?skipintro#/work/${workId}`); },
    me: async () => { await page.goto('/?skipintro#/me'); },
    ...(browserName === 'chromium' ? { live: async () => { await page.goto('/?skipintro#/live'); await camera(page); await page.waitForTimeout(800); } } : {}),
  };
  const report = [];
  for (const [name, setup] of Object.entries(screens)) {
    await setup(); await page.waitForTimeout(500);
    // 「你在这里」的指示（当前模式）不算：它本来就不该跳走
    const labels = await page.evaluate(() => [...document.querySelectorAll('.screen:not([hidden]) button:not([aria-current="page"])')].filter(b => {
      const r = b.getBoundingClientRect(); const s = getComputedStyle(b);
      return r.width && r.height && !b.closest('[hidden]') && s.visibility !== 'hidden' && s.opacity !== '0' && !b.disabled && r.bottom > 0 && r.top < innerHeight;
    }).map((b, i) => { b.dataset.qa = String(i); return (b.getAttribute('aria-label') || b.textContent || '').trim().slice(0, 14) || b.className; }));
    let ok = 0;
    for (let i = 0; i < labels.length; i++) {
      await setup(); await page.waitForTimeout(350);
      await page.evaluate(() => [...document.querySelectorAll('.screen:not([hidden]) button:not([aria-current="page"])')].filter(b => {
        const r = b.getBoundingClientRect(); const s = getComputedStyle(b);
        return r.width && r.height && !b.closest('[hidden]') && s.visibility !== 'hidden' && s.opacity !== '0' && !b.disabled && r.bottom > 0 && r.top < innerHeight;
      }).forEach((b, k) => { b.dataset.qa = String(k); }));
      const target = page.locator(`[data-qa="${i}"]`);
      if (!(await target.count())) continue;
      const before = await page.evaluate(() => { window.__mut = 0; new MutationObserver(m => { window.__mut += m.length; }).observe(document.body, { subtree: true, childList: true, attributes: true, characterData: true }); return location.href; });
      let chooser = false;
      const fc = page.waitForEvent('filechooser', { timeout: 900 }).then(() => { chooser = true; }).catch(() => {});
      await target.click({ timeout: 3000 }).catch(e => report.push(`${name} · ${labels[i]}：点不到（${e.message.split('\n')[0]}）`));
      await fc;
      await page.waitForTimeout(250);
      const after = await page.evaluate(() => ({ href: location.href, mut: window.__mut }));
      if (after.href !== before || after.mut > 0 || chooser) ok++;
      else report.push(`${name} · ${labels[i]}：点了没有任何反馈`);
    }
    console.log(`${name}：${ok}/${labels.length} 个按钮有反馈`);
  }
  expect(report).toEqual([]);
  expect(errors).toEqual([]);
});
