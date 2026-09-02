// The single definition of "this change reaches the production database", used
// by the release-risk classifier to label a pull request and by
// deploy-production.yml to refuse promoting a database change that nobody
// signed off on staging. Both have to agree on the paths or the label says one
// thing and the gate does another.
//
// Usage: node .github/scripts/database-changes.mjs <baseSha> <headSha>
// Prints one changed path per line, nothing when the range touches no database.

import { execFileSync } from 'node:child_process';

export const DATABASE_AREAS = [
  {
    prefix: 'packages/twenty-server/src/database/',
    reason: 'migrations and upgrade commands',
  },
  {
    prefix: 'packages/twenty-server/src/engine/core-modules/upgrade/',
    reason: 'which upgrade commands run, and in what order',
  },
];

// Entities are the schema. They carry no migration of their own, so a change
// here reaches the database through the sync that runs on upgrade rather than
// through anything under src/database, and the two path prefixes above miss it.
const ENTITY_FILE = /(?:\.|-)(?:workspace-)?entity\.ts$/;

const ENTITY_ROOT = 'packages/twenty-server/src/';

const TEST_FILE = /(?:\/__tests__\/|\.spec\.ts$)/;

export const databaseAreaFor = (file) => {
  if (TEST_FILE.test(file)) return null;

  const area = DATABASE_AREAS.find(({ prefix }) => file.startsWith(prefix));

  if (area !== undefined) return area;

  if (file.startsWith(ENTITY_ROOT) && ENTITY_FILE.test(file)) {
    return { prefix: ENTITY_ROOT, reason: 'a table definition' };
  }

  return null;
};

export const databaseChanges = (baseSha, headSha) =>
  execFileSync(
    'git',
    ['diff', '--name-only', '--find-renames', `${baseSha}...${headSha}`],
    { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
  )
    .split('\n')
    .filter(Boolean)
    .filter((file) => databaseAreaFor(file) !== null);

// Only when invoked directly, so importing the definitions above costs nothing.
if (process.argv[1]?.endsWith('database-changes.mjs')) {
  const [baseSha, headSha] = process.argv.slice(2);

  if (!baseSha || !headSha) {
    console.error('usage: database-changes.mjs <baseSha> <headSha>');
    process.exit(2);
  }

  for (const file of databaseChanges(baseSha, headSha)) {
    console.log(file);
  }
}
