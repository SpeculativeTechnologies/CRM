import { useCallback, useEffect, useState } from 'react';

import { assertLocalFirstScopeIsCurrent } from '@/local-first/services/getCurrentLocalFirstScope';
import { getLocalFirstDatabase } from '@/local-first/services/getLocalFirstDatabase';
import {
  importPersonalTool,
  initializePersonalTools,
  listPersonalTools,
  readPersonalToolHistory,
  savePersonalTool,
} from '@/local-first/services/personalToolStorage';
import { type LocalFirstScope } from '@/local-first/types/LocalFirstScope';
import {
  type PersonalTool,
  type PersonalToolRevision,
} from '@/local-first/types/PersonalTool';

export const usePersonalTools = (scope: LocalFirstScope) => {
  const [tools, setTools] = useState<PersonalToolRevision[]>([]);
  const [selectedId, setSelectedId] = useState<string>();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const database = useCallback(async () => {
    assertLocalFirstScopeIsCurrent(scope);
    const connection = await getLocalFirstDatabase(scope);
    await initializePersonalTools(connection);
    assertLocalFirstScopeIsCurrent(scope);
    return connection;
  }, [scope]);
  const refresh = useCallback(async () => {
    const revisions = await listPersonalTools(await database());
    assertLocalFirstScopeIsCurrent(scope);
    setTools(revisions);
    setError(undefined);
  }, [database, scope]);
  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    try {
      await action();
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : 'The tool could not be saved on this device.',
      );
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => {
    void refresh().catch(() => setError('Local storage is unavailable.'));
  }, [refresh]);
  const save = (definition: PersonalTool, expectedRevision: number) =>
    run(async () => {
      await savePersonalTool(await database(), definition, expectedRevision);
      assertLocalFirstScopeIsCurrent(scope);
      setSelectedId(definition.id);
      await refresh();
    });
  const importFile = (source: string) =>
    run(async () => {
      const imported = await importPersonalTool(await database(), source);
      assertLocalFirstScopeIsCurrent(scope);
      setSelectedId(imported.definition.id);
      await refresh();
    });
  const history = async (toolId: string) => {
    const revisions = await readPersonalToolHistory(await database(), toolId);
    assertLocalFirstScopeIsCurrent(scope);
    return revisions;
  };
  return {
    tools,
    selected:
      tools.find((tool) => tool.definition.id === selectedId) ?? tools.at(0),
    select: setSelectedId,
    error,
    busy,
    save,
    importFile,
    history,
    refresh: () => run(refresh),
  };
};
