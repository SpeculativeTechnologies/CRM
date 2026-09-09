/** @jest-environment node */
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

// PGlite's Emscripten runtime imports native modules dynamically. Run the real
// persistence checks in Node, outside Jest's VM, rather than mock the database.
it('should pass the durable replica behavior checks against real Postgres WASM', () => {
  const packageDirectory = resolve(__dirname, '../../../../..');
  const result = spawnSync(
    process.execPath,
    [
      '--import',
      'tsx',
      '--test',
      resolve(__dirname, '../../testing/localFirstReplica.behavior.ts'),
    ],
    {
      cwd: packageDirectory,
      env: {
        ...process.env,
        TSX_TSCONFIG_PATH: resolve(packageDirectory, 'tsconfig.json'),
      },
      encoding: 'utf8',
      timeout: 60000,
    },
  );
  if (result.status !== 0) {
    throw new Error(
      `${result.error?.message ?? ''}\n${result.stdout}\n${result.stderr}`,
    );
  }
}, 65000);
