import { Command } from 'nest-commander';

import { isDefined } from 'twenty-shared/utils';
import { v4 } from 'uuid';

import { ProvisionedWorkspaceCommandRunner } from 'src/database/commands/command-runners/provisioned-workspace.command-runner';
import { WorkspaceIteratorService } from 'src/database/commands/command-runners/workspace-iterator.service';
import { type RunOnWorkspaceArgs } from 'src/database/commands/command-runners/workspace.command-runner';
import { computeMissingLabelIdentifierViewFields } from 'src/database/commands/upgrade-version-command/2-32/utils/compute-missing-label-identifier-view-fields.util';
import { ApplicationService } from 'src/engine/core-modules/application/application.service';
import { RegisteredWorkspaceCommand } from 'src/engine/core-modules/upgrade/decorators/registered-workspace-command.decorator';
import { WorkspaceCacheService } from 'src/engine/workspace-cache/services/workspace-cache.service';
import { WorkspaceMigrationValidateBuildAndRunService } from 'src/engine/workspace-manager/workspace-migration/services/workspace-migration-validate-build-and-run-service';

// Registered under the CURRENT version: the deploy-time upgrade only fires
// commands for the previous and current versions, so a 2.25.0 registration
// would never run automatically while the app is at 2.32.0.
@RegisteredWorkspaceCommand('2.32.0', 1786838400000)
@Command({
  name: 'upgrade:2-32:backfill-missing-label-identifier-view-fields',
  description:
    'Add the missing label identifier column to views that lack one, so their first column is the record label again and their columns can be reordered',
})
export class BackfillMissingLabelIdentifierViewFieldsCommand extends ProvisionedWorkspaceCommandRunner {
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

    const {
      flatObjectMetadataMaps,
      flatFieldMetadataMaps,
      flatViewMaps,
      flatViewFieldMaps,
    } = await this.workspaceCacheService.getOrRecompute(workspaceId, [
      'flatObjectMetadataMaps',
      'flatFieldMetadataMaps',
      'flatViewMaps',
      'flatViewFieldMaps',
    ]);

    const { twentyStandardFlatApplication, workspaceCustomFlatApplication } =
      await this.applicationService.findWorkspaceTwentyStandardAndCustomApplicationOrThrow(
        { workspaceId },
      );

    const labelIdentifierByObjectUniversalIdentifier = Object.fromEntries(
      Object.values(flatObjectMetadataMaps.byUniversalIdentifier)
        .filter(isDefined)
        .flatMap((flatObjectMetadata) => {
          const labelIdentifierFieldMetadataUniversalIdentifier =
            flatObjectMetadata.labelIdentifierFieldMetadataUniversalIdentifier;

          if (!isDefined(labelIdentifierFieldMetadataUniversalIdentifier)) {
            return [];
          }

          const labelIdentifierFieldMetadata =
            flatFieldMetadataMaps.byUniversalIdentifier[
              labelIdentifierFieldMetadataUniversalIdentifier
            ];

          if (!isDefined(labelIdentifierFieldMetadata)) {
            return [];
          }

          return [
            [
              flatObjectMetadata.universalIdentifier,
              {
                fieldMetadataId: labelIdentifierFieldMetadata.id,
                fieldMetadataUniversalIdentifier:
                  labelIdentifierFieldMetadataUniversalIdentifier,
              },
            ],
          ];
        }),
    );

    const flatViews = Object.values(flatViewMaps.byUniversalIdentifier).filter(
      isDefined,
    );

    const flatViewFieldsByViewUniversalIdentifier = Object.fromEntries(
      flatViews.map((flatView) => [
        flatView.universalIdentifier,
        flatView.viewFieldUniversalIdentifiers
          .map(
            (viewFieldUniversalIdentifier) =>
              flatViewFieldMaps.byUniversalIdentifier[
                viewFieldUniversalIdentifier
              ],
          )
          .filter(isDefined)
          .filter((flatViewField) => !isDefined(flatViewField.deletedAt)),
      ]),
    );

    const viewFieldsToCreate = computeMissingLabelIdentifierViewFields({
      flatViews,
      flatViewFieldsByViewUniversalIdentifier,
      labelIdentifierByObjectUniversalIdentifier,
      // The standard application owns the layout of its own views, and some of
      // them purposely have no label identifier column. Touching those would
      // only give the standard-application sync something to revert.
      excludedApplicationUniversalIdentifiers: [
        twentyStandardFlatApplication.universalIdentifier,
      ],
      ownerApplication: {
        id: workspaceCustomFlatApplication.id,
        universalIdentifier: workspaceCustomFlatApplication.universalIdentifier,
      },
      now: new Date().toISOString(),
      generateId: v4,
    });

    if (viewFieldsToCreate.length === 0) {
      this.logger.log(
        `Every view already has its label identifier column for workspace ${workspaceId}, skipping`,
      );

      return;
    }

    this.logger.log(
      `${isDryRun ? '[DRY RUN] ' : ''}Adding ${viewFieldsToCreate.length} missing label identifier column(s) for workspace ${workspaceId}`,
    );

    if (isDryRun) {
      return;
    }

    const result =
      await this.workspaceMigrationValidateBuildAndRunService.validateBuildAndRunLegacyWorkspaceMigration(
        {
          isSystemBuild: true,
          workspaceId,
          applicationUniversalIdentifier:
            workspaceCustomFlatApplication.universalIdentifier,
          allFlatEntityOperationByMetadataName: {
            viewField: {
              flatEntityToCreate: viewFieldsToCreate,
              flatEntityToDelete: [],
              flatEntityToUpdate: [],
            },
          },
        },
      );

    if (result.status === 'fail') {
      throw new Error(
        `Failed to add the missing label identifier column(s) for workspace ${workspaceId}: ${JSON.stringify(
          result,
          null,
          2,
        )}`,
      );
    }

    this.logger.log(
      `Added ${viewFieldsToCreate.length} missing label identifier column(s) for workspace ${workspaceId}`,
    );
  }
}
