import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { resolveTheme, validTheme, themeBootstrap, THEME_COLORS } from '../lib/appearance.ts';

test('appearance follows the device only when System is selected', () => {
  assert.equal(resolveTheme('light', true), 'light');
  assert.equal(resolveTheme('dark', false), 'dark');
  assert.equal(resolveTheme('system', true), 'dark');
  assert.equal(resolveTheme('system', false), 'light');
  for (const value of [null, undefined, 'broken', '', 1]) assert.equal(validTheme(value), 'system');
});

function bootstrap(saved, systemDark, blocked = false) {
  const root = { dataset: {}, style: {} }, meta = {};
  vm.runInNewContext(themeBootstrap, {
    localStorage: { getItem() { if (blocked) throw new Error('Storage blocked'); return saved; } },
    matchMedia: () => ({ matches: systemDark }),
    document: {
      documentElement: root,
      querySelectorAll: () => [{ setAttribute: (key, value) => { meta[key] = value; } }],
    },
  });
  return { root, meta };
}
test('first paint restores the saved theme and browser bar before hydration', () => {
  for (const [saved, systemDark, expected] of [['dark', false, 'dark'], ['light', true, 'light'], ['system', true, 'dark'], [null, false, 'light'], ['unknown', true, 'dark']]) {
    const { root, meta } = bootstrap(saved, systemDark);
    assert.equal(root.dataset.theme, expected);
    assert.equal(root.style.colorScheme, expected);
    assert.equal(meta.content, THEME_COLORS[expected]);
  }
});
test('a storage restriction still allows the system appearance', () => {
  assert.equal(bootstrap(null, true, true).root.dataset.theme, 'dark');
});

function worker(fetcher) {
  const handlers = {};
  const context = {
    self: { location: { origin: 'https://cinepulse.test' }, addEventListener: (name, fn) => { handlers[name] = fn; }, skipWaiting() {}, clients: { claim() {} } },
    URL, Response, fetch: fetcher,
  };
  vm.runInNewContext(fs.readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8'), context);
  return handlers;
}
function request(handlers, path, { method = 'GET', mode = 'navigate' } = {}) {
  let response;
  handlers.fetch({ request: { url: new URL(path, 'https://cinepulse.test').href, method, mode }, respondWith: result => { response = result; } });
  return response;
}
test('offline fallback does not intercept APIs, sign-in routes or component requests', () => {
  let fetched = 0;
  const handlers = worker(() => { fetched++; throw new Error('Unexpected fetch'); });
  for (const path of ['/api/report', '/api/refresh', '/auth/callback', '/login', '/manifest.webmanifest', 'https://accounts.example/']) {
    assert.equal(request(handlers, path), undefined);
  }
  assert.equal(request(handlers, '/', { method: 'POST' }), undefined);
  assert.equal(request(handlers, '/', { mode: 'cors' }), undefined);
  assert.equal(fetched, 0);
});
test('online authentication and server responses are returned unchanged', async () => {
  for (const status of [200, 302, 401, 403, 500]) {
    const original = new Response('Upstream response', { status });
    const handlers = worker(() => Promise.resolve(original));
    assert.equal(await request(handlers, '/?source=homescreen'), original);
  }
});
test('an offline launch shows a generic reconnect screen with no collection data', async () => {
  const handlers = worker(() => Promise.reject(new TypeError('Network unavailable')));
  const response = await request(handlers, '/?view=saved');
  assert.equal(response.status, 503);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.match(response.headers.get('content-type'), /text\/html/);
  const html = await response.text();
  assert.match(html, /Let’s reconnect/);
  assert.match(html, /Try again/);
  assert.doesNotMatch(html, /₹|indiaNet|sourceUpdatedAt/);
});
test('install manifest has local, correctly sized app and maskable icons', () => {
  const manifest = JSON.parse(fs.readFileSync(new URL('../public/manifest.webmanifest', import.meta.url), 'utf8'));
  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.id, '/');
  assert.equal(manifest.scope, '/');
  assert.equal(manifest.prefer_related_applications, false);
  assert.ok(manifest.icons.some(icon => icon.sizes === '192x192' && icon.purpose === 'any'));
  assert.ok(manifest.icons.some(icon => icon.sizes === '512x512' && icon.purpose === 'any'));
  assert.ok(manifest.icons.some(icon => icon.purpose === 'maskable'));
  for (const icon of [...manifest.icons, { src: '/icons/apple-touch-icon.png', sizes: '180x180' }]) {
    assert.match(icon.src, /^\/icons\/[\w-]+\.png$/);
    const png = fs.readFileSync(new URL(`../public${icon.src}`, import.meta.url));
    assert.equal(png.subarray(1, 4).toString(), 'PNG');
    assert.equal(`${png.readUInt32BE(16)}x${png.readUInt32BE(20)}`, icon.sizes);
  }
});
