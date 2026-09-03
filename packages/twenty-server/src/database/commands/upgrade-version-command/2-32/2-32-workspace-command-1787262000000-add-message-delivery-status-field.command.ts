import { Command } from 'nest-commander';
import { STANDARD_OBJECTS } from 'twenty-shared/metadata';
import { isDefined } from 'twenty-shared/utils';

import { ProvisionedWorkspaceCommandRunner } from 'src/database/commands/command-runners/provisioned-workspace.command-runner';
import { WorkspaceIteratorService } from 'src/database/commands/command-runners/workspace-iterator.service';
import { type RunOnWorkspaceArgs } from 'src/database/commands/command-runners/workspace.command-runner';
import { getStandardFlatEntitiesToCreateOrThrow } from 'src/database/commands/upgrade-version-command/2-10/utils/get-standard-flat-entities-to-create-or-throw.util';
import { ApplicationService } from 'src/engine/core-modules/application/application.service';
import { RegisteredWorkspaceCommand } from 'src/engine/core-modules/upgrade/decorators/registered-workspace-command.decorator';
import { type FlatFieldMetadata } from 'src/engine/metadata-modules/flat-field-metadata/types/flat-field-metadata.type';
import { WorkspaceCacheService } from 'src/engine/workspace-cache/services/workspace-cache.service';
import { computeTwentyStandardApplicationAllFlatEntityMaps } from 'src/engine/workspace-manager/twenty-standard-application/utils/twenty-standard-application-all-flat-entity-maps.constant';
import { WorkspaceMigrationValidateBuildAndRunService } from 'src/engine/workspace-manager/workspace-migration/services/workspace-migration-validate-build-and-run-service';

const MESSAGE = STANDARD_OBJECTS.message;
// Literal because upstream dropped this field from STANDARD_OBJECT_FIELDS when
// per-recipient state moved to core.campaignDelivery (see the 2-38 command).
const DELIVERY_STATUS_FIELD_UNIVERSAL_IDENTIFIER =
  '209254fa-2b89-429d-a72a-c401c4bd5a78';

@RegisteredWorkspaceCommand('2.32.0', 1787262000000)
@Command({
  name: 'upgrade:2-32:add-message-delivery-status-field',
  description:
    'Add the Message.deliveryStatus system field on existing workspaces that missed it during campaign metadata provisioning',
})
export class AddMessageDeliveryStatusFieldCommand extends ProvisionedWorkspaceCommandRunner {
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
        flatObjectMetadataMaps.byUniversalIdentifier[
          MESSAGE.universalIdentifier
        ],
      )
    ) {
      this.logger.log(
        `Message object does not exist for workspace ${workspaceId}, skipping`,
      );

      return;
    }

    if (
      isDefined(
        flatFieldMetadataMaps.byUniversalIdentifier[
          DELIVERY_STATUS_FIELD_UNIVERSAL_IDENTIFIER
        ],
      )
    ) {
      this.logger.log(
        `Message.deliveryStatus already exists for workspace ${workspaceId}, skipping`,
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

    if (
      !isDefined(
        standardAllFlatEntityMaps.flatFieldMetadataMaps.byUniversalIdentifier[
          DELIVERY_STATUS_FIELD_UNIVERSAL_IDENTIFIER
        ],
      )
    ) {
      this.logger.log(
        `Message.deliveryStatus is no longer part of the standard application, skipping workspace ${workspaceId}`,
      );

      return;
    }

    const [deliveryStatusField] =
      getStandardFlatEntitiesToCreateOrThrow<FlatFieldMetadata>({
        standardFlatEntityMaps: standardAllFlatEntityMaps.flatFieldMetadataMaps,
        existingFlatEntityMaps: flatFieldMetadataMaps,
        universalIdentifiers: [DELIVERY_STATUS_FIELD_UNIVERSAL_IDENTIFIER],
      });

    if (!isDefined(deliveryStatusField)) {
      return;
    }

    if (isDryRun) {
      this.logger.log(
        `[DRY RUN] Would add Message.deliveryStatus for workspace ${workspaceId}`,
      );

      return;
    }

    const result =
      await this.workspaceMigrationValidateBuildAndRunService.validateBuildAndRunWorkspaceMigration(
        {
          isSystemBuild: true,
          applicationUniversalIdentifier:
            twentyStandardFlatApplication.universalIdentifier,
          workspaceId,
          allFlatEntityOperationByMetadataName: {
            fieldMetadata: {
              flatEntityToCreate: [deliveryStatusField],
              flatEntityToDelete: [],
              flatEntityToUpdate: [],
            },
          },
        },
      );

    if (result.status === 'fail') {
      throw new Error(
        `Failed to add Message.deliveryStatus for workspace ${workspaceId}: ${JSON.stringify(
          result,
          null,
          2,
        )}`,
      );
    }

    this.logger.log(
      `Added Message.deliveryStatus for workspace ${workspaceId}`,
    );
  }
}
