import { STANDARD_OBJECTS } from 'twenty-shared/metadata';

import { type WorkspaceIteratorService } from 'src/database/commands/command-runners/workspace-iterator.service';
import { AddMessageCampaignCcAddressesFieldCommand } from 'src/database/commands/upgrade-version-command/2-35/2-35-workspace-command-1787600000000-add-message-campaign-cc-addresses-field.command';
import { type ApplicationService } from 'src/engine/core-modules/application/application.service';
import { type WorkspaceCacheService } from 'src/engine/workspace-cache/services/workspace-cache.service';
import { type WorkspaceMigrationValidateBuildAndRunService } from 'src/engine/workspace-manager/workspace-migration/services/workspace-migration-validate-build-and-run-service';

const WORKSPACE_ID = '20202020-0000-0000-0000-000000000001';
const STANDARD_APPLICATION = {
  id: '20202020-0000-0000-0000-0000000000aa',
  universalIdentifier: '20202020-0000-0000-0000-0000000000bb',
};
const MESSAGE_CAMPAIGN = STANDARD_OBJECTS.messageCampaign;

const buildByUniversalIdentifierMap = (
  universalIdentifiers: string[] = [],
) => ({
  byUniversalIdentifier: Object.fromEntries(
    universalIdentifiers.map((universalIdentifier) => [
      universalIdentifier,
      { universalIdentifier },
    ]),
  ),
});

describe('AddMessageCampaignCcAddressesFieldCommand', () => {
  let command: AddMessageCampaignCcAddressesFieldCommand;
  let applicationServiceMock: jest.Mock;
  let getOrRecomputeMock: jest.Mock;
  let validateBuildAndRunWorkspaceMigrationMock: jest.Mock;

  beforeEach(() => {
    applicationServiceMock = jest.fn().mockResolvedValue({
      twentyStandardFlatApplication: STANDARD_APPLICATION,
    });
    getOrRecomputeMock = jest.fn().mockResolvedValue({
      flatFieldMetadataMaps: buildByUniversalIdentifierMap(),
      flatObjectMetadataMaps: buildByUniversalIdentifierMap([
        MESSAGE_CAMPAIGN.universalIdentifier,
      ]),
    });
    validateBuildAndRunWorkspaceMigrationMock = jest
      .fn()
      .mockResolvedValue({ status: 'success' });

    command = new AddMessageCampaignCcAddressesFieldCommand(
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

  it('creates MessageCampaign.ccAddresses when an existing workspace is missing it', async () => {
    await runOnWorkspace();

    expect(validateBuildAndRunWorkspaceMigrationMock).toHaveBeenCalledWith(
      expect.objectContaining({
        isSystemBuild: true,
        applicationUniversalIdentifier:
          STANDARD_APPLICATION.universalIdentifier,
        workspaceId: WORKSPACE_ID,
        allFlatEntityOperationByMetadataName: {
          fieldMetadata: {
            flatEntityToCreate: [
              expect.objectContaining({
                universalIdentifier:
                  MESSAGE_CAMPAIGN.fields.ccAddresses.universalIdentifier,
                name: 'ccAddresses',
              }),
            ],
            flatEntityToDelete: [],
            flatEntityToUpdate: [],
          },
        },
      }),
    );
  });

  it('skips an already-upgraded workspace without building a migration', async () => {
    getOrRecomputeMock.mockResolvedValue({
      flatFieldMetadataMaps: buildByUniversalIdentifierMap([
        MESSAGE_CAMPAIGN.fields.ccAddresses.universalIdentifier,
      ]),
      flatObjectMetadataMaps: buildByUniversalIdentifierMap([
        MESSAGE_CAMPAIGN.universalIdentifier,
      ]),
    });

    await runOnWorkspace();

    expect(applicationServiceMock).not.toHaveBeenCalled();
    expect(validateBuildAndRunWorkspaceMigrationMock).not.toHaveBeenCalled();
  });

  it('skips a workspace without the MessageCampaign object', async () => {
    getOrRecomputeMock.mockResolvedValue({
      flatFieldMetadataMaps: buildByUniversalIdentifierMap(),
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
