/**
 * 哈基秀 in Chromium at phone size, against two freshly started servers:
 *   showcase   the static demo (node tools/serve.mjs): sample results are the pre-made renders, your own photo a local preview
 *   live       the real server on the simulator engine (uv run likeness serve --engine simulator); skipped where uv is absent
 *
 * The camera is Chromium's fake device playing tests/fixtures/camera/selfie.mjpeg (an invented person), so face
 * tracking and the AR stickers run for real. LIKENESS_BROWSER_CHANNEL=chrome uses an installed Google Chrome instead.
 */
import { spawnSync } from 'node:child_process';
import { homedir, tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, devices } from '@playwright/test';
import { existsSync, readdirSync } from 'node:fs';

const SHOWCASE = 'http://127.0.0.1:4183', LIVE = 'http://127.0.0.1:8797';
const env = { ...process.env, PATH: [join(homedir(), '.local', 'bin'), process.env.PATH].join(delimiter) };
const hasUv = spawnSync('uv', ['--version'], { env }).status === 0;
const camera = fileURLToPath(new URL('tests/fixtures/camera/selfie.mjpeg', import.meta.url));
// npm run accept: the slow, exhaustive acceptance pass (every button, every slider, keyboard, safe areas), in Chromium and,
// where Playwright's WebKit is installed, as an iPhone 13 in WebKit (Safari's engine)
const accept = process.env.LIKENESS_ACCEPT === '1';
const cache = join(homedir(), '.cache', 'ms-playwright');
const hasWebkit = existsSync(cache) && readdirSync(cache).some(d => d.startsWith('webkit-'));

export default defineConfig({
  testDir: 'tests/browser',
  outputDir: 'test-results',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  workers: 1,
  fullyParallel: false,
  forbidOnly: true,
  reporter: [['list']],
  use: {
    ...(process.env.LIKENESS_BROWSER_CHANNEL ? { channel: process.env.LIKENESS_BROWSER_CHANNEL } : {}),
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
    isMobile: true,
    hasTouch: true,
    locale: 'zh-SG',
    trace: 'retain-on-failure',
    permissions: ['camera'],
    launchOptions: { args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--use-file-for-fake-video-capture=' + camera] },
  },
  projects: [
    { name: 'showcase', testMatch: /showcase\.spec\.mjs$/, use: { baseURL: SHOWCASE } },
    ...(hasUv ? [{ name: 'live', testMatch: /live\.spec\.mjs$/, use: { baseURL: LIVE } }] : []),
    ...(hasUv && accept ? [{ name: 'accept', testMatch: /acceptance\.spec\.mjs$/, use: { baseURL: LIVE } }] : []),
    ...(hasUv && accept && hasWebkit ? [{ name: 'accept-iphone', testMatch: /(acceptance|live)\.spec\.mjs$/, use: { ...devices['iPhone 13'], baseURL: LIVE, permissions: [], launchOptions: {} } }] : []),
  ],
  webServer: [
    { command: 'node tools/serve.mjs 4183', url: SHOWCASE + '/index.html', reuseExistingServer: false, timeout: 30_000 },
    ...(hasUv ? [{
      command: 'uv run likeness serve --engine simulator --host 127.0.0.1 --port 8797', url: LIVE + '/api/health', reuseExistingServer: false, timeout: 120_000,
      env: { ...env, LIKENESS_HOME: join(tmpdir(), 'hajixiu-test-' + process.pid), LIKENESS_SIM_SPEED: '0.4' },
    }] : []),
  ],
});
