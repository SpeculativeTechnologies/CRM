import { type LinkedFieldReference } from '@/types/LinkedFieldReference';
import { isNonEmptyString } from '@sniptt/guards';

export const getLinkedFieldReference = (
  settings: unknown,
): LinkedFieldReference | undefined => {
  if (
    typeof settings !== 'object' ||
    settings === null ||
    !('linkedField' in settings)
  ) {
    return undefined;
  }

  const reference = settings.linkedField;

  if (
    typeof reference !== 'object' ||
    reference === null ||
    !('relationFieldMetadataUniversalIdentifier' in reference) ||
    !('sourceFieldMetadataUniversalIdentifier' in reference) ||
    !isNonEmptyString(reference.relationFieldMetadataUniversalIdentifier) ||
    !isNonEmptyString(reference.sourceFieldMetadataUniversalIdentifier)
  ) {
    return undefined;
  }

  return {
    relationFieldMetadataUniversalIdentifier:
      reference.relationFieldMetadataUniversalIdentifier,
    sourceFieldMetadataUniversalIdentifier:
      reference.sourceFieldMetadataUniversalIdentifier,
  };
};
