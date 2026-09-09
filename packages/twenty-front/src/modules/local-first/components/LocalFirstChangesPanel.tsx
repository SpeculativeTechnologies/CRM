import { styled } from '@linaria/react';
import { Trans } from '@lingui/react/macro';
import { useCallback, useEffect, useState } from 'react';
import { themeCssVariables } from 'twenty-ui/theme-constants';

import {
  assertLocalFirstScopeIsCurrent,
  getCurrentLocalFirstScope,
} from '@/local-first/services/getCurrentLocalFirstScope';
import { getLocalFirstDatabase } from '@/local-first/services/getLocalFirstDatabase';
import {
  initializeLocalFirstJournal,
  readLocalFirstJournal,
  resolveLocalFirstConflict,
} from '@/local-first/services/localFirstJournal';
import { startLocalFirstJournalSync } from '@/local-first/services/startLocalFirstJournalSync';
import { type LocalFirstJournalEntry } from '@/local-first/types/LocalFirstJournalEntry';
import { PersonalToolsLauncher } from '@/local-first/components/PersonalToolsLauncher';

const StyledPanel = styled.aside`
  background: ${themeCssVariables.background.primary};
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.md};
  bottom: 16px;
  box-shadow: ${themeCssVariables.boxShadow.light};
  color: ${themeCssVariables.font.color.primary};
  font-family: ${themeCssVariables.font.family};
  font-size: ${themeCssVariables.font.size.sm};
  left: 16px;
  max-height: 65vh;
  overflow: auto;
  padding: 12px;
  position: fixed;
  width: 330px;
  z-index: 9998;
`;
const StyledEntry = styled.div`
  border-top: 1px solid ${themeCssVariables.border.color.light};
  margin-top: 8px;
  overflow-wrap: anywhere;
  padding-top: 8px;
`;
const StyledActions = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 8px;
`;

export const LocalFirstChangesPanel = () => {
  const [entries, setEntries] = useState<LocalFirstJournalEntry[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const refresh = useCallback(async () => {
    const scope = getCurrentLocalFirstScope();
    if (!scope) return;
    try {
      const database = await getLocalFirstDatabase(scope);
      await initializeLocalFirstJournal(database);
      const journal = await readLocalFirstJournal(database);
      assertLocalFirstScopeIsCurrent(scope);
      setEntries(journal);
      setError(false);
    } catch {
      setError(true);
    }
  }, []);
  useEffect(() => {
    const reportSaveFailure = () => setSaveError(true);
    window.addEventListener('twenty-local-save-failed', reportSaveFailure);
    const stop = startLocalFirstJournalSync({ onChange: () => void refresh() });
    // Followers also observe edits made by the sync-owning tab.
    const timer = setInterval(() => void refresh(), 1500);
    void refresh();
    return () => {
      window.removeEventListener('twenty-local-save-failed', reportSaveFailure);
      stop();
      clearInterval(timer);
    };
  }, [refresh]);

  const handleResolve = async (
    operationId: string,
    choice: 'local' | 'server',
  ) => {
    const scope = getCurrentLocalFirstScope();
    if (!scope) return;
    try {
      const database = await getLocalFirstDatabase(scope);
      assertLocalFirstScopeIsCurrent(scope);
      await resolveLocalFirstConflict({
        database,
        operationId,
        choice,
        replacementId: crypto.randomUUID(),
      });
      await refresh();
      window.dispatchEvent(new Event('twenty-local-changes-resolved'));
    } catch {
      setError(true);
    }
  };
  const handleExport = () => {
    const downloadUrl = URL.createObjectURL(
      new Blob(
        [
          JSON.stringify(
            { format: 'twenty-local-journal', version: 1, entries },
            null,
            2,
          ),
        ],
        { type: 'application/json' },
      ),
    );
    const anchor = document.createElement('a');
    anchor.href = downloadUrl;
    anchor.download = 'local-crm-changes.json';
    anchor.click();
    URL.revokeObjectURL(downloadUrl);
  };
  const handleRetry = async (operationId: string) => {
    const scope = getCurrentLocalFirstScope();
    if (!scope) return;
    try {
      const database = await getLocalFirstDatabase(scope);
      assertLocalFirstScopeIsCurrent(scope);
      await database.query(
        `update local_first.journal set state = 'pending', error = null where "operationId" = $1 and state = 'rejected'`,
        [operationId],
      );
      await refresh();
    } catch {
      setError(true);
    }
  };
  const active = entries.filter(
    (entry) => !['applied', 'superseded'].includes(entry.state),
  );
  return (
    <StyledPanel aria-label="Local changes">
      <button
        onClick={() => setExpanded((previous) => !previous)}
        aria-expanded={expanded}
      >
        <Trans>Local changes</Trans> · {active.length}
      </button>
      {error && (
        <p role="alert">
          <Trans>
            Local storage could not be read. Your edits have not been discarded.
          </Trans>
        </p>
      )}
      {saveError && (
        <div role="alert">
          <p>
            <Trans>
              This edit could not be saved on this device. Check local storage
              and try again.
            </Trans>
          </p>
          <button onClick={() => setSaveError(false)}>
            <Trans>Dismiss</Trans>
          </button>
        </div>
      )}
      {expanded && (
        <>
          <PersonalToolsLauncher />
          <p>
            <Trans>
              Experimental. Text, number, checkbox and single-choice field edits
              are saved on this device before syncing. Other changes need a
              connection.
            </Trans>
          </p>
          {active.length === 0 && (
            <p>
              <Trans>No pending edits.</Trans>
            </p>
          )}
          {active.map((entry) => (
            <StyledEntry key={entry.operation.operationId}>
              <strong>
                {entry.objectName} · {entry.operation.recordId.slice(0, 8)}
              </strong>
              <div>
                {entry.state === 'conflict' ? (
                  <Trans>Conflict</Trans>
                ) : entry.state === 'rejected' ? (
                  <Trans>Needs attention</Trans>
                ) : (
                  <Trans>Saved on this device</Trans>
                )}
              </div>
              {entry.operation.changes.map((change) => (
                <div key={change.fieldId}>
                  {entry.fieldNames[change.fieldId]}:{' '}
                  {String(change.after ?? '—')}
                  {entry.state === 'conflict' && (
                    <div>
                      <Trans>Server</Trans>:{' '}
                      {String(entry.current?.[change.fieldId] ?? '—')}
                    </div>
                  )}
                </div>
              ))}
              {entry.error && <p>{entry.error}</p>}
              {entry.state === 'rejected' && (
                <button
                  onClick={() => void handleRetry(entry.operation.operationId)}
                >
                  <Trans>Retry this edit</Trans>
                </button>
              )}
              {entry.state === 'conflict' && (
                <StyledActions>
                  <button
                    onClick={() =>
                      void handleResolve(entry.operation.operationId, 'local')
                    }
                  >
                    <Trans>Keep local changes</Trans>
                  </button>
                  <button
                    onClick={() =>
                      void handleResolve(entry.operation.operationId, 'server')
                    }
                  >
                    <Trans>Use server values</Trans>
                  </button>
                </StyledActions>
              )}
            </StyledEntry>
          ))}
          <StyledActions>
            <button onClick={handleExport} disabled={entries.length === 0}>
              <Trans>Export edit history</Trans>
            </button>
          </StyledActions>
        </>
      )}
    </StyledPanel>
  );
};
