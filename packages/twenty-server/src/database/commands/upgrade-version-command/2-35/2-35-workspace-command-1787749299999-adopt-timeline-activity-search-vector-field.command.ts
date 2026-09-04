import { Command } from 'nest-commander';
import { getSearchFieldUniversalIdentifier } from 'twenty-shared/application';
import { STANDARD_OBJECTS } from 'twenty-shared/metadata';
import { FieldMetadataType } from 'twenty-shared/types';
import { isDefined } from 'twenty-shared/utils';

import { ProvisionedWorkspaceCommandRunner } from 'src/database/commands/command-runners/provisioned-workspace.command-runner';
import { WorkspaceIteratorService } from 'src/database/commands/command-runners/workspace-iterator.service';
import { type RunOnWorkspaceArgs } from 'src/database/commands/command-runners/workspace.command-runner';
import { RegisteredWorkspaceCommand } from 'src/engine/core-modules/upgrade/decorators/registered-workspace-command.decorator';
import { type FlatEntityMaps } from 'src/engine/metadata-modules/flat-entity/types/flat-entity-maps.type';
import { type FlatFieldMetadata } from 'src/engine/metadata-modules/flat-field-metadata/types/flat-field-metadata.type';
import { type FlatObjectMetadata } from 'src/engine/metadata-modules/flat-object-metadata/types/flat-object-metadata.type';
import { type FlatSearchFieldMetadata } from 'src/engine/metadata-modules/flat-search-field-metadata/types/flat-search-field-metadata.type';
import { buildFlatSearchFieldMetadataForField } from 'src/engine/metadata-modules/flat-search-field-metadata/utils/build-flat-search-field-metadata-for-field.util';
import { WorkspaceCacheService } from 'src/engine/workspace-cache/services/workspace-cache.service';
import { WorkspaceMigrationValidateBuildAndRunService } from 'src/engine/workspace-manager/workspace-migration/services/workspace-migration-validate-build-and-run-service';

type WorkspaceDataSource = NonNullable<RunOnWorkspaceArgs['dataSource']>;

const TIMELINE_ACTIVITY = STANDARD_OBJECTS.timelineActivity;
const LINKED_RECORD_CACHED_NAME_FIELD_UNIVERSAL_IDENTIFIER =
  TIMELINE_ACTIVITY.fields.linkedRecordCachedName.universalIdentifier;
const SEARCH_VECTOR_FIELD_UNIVERSAL_IDENTIFIER =
  TIMELINE_ACTIVITY.fields.searchVector.universalIdentifier;

export type TimelineActivitySearchVectorAdoption = {
  objectMetadata: FlatObjectMetadata;
  linkedRecordCachedNameField: FlatFieldMetadata;
  fieldToAdopt: FlatFieldMetadata | null;
  isSearchFieldMetadataMissing: boolean;
};

// Workspaces provisioned before upstream made standard field identifiers
// deterministic still carry timelineActivity.searchVector under a random
// universal identifier, and the 2.33 search repoint (run here by name) took
// the search field metadata row and the generated column with the old name
// field. Upstream's 2.35 backfill, which runs right after this, looks the field
// up by its standard identifier and tries to create a second "searchVector";
// the name collision fails the whole upgrade. Re-identify the surviving field
// and restore the metadata row here so the backfill finds converged metadata
// and takes its column-rebuild path.
export const planTimelineActivitySearchVectorAdoption = ({
  flatObjectMetadataMaps,
  flatFieldMetadataMaps,
  flatSearchFieldMetadataMaps,
}: {
  flatObjectMetadataMaps: FlatEntityMaps<FlatObjectMetadata>;
  flatFieldMetadataMaps: FlatEntityMaps<FlatFieldMetadata>;
  flatSearchFieldMetadataMaps: FlatEntityMaps<FlatSearchFieldMetadata>;
}): TimelineActivitySearchVectorAdoption | null => {
  const objectMetadata =
    flatObjectMetadataMaps.byUniversalIdentifier[
      TIMELINE_ACTIVITY.universalIdentifier
    ];
  const linkedRecordCachedNameField =
    flatFieldMetadataMaps.byUniversalIdentifier[
      LINKED_RECORD_CACHED_NAME_FIELD_UNIVERSAL_IDENTIFIER
    ];

  if (!isDefined(objectMetadata) || !isDefined(linkedRecordCachedNameField)) {
    return null;
  }

  const standardSearchVectorField =
    flatFieldMetadataMaps.byUniversalIdentifier[
      SEARCH_VECTOR_FIELD_UNIVERSAL_IDENTIFIER
    ];

  const fieldToAdopt = isDefined(standardSearchVectorField)
    ? null
    : (Object.values(flatFieldMetadataMaps.byUniversalIdentifier)
        .filter(isDefined)
        .find(
          (field) =>
            field.objectMetadataId === objectMetadata.id &&
            field.name === 'searchVector' &&
            field.type === FieldMetadataType.TS_VECTOR,
        ) ?? null);

  const isSearchFieldMetadataMissing = !isDefined(
    flatSearchFieldMetadataMaps.byUniversalIdentifier[
      getSearchFieldUniversalIdentifier({
        applicationUniversalIdentifier:
          objectMetadata.applicationUniversalIdentifier,
        fieldMetadataUniversalIdentifier:
          LINKED_RECORD_CACHED_NAME_FIELD_UNIVERSAL_IDENTIFIER,
      })
    ],
  );

  // Without a searchVector field to point at, the backfill recreates both
  // the field and the search row itself; nothing to adopt here.
  const hasSearchVectorField =
    isDefined(standardSearchVectorField) || isDefined(fieldToAdopt);

  if (
    !hasSearchVectorField ||
    (!isDefined(fieldToAdopt) && !isSearchFieldMetadataMissing)
  ) {
    return null;
  }

  return {
    objectMetadata,
    linkedRecordCachedNameField,
    fieldToAdopt,
    isSearchFieldMetadataMissing,
  };
};

@RegisteredWorkspaceCommand('2.35.0', 1787749299999)
@Command({
  name: 'upgrade:2-35:adopt-timeline-activity-search-vector-field',
  description:
    'Give a pre-existing timelineActivity.searchVector field the standard universal identifier and restore its search field metadata before the 2.35 search backfill',
})
export class AdoptTimelineActivitySearchVectorFieldCommand extends ProvisionedWorkspaceCommandRunner {
  constructor(
    protected readonly workspaceIteratorService: WorkspaceIteratorService,
    private readonly workspaceCacheService: WorkspaceCacheService,
    private readonly workspaceMigrationValidateBuildAndRunService: WorkspaceMigrationValidateBuildAndRunService,
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
        `No data source for workspace ${workspaceId}; cannot adopt the timelineActivity search vector field`,
      );
    }

    const isDryRun = options.dryRun ?? false;

    const {
      flatObjectMetadataMaps,
      flatFieldMetadataMaps,
      flatSearchFieldMetadataMaps,
    } = await this.workspaceCacheService.getOrRecompute(workspaceId, [
      'flatObjectMetadataMaps',
      'flatFieldMetadataMaps',
      'flatSearchFieldMetadataMaps',
    ]);

    const adoption = planTimelineActivitySearchVectorAdoption({
      flatObjectMetadataMaps,
      flatFieldMetadataMaps,
      flatSearchFieldMetadataMaps,
    });

    if (!isDefined(adoption)) {
      this.logger.log(
        `timelineActivity search vector metadata needs no adoption for workspace ${workspaceId}`,
      );

      return;
    }

    if (isDefined(adoption.fieldToAdopt)) {
      this.logger.log(
        `${isDryRun ? '[DRY RUN] Would adopt' : 'Adopting'} timelineActivity.searchVector field ${adoption.fieldToAdopt.id} (${adoption.fieldToAdopt.universalIdentifier}) as ${SEARCH_VECTOR_FIELD_UNIVERSAL_IDENTIFIER} for workspace ${workspaceId}`,
      );
    }

    if (adoption.isSearchFieldMetadataMissing) {
      this.logger.log(
        `${isDryRun ? '[DRY RUN] Would restore' : 'Restoring'} the timelineActivity linkedRecordCachedName search field metadata for workspace ${workspaceId}`,
      );
    }

    if (isDryRun) {
      return;
    }

    if (isDefined(adoption.fieldToAdopt)) {
      await this.adoptField({
        dataSource,
        workspaceId,
        fieldId: adoption.fieldToAdopt.id,
        applicationId: adoption.objectMetadata.applicationId,
      });

      await this.workspaceCacheService.flush(workspaceId, [
        'flatFieldMetadataMaps',
      ]);
    }

    if (adoption.isSearchFieldMetadataMissing) {
      await this.restoreSearchFieldMetadata({
        workspaceId,
        objectMetadata: adoption.objectMetadata,
        linkedRecordCachedNameField: adoption.linkedRecordCachedNameField,
      });
    }
  }

  private async adoptField({
    dataSource,
    workspaceId,
    fieldId,
    applicationId,
  }: {
    dataSource: WorkspaceDataSource;
    workspaceId: string;
    fieldId: string;
    applicationId: string;
  }): Promise<void> {
    await dataSource.query(
      `UPDATE "core"."fieldMetadata"
       SET "universalIdentifier" = $1, "applicationId" = $2
       WHERE "id" = $3 AND "workspaceId" = $4`,
      [SEARCH_VECTOR_FIELD_UNIVERSAL_IDENTIFIER, applicationId, fieldId, workspaceId],
    );
  }

  // Same metadata-only write as the create path of upstream's 2.35 backfill.
  // The generated column is deliberately left to that backfill, whose
  // rebuild path recreates it once the metadata is converged.
  private async restoreSearchFieldMetadata({
    workspaceId,
    objectMetadata,
    linkedRecordCachedNameField,
  }: {
    workspaceId: string;
    objectMetadata: FlatObjectMetadata;
    linkedRecordCachedNameField: FlatFieldMetadata;
  }): Promise<void> {
    const validateAndBuildResult =
      await this.workspaceMigrationValidateBuildAndRunService.validateBuildAndRunLegacyWorkspaceMigration(
        {
          isSystemBuild: true,
          workspaceId,
          applicationUniversalIdentifier:
            objectMetadata.applicationUniversalIdentifier,
          allFlatEntityOperationByMetadataName: {
            searchFieldMetadata: {
              flatEntityToCreate: [
                buildFlatSearchFieldMetadataForField({
                  flatObjectMetadata: objectMetadata,
                  flatFieldMetadata: linkedRecordCachedNameField,
                  tsVectorFlatFieldMetadata: {
                    universalIdentifier: SEARCH_VECTOR_FIELD_UNIVERSAL_IDENTIFIER,
                  },
                  position: 0,
                }),
              ],
              flatEntityToDelete: [],
              flatEntityToUpdate: [],
            },
          },
        },
      );

    if (validateAndBuildResult.status === 'fail') {
      throw new Error(
        `Failed to restore the timelineActivity search field metadata for workspace ${workspaceId}:\n${JSON.stringify(
          validateAndBuildResult,
          null,
          2,
        )}`,
      );
    }
  }
}
