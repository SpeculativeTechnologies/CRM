// This separate entry has no CRM keyboard shortcuts or focus-stack provider.
// oxlint-disable twenty/require-text-input-focus-handlers
import { Trans } from '@lingui/react/macro';
import { useState } from 'react';

import { PersonalToolDesigner } from '@/local-first/components/PersonalToolDesigner';
import { PersonalToolHistory } from '@/local-first/components/PersonalToolHistory';
import {
  StyledPersonalToolActions,
  StyledPersonalWorkspaceLayout,
} from '@/local-first/components/PersonalToolStyles';
import { PersonalToolTable } from '@/local-first/components/PersonalToolTable';
import { PersonalWorkspaceOfflineStatus } from '@/local-first/components/PersonalWorkspaceOfflineStatus';
import { usePersonalTools } from '@/local-first/hooks/usePersonalTools';
import { createPersonalTool } from '@/local-first/services/personalToolStorage';
import { type LocalFirstScope } from '@/local-first/types/LocalFirstScope';
import { type PersonalTool } from '@/local-first/types/PersonalTool';
import { downloadPersonalTool } from '@/local-first/utils/downloadPersonalTool';

export const PersonalWorkspace = ({
  scope,
  onLock,
}: {
  scope: LocalFirstScope;
  onLock: () => void;
}) => {
  const {
    tools,
    selected,
    select,
    error,
    busy,
    save,
    importFile,
    history,
    refresh,
  } = usePersonalTools(scope);
  const [title, setTitle] = useState('');
  const [viewId, setViewId] = useState<string>();
  const [exportError, setExportError] = useState(false);
  const definition = selected?.definition;
  const view =
    definition?.views.find((candidate) => candidate.id === viewId) ??
    definition?.views[0];
  const change = (tool: PersonalTool) => {
    if (selected) void save(tool, selected.revision);
  };
  const exportTool = async () => {
    if (!selected) return;
    try {
      downloadPersonalTool('personal-tool-with-history.json', {
        format: 'twenty-personal-tool',
        version: 1,
        definition: selected.definition,
        history: await history(selected.definition.id),
      });
      setExportError(false);
    } catch {
      setExportError(true);
    }
  };
  const restore = async () => {
    if (!selected) return;
    try {
      const revisions = await history(selected.definition.id);
      const previous = revisions.find(
        (revision) => revision.revision === selected.revision - 1,
      );
      if (previous) await save(previous.definition, selected.revision);
    } catch {
      setExportError(true);
    }
  };
  return (
    <StyledPersonalWorkspaceLayout>
      <aside>
        <small>
          <Trans>TWENTY · EXPERIMENTAL</Trans>
        </small>
        <h2>
          <Trans>Personal tools</Trans>
        </h2>
        <p>
          <Trans>Your own fields, views and working copies.</Trans>
        </p>
        <nav aria-label="Personal tools">
          {tools.map((tool) => (
            <button
              key={tool.definition.id}
              aria-current={selected?.definition.id === tool.definition.id}
              onClick={() => select(tool.definition.id)}
            >
              {tool.definition.title}
            </button>
          ))}
        </nav>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (title.trim()) {
              void save(createPersonalTool(title), 0);
              setTitle('');
            }
          }}
        >
          <label>
            <Trans>Tool name</Trans>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              required
              maxLength={200}
            />
          </label>
          <button type="submit" disabled={busy}>
            <Trans>Make a tool</Trans>
          </button>
        </form>
        <label>
          <Trans>Import a tool</Trans>
          <input
            type="file"
            accept="application/json,.json"
            disabled={busy}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) {
                if (file.size > 10_000_000) {
                  setExportError(true);
                  return;
                }
                void file
                  .text()
                  .then(importFile)
                  .catch(() => setExportError(true));
              }
              event.target.value = '';
            }}
          />
        </label>
        <p>
          <small>
            <Trans>
              Imports create a new personal copy. Use Export tool to keep a
              backup; clearing browser storage removes local tools.
            </Trans>
          </small>
        </p>
        <p>
          <a href="/">
            <Trans>Back to CRM</Trans>
          </a>
        </p>
        <button onClick={onLock}>
          <Trans>Close local workspace</Trans>
        </button>
      </aside>
      <article>
        <PersonalWorkspaceOfflineStatus />
        {error && <p role="alert">{error}</p>}
        {exportError && (
          <p role="alert">
            <Trans>
              The file or history could not be read. Imports must be valid tool
              files under 10 MB.
            </Trans>
          </p>
        )}
        <button disabled={busy} onClick={() => void refresh()}>
          <Trans>Reload from this device</Trans>
        </button>
        {selected && definition && view ? (
          <fieldset disabled={busy}>
            <small>
              <Trans>PERSONAL · SAVED ON THIS DEVICE</Trans> ·{' '}
              {selected.revision}
            </small>
            <h1>{definition.title}</h1>
            <label>
              <Trans>Rename tool</Trans>
              <input
                defaultValue={definition.title}
                key={`${definition.id}:${definition.title}`}
                maxLength={200}
                onBlur={(event) => {
                  if (
                    event.target.value.trim() &&
                    event.target.value !== definition.title
                  )
                    change({ ...definition, title: event.target.value });
                }}
              />
            </label>
            <p>
              <Trans>
                Changes here stay personal. CRM copies are snapshots; editing
                them does not update shared records.
              </Trans>
            </p>
            <StyledPersonalToolActions>
              <button
                onClick={() =>
                  void save(
                    {
                      ...definition,
                      id: crypto.randomUUID(),
                      title: `${definition.title} (copy)`,
                    },
                    0,
                  )
                }
              >
                <Trans>Duplicate tool</Trans>
              </button>
              <button
                onClick={() =>
                  downloadPersonalTool('personal-tool-template.json', {
                    format: 'twenty-personal-tool',
                    version: 1,
                    definition: { ...definition, records: [] },
                  })
                }
              >
                <Trans>Export template</Trans>
              </button>
              <button onClick={() => void exportTool()}>
                <Trans>Export tool and history</Trans>
              </button>
              <button
                disabled={selected.revision < 2}
                onClick={() => void restore()}
              >
                <Trans>Restore previous revision</Trans>
              </button>
            </StyledPersonalToolActions>
            <PersonalToolDesigner
              tool={definition}
              view={view}
              onChange={change}
              onSelectView={setViewId}
            />
            <PersonalToolHistory
              key={definition.id}
              selected={selected}
              onRead={() => history(definition.id)}
              onRestore={(revision) =>
                void save(revision.definition, selected.revision)
              }
            />
            <PersonalToolTable
              tool={definition}
              view={view}
              onChange={change}
            />
          </fieldset>
        ) : (
          <section>
            <h1>
              <Trans>Make the CRM fit your work.</Trans>
            </h1>
            <p>
              <Trans>
                Create a personal tool, add the fields you need, and arrange a
                view. You can also copy a viewed CRM record from the Local
                changes panel.
              </Trans>
            </p>
          </section>
        )}
      </article>
    </StyledPersonalWorkspaceLayout>
  );
};
