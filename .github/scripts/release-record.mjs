// Durable release identity. A newer failure always overrides an older pass.
import { execFileSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export const validIdentity = (record) =>
  /^[0-9a-f]{40}$/.test(record?.sha ?? '') &&
  /^ghcr\.io\/[a-z0-9/-]+@sha256:[0-9a-f]{64}$/.test(record?.image ?? '');

export function selectRecord(records, kind, sha) {
  const record = records.find((item) => item.payload?.kind === kind);
  if (
    !record ||
    record.sha !== sha ||
    record.payload?.sha !== sha ||
    !validIdentity(record.payload)
  ) {
    throw new Error(
      `Latest ${kind} does not certify the exact requested commit`,
    );
  }
  if (record.latestStatus !== 'success') {
    throw new Error(`Latest ${kind} failed or is incomplete`);
  }
  return record;
}

export function requireSameArtifact(artifact, staged, checked) {
  if (
    artifact.payload.image !== staged.payload.image ||
    artifact.sha !== staged.sha
  ) {
    throw new Error('Staging did not run this exact release artifact');
  }
  if (
    checked &&
    (checked.payload.image !== staged.payload.image ||
      checked.payload.deployment_id !== staged.id ||
      checked.payload.staging_check !== 'pass')
  ) {
    throw new Error(
      'Staging check is stale, failed, or belongs to another deployment',
    );
  }
}

function api(path, body) {
  return JSON.parse(
    execFileSync(
      'gh',
      [
        'api',
        `repos/${process.env.GITHUB_REPOSITORY}/${path}`,
        ...(body ? ['--method', 'POST', '--input', '-'] : []),
      ],
      { encoding: 'utf8', input: body ? JSON.stringify(body) : undefined },
    ),
  );
}

function records(environment, sha) {
  // Pagination prevents a busy environment hiding the relevant release. Stage
  // records deliberately query the current environment, not historical SHAs.
  const all = JSON.parse(
    execFileSync(
      'gh',
      [
        'api',
        '--paginate',
        '--slurp',
        `repos/${process.env.GITHUB_REPOSITORY}/deployments?environment=${environment}&per_page=100${sha ? `&sha=${sha}` : ''}`,
      ],
      { encoding: 'utf8' },
    ),
  ).flat();
  return all
    .filter((record) =>
      ['release-artifact', 'staged-artifact', 'staging-check'].includes(
        record.payload?.kind,
      ),
    )
    .slice(0, 1)
    .map((record) => ({
      ...record,
      latestStatus: api(`deployments/${record.id}/statuses?per_page=1`)[0]
        ?.state,
    }));
}

function output(record) {
  const values = {
    image: record.payload.image,
    sha: record.sha,
    deployment_id: record.id,
  };
  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(
      process.env.GITHUB_OUTPUT,
      Object.entries(values)
        .map(([key, value]) => `${key}=${value}\n`)
        .join(''),
    );
  }
  process.stdout.write(JSON.stringify(values) + '\n');
}

function main() {
  const [operation, sha] = process.argv.slice(2);
  if (!/^[0-9a-f]{40}$/.test(sha ?? ''))
    throw new Error('Full source SHA required');
  if (operation === 'finish') {
    const record = api(`deployments/${process.env.RELEASE_DEPLOYMENT_ID}`);
    if (
      record.sha !== sha ||
      record.payload?.sha !== sha ||
      !validIdentity(record.payload)
    )
      throw new Error('Deployment identity changed');
    api(`deployments/${record.id}/statuses`, {
      state: process.env.RELEASE_RESULT,
      auto_inactive: false,
    });
    output(record);
    return;
  }
  if (operation === 'publish') {
    const payload = JSON.parse(process.env.RELEASE_PAYLOAD);
    if (!validIdentity(payload) || payload.sha !== sha)
      throw new Error('Invalid release identity');
    const record = api('deployments', {
      ref: sha,
      environment: process.env.RELEASE_ENVIRONMENT,
      auto_merge: false,
      required_contexts: [],
      payload,
      description: `${payload.kind} ${sha.slice(0, 12)}`,
    });
    api(`deployments/${record.id}/statuses`, {
      state: process.env.RELEASE_RESULT ?? 'success',
      auto_inactive: false,
      log_url: `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`,
    });
    output({ ...record, payload });
    return;
  }
  const artifact = selectRecord(
    records('release-artifact', sha),
    'release-artifact',
    sha,
  );
  // Validate the exact SHA. A PR head check cannot certify a new main merge.
  if (operation === 'artifact') {
    const runs = api(`commits/${sha}/check-runs?per_page=100`).check_runs;
    const gate = runs.find(
      (item) =>
        item.name === 'ci-fork-status-check' &&
        item.app?.slug === 'github-actions',
    );
    if (gate?.conclusion !== 'success')
      throw new Error('Exact source SHA lacks successful CI Fork gate');
    output(artifact);
    return;
  }
  const staged = selectRecord(records('staging'), 'staged-artifact', sha);
  requireSameArtifact(artifact, staged);
  if (operation === 'promote') {
    const checked = selectRecord(
      records('staging-check'),
      'staging-check',
      sha,
    );
    requireSameArtifact(artifact, staged, checked);
  } else if (operation !== 'staged')
    throw new Error('Unknown release-record operation');
  output(staged);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  main();
