import { STANDARD_OBJECTS } from 'twenty-shared/metadata';

import { type WorkspaceIteratorService } from 'src/database/commands/command-runners/workspace-iterator.service';
import { AddMessageReplyTrackingFieldsCommand } from 'src/database/commands/upgrade-version-command/2-35/2-35-workspace-command-1787660000000-add-message-reply-tracking-fields.command';
import { type ApplicationService } from 'src/engine/core-modules/application/application.service';
import { type WorkspaceCacheService } from 'src/engine/workspace-cache/services/workspace-cache.service';
import { type WorkspaceMigrationValidateBuildAndRunService } from 'src/engine/workspace-manager/workspace-migration/services/workspace-migration-validate-build-and-run-service';

const WORKSPACE_ID = '20202020-0000-0000-0000-000000000001';
const STANDARD_APPLICATION = {
  id: '20202020-0000-0000-0000-0000000000aa',
  universalIdentifier: '20202020-0000-0000-0000-0000000000bb',
};
const MESSAGE = STANDARD_OBJECTS.message;
const MESSAGE_CAMPAIGN = STANDARD_OBJECTS.messageCampaign;

const ALL_OBJECT_UNIVERSAL_IDENTIFIERS = [
  MESSAGE.universalIdentifier,
  MESSAGE_CAMPAIGN.universalIdentifier,
];

const REPLY_FIELDS = [
  {
    universalIdentifier: MESSAGE.fields.repliedAt.universalIdentifier,
    name: 'repliedAt',
  },
  {
    universalIdentifier:
      MESSAGE_CAMPAIGN.fields.repliedCount.universalIdentifier,
    name: 'repliedCount',
  },
];

const buildByUniversalIdentifierMap = (universalIdentifiers: string[] = []) => ({
  byUniversalIdentifier: Object.fromEntries(
    universalIdentifiers.map((universalIdentifier) => [
      universalIdentifier,
      { universalIdentifier },
    ]),
  ),
});

describe('AddMessageReplyTrackingFieldsCommand', () => {
  let command: AddMessageReplyTrackingFieldsCommand;
  let applicationServiceMock: jest.Mock;
  let getOrRecomputeMock: jest.Mock;
  let validateBuildAndRunWorkspaceMigrationMock: jest.Mock;

  beforeEach(() => {
    applicationServiceMock = jest.fn().mockResolvedValue({
      twentyStandardFlatApplication: STANDARD_APPLICATION,
    });
    getOrRecomputeMock = jest.fn().mockResolvedValue({
      flatFieldMetadataMaps: buildByUniversalIdentifierMap(),
      flatObjectMetadataMaps: buildByUniversalIdentifierMap(
        ALL_OBJECT_UNIVERSAL_IDENTIFIERS,
      ),
    });
    validateBuildAndRunWorkspaceMigrationMock = jest
      .fn()
      .mockResolvedValue({ status: 'success' });

    command = new AddMessageReplyTrackingFieldsCommand(
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

  it('creates both reply fields on a workspace missing them', async () => {
    await runOnWorkspace();

    expect(validateBuildAndRunWorkspaceMigrationMock).toHaveBeenCalledWith(
      expect.objectContaining({
        isSystemBuild: true,
        applicationUniversalIdentifier:
          STANDARD_APPLICATION.universalIdentifier,
        workspaceId: WORKSPACE_ID,
        allFlatEntityOperationByMetadataName: {
          fieldMetadata: {
            flatEntityToCreate: REPLY_FIELDS.map((field) =>
              expect.objectContaining(field),
            ),
            flatEntityToDelete: [],
            flatEntityToUpdate: [],
          },
        },
      }),
    );
  });

  it('creates only the missing fields on a partially upgraded workspace', async () => {
    getOrRecomputeMock.mockResolvedValue({
      flatFieldMetadataMaps: buildByUniversalIdentifierMap([
        MESSAGE.fields.repliedAt.universalIdentifier,
      ]),
      flatObjectMetadataMaps: buildByUniversalIdentifierMap(
        ALL_OBJECT_UNIVERSAL_IDENTIFIERS,
      ),
    });

    await runOnWorkspace();

    expect(validateBuildAndRunWorkspaceMigrationMock).toHaveBeenCalledWith(
      expect.objectContaining({
        allFlatEntityOperationByMetadataName: {
          fieldMetadata: {
            flatEntityToCreate: REPLY_FIELDS.slice(1).map((field) =>
              expect.objectContaining(field),
            ),
            flatEntityToDelete: [],
            flatEntityToUpdate: [],
          },
        },
      }),
    );
  });

  it('skips an already-upgraded workspace without building a migration', async () => {
    getOrRecomputeMock.mockResolvedValue({
      flatFieldMetadataMaps: buildByUniversalIdentifierMap(
        REPLY_FIELDS.map(({ universalIdentifier }) => universalIdentifier),
      ),
      flatObjectMetadataMaps: buildByUniversalIdentifierMap(
        ALL_OBJECT_UNIVERSAL_IDENTIFIERS,
      ),
    });

    await runOnWorkspace();

    expect(validateBuildAndRunWorkspaceMigrationMock).not.toHaveBeenCalled();
  });

  it('skips a workspace that never got the campaign objects', async () => {
    getOrRecomputeMock.mockResolvedValue({
      flatFieldMetadataMaps: buildByUniversalIdentifierMap(),
      flatObjectMetadataMaps: buildByUniversalIdentifierMap([
        MESSAGE.universalIdentifier,
      ]),
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
