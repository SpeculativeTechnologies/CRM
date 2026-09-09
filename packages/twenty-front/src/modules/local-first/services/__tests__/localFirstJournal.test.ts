/** @jest-environment node */
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

it('should preserve authored edits through failures and conflicts in real Postgres WASM', () => {
  const packageDirectory = resolve(__dirname, '../../../../..');
  const result = spawnSync(
    process.execPath,
    [
      '--import',
      'tsx',
      '--test',
      resolve(__dirname, '../../testing/localFirstJournal.behavior.ts'),
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
  if (result.status !== 0)
    throw new Error(
      `${result.error?.message ?? ''}\n${result.stdout}\n${result.stderr}`,
    );
}, 65000);
