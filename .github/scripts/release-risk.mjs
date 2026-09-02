// Classifies a pull request's changes by whether redeploying the previous SHA
// would undo them. Deploys are pinned to a commit and rollback is a redeploy,
// so reversible changes need no gate. What rollback cannot undo is a migration
// that has already run, and that is what this refuses to let through
// undocumented.
//
// Usage: node .github/scripts/release-risk.mjs <baseSha> <headSha>
// Reads the pull-request body from PR_BODY. Writes a report to
// GITHUB_STEP_SUMMARY and `labels` to GITHUB_OUTPUT. Exits 1 on a violation.

import { execFileSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';

import { databaseAreaFor } from './database-changes.mjs';

const COMMANDS_ROOT =
  'packages/twenty-server/src/database/commands/upgrade-version-command';
const CURRENT_VERSION_FILE =
  'packages/twenty-server/src/engine/core-modules/upgrade/constants/twenty-current-version.constant.ts';

// Reviewed by a person because the blast radius is wide or the change escapes
// the pinned image, not because CI can judge it. CODEOWNERS is what actually
// requests the review; these only annotate the pull request.
const ADVISORY_AREAS = [
  { label: 'risk:deploy', prefix: 'deploy/', reason: 'deploy and host configuration' },
  {
    label: 'risk:deploy',
    prefix: '.github/workflows/deploy-',
    reason: 'promotion machinery',
  },
  {
    label: 'risk:deploy',
    prefix: '.github/workflows/cd-deploy-cloud.yaml',
    reason: 'promotion machinery',
  },
  {
    label: 'risk:deploy',
    prefix: '.github/actions/deploy-cloud-box/',
    reason: 'promotion machinery',
  },
  {
    label: 'risk:access-control',
    prefix: 'packages/twenty-server/src/engine/core-modules/auth/',
    reason: 'authentication',
  },
  {
    label: 'risk:access-control',
    prefix: 'packages/twenty-server/src/engine/metadata-modules/permissions/',
    reason: 'permissions',
  },
  {
    label: 'risk:access-control',
    prefix: 'packages/twenty-server/src/engine/guards/',
    reason: 'request guards',
  },
  {
    label: 'risk:external-effects',
    prefix: 'packages/twenty-server/src/modules/messaging/',
    reason: 'message sync and outbound email',
  },
  {
    label: 'risk:external-effects',
    prefix: 'packages/twenty-server/src/modules/calendar/',
    reason: 'calendar sync',
  },
];

// Matched against the up path of an upgrade command, never against `down`.
const DESTRUCTIVE_SQL = [
  { pattern: /\bDROP\s+COLUMN\b/i, description: 'drops a column' },
  { pattern: /\bDROP\s+TABLE\b/i, description: 'drops a table' },
  { pattern: /\bDROP\s+SCHEMA\b/i, description: 'drops a schema' },
  { pattern: /\bTRUNCATE\b/i, description: 'truncates a table' },
  { pattern: /\bDELETE\s+FROM\b/i, description: 'deletes rows' },
  // Anchored on a quoted or schema-qualified target so that the `ON UPDATE NO
  // ACTION` of an ordinary foreign key is not read as a row write.
  {
    pattern: /(?<!\bON\s)\bUPDATE\s+(?:ONLY\s+)?(?:["'`]|\w+\.\w)/i,
    description: 'updates rows',
  },
  { pattern: /\bINSERT\s+INTO\b/i, description: 'inserts rows' },
];

const DATA_MUTATION_CALLS = [
  { pattern: /\brunDataMigration\s*\(/, description: 'runs a data migration' },
  { pattern: /\.(softDelete|softRemove)\s*\(/, description: 'soft-deletes records' },
  { pattern: /\.(delete|remove)\s*\(/, description: 'deletes records' },
  { pattern: /\.(save|insert|upsert)\s*\(/, description: 'writes records' },
  { pattern: /\.update\s*\(/, description: 'updates records' },
];

const git = (...args) =>
  execFileSync('git', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });

const changedFiles = (baseSha, headSha) =>
  git('diff', '--name-status', '--find-renames', `${baseSha}...${headSha}`)
    .split('\n')
    .filter(Boolean)
    .map((line) => line.split('\t'))
    .filter(([status]) => status !== 'D')
    // A rename reports the destination in the third column.
    .map((parts) => (parts[0].startsWith('R') ? parts[2] : parts[1]));

const fileAtHead = (headSha, path) => {
  try {
    return git('show', `${headSha}:${path}`);
  } catch {
    return '';
  }
};

// Removes each `down` method body so that the DROP COLUMN which reverses an
// added column is not read as a destructive change. Brace counting is enough
// here: template-literal interpolation is balanced, and these files are
// generated from one narrow template.
const stripDownMethods = (source) => {
  let result = '';
  let cursor = 0;

  for (;;) {
    const signature = /(?:public\s+|protected\s+|private\s+)?(?:override\s+)?(?:async\s+)?down\s*\(/g;

    signature.lastIndex = cursor;

    const match = signature.exec(source);

    if (!match) {
      return result + source.slice(cursor);
    }

    const bodyStart = source.indexOf('{', match.index + match[0].length);

    if (bodyStart === -1) {
      return result + source.slice(cursor);
    }

    let depth = 0;
    let index = bodyStart;

    while (index < source.length) {
      if (source[index] === '{') depth += 1;
      if (source[index] === '}') {
        depth -= 1;
        if (depth === 0) break;
      }
      index += 1;
    }

    result += source.slice(cursor, match.index);
    cursor = index + 1;
  }
};

const compareVersions = (left, right) => {
  const leftParts = left.split('.').map(Number);
  const rightParts = right.split('.').map(Number);

  for (let index = 0; index < 3; index += 1) {
    const difference = (leftParts[index] ?? 0) - (rightParts[index] ?? 0);

    if (difference !== 0) return difference;
  }

  return 0;
};

const currentVersionFrom = (source) =>
  source.match(/TWENTY_CURRENT_VERSION = '([\d.]+)'/)?.[1] ?? null;

const registeredVersionFrom = (source) =>
  source.match(
    /@Registered(?:Instance|Workspace)Command\(\s*'([\d.]+)'/,
  )?.[1] ?? null;

const commandNameFrom = (source) =>
  source.match(/name:\s*'([^']+)'/)?.[1] ?? null;

const hasRollbackSection = (body) =>
  /^\s*#{1,6}\s*rollback\b/im.test(body) || /^\s*\*{0,2}rollback\*{0,2}\s*:/im.test(body);

const mentionsManualRun = (body, commandName) =>
  (commandName !== null && body.includes(commandName)) ||
  /--dry-run/.test(body) ||
  /\brun (?:it )?by name\b/i.test(body);

const main = () => {
  const [baseSha, headSha] = process.argv.slice(2);

  if (!baseSha || !headSha) {
    console.error('usage: release-risk.mjs <baseSha> <headSha>');
    process.exit(2);
  }

  const body = process.env.PR_BODY ?? '';
  // An upstream sync carries Twenty's own migrations, which arrive with their
  // version bump and are not this fork's to write a rollback for. Still worth
  // classifying and labelling, just not worth blocking on.
  const advisoryOnly = process.env.ADVISORY_ONLY === 'true';
  const files = changedFiles(baseSha, headSha);
  const currentVersion = currentVersionFrom(fileAtHead(headSha, CURRENT_VERSION_FILE));

  const irreversible = [];
  const dormant = [];
  const advisory = [];
  const database = [];

  for (const file of files) {
    const databaseArea = databaseAreaFor(file);

    if (databaseArea !== null) {
      database.push({ file, reason: databaseArea.reason });
    }

    for (const area of ADVISORY_AREAS) {
      if (file.startsWith(area.prefix)) {
        advisory.push({ file, ...area });
        break;
      }
    }

    const isCommand =
      file.startsWith(`${COMMANDS_ROOT}/`) &&
      file.endsWith('.ts') &&
      !file.includes('/__tests__/') &&
      !file.endsWith('.spec.ts');

    if (!isCommand) continue;

    const source = fileAtHead(headSha, file);
    const upPath = stripDownMethods(source);

    const findings = [...DESTRUCTIVE_SQL, ...DATA_MUTATION_CALLS]
      .filter(({ pattern }) => pattern.test(upPath))
      .map(({ description }) => description);

    if (findings.length > 0) {
      irreversible.push({ file, findings: [...new Set(findings)] });
    }

    const registeredVersion = registeredVersionFrom(source);

    if (
      registeredVersion !== null &&
      currentVersion !== null &&
      compareVersions(registeredVersion, currentVersion) > 0
    ) {
      dormant.push({
        file,
        registeredVersion,
        commandName: commandNameFrom(source),
      });
    }
  }

  const violations = [];
  const lines = ['## Release risk'];

  if (
    irreversible.length === 0 &&
    dormant.length === 0 &&
    advisory.length === 0 &&
    database.length === 0
  ) {
    lines.push(
      '',
      'Nothing here survives a rollback. Redeploying the previous SHA undoes this change.',
    );
  }

  if (database.length > 0) {
    lines.push(
      '',
      '### Reaches the production database',
      '',
      'Any developer can merge this. Promoting it is what is gated: **Deploy to',
      'production** refuses these files until *Record a staging check* has signed',
      'off a staging deploy that contained them. Deploy the merged SHA to staging,',
      'exercise it there, then record the check.',
      '',
    );

    for (const { file, reason } of database) {
      lines.push(`- \`${file}\` — ${reason}`);
    }
  }

  if (irreversible.length > 0) {
    lines.push(
      '',
      '### Not undone by a rollback',
      '',
      'These run against the production database. Redeploying the previous image',
      'leaves their effects in place.',
      '',
    );

    for (const { file, findings } of irreversible) {
      lines.push(`- \`${file}\` — ${findings.join(', ')}`);
    }

    if (!hasRollbackSection(body)) {
      violations.push(
        'This pull request changes data or drops schema, so its description needs a ' +
          '`## Rollback` section saying how to get back if it goes wrong. ' +
          'Redeploying the previous SHA is not an answer here.',
      );
    }
  }

  if (dormant.length > 0) {
    lines.push(
      '',
      `### Registered ahead of the current version (${currentVersion})`,
      '',
      'The upgrade sequence only runs the previous and current versions, so these',
      'ship inert and have to be run by name on each box after the deploy.',
      '',
    );

    for (const { file, registeredVersion, commandName } of dormant) {
      lines.push(`- \`${file}\` — registered for ${registeredVersion}`);

      if (!mentionsManualRun(body, commandName)) {
        violations.push(
          `\`${file}\` is registered for ${registeredVersion} while the app is on ` +
            `${currentVersion}, so deploying it does nothing. Say in the description ` +
            'how to run it by name, including the `--dry-run` step.',
        );
      }
    }
  }

  if (advisory.length > 0) {
    lines.push('', '### Needs the production owner', '');

    for (const { file, reason } of advisory) {
      lines.push(`- \`${file}\` — ${reason}`);
    }
  }

  if (violations.length > 0) {
    lines.push('', '### Missing from the description', '');

    for (const violation of violations) {
      lines.push(`- ${violation}`);

      if (!advisoryOnly) {
        console.log(`::error::${violation.replace(/\n/g, ' ')}`);
      }
    }
  }

  if (advisoryOnly && violations.length > 0) {
    lines.push(
      '',
      'Reporting only: this is an upstream sync, so the missing description ' +
        'sections do not fail the check.',
    );
  }

  const report = `${lines.join('\n')}\n`;

  console.log(report);

  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, report);
  }

  const labels = [
    ...new Set([
      ...(irreversible.length > 0 ? ['risk:irreversible'] : []),
      ...(database.length > 0 ? ['risk:database'] : []),
      ...advisory.map(({ label }) => label),
    ]),
  ];

  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT, `labels=${labels.join(',')}\n`);
  }

  process.exit(violations.length > 0 && !advisoryOnly ? 1 : 0);
};

main();
