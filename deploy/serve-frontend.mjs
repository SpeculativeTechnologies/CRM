// =============================================================================
// Static server + API proxy for the built frontend (replaces `vite preview`).
// =============================================================================
// Two jobs, single origin on :3010 (Tailscale Funnel proxies the public URL
// here):
//   1. Serve the built SPA, caching content-hashed /assets/* immutably so a
//      reload behind the relay tunnel only refetches dropped chunks (recovery).
//      `vite preview` sent `no-cache`, which broke reload-based recovery.
//   2. Proxy backend routes (/graphql incl. websockets, /auth, /s/, etc.) to
//      the NestJS server on :3000 — mirrors vite.config.ts `buildApiProxy`.
//      Without this the SPA's API calls get index.html back → "Unable to reach
//      back-end".
// =============================================================================
import { createServer } from 'node:http';
import httpProxy from 'http-proxy';
import sirv from 'sirv';

const BUILD_DIR = '/Users/ben/Projects/twenty/packages/twenty-front/build';
const PORT = Number(process.env.VITE_PREVIEW_PORT ?? 3010);
const HOST = '127.0.0.1';
const API_TARGET = process.env.VITE_PROXY_API_TO ?? 'http://127.0.0.1:3000';

// Routes that must hit the backend, not the static SPA. Keep in sync with
// packages/twenty-front/vite.config.ts buildApiProxy().
const API_REGEXES = [/^\/auth(\/|$)/, /^\/s\//];
const API_PREFIXES = [
  '/graphql',
  '/metadata',
  '/admin-panel',
  '/client-config',
  '/rest',
  '/oauth',
  '/apps',
  '/app/billing',
  '/webhooks',
  '/healthz',
  '/mcp',
  '/files',
  '/file',
  '/public-assets',
  '/.well-known',
];
const isApiPath = (pathname) =>
  API_REGEXES.some((re) => re.test(pathname)) ||
  API_PREFIXES.some((prefix) => pathname.startsWith(prefix));

const proxy = httpProxy.createProxyServer({
  target: API_TARGET,
  changeOrigin: true,
  ws: true,
});
proxy.on('error', (err, _req, res) => {
  if (res && typeof res.writeHead === 'function' && !res.headersSent) {
    res.writeHead(502, { 'content-type': 'text/plain' });
    res.end('Backend unavailable');
  } else if (res && typeof res.destroy === 'function') {
    res.destroy();
  }
});

const serve = sirv(BUILD_DIR, {
  // dev:true makes sirv stat files per-request instead of snapshotting the
  // directory listing once at startup. The build dir is rewritten in place by
  // publish-frontend.sh (new content-hashed /assets/* names each build); with
  // dev:false this long-running server kept serving its startup snapshot and
  // 404'd every new asset -> blank page on fresh loads. Per-request stat is
  // negligible on this single-user stack and makes rebuilds self-healing.
  dev: true,
  etag: true,
  single: true, // SPA fallback: serve index.html for unknown routes (/invite/...)
  setHeaders(res, pathname) {
    if (pathname.startsWith('/assets/')) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    } else {
      res.setHeader('Cache-Control', 'no-cache');
    }
  },
});

const server = createServer((req, res) => {
  const pathname = (req.url ?? '/').split('?')[0];
  if (isApiPath(pathname)) {
    proxy.web(req, res);
    return;
  }
  serve(req, res, () => {
    res.statusCode = 404;
    res.end('Not found');
  });
});

// GraphQL subscriptions use a websocket on /graphql — proxy the upgrade too.
server.on('upgrade', (req, socket, head) => {
  const pathname = (req.url ?? '/').split('?')[0];
  if (isApiPath(pathname)) {
    proxy.ws(req, socket, head);
  } else {
    socket.destroy();
  }
});

server.listen(PORT, HOST, () => {
  console.log(
    `[serve-frontend] serving ${BUILD_DIR} at http://${HOST}:${PORT} (API -> ${API_TARGET})`,
  );
});
