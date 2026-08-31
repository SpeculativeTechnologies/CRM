import { STANDARD_OBJECTS } from 'twenty-shared/metadata';

import { type WorkspaceIteratorService } from 'src/database/commands/command-runners/workspace-iterator.service';
import { AddMessageHeaderMessageIdIndexCommand } from 'src/database/commands/upgrade-version-command/2-35/2-35-workspace-command-1787680000000-add-message-header-message-id-index.command';
import { type ApplicationService } from 'src/engine/core-modules/application/application.service';
import { type WorkspaceCacheService } from 'src/engine/workspace-cache/services/workspace-cache.service';
import { type WorkspaceMigrationValidateBuildAndRunService } from 'src/engine/workspace-manager/workspace-migration/services/workspace-migration-validate-build-and-run-service';

const WORKSPACE_ID = '20202020-0000-0000-0000-000000000001';
const STANDARD_APPLICATION = {
  id: '20202020-0000-0000-0000-0000000000aa',
  universalIdentifier: '20202020-0000-0000-0000-0000000000bb',
};
const MESSAGE = STANDARD_OBJECTS.message;
const INDEX_UNIVERSAL_IDENTIFIER =
  MESSAGE.indexes.headerMessageIdIndex.universalIdentifier;

const buildByUniversalIdentifierMap = (universalIdentifiers: string[] = []) => ({
  byUniversalIdentifier: Object.fromEntries(
    universalIdentifiers.map((universalIdentifier) => [
      universalIdentifier,
      { universalIdentifier },
    ]),
  ),
});

describe('AddMessageHeaderMessageIdIndexCommand', () => {
  let command: AddMessageHeaderMessageIdIndexCommand;
  let applicationServiceMock: jest.Mock;
  let getOrRecomputeMock: jest.Mock;
  let validateBuildAndRunWorkspaceMigrationMock: jest.Mock;

  beforeEach(() => {
    applicationServiceMock = jest.fn().mockResolvedValue({
      twentyStandardFlatApplication: STANDARD_APPLICATION,
    });
    getOrRecomputeMock = jest.fn().mockResolvedValue({
      flatIndexMaps: buildByUniversalIdentifierMap(),
      flatObjectMetadataMaps: buildByUniversalIdentifierMap([
        MESSAGE.universalIdentifier,
      ]),
    });
    validateBuildAndRunWorkspaceMigrationMock = jest
      .fn()
      .mockResolvedValue({ status: 'success' });

    command = new AddMessageHeaderMessageIdIndexCommand(
      {} as WorkspaceIteratorService,
      {
        findWorkspaceTwentyStandardAndCustomApplicationOrThrow:
          applicationServiceMock,
      } as unknown as ApplicationService,
      {
        getOrRecompute: getOrRecomputeMock,
      } as unknown as WorkspaceCacheService,
      {
        validateBuildAndRunWorkspaceMigration:
          validateBuildAndRunWorkspaceMigrationMock,
      } as unknown as WorkspaceMigrationValidateBuildAndRunService,
    );
  });

  const runOnWorkspace = (dryRun = false) =>
    command.runOnWorkspace({
      workspaceId: WORKSPACE_ID,
      options: { dryRun },
      index: 0,
      total: 1,
    });

  it('creates the index on a workspace missing it', async () => {
    await runOnWorkspace();

    expect(validateBuildAndRunWorkspaceMigrationMock).toHaveBeenCalledWith(
      expect.objectContaining({
        isSystemBuild: true,
        applicationUniversalIdentifier:
          STANDARD_APPLICATION.universalIdentifier,
        workspaceId: WORKSPACE_ID,
        allFlatEntityOperationByMetadataName: {
          index: {
            flatEntityToCreate: [
              expect.objectContaining({
                universalIdentifier: INDEX_UNIVERSAL_IDENTIFIER,
              }),
            ],
            flatEntityToDelete: [],
            flatEntityToUpdate: [],
          },
        },
      }),
    );
  });

  it('skips a workspace that already has the index', async () => {
    getOrRecomputeMock.mockResolvedValue({
      flatIndexMaps: buildByUniversalIdentifierMap([
        INDEX_UNIVERSAL_IDENTIFIER,
      ]),
      flatObjectMetadataMaps: buildByUniversalIdentifierMap([
        MESSAGE.universalIdentifier,
      ]),
    });

    await runOnWorkspace();

    expect(validateBuildAndRunWorkspaceMigrationMock).not.toHaveBeenCalled();
  });

  it('skips a workspace that never got the Message object', async () => {
    getOrRecomputeMock.mockResolvedValue({
      flatIndexMaps: buildByUniversalIdentifierMap(),
      flatObjectMetadataMaps: buildByUniversalIdentifierMap(),
    });

    await runOnWorkspace();

    expect(applicationServiceMock).not.toHaveBeenCalled();
    expect(validateBuildAndRunWorkspaceMigrationMock).not.toHaveBeenCalled();
  });

  it('does not write metadata in dry-run mode', async () => {
    await runOnWorkspace(true);

    expect(validateBuildAndRunWorkspaceMigrationMock).not.toHaveBeenCalled();
  });
});
