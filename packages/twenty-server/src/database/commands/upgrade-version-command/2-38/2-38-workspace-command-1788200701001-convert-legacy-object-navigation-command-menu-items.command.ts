import { Command } from 'nest-commander';
import { isDefined } from 'twenty-shared/utils';

import { ProvisionedWorkspaceCommandRunner } from 'src/database/commands/command-runners/provisioned-workspace.command-runner';
import { WorkspaceIteratorService } from 'src/database/commands/command-runners/workspace-iterator.service';
import { type RunOnWorkspaceArgs } from 'src/database/commands/command-runners/workspace.command-runner';
import { computeObjectNavigationTargetBackfill } from 'src/database/commands/upgrade-version-command/2-35/utils/compute-object-navigation-target-backfill.util';
import { ApplicationService } from 'src/engine/core-modules/application/application.service';
import { RegisteredWorkspaceCommand } from 'src/engine/core-modules/upgrade/decorators/registered-workspace-command.decorator';
import { WorkspaceCacheService } from 'src/engine/workspace-cache/services/workspace-cache.service';
import { WorkspaceMigrationValidateBuildAndRunService } from 'src/engine/workspace-manager/workspace-migration/services/workspace-migration-validate-build-and-run-service';

// Upstream's 2.38 campaign schema sync still builds object navigation items in
// the legacy { objectMetadataItemId } payload shape, and it runs after the 2.35
// backfill that converts that shape. The 2.38 API hides object payloads, so the
// three campaign objects end up with navigation items the app cannot route
// (staging, 2026-09-04: six such items). Convert whatever legacy items exist
// once the sync has run, using the 2.35 backfill's own logic with the payload
// cleared, as the exclusive 2.38 coherence check requires. Idempotent.
@RegisteredWorkspaceCommand('2.38.0', 1788200701001)
@Command({
  name: 'upgrade:2-38:convert-legacy-object-navigation-command-menu-items',
  description:
    'Give object navigation command menu items created in the legacy payload shape their navigation target, after the 2.38 campaign schema sync',
})
export class ConvertLegacyObjectNavigationCommandMenuItemsCommand extends ProvisionedWorkspaceCommandRunner {
  constructor(
    protected readonly workspaceIteratorService: WorkspaceIteratorService,
    private readonly applicationService: ApplicationService,
    private readonly workspaceCacheService: WorkspaceCacheService,
    private readonly workspaceMigrationValidateBuildAndRunService: WorkspaceMigrationValidateBuildAndRunService,
  ) {
    super(workspaceIteratorService);
  }

  override async runOnWorkspace({
    workspaceId,
    options,
  }: RunOnWorkspaceArgs): Promise<void> {
    const isDryRun = options.dryRun ?? false;

    const { flatCommandMenuItemMaps, flatObjectMetadataMaps } =
      await this.workspaceCacheService.getOrRecompute(workspaceId, [
        'flatCommandMenuItemMaps',
        'flatObjectMetadataMaps',
      ]);

    const { flatCommandMenuItemsToUpdate, flatCommandMenuItemsToDelete } =
      computeObjectNavigationTargetBackfill({
        flatCommandMenuItemMaps,
        flatObjectMetadataMaps,
        now: new Date().toISOString(),
        clearPayload: true,
      });

    if (
      flatCommandMenuItemsToUpdate.length === 0 &&
      flatCommandMenuItemsToDelete.length === 0
    ) {
      this.logger.log(
        `No legacy object navigation command menu item for workspace ${workspaceId}`,
      );

      return;
    }

    this.logger.log(
      `${isDryRun ? '[DRY RUN] Would convert' : 'Converting'} ${flatCommandMenuItemsToUpdate.length} legacy object navigation command menu item(s) and ${isDryRun ? 'delete' : 'deleting'} ${flatCommandMenuItemsToDelete.length} orphaned one(s) for workspace ${workspaceId}`,
    );

    if (isDryRun) {
      return;
    }

    const { twentyStandardFlatApplication } =
      await this.applicationService.findWorkspaceTwentyStandardAndCustomApplicationOrThrow(
        { workspaceId },
      );

    const validateAndBuildResult =
      await this.workspaceMigrationValidateBuildAndRunService.validateBuildAndRunWorkspaceMigration(
        {
          allFlatEntityOperationByMetadataName: {
            commandMenuItem: {
              flatEntityToCreate: [],
              flatEntityToDelete: flatCommandMenuItemsToDelete,
              flatEntityToUpdate: flatCommandMenuItemsToUpdate,
            },
          },
          workspaceId,
          applicationUniversalIdentifier:
            twentyStandardFlatApplication.universalIdentifier,
        },
      );

    if (validateAndBuildResult.status === 'fail') {
      throw new Error(
        `Failed to convert legacy object navigation command menu items for workspace ${workspaceId}:\n${JSON.stringify(validateAndBuildResult, null, 2)}`,
      );
    }

    if (isDefined(flatCommandMenuItemsToUpdate[0])) {
      this.logger.log(
        `Converted ${flatCommandMenuItemsToUpdate.length} legacy object navigation command menu item(s) for workspace ${workspaceId}`,
      );
    }
  }
}
