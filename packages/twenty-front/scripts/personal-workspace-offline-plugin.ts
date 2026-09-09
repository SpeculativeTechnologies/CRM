import { createHash } from 'node:crypto';
import { type Plugin } from 'vite';

// Only static build artifacts enter this cache. CRM HTML, API responses, tokens
// and record data are never service-worker cache inputs.
export const personalWorkspaceOfflinePlugin = (): Plugin => ({
  name: 'personal-workspace-offline',
  apply: 'build',
  enforce: 'post',
  generateBundle(_options, bundle) {
    const paths = new Set<string>(['local-workspace/index.html']);
    const visit = (filename: string) => {
      if (paths.has(filename)) return;
      paths.add(filename);
      const artifact = bundle[filename];
      if (artifact?.type !== 'chunk') return;
      for (const dependency of [
        ...artifact.imports,
        ...artifact.dynamicImports,
      ])
        visit(dependency);
      for (const asset of artifact.viteMetadata?.importedAssets ?? [])
        paths.add(asset);
      for (const stylesheet of artifact.viteMetadata?.importedCss ?? [])
        paths.add(stylesheet);
    };
    for (const artifact of Object.values(bundle)) {
      if (
        artifact.type === 'chunk' &&
        artifact.isEntry &&
        artifact.facadeModuleId?.endsWith('/local-workspace/index.html')
      )
        visit(artifact.fileName);
      // Worker sub-builds own these resources; they are not in the entry's
      // import graph. Their filenames are hashed by Vite.
      if (
        /\.(wasm|data|woff2?)$/.test(artifact.fileName) ||
        artifact.fileName.includes('localFirstDatabase.worker-')
      )
        paths.add(artifact.fileName);
    }
    const assets = [...paths].sort().map((filename) => `/${filename}`);
    const hash = createHash('sha256').update(JSON.stringify(assets));
    const shell = bundle['local-workspace/index.html'];
    if (shell?.type === 'asset') hash.update(shell.source);
    const version = hash.digest('hex').slice(0, 16);
    this.emitFile({
      type: 'asset',
      fileName: 'local-workspace/service-worker.js',
      source: `
const CACHE = 'twenty-personal-shell-${version}';
const ASSETS = ${JSON.stringify(assets)};
const PATHS = new Set(ASSETS);
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)));
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) {
      if (key.startsWith('twenty-personal-shell-') && key !== CACHE) await caches.delete(key);
    }
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;
  const path = url.pathname === '/local-workspace/' ? '/local-workspace/index.html' : url.pathname;
  if (!PATHS.has(path) || url.search) return;
  event.respondWith(caches.open(CACHE).then(async cache => (await cache.match(path)) || fetch(event.request)));
});
self.addEventListener('message', event => {
  if (event.data !== 'CHECK_READY' || !event.ports[0]) return;
  event.waitUntil(caches.open(CACHE).then(async cache => {
    const ready = (await Promise.all(ASSETS.map(path => cache.match(path)))).every(Boolean);
    event.ports[0].postMessage(ready);
  }));
});
`,
    });
  },
});
