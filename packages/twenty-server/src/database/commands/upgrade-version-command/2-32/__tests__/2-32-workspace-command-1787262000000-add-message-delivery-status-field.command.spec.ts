import { STANDARD_OBJECTS } from 'twenty-shared/metadata';

import { type WorkspaceIteratorService } from 'src/database/commands/command-runners/workspace-iterator.service';
import { AddMessageDeliveryStatusFieldCommand } from 'src/database/commands/upgrade-version-command/2-32/2-32-workspace-command-1787262000000-add-message-delivery-status-field.command';
import { type ApplicationService } from 'src/engine/core-modules/application/application.service';
import { type WorkspaceCacheService } from 'src/engine/workspace-cache/services/workspace-cache.service';
import { type WorkspaceMigrationValidateBuildAndRunService } from 'src/engine/workspace-manager/workspace-migration/services/workspace-migration-validate-build-and-run-service';

const WORKSPACE_ID = '20202020-0000-0000-0000-000000000001';
const STANDARD_APPLICATION = {
  id: '20202020-0000-0000-0000-0000000000aa',
  universalIdentifier: '20202020-0000-0000-0000-0000000000bb',
};
const MESSAGE = STANDARD_OBJECTS.message;
const DELIVERY_STATUS_FIELD_UNIVERSAL_IDENTIFIER =
  '209254fa-2b89-429d-a72a-c401c4bd5a78';

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

describe('AddMessageDeliveryStatusFieldCommand', () => {
  let command: AddMessageDeliveryStatusFieldCommand;
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
        MESSAGE.universalIdentifier,
      ]),
    });
    validateBuildAndRunWorkspaceMigrationMock = jest
      .fn()
      .mockResolvedValue({ status: 'success' });

    command = new AddMessageDeliveryStatusFieldCommand(
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

  // The 2-38 command removed deliveryStatus from the standard application, so
  // this command can no longer build the field and must leave the workspace as
  // it found it instead of throwing.
  it('skips a workspace missing the field now that the standard application no longer defines it', async () => {
    await runOnWorkspace();

    expect(applicationServiceMock).toHaveBeenCalled();
    expect(validateBuildAndRunWorkspaceMigrationMock).not.toHaveBeenCalled();
  });

  it('skips an already-correct workspace without building a migration', async () => {
    getOrRecomputeMock.mockResolvedValue({
      flatFieldMetadataMaps: buildByUniversalIdentifierMap([
        DELIVERY_STATUS_FIELD_UNIVERSAL_IDENTIFIER,
      ]),
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
