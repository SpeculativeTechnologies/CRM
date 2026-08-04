import { type ObjectRecord } from 'twenty-shared/types';
import { isDefined } from 'twenty-shared/utils';

import { computeConflictingPropertiesForIndex } from 'src/engine/api/common/common-query-runners/common-create-many-query-runner/utils/get-conflicting-fields.util';
import { getValueFromPath } from 'src/engine/api/common/common-query-runners/common-create-many-query-runner/utils/get-value-from-path.util';
import { type FlatEntityMaps } from 'src/engine/metadata-modules/flat-entity/types/flat-entity-maps.type';
import { findManyFlatEntityByIdInFlatEntityMaps } from 'src/engine/metadata-modules/flat-entity/utils/find-many-flat-entity-by-id-in-flat-entity-maps.util';
import { type FlatFieldMetadata } from 'src/engine/metadata-modules/flat-field-metadata/types/flat-field-metadata.type';
import { type FlatIndexMetadata } from 'src/engine/metadata-modules/flat-index-metadata/types/flat-index-metadata.type';
import { type FlatObjectMetadata } from 'src/engine/metadata-modules/flat-object-metadata/types/flat-object-metadata.type';

type AbsorbedRecordUniqueColumnsToRelease = {
  recordId: string;
  columnNames: string[];
};

const ACTIVE_RECORDS_INDEX_WHERE_CLAUSE = '"deletedAt" IS NULL';

const hasIndexableValue = (value: unknown): boolean =>
  isDefined(value) && value !== '';

export const getAbsorbedRecordUniqueColumnsToRelease = ({
  recordsToMerge,
  survivorRecordId,
  finalRecordData,
  flatObjectMetadata,
  flatFieldMetadataMaps,
  flatIndexMaps,
  excludedBaseFieldNames = [],
}: {
  recordsToMerge: ObjectRecord[];
  survivorRecordId: string;
  finalRecordData: Partial<ObjectRecord>;
  flatObjectMetadata: FlatObjectMetadata;
  flatFieldMetadataMaps: FlatEntityMaps<FlatFieldMetadata>;
  flatIndexMaps: FlatEntityMaps<FlatIndexMetadata>;
  excludedBaseFieldNames?: string[];
}): AbsorbedRecordUniqueColumnsToRelease[] => {
  const columnsByRecordId = new Map<string, Set<string>>();

  const uniqueIndexes = findManyFlatEntityByIdInFlatEntityMaps({
    flatEntityIds: flatObjectMetadata.indexMetadataIds,
    flatEntityMaps: flatIndexMaps,
  }).filter(
    (flatIndexMetadata) =>
      flatIndexMetadata.isUnique &&
      flatIndexMetadata.indexWhereClause !== ACTIVE_RECORDS_INDEX_WHERE_CLAUSE,
  );

  for (const uniqueIndex of uniqueIndexes) {
    const conflictingFields = computeConflictingPropertiesForIndex({
      flatIndexFieldMetadatas: uniqueIndex.flatIndexFieldMetadatas,
      flatFieldMetadataMaps,
    });

    if (
      !isDefined(conflictingFields) ||
      conflictingFields.baseFields.some((fieldName) =>
        excludedBaseFieldNames.includes(fieldName),
      )
    ) {
      continue;
    }

    const finalValues = conflictingFields.conflictingProperties.map(
      ({ fullPath }) => getValueFromPath(finalRecordData, fullPath),
    );

    // A regular PostgreSQL unique index cannot conflict when any indexed
    // column is null. Empty composite values are normalized to null before
    // persistence, so they are safe to skip here as well.
    if (!finalValues.every(hasIndexableValue)) {
      continue;
    }

    for (const record of recordsToMerge) {
      if (record.id === survivorRecordId) {
        continue;
      }

      const absorbedValues = conflictingFields.conflictingProperties.map(
        ({ fullPath }) => getValueFromPath(record, fullPath),
      );

      if (
        !absorbedValues.every((value, index) => value === finalValues[index])
      ) {
        continue;
      }

      const columnNames = columnsByRecordId.get(record.id) ?? new Set<string>();

      for (const { column } of conflictingFields.conflictingProperties) {
        columnNames.add(column);
      }

      columnsByRecordId.set(record.id, columnNames);
    }
  }

  return Array.from(columnsByRecordId, ([recordId, columnNames]) => ({
    recordId,
    columnNames: Array.from(columnNames),
  }));
};
