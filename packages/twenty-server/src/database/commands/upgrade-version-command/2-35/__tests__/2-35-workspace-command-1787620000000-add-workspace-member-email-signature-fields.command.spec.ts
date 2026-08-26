import { STANDARD_OBJECTS } from 'twenty-shared/metadata';

import { type WorkspaceIteratorService } from 'src/database/commands/command-runners/workspace-iterator.service';
import { AddWorkspaceMemberEmailSignatureFieldsCommand } from 'src/database/commands/upgrade-version-command/2-35/2-35-workspace-command-1787620000000-add-workspace-member-email-signature-fields.command';
import { type ApplicationService } from 'src/engine/core-modules/application/application.service';
import { type WorkspaceCacheService } from 'src/engine/workspace-cache/services/workspace-cache.service';
import { type WorkspaceMigrationValidateBuildAndRunService } from 'src/engine/workspace-manager/workspace-migration/services/workspace-migration-validate-build-and-run-service';

const WORKSPACE_ID = '20202020-0000-0000-0000-000000000001';
const STANDARD_APPLICATION = {
  id: '20202020-0000-0000-0000-0000000000aa',
  universalIdentifier: '20202020-0000-0000-0000-0000000000bb',
};
const WORKSPACE_MEMBER = STANDARD_OBJECTS.workspaceMember;
const EMAIL_SIGNATURE_UNIVERSAL_IDENTIFIER =
  WORKSPACE_MEMBER.fields.emailSignature.universalIdentifier;
const INCLUDED_BY_DEFAULT_UNIVERSAL_IDENTIFIER =
  WORKSPACE_MEMBER.fields.isEmailSignatureIncludedByDefault
    .universalIdentifier;

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

describe('AddWorkspaceMemberEmailSignatureFieldsCommand', () => {
  let command: AddWorkspaceMemberEmailSignatureFieldsCommand;
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
        WORKSPACE_MEMBER.universalIdentifier,
      ]),
    });
    validateBuildAndRunWorkspaceMigrationMock = jest
      .fn()
      .mockResolvedValue({ status: 'success' });

    command = new AddWorkspaceMemberEmailSignatureFieldsCommand(
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

  it('creates both signature fields when an existing workspace is missing them', async () => {
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
                universalIdentifier: EMAIL_SIGNATURE_UNIVERSAL_IDENTIFIER,
                name: 'emailSignature',
              }),
              expect.objectContaining({
                universalIdentifier: INCLUDED_BY_DEFAULT_UNIVERSAL_IDENTIFIER,
                name: 'isEmailSignatureIncludedByDefault',
              }),
            ],
            flatEntityToDelete: [],
            flatEntityToUpdate: [],
          },
        },
      }),
    );
  });

  it('creates only the missing field on a partially upgraded workspace', async () => {
    getOrRecomputeMock.mockResolvedValue({
      flatFieldMetadataMaps: buildByUniversalIdentifierMap([
        EMAIL_SIGNATURE_UNIVERSAL_IDENTIFIER,
      ]),
      flatObjectMetadataMaps: buildByUniversalIdentifierMap([
        WORKSPACE_MEMBER.universalIdentifier,
      ]),
    });

    await runOnWorkspace();

    expect(validateBuildAndRunWorkspaceMigrationMock).toHaveBeenCalledWith(
      expect.objectContaining({
        allFlatEntityOperationByMetadataName: {
          fieldMetadata: {
            flatEntityToCreate: [
              expect.objectContaining({
                universalIdentifier: INCLUDED_BY_DEFAULT_UNIVERSAL_IDENTIFIER,
                name: 'isEmailSignatureIncludedByDefault',
              }),
            ],
            flatEntityToDelete: [],
            flatEntityToUpdate: [],
          },
        },
      }),
    );
  });

  it('skips an already-correct workspace without building a migration', async () => {
    getOrRecomputeMock.mockResolvedValue({
      flatFieldMetadataMaps: buildByUniversalIdentifierMap([
        EMAIL_SIGNATURE_UNIVERSAL_IDENTIFIER,
        INCLUDED_BY_DEFAULT_UNIVERSAL_IDENTIFIER,
      ]),
      flatObjectMetadataMaps: buildByUniversalIdentifierMap([
        WORKSPACE_MEMBER.universalIdentifier,
      ]),
    });

    await runOnWorkspace();

    expect(validateBuildAndRunWorkspaceMigrationMock).not.toHaveBeenCalled();
  });

  it('skips a workspace without the workspaceMember object', async () => {
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
