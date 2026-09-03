import { Command } from 'nest-commander';
import { STANDARD_OBJECTS } from 'twenty-shared/metadata';
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
import { computeTwentyStandardApplicationAllFlatEntityMaps } from 'src/engine/workspace-manager/twenty-standard-application/utils/twenty-standard-application-all-flat-entity-maps.constant';

type WorkspaceDataSource = NonNullable<RunOnWorkspaceArgs['dataSource']>;

const CAMPAIGN_OBJECT_UNIVERSAL_IDENTIFIERS = [
  STANDARD_OBJECTS.messageCampaign.universalIdentifier,
  STANDARD_OBJECTS.messageList.universalIdentifier,
  STANDARD_OBJECTS.messageListMember.universalIdentifier,
];

// Workspaces that got their campaign objects before the fork provisioned the
// standard metadata carry auto-created index views under their own universal
// identifiers. Upstream's 2.38 schema sync then tries to create the standard
// index view next to them and the migration refuses ("Object already has a view
// with the INDEX key"). Re-identify the existing view and its columns as the
// standard ones first, so the sync sees them as present and only fills gaps.
@RegisteredWorkspaceCommand('2.38.0', 1788200700999)
@Command({
  name: 'upgrade:2-38:adopt-message-campaign-index-views',
  description:
    'Give pre-existing MessageCampaign, MessageList and MessageListMember index views the standard universal identifiers before the 2.38 schema sync',
})
export class AdoptMessageCampaignIndexViewsCommand extends ProvisionedWorkspaceCommandRunner {
  constructor(
    protected readonly workspaceIteratorService: WorkspaceIteratorService,
    private readonly applicationService: ApplicationService,
    private readonly workspaceCacheService: WorkspaceCacheService,
  ) {
    super(workspaceIteratorService);
  }

  override async runOnWorkspace({
    workspaceId,
    options,
    dataSource,
  }: RunOnWorkspaceArgs): Promise<void> {
    if (!isDefined(dataSource)) {
      throw new Error(
        `No data source for workspace ${workspaceId}; cannot adopt campaign index views`,
      );
    }

    const isDryRun = options.dryRun ?? false;

    const { flatObjectMetadataMaps, flatFieldMetadataMaps, flatViewMaps, flatViewFieldMaps } =
      await this.workspaceCacheService.getOrRecompute(workspaceId, [
        'flatObjectMetadataMaps',
        'flatFieldMetadataMaps',
        'flatViewMaps',
        'flatViewFieldMaps',
      ]);

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

    const adoptions = this.planAdoptions({
      flatObjectMetadataMaps,
      flatFieldMetadataMaps,
      flatViewMaps,
      flatViewFieldMaps,
      standardFlatViewMaps: standardAllFlatEntityMaps.flatViewMaps,
      standardFlatViewFieldMaps: standardAllFlatEntityMaps.flatViewFieldMaps,
    });

    if (adoptions.length === 0) {
      this.logger.log(
        `No campaign index view to adopt for workspace ${workspaceId}`,
      );

      return;
    }

    for (const adoption of adoptions) {
      this.logger.log(
        `${isDryRun ? '[DRY RUN] Would adopt' : 'Adopting'} index view ${adoption.viewId} of ${adoption.objectNameSingular} as ${adoption.standardViewUniversalIdentifier} with ${adoption.viewFields.length} column(s) for workspace ${workspaceId}`,
      );
    }

    if (isDryRun) {
      return;
    }

    await this.applyAdoptions({
      dataSource,
      workspaceId,
      twentyStandardApplicationId: twentyStandardFlatApplication.id,
      adoptions,
    });

    await this.workspaceCacheService.flush(workspaceId, [
      'flatViewMaps',
      'flatViewFieldMaps',
    ]);
  }

  planAdoptions({
    flatObjectMetadataMaps,
    flatFieldMetadataMaps,
    flatViewMaps,
    flatViewFieldMaps,
    standardFlatViewMaps,
    standardFlatViewFieldMaps,
  }: {
    flatObjectMetadataMaps: FlatEntityMaps<FlatObjectMetadata>;
    flatFieldMetadataMaps: FlatEntityMaps<FlatFieldMetadata>;
    flatViewMaps: FlatEntityMaps<FlatView>;
    flatViewFieldMaps: FlatEntityMaps<FlatViewField>;
    standardFlatViewMaps: FlatEntityMaps<FlatView>;
    standardFlatViewFieldMaps: FlatEntityMaps<FlatViewField>;
  }): ViewAdoption[] {
    const existingViews = Object.values(
      flatViewMaps.byUniversalIdentifier,
    ).filter(isDefined);
    const existingViewFields = Object.values(
      flatViewFieldMaps.byUniversalIdentifier,
    ).filter(isDefined);
    const standardViews = Object.values(
      standardFlatViewMaps.byUniversalIdentifier,
    ).filter(isDefined);
    const standardViewFields = Object.values(
      standardFlatViewFieldMaps.byUniversalIdentifier,
    ).filter(isDefined);

    const adoptions: ViewAdoption[] = [];

    for (const objectUniversalIdentifier of CAMPAIGN_OBJECT_UNIVERSAL_IDENTIFIERS) {
      const objectMetadata =
        flatObjectMetadataMaps.byUniversalIdentifier[objectUniversalIdentifier];

      if (!isDefined(objectMetadata)) {
        continue;
      }

      const standardIndexView = standardViews.find(
        (view) =>
          view.objectMetadataUniversalIdentifier === objectUniversalIdentifier &&
          view.key === 'INDEX',
      );

      if (!isDefined(standardIndexView)) {
        continue;
      }

      if (
        isDefined(
          flatViewMaps.byUniversalIdentifier[
            standardIndexView.universalIdentifier
          ],
        )
      ) {
        continue;
      }

      // The oldest index view is the one the workspace has been using.
      const [existingIndexView] = existingViews
        .filter(
          (view) =>
            view.objectMetadataId === objectMetadata.id &&
            view.key === 'INDEX' &&
            !isDefined(view.deletedAt),
        )
        .sort((left, right) => left.createdAt.localeCompare(right.createdAt));

      if (!isDefined(existingIndexView)) {
        continue;
      }

      const viewFieldsOfExistingView = existingViewFields.filter(
        (viewField) =>
          viewField.viewId === existingIndexView.id &&
          !isDefined(viewField.deletedAt),
      );

      const viewFields = standardViewFields
        .filter(
          (standardViewField) =>
            standardViewField.viewUniversalIdentifier ===
              standardIndexView.universalIdentifier &&
            !isDefined(
              flatViewFieldMaps.byUniversalIdentifier[
                standardViewField.universalIdentifier
              ],
            ),
        )
        .flatMap((standardViewField) => {
          const existingViewField = viewFieldsOfExistingView.find(
            (viewField) =>
              flatFieldMetadataMaps.universalIdentifierById[
                viewField.fieldMetadataId
              ] === standardViewField.fieldMetadataUniversalIdentifier,
          );

          return isDefined(existingViewField)
            ? [
                {
                  viewFieldId: existingViewField.id,
                  standardViewFieldUniversalIdentifier:
                    standardViewField.universalIdentifier,
                },
              ]
            : [];
        });

      adoptions.push({
        objectNameSingular: objectMetadata.nameSingular,
        viewId: existingIndexView.id,
        standardViewUniversalIdentifier: standardIndexView.universalIdentifier,
        viewFields,
      });
    }

    return adoptions;
  }

  private async applyAdoptions({
    dataSource,
    workspaceId,
    twentyStandardApplicationId,
    adoptions,
  }: {
    dataSource: WorkspaceDataSource;
    workspaceId: string;
    twentyStandardApplicationId: string;
    adoptions: ViewAdoption[];
  }): Promise<void> {
    const queryRunner = dataSource.createQueryRunner();

    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      for (const adoption of adoptions) {
        await queryRunner.query(
          `UPDATE "core"."view"
           SET "universalIdentifier" = $1, "applicationId" = $2
           WHERE "id" = $3 AND "workspaceId" = $4`,
          [
            adoption.standardViewUniversalIdentifier,
            twentyStandardApplicationId,
            adoption.viewId,
            workspaceId,
          ],
        );

        for (const viewField of adoption.viewFields) {
          await queryRunner.query(
            `UPDATE "core"."viewField"
             SET "universalIdentifier" = $1, "applicationId" = $2
             WHERE "id" = $3 AND "workspaceId" = $4`,
            [
              viewField.standardViewFieldUniversalIdentifier,
              twentyStandardApplicationId,
              viewField.viewFieldId,
              workspaceId,
            ],
          );
        }
      }

      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
}

type ViewAdoption = {
  objectNameSingular: string;
  viewId: string;
  standardViewUniversalIdentifier: string;
  viewFields: {
    viewFieldId: string;
    standardViewFieldUniversalIdentifier: string;
  }[];
};
