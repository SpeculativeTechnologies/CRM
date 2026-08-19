// =============================================================================
// Emit .br and .gz siblings for the frontend build's content-hashed assets.
// =============================================================================
// sirv (deploy/serve-frontend.mjs) serves a precompressed sibling when the
// client accepts that encoding, so the ~7MB of JS ships as ~2MB instead.
//
// Only build/assets/* is compressed. Root files (index.html, icons) are left
// alone deliberately: index.html is rewritten in place at server boot by
// generate-front-config.ts, and a stale sibling would silently serve outdated
// config to clients that accept brotli. Hashed assets never change in place,
// so their siblings cannot go stale.
//
// Usage: node packages/twenty-front/scripts/precompress-build.mjs [buildDir]
// =============================================================================
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';
import { promisify } from 'node:util';

const brotliCompress = promisify(zlib.brotliCompress);
const gzip = promisify(zlib.gzip);

const COMPRESSIBLE_EXTENSIONS = new Set([
  '.js',
  '.mjs',
  '.css',
  '.html',
  '.svg',
  '.json',
  '.txt',
  '.map',
  '.webmanifest',
]);

// Below this size the encoding overhead outweighs the saving.
const MIN_SIZE_BYTES = 1024;

const buildDir = path.resolve(
  process.argv[2] ??
    path.join(path.dirname(fileURLToPath(import.meta.url)), '../build'),
);
const assetsDir = path.join(buildDir, 'assets');

const listFilesRecursively = async (dir) => {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map((entry) => {
      const absolutePath = path.join(dir, entry.name);
      return entry.isDirectory()
        ? listFilesRecursively(absolutePath)
        : [absolutePath];
    }),
  );
  return files.flat();
};

const main = async () => {
  let allFiles;
  try {
    allFiles = await listFilesRecursively(assetsDir);
  } catch {
    console.error(`[precompress] no assets directory at ${assetsDir}`);
    process.exit(1);
  }

  const targets = [];
  for (const filePath of allFiles) {
    if (!COMPRESSIBLE_EXTENSIONS.has(path.extname(filePath))) continue;
    const { size } = await fs.stat(filePath);
    if (size < MIN_SIZE_BYTES) continue;
    targets.push({ filePath, size });
  }

  let originalBytes = 0;
  let brotliBytes = 0;

  // Bounded concurrency keeps peak memory sane on multi-MB chunks.
  const CONCURRENCY = 8;
  let nextIndex = 0;
  const worker = async () => {
    while (nextIndex < targets.length) {
      const { filePath, size } = targets[nextIndex++];
      const content = await fs.readFile(filePath);
      const [brotliContent, gzipContent] = await Promise.all([
        brotliCompress(content, {
          params: {
            [zlib.constants.BROTLI_PARAM_QUALITY]: 9,
            [zlib.constants.BROTLI_PARAM_SIZE_HINT]: size,
          },
        }),
        gzip(content, { level: 9 }),
      ]);
      await Promise.all([
        fs.writeFile(`${filePath}.br`, brotliContent),
        fs.writeFile(`${filePath}.gz`, gzipContent),
      ]);
      originalBytes += size;
      brotliBytes += brotliContent.length;
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, targets.length) }, worker),
  );

  const toMb = (bytesCount) => (bytesCount / 1024 / 1024).toFixed(2);
  console.log(
    `[precompress] ${targets.length} assets: ${toMb(originalBytes)}MB -> ${toMb(brotliBytes)}MB brotli`,
  );
};

await main();
