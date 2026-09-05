import { isDefined } from 'twenty-shared/utils';

import { type WorkspaceManyOrAllFlatEntityMapsCacheService } from 'src/engine/metadata-modules/flat-entity/services/workspace-many-or-all-flat-entity-maps-cache.service';
import { type WorkspaceCacheKeyName } from 'src/engine/workspace-cache/types/workspace-cache-key.type';
import { type WorkspaceCacheService } from 'src/engine/workspace-cache/services/workspace-cache.service';

// After `cache:flush` (every deploy ends with one) a collection has no hash
// until something recomputes its flat maps. The frontend treats a collection
// without a server hash as unchanged and keeps its persisted copy, so nobody
// ever asks for the collection and the hash never appears: staging showed
// pre-deploy command menu labels through reloads on 2026-09-05 until an API
// call happened to recompute them. Recompute what is missing before answering.
export const forkGetCompleteCacheHashes = async ({
  workspaceId,
  cacheKeyNames,
  workspaceCacheService,
  flatEntityMapsCacheService,
}: {
  workspaceId: string;
  cacheKeyNames: WorkspaceCacheKeyName[];
  workspaceCacheService: WorkspaceCacheService;
  flatEntityMapsCacheService: WorkspaceManyOrAllFlatEntityMapsCacheService;
}): Promise<Partial<Record<WorkspaceCacheKeyName, string>>> => {
  const cacheHashes = await workspaceCacheService.getCacheHashes(
    workspaceId,
    cacheKeyNames,
  );

  const missingKeyNames = cacheKeyNames.filter(
    (keyName) => !isDefined(cacheHashes[keyName]),
  );

  if (missingKeyNames.length === 0) {
    return cacheHashes;
  }

  await flatEntityMapsCacheService.getOrRecomputeManyOrAllFlatEntityMaps({
    workspaceId,
    flatMapsKeys: missingKeyNames as Parameters<
      WorkspaceManyOrAllFlatEntityMapsCacheService['getOrRecomputeManyOrAllFlatEntityMaps']
    >[0]['flatMapsKeys'],
  });

  return workspaceCacheService.getCacheHashes(workspaceId, cacheKeyNames);
};
