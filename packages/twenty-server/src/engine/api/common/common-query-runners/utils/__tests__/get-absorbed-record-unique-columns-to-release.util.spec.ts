import { FieldMetadataType } from 'twenty-shared/types';

import { getAbsorbedRecordUniqueColumnsToRelease } from 'src/engine/api/common/common-query-runners/utils/get-absorbed-record-unique-columns-to-release.util';
import { type FlatEntityMaps } from 'src/engine/metadata-modules/flat-entity/types/flat-entity-maps.type';
import { type FlatFieldMetadata } from 'src/engine/metadata-modules/flat-field-metadata/types/flat-field-metadata.type';
import { type FlatIndexMetadata } from 'src/engine/metadata-modules/flat-index-metadata/types/flat-index-metadata.type';
import { type FlatObjectMetadata } from 'src/engine/metadata-modules/flat-object-metadata/types/flat-object-metadata.type';

describe('getAbsorbedRecordUniqueColumnsToRelease', () => {
  const objectMetadataId = 'person-object-id';

  const createField = ({
    id,
    name,
    type = FieldMetadataType.TEXT,
  }: {
    id: string;
    name: string;
    type?: FieldMetadataType;
  }) =>
    ({
      id,
      universalIdentifier: id,
      objectMetadataId,
      name,
      type,
    }) as FlatFieldMetadata;

  const createIndex = ({
    id,
    fields,
    indexWhereClause = null,
  }: {
    id: string;
    fields: Array<{
      fieldMetadataId: string;
      subFieldName?: string | null;
    }>;
    indexWhereClause?: string | null;
  }) =>
    ({
      id,
      universalIdentifier: id,
      objectMetadataId,
      isUnique: true,
      indexWhereClause,
      flatIndexFieldMetadatas: fields.map((field, order) => ({
        id: `${id}-${order}`,
        universalIdentifier: `${id}-${order}`,
        indexMetadataId: id,
        fieldMetadataId: field.fieldMetadataId,
        subFieldName: field.subFieldName ?? null,
        order,
      })),
    }) as unknown as FlatIndexMetadata;

  const buildFieldMaps = (entities: FlatFieldMetadata[]) =>
    ({
      byUniversalIdentifier: Object.fromEntries(
        entities.map((entity) => [entity.universalIdentifier, entity]),
      ),
      universalIdentifierById: Object.fromEntries(
        entities.map((entity) => [entity.id, entity.universalIdentifier]),
      ),
      universalIdentifiersByApplicationId: {},
    }) as FlatEntityMaps<FlatFieldMetadata>;

  const buildIndexMaps = (entities: FlatIndexMetadata[]) =>
    ({
      byUniversalIdentifier: Object.fromEntries(
        entities.map((entity) => [entity.universalIdentifier, entity]),
      ),
      universalIdentifierById: Object.fromEntries(
        entities.map((entity) => [entity.id, entity.universalIdentifier]),
      ),
      universalIdentifiersByApplicationId: {},
    }) as FlatEntityMaps<FlatIndexMetadata>;

  const run = ({
    fields,
    indexes,
    recordsToMerge,
    finalRecordData,
    excludedBaseFieldNames,
  }: {
    fields: FlatFieldMetadata[];
    indexes: FlatIndexMetadata[];
    recordsToMerge: Array<Record<string, unknown> & { id: string }>;
    finalRecordData: Record<string, unknown>;
    excludedBaseFieldNames?: string[];
  }) =>
    getAbsorbedRecordUniqueColumnsToRelease({
      recordsToMerge,
      survivorRecordId: 'survivor',
      finalRecordData,
      flatObjectMetadata: {
        id: objectMetadataId,
        indexMetadataIds: indexes.map(({ id }) => id),
      } as FlatObjectMetadata,
      flatFieldMetadataMaps: buildFieldMaps(fields),
      flatIndexMaps: buildIndexMaps(indexes),
      excludedBaseFieldNames,
    });

  it('releases a scalar unique value moved from an absorbed record', () => {
    const externalIdField = createField({
      id: 'external-id-field',
      name: 'externalId',
    });
    const externalIdIndex = createIndex({
      id: 'external-id-index',
      fields: [{ fieldMetadataId: externalIdField.id }],
    });

    expect(
      run({
        fields: [externalIdField],
        indexes: [externalIdIndex],
        recordsToMerge: [
          { id: 'survivor', externalId: null },
          { id: 'absorbed', externalId: 'source-value' },
        ],
        finalRecordData: {
          id: 'survivor',
          externalId: 'source-value',
        },
      }),
    ).toEqual([{ recordId: 'absorbed', columnNames: ['externalId'] }]);
  });

  it('preserves absorbed unique values that are not assigned to the survivor', () => {
    const externalIdField = createField({
      id: 'external-id-field',
      name: 'externalId',
    });
    const externalIdIndex = createIndex({
      id: 'external-id-index',
      fields: [{ fieldMetadataId: externalIdField.id }],
    });

    expect(
      run({
        fields: [externalIdField],
        indexes: [externalIdIndex],
        recordsToMerge: [
          { id: 'survivor', externalId: 'survivor-value' },
          { id: 'absorbed', externalId: 'source-value' },
        ],
        finalRecordData: {
          id: 'survivor',
          externalId: 'survivor-value',
        },
      }),
    ).toEqual([]);
  });

  it('releases every column in a matching composite unique value', () => {
    const phoneField = createField({
      id: 'phone-field',
      name: 'customPhone',
      type: FieldMetadataType.PHONES,
    });
    const phoneIndex = createIndex({
      id: 'phone-index',
      fields: [{ fieldMetadataId: phoneField.id }],
    });
    const phone = {
      primaryPhoneNumber: '5550100',
      primaryPhoneCountryCode: 'US',
      primaryPhoneCallingCode: '+1',
      additionalPhones: [],
    };

    expect(
      run({
        fields: [phoneField],
        indexes: [phoneIndex],
        recordsToMerge: [
          { id: 'survivor', customPhone: null },
          { id: 'absorbed', customPhone: phone },
        ],
        finalRecordData: { id: 'survivor', customPhone: phone },
      }),
    ).toEqual([
      {
        recordId: 'absorbed',
        columnNames: [
          'customPhonePrimaryPhoneNumber',
          'customPhonePrimaryPhoneCountryCode',
          'customPhonePrimaryPhoneCallingCode',
        ],
      },
    ]);
  });

  it('skips indexes released by soft deletion and explicitly handled fields', () => {
    const activeOnlyField = createField({
      id: 'active-only-field',
      name: 'activeOnlyValue',
    });
    const emailField = createField({
      id: 'email-field',
      name: 'emails',
      type: FieldMetadataType.EMAILS,
    });
    const activeOnlyIndex = createIndex({
      id: 'active-only-index',
      fields: [{ fieldMetadataId: activeOnlyField.id }],
      indexWhereClause: '"deletedAt" IS NULL',
    });
    const emailIndex = createIndex({
      id: 'email-index',
      fields: [{ fieldMetadataId: emailField.id }],
    });
    const emails = {
      primaryEmail: 'source@example.com',
      additionalEmails: [],
    };

    expect(
      run({
        fields: [activeOnlyField, emailField],
        indexes: [activeOnlyIndex, emailIndex],
        recordsToMerge: [
          { id: 'survivor' },
          {
            id: 'absorbed',
            activeOnlyValue: 'source-value',
            emails,
          },
        ],
        finalRecordData: {
          id: 'survivor',
          activeOnlyValue: 'source-value',
          emails,
        },
        excludedBaseFieldNames: ['emails'],
      }),
    ).toEqual([]);
  });
});
