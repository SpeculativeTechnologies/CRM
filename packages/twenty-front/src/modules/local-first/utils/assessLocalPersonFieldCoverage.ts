import { type RequestedNodeField } from '@/local-first/utils/extractRequestedNodeFields';
import { resolveLocalFieldSource } from '@/local-first/utils/resolveLocalFieldSource';

export type LocalPersonFieldCoverage =
  | { isCovered: true }
  | { isCovered: false; missingFields: string[] };

// Decides whether every field a query asked for can be answered from the
// synced columns. A local read must serve the whole selection or none of it:
// a record returned with fields missing renders blank cells instead of falling
// back, so partial coverage has to count as no coverage.
export const assessLocalPersonFieldCoverage = ({
  requestedFields,
  syncedColumns,
}: {
  requestedFields: RequestedNodeField[];
  syncedColumns: readonly string[];
}): LocalPersonFieldCoverage => {
  if (requestedFields.length === 0) {
    return { isCovered: false, missingFields: ['<no fields parsed>'] };
  }

  const availableColumns = new Set(syncedColumns);
  const missingFields: string[] = [];

  for (const field of requestedFields) {
    // A sub-selection that has its own sub-selections is a relation, which
    // lives in another table entirely.
    if (field.hasNestedSelections) {
      missingFields.push(`${field.name} (relation)`);
      continue;
    }

    if (field.subFields.length === 0) {
      if (
        !resolveLocalFieldSource({
          fieldName: field.name,
          syncedColumns: availableColumns,
        })
      ) {
        missingFields.push(field.name);
      }

      continue;
    }

    for (const subField of field.subFields) {
      if (
        !resolveLocalFieldSource({
          fieldName: field.name,
          subFieldName: subField,
          syncedColumns: availableColumns,
        })
      ) {
        missingFields.push(`${field.name}.${subField}`);
      }
    }
  }

  if (missingFields.length > 0) {
    return { isCovered: false, missingFields };
  }

  return { isCovered: true };
};
