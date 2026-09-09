import { Trans } from '@lingui/react/macro';
import { useState } from 'react';

import { StyledPersonalToolActions } from '@/local-first/components/PersonalToolStyles';
import { type PersonalToolRevision } from '@/local-first/types/PersonalTool';

export const PersonalToolHistory = ({
  selected,
  onRead,
  onRestore,
}: {
  selected: PersonalToolRevision;
  onRead: () => Promise<PersonalToolRevision[]>;
  onRestore: (revision: PersonalToolRevision) => void;
}) => {
  const [history, setHistory] = useState<PersonalToolRevision[]>([]);
  const [target, setTarget] = useState('');
  const [error, setError] = useState(false);
  const load = async () => {
    try {
      setHistory(await onRead());
      setError(false);
    } catch {
      setError(true);
    }
  };
  return (
    <>
      <StyledPersonalToolActions>
        <button onClick={() => void load()}>
          <Trans>Browse history</Trans>
        </button>
        {history.length > 0 && (
          <>
            <label>
              <Trans>Saved revision</Trans>
              <select
                value={target}
                onChange={(event) => setTarget(event.target.value)}
              >
                <option value="">
                  <Trans>Choose a revision</Trans>
                </option>
                {history.map((revision) => (
                  <option key={revision.revision} value={revision.revision}>
                    {revision.revision} ·{' '}
                    {new Date(revision.createdAt).toLocaleString()}
                  </option>
                ))}
              </select>
            </label>
            <button
              disabled={!target || Number(target) === selected.revision}
              onClick={() => {
                const revision = history.find(
                  (candidate) => candidate.revision === Number(target),
                );
                if (revision) onRestore(revision);
              }}
            >
              <Trans>Restore this revision</Trans>
            </button>
            <small>
              <Trans>
                Restoring creates a new revision and keeps the existing history.
              </Trans>
            </small>
          </>
        )}
      </StyledPersonalToolActions>
      {error && (
        <p role="alert">
          <Trans>History could not be read from this device.</Trans>
        </p>
      )}
    </>
  );
};
