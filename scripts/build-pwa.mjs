import { readdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

// Cache a complete build together; user worlds stay in the existing local storage.
const files = (await readdir('dist', { recursive: true }))
  .filter((file) => /\.(html|js|css|png|webmanifest)$/.test(file) && file !== 'sw.js')
  .sort();
const hash = createHash('sha256').update(await readFile(new URL(import.meta.url)));
for (const file of files) hash.update(file).update(await readFile(`dist/${file}`));
const version = hash.digest('hex').slice(0, 20);
await writeFile(
  'dist/sw.js',
  `const PREFIX = 'another-today:' + new URL(self.registration.scope).pathname + ':';
const CACHE = PREFIX + '${version}';
const FILES = ${JSON.stringify(files)}.map(file => new URL(file, self.registration.scope).href);
const INDEX = new URL('index.html', self.registration.scope).href;
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    try {
      const cache = await caches.open(CACHE);
      await cache.addAll(FILES.map(url => new Request(url, { cache: 'reload' })));
    } catch (error) {
      await caches.delete(CACHE);
      throw error;
    }
  })());
});
// Updates wait until all existing game windows close, without forcing a reload.
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) {
      if (key.startsWith(PREFIX) && key !== CACHE) await caches.delete(key);
    }
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (!url.href.startsWith(self.registration.scope)) return;
  const key = request.mode === 'navigate' ? INDEX : url.href;
  if (!FILES.includes(key)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    return (await cache.match(key)) || fetch(request);
  })());
});
`,
);
console.log(`PWA: cached ${files.length} files (${version})`);
