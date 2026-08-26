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

const MESSAGE_CAMPAIGN = STANDARD_OBJECTS.messageCampaign;
const CC_ADDRESSES_FIELD_UNIVERSAL_IDENTIFIER =
  MESSAGE_CAMPAIGN.fields.ccAddresses.universalIdentifier;

@RegisteredWorkspaceCommand('2.35.0', 1787600000000)
@Command({
  name: 'upgrade:2-35:add-message-campaign-cc-addresses-field',
  description:
    'Add the MessageCampaign.ccAddresses system field so mass email drafts can store their shared Cc list',
})
export class AddMessageCampaignCcAddressesFieldCommand extends ProvisionedWorkspaceCommandRunner {
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
          MESSAGE_CAMPAIGN.universalIdentifier
        ],
      )
    ) {
      this.logger.log(
        `MessageCampaign object does not exist for workspace ${workspaceId}, skipping`,
      );

      return;
    }

    // Re-running the command is a no-op, so a partially upgraded fleet can be
    // swept again safely.
    if (
      isDefined(
        flatFieldMetadataMaps.byUniversalIdentifier[
          CC_ADDRESSES_FIELD_UNIVERSAL_IDENTIFIER
        ],
      )
    ) {
      this.logger.log(
        `MessageCampaign.ccAddresses already exists for workspace ${workspaceId}, skipping`,
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

    const [ccAddressesField] =
      getStandardFlatEntitiesToCreateOrThrow<FlatFieldMetadata>({
        standardFlatEntityMaps: standardAllFlatEntityMaps.flatFieldMetadataMaps,
        existingFlatEntityMaps: flatFieldMetadataMaps,
        universalIdentifiers: [CC_ADDRESSES_FIELD_UNIVERSAL_IDENTIFIER],
      });

    if (!isDefined(ccAddressesField)) {
      return;
    }

    if (isDryRun) {
      this.logger.log(
        `[DRY RUN] Would add MessageCampaign.ccAddresses for workspace ${workspaceId}`,
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
              flatEntityToCreate: [ccAddressesField],
              flatEntityToDelete: [],
              flatEntityToUpdate: [],
            },
          },
        },
      );

    if (result.status === 'fail') {
      throw new Error(
        `Failed to add MessageCampaign.ccAddresses for workspace ${workspaceId}: ${JSON.stringify(
          result,
          null,
          2,
        )}`,
      );
    }

    this.logger.log(
      `Added MessageCampaign.ccAddresses for workspace ${workspaceId}`,
    );
  }
}
