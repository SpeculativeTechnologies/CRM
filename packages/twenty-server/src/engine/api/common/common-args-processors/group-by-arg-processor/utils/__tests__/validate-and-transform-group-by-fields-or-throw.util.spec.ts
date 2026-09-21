import { FieldMetadataType } from 'twenty-shared/types';

import { validateAndTransformGroupByFieldsOrThrow } from 'src/engine/api/common/common-args-processors/group-by-arg-processor/utils/validate-and-transform-group-by-fields-or-throw.util';
import { CommonQueryRunnerException } from 'src/engine/api/common/common-query-runners/errors/common-query-runner.exception';

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
