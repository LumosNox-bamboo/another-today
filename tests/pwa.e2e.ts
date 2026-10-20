import { test, expect } from '@playwright/test';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import type { AddressInfo } from 'node:net';

test('install metadata and a cold offline launch retain the player world', async ({
  page,
  context,
}) => {
  await page.goto('./');
  const manifestUrl = await page.locator('link[rel="manifest"]').getAttribute('href');
  const manifestResponse = await page.request.get(new URL(manifestUrl!, page.url()).href);
  const manifest = await manifestResponse.json();
  expect(manifest.display).toBe('standalone');
  expect(manifest.start_url).toBe('./');
  expect(manifest.scope).toBe('./');
  expect(manifest.id).toBe('./');
  for (const icon of manifest.icons) {
    const response = await page.request.get(new URL(icon.src, manifestResponse.url()).href);
    expect(response.ok()).toBe(true);
    expect(response.headers()['content-type']).toContain('image/png');
  }
  await page.getByRole('button', { name: '继续认识 TA' }).click();
  await page.getByRole('button', { name: '继续认识 TA' }).click();
  await page.getByRole('button', { name: '开始另一个今天' }).click();
  await page.getByRole('button', { name: '暂停', exact: true }).click();
  await page.locator('nav').getByRole('button', { name: '设置', exact: true }).click();
  await expect(page.getByText('离线资源已就绪，下次没有网络也能打开游戏。')).toBeVisible();
  await expect(page.getByText('iPhone / iPad：', { exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  // Keep restart notifications quiet so we can compare the complete persisted world.
  await page.getByLabel('免打扰模式').check();
  await page.getByRole('button', { name: '快进 6 小时' }).click();
  // Initialize the real-calendar notification day before taking the persistence snapshot.
  await page.reload();
  await page.locator('nav').getByRole('button', { name: '设置', exact: true }).click();
  const before = await page.evaluate(() => JSON.parse(localStorage.getItem('another-today')!));
  const url = page.url();
  await page.screenshot({ path: test.info().outputPath('mobile-install.png'), fullPage: true });
  await page.close();
  await context.setOffline(true);
  const offline = await context.newPage();
  const errors: string[] = [];
  offline.on('pageerror', (error) => errors.push(error.message));
  await offline.goto(url);
  await expect(offline.locator('canvas')).toBeVisible();
  const after = await offline.evaluate(() => JSON.parse(localStorage.getItem('another-today')!));
  expect(after.character).toEqual(before.character);
  expect(after.time).toBe(before.time);
  expect(after.living).toEqual(before.living);
  await offline.locator('nav').getByRole('button', { name: '设置', exact: true }).click();
  await offline.getByRole('button', { name: '快进 6 小时' }).click();
  await offline.reload();
  await expect(offline.locator('canvas')).toBeVisible();
  const advanced = await offline.evaluate(() => JSON.parse(localStorage.getItem('another-today')!));
  expect(advanced.time).toBe(before.time + 6 * 60 * 60 * 1000);
  expect(errors).toEqual([]);
});

test('the optional install prompt opens only after the player asks', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: '继续认识 TA' }).click();
  await page.getByRole('button', { name: '继续认识 TA' }).click();
  await page.getByRole('button', { name: '开始另一个今天' }).click();
  await page.locator('nav').getByRole('button', { name: '设置', exact: true }).click();
  await page.evaluate(() => {
    const event = new Event('beforeinstallprompt', { cancelable: true });
    Object.assign(event, {
      prompt: async () => {
        document.documentElement.dataset.promptOpened = 'yes';
      },
      userChoice: Promise.resolve({ outcome: 'dismissed' }),
    });
    window.dispatchEvent(event);
  });
  await expect(page.locator('html')).not.toHaveAttribute('data-prompt-opened');
  await page.getByRole('button', { name: '安装到主屏幕', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-prompt-opened', 'yes');
  await expect(page.getByRole('button', { name: '安装到主屏幕', exact: true })).toHaveCount(0);
  await expect(page.getByText('iPhone / iPad：', { exact: true })).toBeVisible();
});

test('updates wait for every game window, recover from failed downloads and isolate caches', async ({
  browser,
  browserName,
}) => {
  test.skip(
    browserName !== 'chromium',
    'Playwright exposes service worker lifecycle inspection only in Chromium.',
  );
  // Use a separate real origin to exercise the generated worker, without touching deployment.
  let version = 'one';
  let fail = false;
  const server = createServer(async (request, response) => {
    const path = new URL(request.url!, 'http://localhost').pathname;
    const file = path === '/another-today/' ? 'index.html' : path.slice('/another-today/'.length);
    try {
      if (
        !path.startsWith('/another-today/') ||
        file.includes('..') ||
        (fail && file === 'icon-192.png')
      ) {
        response.writeHead(404).end();
        return;
      }
      let body: Buffer | string = await readFile(`dist/${file}`);
      if (file === 'sw.js')
        body = body
          .toString()
          .replace(/const CACHE = PREFIX \+ '[^']+';/, `const CACHE = PREFIX + '${version}';`);
      if (file === 'index.html')
        body = body.toString().replace('<html ', `<html data-release="${version}" `);
      const mime: Record<string, string> = {
        js: 'application/javascript',
        css: 'text/css',
        html: 'text/html',
        png: 'image/png',
        webmanifest: 'application/manifest+json',
      };
      response.writeHead(200, {
        'Content-Type': mime[file.split('.').pop()!] || 'application/octet-stream',
        'Cache-Control': 'no-store',
      });
      response.end(body);
    } catch {
      response.writeHead(404).end();
    }
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const context = await browser.newContext();
  try {
    const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/another-today/`;
    const first = await context.newPage();
    await first.goto(url);
    await first.getByRole('button', { name: '继续认识 TA' }).click();
    await first.getByRole('button', { name: '继续认识 TA' }).click();
    await first.getByRole('button', { name: '开始另一个今天' }).click();
    await expect.poll(() => first.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
    await first.evaluate(async () => {
      localStorage.setItem('pwa-save-sentinel', 'keep');
      await caches.open('unrelated-app');
    });
    const second = await context.newPage();
    await second.goto(url);
    version = 'broken';
    fail = true;
    await first.evaluate(async () => {
      const registration = await navigator.serviceWorker.ready;
      await registration.update();
      const worker = registration.installing;
      if (worker && worker.state !== 'redundant')
        await new Promise<void>((resolve) =>
          worker.addEventListener('statechange', () => {
            if (worker.state === 'redundant') resolve();
          }),
        );
    });
    expect(await first.evaluate(() => caches.keys())).not.toContain(
      'another-today:/another-today/:broken',
    );
    await second.reload();
    await expect(second.locator('html')).toHaveAttribute('data-release', 'one');
    fail = false;
    version = 'two';
    await first.evaluate(async () => (await navigator.serviceWorker.ready).update());
    await expect
      .poll(() => first.evaluate(async () => !!(await navigator.serviceWorker.ready).waiting))
      .toBe(true);
    await expect(first.getByText(/新版已下载：/)).toBeVisible();
    await first.close();
    await second.reload();
    await expect(second.locator('html')).toHaveAttribute('data-release', 'one');
    await second.goto('about:blank');
    await expect
      .poll(async () => {
        const workers = context.serviceWorkers();
        for (const worker of workers) {
          try {
            if (
              await worker
                .evaluate(() => caches.keys())
                .then((keys) => !keys.includes('another-today:/another-today/:one'))
            )
              return true;
          } catch {
            /* Old worker may have terminated. */
          }
        }
        return false;
      })
      .toBe(true);
    await second.goto(url);
    await expect(second.locator('html')).toHaveAttribute('data-release', 'two');
    expect(await second.evaluate(() => localStorage.getItem('pwa-save-sentinel'))).toBe('keep');
    const cachesLeft = await second.evaluate(() => caches.keys());
    expect(cachesLeft).toContain('unrelated-app');
    expect(cachesLeft).toContain('another-today:/another-today/:two');
    expect(cachesLeft).not.toContain('another-today:/another-today/:one');
  } finally {
    await context.close();
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
});
