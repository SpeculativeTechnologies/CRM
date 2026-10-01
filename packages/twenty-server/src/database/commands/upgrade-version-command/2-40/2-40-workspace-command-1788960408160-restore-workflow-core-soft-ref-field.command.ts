import { Command } from 'nest-commander';
import { STANDARD_OBJECTS } from 'twenty-shared/metadata';
import { isDefined } from 'twenty-shared/utils';

import { ProvisionedWorkspaceCommandRunner } from 'src/database/commands/command-runners/provisioned-workspace.command-runner';
import { WorkspaceIteratorService } from 'src/database/commands/command-runners/workspace-iterator.service';
import { type RunOnWorkspaceArgs } from 'src/database/commands/command-runners/workspace.command-runner';
import { ApplicationService } from 'src/engine/core-modules/application/application.service';
import { RegisteredWorkspaceCommand } from 'src/engine/core-modules/upgrade/decorators/registered-workspace-command.decorator';
import { type FlatFieldMetadata } from 'src/engine/metadata-modules/flat-field-metadata/types/flat-field-metadata.type';
import { WorkspaceCacheService } from 'src/engine/workspace-cache/services/workspace-cache.service';
import { computeTwentyStandardApplicationAllFlatEntityMaps } from 'src/engine/workspace-manager/twenty-standard-application/utils/twenty-standard-application-all-flat-entity-maps.constant';
import { WorkspaceMigrationValidateBuildAndRunService } from 'src/engine/workspace-manager/workspace-migration/services/workspace-migration-validate-build-and-run-service';

const WORKFLOW = STANDARD_OBJECTS.workflow;
const CORE_WORKFLOW_ID_FIELD_UNIVERSAL_IDENTIFIER =
  WORKFLOW.fields.coreWorkflowId.universalIdentifier;

// Upstream's 2.23 add-workflow-core-soft-ref-field never ran on the boxes: it
// sits below the catch-up floor. From 2.40 on, the workflow backfills read
// workflow.coreWorkflowId and fail with "column does not exist" without it.
// Only the field comes back here. 2.23's companion backfill deletes and
// rebuilds every core workflow, which is not safe this late; upstream's 2.42
// execution backfill creates and links the missing core workflows instead.
@RegisteredWorkspaceCommand('2.40.0', 1788960408160)
@Command({
  name: 'upgrade:2-40:restore-workflow-core-soft-ref-field',
  description:
    'Add the workflow.coreWorkflowId field that upstream 2.23 adds, on workspaces that never ran it',
})
export class RestoreWorkflowCoreSoftRefFieldCommand extends ProvisionedWorkspaceCommandRunner {
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

    const { flatFieldMetadataMaps, flatObjectMetadataMaps } =
      await this.workspaceCacheService.getOrRecompute(workspaceId, [
        'flatFieldMetadataMaps',
        'flatObjectMetadataMaps',
      ]);

    if (
      !isDefined(
        flatObjectMetadataMaps.byUniversalIdentifier[WORKFLOW.universalIdentifier],
      ) ||
      isDefined(
        flatFieldMetadataMaps.byUniversalIdentifier[
          CORE_WORKFLOW_ID_FIELD_UNIVERSAL_IDENTIFIER
        ],
      )
    ) {
      this.logger.log(
        `workflow.coreWorkflowId present or no workflow object for workspace ${workspaceId}, skipping`,
      );

      return;
    }

    const { twentyStandardFlatApplication } =
      await this.applicationService.findWorkspaceTwentyStandardAndCustomApplicationOrThrow(
        { workspaceId },
      );

    const { allFlatEntityMaps: standardAllFlatEntityMaps } =
      computeTwentyStandardApplicationAllFlatEntityMaps({
        now: new Date().toISOString(),
        workspaceId,
        twentyStandardApplicationId: twentyStandardFlatApplication.id,
      });

    const standardField =
      standardAllFlatEntityMaps.flatFieldMetadataMaps.byUniversalIdentifier[
        CORE_WORKFLOW_ID_FIELD_UNIVERSAL_IDENTIFIER
      ];

    if (!isDefined(standardField)) {
      throw new Error(
        'Standard application is missing workflow field coreWorkflowId',
      );
    }

    this.logger.log(
      `${isDryRun ? '[DRY RUN] Would restore' : 'Restoring'} the workflow.coreWorkflowId field for workspace ${workspaceId}`,
    );

    if (isDryRun) {
      return;
    }

    const flatFieldMetadataToCreate: FlatFieldMetadata = {
      ...standardField,
      viewFieldIds: [],
      viewFieldUniversalIdentifiers: [],
    };

    const result =
      await this.workspaceMigrationValidateBuildAndRunService.validateBuildAndRunLegacyWorkspaceMigration(
        {
          isSystemBuild: true,
          workspaceId,
          applicationUniversalIdentifier:
            twentyStandardFlatApplication.universalIdentifier,
          allFlatEntityOperationByMetadataName: {
            fieldMetadata: {
              flatEntityToCreate: [flatFieldMetadataToCreate],
              flatEntityToDelete: [],
              flatEntityToUpdate: [],
            },
          },
        },
      );

    if (result.status === 'fail') {
      this.logger.error(
        `Failed to restore the workflow.coreWorkflowId field:\n${JSON.stringify(result, null, 2)}`,
      );

      throw new Error(
        `Failed to restore the workflow.coreWorkflowId field for workspace ${workspaceId}`,
      );
    }
  }
}
