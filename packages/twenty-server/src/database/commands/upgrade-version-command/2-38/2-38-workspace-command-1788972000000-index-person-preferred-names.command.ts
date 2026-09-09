import { Command } from 'nest-commander';
import { isDefined } from 'twenty-shared/utils';

import { ProvisionedWorkspaceCommandRunner } from 'src/database/commands/command-runners/provisioned-workspace.command-runner';
import { WorkspaceIteratorService } from 'src/database/commands/command-runners/workspace-iterator.service';
import { type RunOnWorkspaceArgs } from 'src/database/commands/command-runners/workspace.command-runner';
import { buildPersonPreferredNameSearchFields } from 'src/database/commands/upgrade-version-command/2-38/utils/build-person-preferred-name-search-fields.util';
import { RegisteredWorkspaceCommand } from 'src/engine/core-modules/upgrade/decorators/registered-workspace-command.decorator';
import { WorkspaceCacheService } from 'src/engine/workspace-cache/services/workspace-cache.service';
import { WorkspaceMigrationValidateBuildAndRunService } from 'src/engine/workspace-manager/workspace-migration/services/workspace-migration-validate-build-and-run-service';
import { WORKSPACE_MIGRATION_ACTION_TYPE } from 'src/engine/workspace-manager/workspace-migration/workspace-migration-builder/constants/workspace-migration-action-type.constant';
import { WorkspaceMigrationRunnerService } from 'src/engine/workspace-manager/workspace-migration/workspace-migration-runner/services/workspace-migration-runner.service';

@RegisteredWorkspaceCommand('2.38.0', 1788972000000)
@Command({
  name: 'upgrade:2-38:index-person-preferred-names',
  description:
    'Include the existing preferred name field in person search while preserving stored-name search',
})
export class IndexPersonPreferredNamesCommand extends ProvisionedWorkspaceCommandRunner {
  constructor(
    protected readonly workspaceIteratorService: WorkspaceIteratorService,
    private readonly workspaceCacheService: WorkspaceCacheService,
    private readonly workspaceMigrationValidateBuildAndRunService: WorkspaceMigrationValidateBuildAndRunService,
    private readonly workspaceMigrationRunnerService: WorkspaceMigrationRunnerService,
  ) {
    super(workspaceIteratorService);
  }

  override async runOnWorkspace({
    workspaceId,
    options,
  }: RunOnWorkspaceArgs): Promise<void> {
    await this.workspaceCacheService.invalidateAndRecompute(workspaceId, [
      'flatObjectMetadataMaps',
      'flatFieldMetadataMaps',
      'flatSearchFieldMetadataMaps',
    ]);
    const {
      flatObjectMetadataMaps,
      flatFieldMetadataMaps,
      flatSearchFieldMetadataMaps,
    } = await this.workspaceCacheService.getOrRecompute(workspaceId, [
      'flatObjectMetadataMaps',
      'flatFieldMetadataMaps',
      'flatSearchFieldMetadataMaps',
    ]);
    const person = Object.values(
      flatObjectMetadataMaps.byUniversalIdentifier,
    ).find((object) => object?.nameSingular === 'person' && object.isActive);

    if (!isDefined(person)) {
      return;
    }

    const plan = buildPersonPreferredNameSearchFields({
      person,
      fields: Object.values(flatFieldMetadataMaps.byUniversalIdentifier).filter(
        isDefined,
      ),
      searchFields: Object.values(
        flatSearchFieldMetadataMaps.byUniversalIdentifier,
      ).filter(isDefined),
    });

    if (!isDefined(plan) || options.dryRun) {
      return;
    }

    const applicationIdentifiers = new Set(
      plan.fieldsToCreate.map((field) => field.applicationUniversalIdentifier),
    );

    for (const applicationUniversalIdentifier of applicationIdentifiers) {
      const result =
        await this.workspaceMigrationValidateBuildAndRunService.validateBuildAndRunLegacyWorkspaceMigration(
          {
            isSystemBuild: true,
            workspaceId,
            applicationUniversalIdentifier,
            allFlatEntityOperationByMetadataName: {
              searchFieldMetadata: {
                flatEntityToCreate: plan.fieldsToCreate.filter(
                  (field) =>
                    field.applicationUniversalIdentifier ===
                    applicationUniversalIdentifier,
                ),
                flatEntityToUpdate: [],
                flatEntityToDelete: [],
              },
            },
          },
        );

      if (result.status === 'fail') {
        throw new Error(
          `Failed to index person preferred names for workspace ${workspaceId}: ${JSON.stringify(result)}`,
        );
      }
    }

    // Rebuild even on a retry: a previous run may have saved the metadata
    // before its generated-column update failed.
    await this.workspaceMigrationRunnerService.run({
      workspaceId,
      workspaceMigration: {
        applicationUniversalIdentifier: person.applicationUniversalIdentifier,
        actions: [
          {
            type: WORKSPACE_MIGRATION_ACTION_TYPE.update,
            metadataName: 'fieldMetadata',
            universalIdentifier: plan.searchVector.universalIdentifier,
            update: { universalSettings: null },
            rebuildSearchVector: true,
          },
        ],
      },
    });
  }
}
