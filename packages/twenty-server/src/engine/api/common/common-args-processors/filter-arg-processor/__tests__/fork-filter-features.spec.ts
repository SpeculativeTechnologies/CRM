import { FieldMetadataType, RelationType } from 'twenty-shared/types';

import { FilterArgProcessorService } from 'src/engine/api/common/common-args-processors/filter-arg-processor/filter-arg-processor.service';
import { validateAndTransformValueOrThrow } from 'src/engine/api/common/common-args-processors/filter-arg-processor/utils/validate-and-transform-value-or-throw.util';
import { CommonQueryRunnerException } from 'src/engine/api/common/common-query-runners/errors/common-query-runner.exception';
import { type FlatEntityMaps } from 'src/engine/metadata-modules/flat-entity/types/flat-entity-maps.type';
import { type FlatFieldMetadata } from 'src/engine/metadata-modules/flat-field-metadata/types/flat-field-metadata.type';
import { type FlatObjectMetadata } from 'src/engine/metadata-modules/flat-object-metadata/types/flat-object-metadata.type';

// Fork-only behavior: one-to-many relation filters and the containsExactly
// operator. Kept in a fork-owned spec so upstream test restructures don't
// conflict with it.
describe('fork filter features', () => {
  describe('one-to-many relation filters', () => {
    const filterArgProcessorService = new FilterArgProcessorService();

    // `source` has a `target` relation; the target carries a TEXT field.
    const createRelationFixture = (relationType: RelationType) => {
      const sourceObjectId = 'source-obj-id';
      const targetObjectId = 'target-obj-id';
      const sourceUniversalId = 'source-obj-universal-id';
      const targetUniversalId = 'target-obj-universal-id';

      const relationFieldId = 'relation-field-id';
      const targetTextFieldId = 'target-text-field-id';

      const flatFieldMetadataMaps = {
        byUniversalIdentifier: {
          'relation-field-uid': {
            id: relationFieldId,
            name: 'target',
            type: FieldMetadataType.RELATION,
            isNullable: true,
            objectMetadataId: sourceObjectId,
            universalIdentifier: 'relation-field-uid',
            relationTargetObjectMetadataId: targetObjectId,
            settings: {
              relationType,
              joinColumnName: 'targetId',
            },
          },
          'target-text-uid': {
            id: targetTextFieldId,
            name: 'name',
            type: FieldMetadataType.TEXT,
            isNullable: true,
            objectMetadataId: targetObjectId,
            universalIdentifier: 'target-text-uid',
          },
        },
        universalIdentifierById: {
          [relationFieldId]: 'relation-field-uid',
          [targetTextFieldId]: 'target-text-uid',
        },
        universalIdentifiersByApplicationId: {},
      } as unknown as FlatEntityMaps<FlatFieldMetadata>;

      const sourceObjectMetadata = {
        id: sourceObjectId,
        nameSingular: 'sourceObject',
        namePlural: 'sourceObjects',
        fieldIds: [relationFieldId],
        universalIdentifier: sourceUniversalId,
        labelIdentifierFieldMetadataUniversalIdentifier: null,
        imageIdentifierFieldMetadataUniversalIdentifier: null,
      } as unknown as FlatObjectMetadata;

      const targetObjectMetadata = {
        id: targetObjectId,
        nameSingular: 'targetObject',
        namePlural: 'targetObjects',
        fieldIds: [targetTextFieldId],
        universalIdentifier: targetUniversalId,
        labelIdentifierFieldMetadataUniversalIdentifier: null,
        imageIdentifierFieldMetadataUniversalIdentifier: null,
      } as unknown as FlatObjectMetadata;

      const flatObjectMetadataMaps = {
        byUniversalIdentifier: {
          [sourceUniversalId]: sourceObjectMetadata,
          [targetUniversalId]: targetObjectMetadata,
        },
        universalIdentifierById: {
          [sourceObjectId]: sourceUniversalId,
          [targetObjectId]: targetUniversalId,
        },
        universalIdentifiersByApplicationId: {},
      } as unknown as FlatEntityMaps<FlatObjectMetadata>;

      return {
        flatFieldMetadataMaps,
        flatObjectMetadataMaps,
        sourceObjectMetadata,
      };
    };

    it('should accept a one-to-many relation traversal onto a scalar target field', () => {
      const {
        flatFieldMetadataMaps,
        flatObjectMetadataMaps,
        sourceObjectMetadata,
      } = createRelationFixture(RelationType.ONE_TO_MANY);

      const filter = { target: { name: { eq: 'Brains' } } };
      const result = filterArgProcessorService.process({
        filter,
        flatObjectMetadata: sourceObjectMetadata,
        flatObjectMetadataMaps,
        flatFieldMetadataMaps,
      });

      expect(result).toEqual(filter);
    });

    it('should reject a scalar operator directly on a one-to-many relation', () => {
      const {
        flatFieldMetadataMaps,
        flatObjectMetadataMaps,
        sourceObjectMetadata,
      } = createRelationFixture(RelationType.ONE_TO_MANY);

      expect(() =>
        filterArgProcessorService.process({
          filter: { target: null },
          flatObjectMetadata: sourceObjectMetadata,
          flatObjectMetadataMaps,
          flatFieldMetadataMaps,
        }),
      ).toThrow(/without a related-record filter/);
    });
  });

  describe('containsExactly operator', () => {
    const multiSelectFieldMetadata = {
      name: 'multiSelectField',
      type: FieldMetadataType.MULTI_SELECT,
    } as unknown as FlatFieldMetadata;

    it('should accept an array value', () => {
      expect(
        validateAndTransformValueOrThrow(
          'containsExactly',
          ['OPTION_1'],
          multiSelectFieldMetadata,
          'multiSelectField',
        ),
      ).toEqual(['OPTION_1']);
    });

    it('should reject a non-array value', () => {
      expect(() =>
        validateAndTransformValueOrThrow(
          'containsExactly',
          'OPTION_1',
          multiSelectFieldMetadata,
          'multiSelectField',
        ),
      ).toThrow(CommonQueryRunnerException);
    });
  });
});
