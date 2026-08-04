import { WorkspaceManyOrAllFlatEntityMapsCacheService } from 'src/engine/metadata-modules/flat-entity/services/workspace-many-or-all-flat-entity-maps-cache.service';
import { type LogicFunctionFromSourceService } from 'src/engine/metadata-modules/logic-function/services/logic-function-from-source.service';
import { PrefillLogicFunctionService } from 'src/engine/workspace-manager/standard-objects-prefill-data/services/prefill-logic-function.service';

jest.mock(
  'src/engine/metadata-modules/logic-function/services/logic-function-from-source.service',
  () => ({ LogicFunctionFromSourceService: jest.fn() }),
);

describe('PrefillLogicFunctionService', () => {
  const definition = {
    id: 'logic-function-id',
    name: 'Seeded function',
    description: 'Seeded function description',
    sourceHandlerCode: 'export const main = async () => ({});',
  };

  const createService = ({
    existingLogicFunction,
    sourceCode,
  }: {
    existingLogicFunction?: object;
    sourceCode?: string | null;
  }) => {
    const logicFunctionFromSourceService = {
      createOneFromSource: jest.fn(),
      getSourceCode: jest.fn().mockResolvedValue(sourceCode),
      updateOneFromSource: jest.fn(),
    };
    const flatEntityMapsCacheService = {
      getOrRecomputeManyOrAllFlatEntityMaps: jest.fn().mockResolvedValue({
        flatLogicFunctionMaps: {
          byUniversalIdentifier: existingLogicFunction
            ? { 'logic-function-universal-id': existingLogicFunction }
            : {},
          universalIdentifierById: existingLogicFunction
            ? { [definition.id]: 'logic-function-universal-id' }
            : {},
          universalIdentifiersByApplicationId: {},
        },
      }),
    };

    return {
      logicFunctionFromSourceService,
      service: new PrefillLogicFunctionService(
        logicFunctionFromSourceService as unknown as LogicFunctionFromSourceService,
        flatEntityMapsCacheService as unknown as WorkspaceManyOrAllFlatEntityMapsCacheService,
      ),
    };
  };

  it('creates a seeded function when its metadata is missing', async () => {
    const { service, logicFunctionFromSourceService } = createService({});

    await service.ensureSeeded({
      workspaceId: 'workspace-id',
      definitions: [definition],
    });

    expect(
      logicFunctionFromSourceService.createOneFromSource,
    ).toHaveBeenCalledWith({
      workspaceId: 'workspace-id',
      input: {
        id: definition.id,
        name: definition.name,
        description: definition.description,
        source: {
          sourceHandlerCode: definition.sourceHandlerCode,
          handlerName: 'main',
        },
      },
    });
  });

  it('keeps an existing source file unchanged', async () => {
    const { service, logicFunctionFromSourceService } = createService({
      existingLogicFunction: { id: definition.id },
      sourceCode: 'custom source',
    });

    await service.ensureSeeded({
      workspaceId: 'workspace-id',
      definitions: [definition],
    });

    expect(
      logicFunctionFromSourceService.updateOneFromSource,
    ).not.toHaveBeenCalled();
  });

  it('restores the seeded source only when its file is missing', async () => {
    const { service, logicFunctionFromSourceService } = createService({
      existingLogicFunction: { id: definition.id },
      sourceCode: null,
    });

    await service.ensureSeeded({
      workspaceId: 'workspace-id',
      definitions: [definition],
    });

    expect(
      logicFunctionFromSourceService.updateOneFromSource,
    ).toHaveBeenCalledWith({
      workspaceId: 'workspace-id',
      updateLogicFunctionFromSourceInput: {
        id: definition.id,
        update: {
          sourceHandlerCode: definition.sourceHandlerCode,
        },
      },
    });
  });
});
