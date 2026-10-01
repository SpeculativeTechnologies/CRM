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
import { type FlatIndexMetadata } from 'src/engine/metadata-modules/flat-index-metadata/types/flat-index-metadata.type';
import { type FlatObjectMetadata } from 'src/engine/metadata-modules/flat-object-metadata/types/flat-object-metadata.type';
import { computeFlatIndexNameOrThrow } from 'src/engine/metadata-modules/index-metadata/utils/compute-flat-index-name.util';
import { WorkspaceCacheService } from 'src/engine/workspace-cache/services/workspace-cache.service';

const TIMELINE_ACTIVITY = STANDARD_OBJECTS.timelineActivity;

const STANDARD_INDEXES = [
  {
    indexUniversalIdentifier:
      TIMELINE_ACTIVITY.indexes.messageListIdIndex.universalIdentifier,
    fieldUniversalIdentifier:
      TIMELINE_ACTIVITY.fields.targetMessageList.universalIdentifier,
  },
  {
    indexUniversalIdentifier:
      TIMELINE_ACTIVITY.indexes.messageCampaignIdIndex.universalIdentifier,
    fieldUniversalIdentifier:
      TIMELINE_ACTIVITY.fields.targetMessageCampaign.universalIdentifier,
  },
] as const;

export type TimelineActivityIndexAdoption = {
  indexId: string;
  indexName: string;
  standardIndexUniversalIdentifier: string;
};

// The fork added timelineActivity's messageList and messageCampaign relations
// before upstream declared their join column indexes, so these workspaces
// already hold both indexes, created alongside the relation under per-workspace
// universal identifiers. Upstream's 2.41 backfill looks them up by the standard
// identifier, misses them, and its create is refused because the name is
// taken. Re-identify the existing rows first so the backfill sees them present.
export const planTimelineActivityIndexAdoptions = ({
  flatObjectMetadataMaps,
  flatFieldMetadataMaps,
  flatIndexMaps,
}: {
  flatObjectMetadataMaps: FlatEntityMaps<FlatObjectMetadata>;
  flatFieldMetadataMaps: FlatEntityMaps<FlatFieldMetadata>;
  flatIndexMaps: FlatEntityMaps<FlatIndexMetadata>;
}): TimelineActivityIndexAdoption[] => {
  const timelineActivity =
    flatObjectMetadataMaps.byUniversalIdentifier[
      TIMELINE_ACTIVITY.universalIdentifier
    ];

  if (!isDefined(timelineActivity)) {
    return [];
  }

  const timelineActivityFields = Object.values(
    flatFieldMetadataMaps.byUniversalIdentifier,
  )
    .filter(isDefined)
    .filter(
      (field) =>
        field.objectMetadataUniversalIdentifier ===
        TIMELINE_ACTIVITY.universalIdentifier,
    );
  const existingIndexes = Object.values(flatIndexMaps.byUniversalIdentifier)
    .filter(isDefined)
    .filter(
      (index) =>
        index.objectMetadataUniversalIdentifier ===
        TIMELINE_ACTIVITY.universalIdentifier,
    );

  return STANDARD_INDEXES.flatMap(
    ({ indexUniversalIdentifier, fieldUniversalIdentifier }) => {
      if (
        isDefined(flatIndexMaps.byUniversalIdentifier[indexUniversalIdentifier]) ||
        !timelineActivityFields.some(
          (field) => field.universalIdentifier === fieldUniversalIdentifier,
        )
      ) {
        return [];
      }

      const standardName = computeFlatIndexNameOrThrow({
        flatObjectMetadata: timelineActivity,
        objectFlatFieldMetadatas: timelineActivityFields,
        indexFields: [
          { fieldMetadataUniversalIdentifier: fieldUniversalIdentifier, order: 0, subFieldName: null },
        ],
        isUnique: false,
        indexWhereClause: null,
      });
      const existingIndex = existingIndexes.find(
        (index) => index.name === standardName,
      );

      return isDefined(existingIndex)
        ? [
            {
              indexId: existingIndex.id,
              indexName: existingIndex.name,
              standardIndexUniversalIdentifier: indexUniversalIdentifier,
            },
          ]
        : [];
    },
  );
};

@RegisteredWorkspaceCommand('2.41.0', 1789461461999)
@Command({
  name: 'upgrade:2-41:adopt-timeline-activity-message-campaign-indexes',
  description:
    'Give existing timelineActivity messageList and messageCampaign indexes the standard universal identifiers before the 2.41 backfill',
})
export class AdoptTimelineActivityMessageCampaignIndexesCommand extends ProvisionedWorkspaceCommandRunner {
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
        `No data source for workspace ${workspaceId}; cannot adopt timelineActivity indexes`,
      );
    }

    const isDryRun = options.dryRun ?? false;

    const { flatObjectMetadataMaps, flatFieldMetadataMaps, flatIndexMaps } =
      await this.workspaceCacheService.getOrRecompute(workspaceId, [
        'flatObjectMetadataMaps',
        'flatFieldMetadataMaps',
        'flatIndexMaps',
      ]);

    const adoptions = planTimelineActivityIndexAdoptions({
      flatObjectMetadataMaps,
      flatFieldMetadataMaps,
      flatIndexMaps,
    });

    if (adoptions.length === 0) {
      this.logger.log(
        `No timelineActivity index to adopt for workspace ${workspaceId}`,
      );

      return;
    }

    for (const adoption of adoptions) {
      this.logger.log(
        `${isDryRun ? '[DRY RUN] Would adopt' : 'Adopting'} timelineActivity index ${adoption.indexName} as ${adoption.standardIndexUniversalIdentifier} for workspace ${workspaceId}`,
      );
    }

    if (isDryRun) {
      return;
    }

    const { twentyStandardFlatApplication } =
      await this.applicationService.findWorkspaceTwentyStandardAndCustomApplicationOrThrow(
        { workspaceId },
      );

    const queryRunner = dataSource.createQueryRunner();

    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      for (const adoption of adoptions) {
        await queryRunner.query(
          `UPDATE "core"."indexMetadata"
           SET "universalIdentifier" = $1, "applicationId" = $2
           WHERE "id" = $3 AND "workspaceId" = $4`,
          [
            adoption.standardIndexUniversalIdentifier,
            twentyStandardFlatApplication.id,
            adoption.indexId,
            workspaceId,
          ],
        );
      }

      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }

    // flush leaves the in-process memoizer, so the backfill that runs next in
    // this process would still read the pre-adoption index map.
    await this.workspaceCacheService.invalidateAndRecompute(workspaceId, [
      'flatIndexMaps',
    ]);
  }
}
