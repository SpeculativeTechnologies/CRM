import assert from 'node:assert/strict';
import test from 'node:test';
import { requireSameArtifact, selectRecord } from './release-record.mjs';

const sha = 'a'.repeat(40);
const image = `ghcr.io/example/twenty@sha256:${'b'.repeat(64)}`;
const staged = {
  id: 1,
  sha,
  latestStatus: 'success',
  payload: { kind: 'staged-artifact', sha, image },
};
test('accepts the exact successfully deployed image', () => {
  assert.equal(selectRecord([staged], 'staged-artifact', sha), staged);
  requireSameArtifact(staged, staged);
});
test('rejects another commit, a moving tag and an incomplete deployment', () => {
  for (const record of [
    { ...staged, sha: 'c'.repeat(40) },
    {
      ...staged,
      payload: { ...staged.payload, image: 'ghcr.io/example/twenty:latest' },
    },
    { ...staged, latestStatus: 'pending' },
  ]) {
    assert.throws(() => selectRecord([record], 'staged-artifact', sha));
  }
});
test('a later failed check overrides an older success', () => {
  assert.throws(() =>
    selectRecord(
      [{ ...staged, latestStatus: 'failure' }, staged],
      'staged-artifact',
      sha,
    ),
  );
});
test('rejects a different digest and a signoff of an earlier deployment', () => {
  assert.throws(() =>
    requireSameArtifact(staged, {
      ...staged,
      payload: { image: image.replaceAll('b', 'c') },
    }),
  );
  assert.throws(() =>
    requireSameArtifact(staged, staged, {
      payload: { image, deployment_id: 2, staging_check: 'pass' },
    }),
  );
  requireSameArtifact(staged, staged, {
    payload: { image, deployment_id: 1, staging_check: 'pass' },
  });
});
