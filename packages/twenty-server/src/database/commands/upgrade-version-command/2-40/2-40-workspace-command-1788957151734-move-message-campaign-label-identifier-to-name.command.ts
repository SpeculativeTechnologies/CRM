import { Command } from 'nest-commander';
import { STANDARD_OBJECTS } from 'twenty-shared/metadata';
import { ViewType } from 'twenty-shared/types';
import { isDefined } from 'twenty-shared/utils';

import { ProvisionedWorkspaceCommandRunner } from 'src/database/commands/command-runners/provisioned-workspace.command-runner';
import { WorkspaceIteratorService } from 'src/database/commands/command-runners/workspace-iterator.service';
import { type RunOnWorkspaceArgs } from 'src/database/commands/command-runners/workspace.command-runner';
import { ApplicationService } from 'src/engine/core-modules/application/application.service';
import { RegisteredWorkspaceCommand } from 'src/engine/core-modules/upgrade/decorators/registered-workspace-command.decorator';
import { type FlatEntityMaps } from 'src/engine/metadata-modules/flat-entity/types/flat-entity-maps.type';
import { type FlatFieldMetadata } from 'src/engine/metadata-modules/flat-field-metadata/types/flat-field-metadata.type';
import { type FlatObjectMetadata } from 'src/engine/metadata-modules/flat-object-metadata/types/flat-object-metadata.type';
import { type FlatView } from 'src/engine/metadata-modules/flat-view/types/flat-view.type';
import { type FlatViewField } from 'src/engine/metadata-modules/flat-view-field/types/flat-view-field.type';
import { WorkspaceCacheService } from 'src/engine/workspace-cache/services/workspace-cache.service';
import { WorkspaceMigrationValidateBuildAndRunService } from 'src/engine/workspace-manager/workspace-migration/services/workspace-migration-validate-build-and-run-service';

const CAMPAIGN = STANDARD_OBJECTS.messageCampaign;
const NAME_FIELD_UNIVERSAL_IDENTIFIER = CAMPAIGN.fields.name.universalIdentifier;
const SUBJECT_FIELD_UNIVERSAL_IDENTIFIER =
  CAMPAIGN.fields.subject.universalIdentifier;

export type MessageCampaignLabelIdentifierPlan = {
  objectMetadataToUpdate: FlatObjectMetadata | null;
  viewFieldsToUpdate: FlatViewField[];
};

// Upstream's 2.25 name-field command moved the campaign label identifier from
// subject to name. The fork provisioned campaigns with its own command instead,
// and 2.25 sits below the catch-up floor, so these workspaces still label
// campaigns by subject with name tied at the first column. Upstream's 2.40
// command then aligns the columns to positions that assume name is the label
// identifier, and the view validator refuses the result. Make the one change
// 2.25 would have made, the same way: repoint the label identifier unless a
// user chose another field, and put name strictly first in every table view.
export const planMessageCampaignLabelIdentifierMove = ({
  flatObjectMetadataMaps,
  flatFieldMetadataMaps,
  flatViewMaps,
  flatViewFieldMaps,
}: {
  flatObjectMetadataMaps: FlatEntityMaps<FlatObjectMetadata>;
  flatFieldMetadataMaps: FlatEntityMaps<FlatFieldMetadata>;
  flatViewMaps: FlatEntityMaps<FlatView>;
  flatViewFieldMaps: FlatEntityMaps<FlatViewField>;
}): MessageCampaignLabelIdentifierPlan => {
  const emptyPlan = { objectMetadataToUpdate: null, viewFieldsToUpdate: [] };
  const campaignObjectMetadata =
    flatObjectMetadataMaps.byUniversalIdentifier[CAMPAIGN.universalIdentifier];
  const nameField =
    flatFieldMetadataMaps.byUniversalIdentifier[NAME_FIELD_UNIVERSAL_IDENTIFIER];

  if (!isDefined(campaignObjectMetadata) || !isDefined(nameField)) {
    return emptyPlan;
  }

  const currentLabelIdentifier =
    campaignObjectMetadata.labelIdentifierFieldMetadataUniversalIdentifier;

  if (
    isDefined(currentLabelIdentifier) &&
    currentLabelIdentifier !== SUBJECT_FIELD_UNIVERSAL_IDENTIFIER &&
    currentLabelIdentifier !== NAME_FIELD_UNIVERSAL_IDENTIFIER
  ) {
    return emptyPlan;
  }

  const objectMetadataToUpdate =
    currentLabelIdentifier === NAME_FIELD_UNIVERSAL_IDENTIFIER
      ? null
      : {
          ...campaignObjectMetadata,
          labelIdentifierFieldMetadataUniversalIdentifier:
            NAME_FIELD_UNIVERSAL_IDENTIFIER,
        };

  const viewFieldsToUpdate = Object.values(flatViewMaps.byUniversalIdentifier)
    .filter(isDefined)
    .filter(
      (view) =>
        view.objectMetadataUniversalIdentifier ===
          CAMPAIGN.universalIdentifier &&
        view.type !== ViewType.FIELDS_WIDGET &&
        !isDefined(view.deletedAt),
    )
    .flatMap((view) => {
      const viewFields = view.viewFieldUniversalIdentifiers
        .map(
          (viewFieldUniversalIdentifier) =>
            flatViewFieldMaps.byUniversalIdentifier[viewFieldUniversalIdentifier],
        )
        .filter(isDefined)
        .filter((viewField) => !isDefined(viewField.deletedAt));
      const nameViewField = viewFields.find(
        (viewField) =>
          viewField.fieldMetadataUniversalIdentifier ===
          NAME_FIELD_UNIVERSAL_IDENTIFIER,
      );
      const otherPositions = viewFields
        .filter((viewField) => viewField !== nameViewField)
        .map(({ position }) => position);

      if (!isDefined(nameViewField) || otherPositions.length === 0) {
        return [];
      }

      const lowestOtherPosition = Math.min(...otherPositions);

      return nameViewField.position < lowestOtherPosition
        ? []
        : [{ ...nameViewField, position: lowestOtherPosition - 1 }];
    });

  return { objectMetadataToUpdate, viewFieldsToUpdate };
};

@RegisteredWorkspaceCommand('2.40.0', 1788957151734)
@Command({
  name: 'upgrade:2-40:move-message-campaign-label-identifier-to-name',
  description:
    'Label campaigns by name, as upstream 2.25 did, before the 2.40 scheduledAt command aligns the campaign columns',
})
export class MoveMessageCampaignLabelIdentifierToNameCommand extends ProvisionedWorkspaceCommandRunner {
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

    const { objectMetadataToUpdate, viewFieldsToUpdate } =
      planMessageCampaignLabelIdentifierMove({
        flatObjectMetadataMaps,
        flatFieldMetadataMaps,
        flatViewMaps,
        flatViewFieldMaps,
      });

    if (!isDefined(objectMetadataToUpdate) && viewFieldsToUpdate.length === 0) {
      this.logger.log(
        `messageCampaign already labelled by name for workspace ${workspaceId}, skipping`,
      );

      return;
    }

    this.logger.log(
      `${isDryRun ? '[DRY RUN] Would move' : 'Moving'} the messageCampaign label identifier to name (${isDefined(objectMetadataToUpdate) ? 'repoint' : 'already name'}, ${viewFieldsToUpdate.length} name column(s) moved first) for workspace ${workspaceId}`,
    );

    if (isDryRun) {
      return;
    }

    const { twentyStandardFlatApplication } =
      await this.applicationService.findWorkspaceTwentyStandardAndCustomApplicationOrThrow(
        { workspaceId },
      );

    // Two migrations because the view validator requires the label identifier
    // column to sit strictly first: it has to be name before name can move.
    if (isDefined(objectMetadataToUpdate)) {
      await this.runMigration({
        workspaceId,
        applicationUniversalIdentifier:
          twentyStandardFlatApplication.universalIdentifier,
        objectMetadataToUpdate: [objectMetadataToUpdate],
        viewFieldsToUpdate: [],
      });
    }

    if (viewFieldsToUpdate.length > 0) {
      await this.runMigration({
        workspaceId,
        applicationUniversalIdentifier:
          twentyStandardFlatApplication.universalIdentifier,
        objectMetadataToUpdate: [],
        viewFieldsToUpdate,
      });
    }
  }

  private async runMigration({
    workspaceId,
    applicationUniversalIdentifier,
    objectMetadataToUpdate,
    viewFieldsToUpdate,
  }: {
    workspaceId: string;
    applicationUniversalIdentifier: string;
    objectMetadataToUpdate: FlatObjectMetadata[];
    viewFieldsToUpdate: FlatViewField[];
  }): Promise<void> {
    const result =
      await this.workspaceMigrationValidateBuildAndRunService.validateBuildAndRunLegacyWorkspaceMigration(
        {
          isSystemBuild: true,
          workspaceId,
          applicationUniversalIdentifier,
          allFlatEntityOperationByMetadataName: {
            objectMetadata: {
              flatEntityToCreate: [],
              flatEntityToDelete: [],
              flatEntityToUpdate: objectMetadataToUpdate,
            },
            viewField: {
              flatEntityToCreate: [],
              flatEntityToDelete: [],
              flatEntityToUpdate: viewFieldsToUpdate,
            },
          },
        },
      );

    if (result.status === 'fail') {
      this.logger.error(
        `Failed to move the messageCampaign label identifier to name:\n${JSON.stringify(result, null, 2)}`,
      );

      throw new Error(
        `Failed to move the messageCampaign label identifier to name for workspace ${workspaceId}`,
      );
    }
  }
}
