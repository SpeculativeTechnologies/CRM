import {
  FieldMetadataType,
  ObjectRecordGroupByDateGranularity,
} from 'twenty-shared/types';

import { validateAndTransformGroupByFieldsOrThrow } from 'src/engine/api/common/common-args-processors/group-by-arg-processor/utils/validate-and-transform-group-by-fields-or-throw.util';
import {
  CommonQueryRunnerException,
  CommonQueryRunnerExceptionCode,
} from 'src/engine/api/common/common-query-runners/errors/common-query-runner.exception';
import { type ObjectRecordGroupBy } from 'src/engine/api/graphql/workspace-query-builder/interfaces/object-record.interface';
import { type FlatEntityMaps } from 'src/engine/metadata-modules/flat-entity/types/flat-entity-maps.type';
import { getFlatFieldMetadataMock } from 'src/engine/metadata-modules/flat-field-metadata/__mocks__/get-flat-field-metadata.mock';
import { type OrmFlatFieldMetadata } from 'src/engine/metadata-modules/flat-field-metadata/types/orm-flat-field-metadata.type';
import { getFlatObjectMetadataMock } from 'src/engine/metadata-modules/flat-object-metadata/__mocks__/get-flat-object-metadata.mock';
import { type FlatObjectMetadata } from 'src/engine/metadata-modules/flat-object-metadata/types/flat-object-metadata.type';

const buildFlatEntityMaps = <T>(byId: Record<string, T>) => ({
  byId,
  idByUniversalIdentifier: Object.fromEntries(
    Object.keys(byId).map((id) => [id, id]),
  ),
  universalIdentifierById: Object.fromEntries(
    Object.keys(byId).map((id) => [id, id]),
  ),
  byUniversalIdentifier: byId,
});

const buildContext = ({
  objectNameSingular,
  fieldNames,
}: {
  objectNameSingular: string;
  fieldNames: string[];
}) => {
  const fields = Object.fromEntries(
    fieldNames.map((name) => [
      `${name}-id`,
      {
        id: `${name}-id`,
        name,
        type: FieldMetadataType.TEXT,
        isSystem: false,
        objectMetadataId: 'object-id',
        settings: {},
      },
    ]),
  );

  const flatObjectMetadata = {
    id: 'object-id',
    nameSingular: objectNameSingular,
    namePlural: `${objectNameSingular}s`,
    fieldIds: fieldNames.map((name) => `${name}-id`),
  };

  return {
    flatObjectMetadata,
    flatObjectMetadataMaps: buildFlatEntityMaps({
      'object-id': flatObjectMetadata,
    }),
    flatFieldMetadataMaps: buildFlatEntityMaps(fields),
  };
};

describe('validateAndTransformGroupByFieldsOrThrow', () => {
  it('should reject grouping by a message body', () => {
    const context = buildContext({
      objectNameSingular: 'message',
      fieldNames: ['text'],
    });

    expect(() =>
      validateAndTransformGroupByFieldsOrThrow({
        groupBy: [{ text: true }],
        ...context,
      } as never),
    ).toThrow(CommonQueryRunnerException);
  });

  it('should reject grouping by a message subject', () => {
    const context = buildContext({
      objectNameSingular: 'message',
      fieldNames: ['subject'],
    });

    expect(() =>
      validateAndTransformGroupByFieldsOrThrow({
        groupBy: [{ subject: true }],
        ...context,
      } as never),
    ).toThrow(CommonQueryRunnerException);
  });

  it.each(['title', 'description'])(
    'should reject grouping by a calendar event %s',
    (fieldName) => {
      const context = buildContext({
        objectNameSingular: 'calendarEvent',
        fieldNames: [fieldName],
      });

      expect(() =>
        validateAndTransformGroupByFieldsOrThrow({
          groupBy: [{ [fieldName]: true }],
          ...context,
        } as never),
      ).toThrow(CommonQueryRunnerException);
    },
  );

  it('should allow grouping by a field that is not visibility restricted', () => {
    const context = buildContext({
      objectNameSingular: 'message',
      fieldNames: ['headerMessageId'],
    });

    const groupByFields = validateAndTransformGroupByFieldsOrThrow({
      groupBy: [{ headerMessageId: true }],
      ...context,
    } as never);

    expect(groupByFields).toHaveLength(1);
    expect(groupByFields[0].fieldMetadata.name).toBe('headerMessageId');
  });

  it('should allow grouping by a same named field on an unrestricted object', () => {
    const context = buildContext({
      objectNameSingular: 'note',
      fieldNames: ['title'],
    });

    const groupByFields = validateAndTransformGroupByFieldsOrThrow({
      groupBy: [{ title: true }],
      ...context,
    } as never);

    expect(groupByFields).toHaveLength(1);
  });
});

describe('validateAndTransformGroupByFieldsOrThrow unnest', () => {
  const objectMetadataId = 'company-object-id';
  const objectUniversalIdentifier = 'company-object-universal-id';
  const fields = [
    { name: 'tags', type: FieldMetadataType.MULTI_SELECT },
    { name: 'aliases', type: FieldMetadataType.ARRAY },
    { name: 'name', type: FieldMetadataType.TEXT },
    { name: 'contactName', type: FieldMetadataType.FULL_NAME },
    { name: 'startedAt', type: FieldMetadataType.DATE_TIME },
  ].map(({ name, type }) =>
    getFlatFieldMetadataMock({
      id: `company-${name}-field-id`,
      universalIdentifier: `company-${name}-field-universal-id`,
      objectMetadataId,
      name,
      type,
    }),
  );
  const flatObjectMetadata = getFlatObjectMetadataMock({
    id: objectMetadataId,
    universalIdentifier: objectUniversalIdentifier,
    nameSingular: 'company',
    namePlural: 'companies',
    fieldIds: fields.map((field) => field.id),
    fieldUniversalIdentifiers: fields.map((field) => field.universalIdentifier),
  });
  const flatFieldMetadataMaps: FlatEntityMaps<OrmFlatFieldMetadata> = {
    byUniversalIdentifier: Object.fromEntries(
      fields.map((field) => [field.universalIdentifier, field]),
    ),
    universalIdentifierById: Object.fromEntries(
      fields.map((field) => [field.id, field.universalIdentifier]),
    ),
    universalIdentifiersByApplicationId: {},
  };
  const flatObjectMetadataMaps: FlatEntityMaps<FlatObjectMetadata> = {
    byUniversalIdentifier: {
      [objectUniversalIdentifier]: flatObjectMetadata,
    },
    universalIdentifierById: {
      [objectMetadataId]: objectUniversalIdentifier,
    },
    universalIdentifiersByApplicationId: {},
  };

  const validateGroupBy = (groupBy: ObjectRecordGroupBy) =>
    validateAndTransformGroupByFieldsOrThrow({
      groupBy,
      flatObjectMetadata,
      flatObjectMetadataMaps,
      flatFieldMetadataMaps,
    });

  it.each(['tags', 'aliases'])(
    'allows explicit unnest on the multi-value field %s',
    (fieldName) => {
      expect(
        validateGroupBy([{ [fieldName]: { unnest: true } }]),
      ).toMatchObject([
        { fieldMetadata: { name: fieldName }, shouldUnnest: true },
      ]);
    },
  );

  it.each(['tags', 'aliases'])(
    'preserves whole-array grouping for %s',
    (fieldName) => {
      const groupByFields = validateGroupBy([{ [fieldName]: true }]);

      expect(groupByFields).toMatchObject([
        { fieldMetadata: { name: fieldName } },
      ]);
      expect(groupByFields[0]).not.toHaveProperty('shouldUnnest');
    },
  );

  it('allows one unnested field alongside a whole-array grouping', () => {
    expect(
      validateGroupBy([{ tags: { unnest: true } }, { aliases: true }]),
    ).toMatchObject([
      { fieldMetadata: { name: 'tags' }, shouldUnnest: true },
      { fieldMetadata: { name: 'aliases' } },
    ]);
  });

  it('preserves composite and date grouping definitions', () => {
    expect(
      validateGroupBy([
        { contactName: { firstName: true } },
        {
          startedAt: {
            granularity: ObjectRecordGroupByDateGranularity.MONTH,
            timeZone: 'UTC',
          },
        },
      ]),
    ).toMatchObject([
      { fieldMetadata: { name: 'contactName' }, subFieldName: 'firstName' },
      {
        fieldMetadata: { name: 'startedAt' },
        dateGranularity: ObjectRecordGroupByDateGranularity.MONTH,
        timeZone: 'UTC',
      },
    ]);
  });

  it.each([
    { unnest: false },
    { unnest: 'true' },
    { unnest: null },
    { unnest: undefined },
    { unnest: true, extra: true },
  ])('rejects invalid runtime unnest input %j', (definition) => {
    expect(() =>
      validateGroupBy([{ tags: definition }] as unknown as ObjectRecordGroupBy),
    ).toThrow(
      expect.objectContaining({
        code: CommonQueryRunnerExceptionCode.INVALID_QUERY_INPUT,
        message: expect.stringContaining('{"tags": {"unnest": true}}'),
      }),
    );
  });

  it.each(['name', 'contactName', 'startedAt'])(
    'rejects unnest on the non-array field %s',
    (fieldName) => {
      expect(() =>
        validateGroupBy([{ [fieldName]: { unnest: true } }]),
      ).toThrow(
        expect.objectContaining({
          code: CommonQueryRunnerExceptionCode.INVALID_QUERY_INPUT,
          message: expect.stringContaining(
            `{"${fieldName}": {"unnest": true}}`,
          ),
        }),
      );
    },
  );

  it('rejects unnest even when a date definition also contains a granularity', () => {
    expect(() =>
      validateGroupBy([
        {
          startedAt: {
            unnest: true,
            granularity: ObjectRecordGroupByDateGranularity.MONTH,
          },
        },
      ] as unknown as ObjectRecordGroupBy),
    ).toThrow(
      expect.objectContaining({
        code: CommonQueryRunnerExceptionCode.INVALID_QUERY_INPUT,
        message: expect.stringContaining('{"startedAt": {"unnest": true}}'),
      }),
    );
  });

  it.each([
    [{ tags: { unnest: true } }, { aliases: { unnest: true } }],
    [{ aliases: { unnest: true } }, { tags: { unnest: true } }],
    [{ tags: { unnest: true } }, { tags: { unnest: true } }],
  ])('rejects more than one unnested grouping entry: %j', (...groupBy) => {
    expect(() => validateGroupBy(groupBy)).toThrow(
      expect.objectContaining({
        code: CommonQueryRunnerExceptionCode.INVALID_QUERY_INPUT,
        message: 'Only one groupBy field can use unnest',
      }),
    );
  });
});
