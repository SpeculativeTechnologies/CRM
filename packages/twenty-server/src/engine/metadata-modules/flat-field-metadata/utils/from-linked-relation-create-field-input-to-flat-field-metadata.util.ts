import {
  FieldMetadataType,
  type LinkedFieldReference,
} from 'twenty-shared/types';
import { isDefined } from 'twenty-shared/utils';

import { FieldMetadataExceptionCode } from 'src/engine/metadata-modules/field-metadata/field-metadata.exception';
import { type FlatEntityMaps } from 'src/engine/metadata-modules/flat-entity/types/flat-entity-maps.type';
import { type FieldInputTranspilationResult } from 'src/engine/metadata-modules/flat-field-metadata/types/field-input-transpilation-result.type';
import { type FlatFieldMetadata } from 'src/engine/metadata-modules/flat-field-metadata/types/flat-field-metadata.type';
import { getDefaultFlatFieldMetadata } from 'src/engine/metadata-modules/flat-field-metadata/utils/get-default-flat-field-metadata-from-create-field-input.util';
import { type UniversalFlatFieldMetadata } from 'src/engine/workspace-manager/workspace-migration/universal-flat-entity/types/universal-flat-field-metadata.type';
import { type UniversalFlatIndexMetadata } from 'src/engine/workspace-manager/workspace-migration/universal-flat-entity/types/universal-flat-index-metadata.type';

export const fromLinkedRelationCreateFieldInputToFlatFieldMetadata = ({
  commonFlatFieldMetadata,
  linkedField,
  flatFieldMetadataMaps,
}: {
  commonFlatFieldMetadata: ReturnType<typeof getDefaultFlatFieldMetadata>;
  linkedField: LinkedFieldReference;
  flatFieldMetadataMaps: FlatEntityMaps<FlatFieldMetadata>;
}): FieldInputTranspilationResult<{
  flatFieldMetadatas: UniversalFlatFieldMetadata[];
  indexMetadatas: UniversalFlatIndexMetadata[];
}> => {
  const source =
    flatFieldMetadataMaps.byUniversalIdentifier[
      linkedField.sourceFieldMetadataUniversalIdentifier
    ];

  if (!isDefined(source) || source.type !== FieldMetadataType.RELATION) {
    return {
      status: 'fail',
      errors: [
        {
          code: FieldMetadataExceptionCode.INVALID_FIELD_INPUT,
          message: 'A linked relation requires a relation source field',
        },
      ],
    };
  }

  // Reuse the source target without creating or modifying an inverse relation.
  return {
    status: 'success',
    result: {
      flatFieldMetadatas: [
        {
          ...commonFlatFieldMetadata,
          type: FieldMetadataType.RELATION,
          universalSettings: { ...source.universalSettings, linkedField },
          relationTargetObjectMetadataUniversalIdentifier:
            source.relationTargetObjectMetadataUniversalIdentifier,
          relationTargetFieldMetadataUniversalIdentifier: null,
        },
      ],
      indexMetadatas: [],
    },
  };
};
