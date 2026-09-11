import { useContext } from 'react';
import { PreComputedChipGeneratorsContext } from '@/object-metadata/contexts/PreComputedChipGeneratorsContext';
import { useApolloCoreClient } from '@/object-metadata/hooks/useApolloCoreClient';
import { useObjectMetadataItems } from '@/object-metadata/hooks/useObjectMetadataItems';
import { type EnrichedObjectMetadataItem } from '@/object-metadata/types/EnrichedObjectMetadataItem';
import { generateDefaultRecordChipData } from '@/object-metadata/utils/generateDefaultRecordChipData';
import { getRecordFromRecordNode } from '@/object-record/cache/utils/getRecordFromRecordNode';
import { generateDepthRecordGqlFieldsFromFields } from '@/object-record/graphql/record-gql-fields/utils/generateDepthRecordGqlFieldsFromFields';
import { type RecordGqlOperationFindManyResult } from '@/object-record/graphql/types/RecordGqlOperationFindManyResult';
import { useObjectPermissions } from '@/object-record/hooks/useObjectPermissions';
import { extractTargetRecordsFromJunction } from '@/object-record/record-field/ui/utils/junction/extractTargetRecordsFromJunction';
import { resolveJunctionConfig } from '@/object-record/record-field/ui/utils/junction/resolveJunctionConfig';
import { type ObjectRecord } from '@/object-record/types/ObjectRecord';
import { generateFindManyRecordsQuery } from '@/object-record/utils/generateFindManyRecordsQuery';
import {
  FieldMetadataType,
  RelationType,
  OrderByDirection,
} from 'twenty-shared/types';
import { getLinkedFieldReference, isDefined } from 'twenty-shared/utils';

export const useExportLinkedRelationValues = () => {
  const client = useApolloCoreClient();
  const { objectMetadataItems } = useObjectMetadataItems();
  const { objectPermissionsByObjectMetadataId } = useObjectPermissions();
  const { identifierChipGeneratorPerObject } = useContext(
    PreComputedChipGeneratorsContext,
  );

  const completeLinkedRelations = async (
    records: ObjectRecord[],
    object: EnrichedObjectMetadataItem,
  ) => {
    const result = records.map((record) =>
      getRecordFromRecordNode({ recordNode: record }),
    );
    for (const field of object.readableFields) {
      const reference = getLinkedFieldReference(field.settings);
      if (field.type !== FieldMetadataType.RELATION || !isDefined(reference))
        continue;
      const person = objectMetadataItems.find((item) =>
        item.fields.some(
          (source) =>
            source.universalIdentifier ===
            reference.sourceFieldMetadataUniversalIdentifier,
        ),
      );
      const source = person?.readableFields.find(
        (item) =>
          item.universalIdentifier ===
          reference.sourceFieldMetadataUniversalIdentifier,
      );
      const path = object.readableFields.find(
        (item) =>
          item.universalIdentifier ===
          reference.relationFieldMetadataUniversalIdentifier,
      );
      const target = objectMetadataItems.find(
        (item) => item.id === source?.relation?.targetObjectMetadata.id,
      );
      if (
        !isDefined(person) ||
        !isDefined(source) ||
        !isDefined(path) ||
        !isDefined(target)
      ) {
        for (const record of result) record[field.name] = '';
        continue;
      }

      const sourceFields = generateDepthRecordGqlFieldsFromFields({
        objectMetadataItems,
        sourceObjectMetadataItem: person,
        fields: [source],
        depth: 1,
      });
      const sourceQuery = generateFindManyRecordsQuery({
        objectMetadataItem: person,
        objectMetadataItems,
        objectPermissionsByObjectMetadataId,
        recordGqlFields: { id: true, ...sourceFields },
      });
      const sourceIds = [
        ...new Set<string>(
          result.map((record) => record[`${path.name}Id`]).filter(isDefined),
        ),
      ];
      const people = new Map<string, ObjectRecord>();
      for (let offset = 0; offset < sourceIds.length; offset += 500) {
        const response = await client.query<RecordGqlOperationFindManyResult>({
          query: sourceQuery,
          fetchPolicy: 'network-only',
          variables: {
            filter: { id: { in: sourceIds.slice(offset, offset + 500) } },
            limit: 500,
          },
        });
        const connection = response.data?.[person.namePlural];
        if (!isDefined(connection))
          throw new Error('Linked field source export returned no data');
        for (const edge of connection.edges) {
          const record = getRecordFromRecordNode({ recordNode: edge.node });
          people.set(record.id, record);
        }
      }
      for (const record of result)
        record[field.name] = people.get(record[`${path.name}Id`])?.[
          source.name
        ];

      if (source.relation?.type === RelationType.ONE_TO_MANY) {
        const inverse = target.fields.find(
          (item) => item.id === source.relation?.targetFieldMetadata.id,
        );
        if (!isDefined(inverse)) continue;
        const personIds = [...people.keys()];
        const byPerson = new Map<string, ObjectRecord[]>();
        const sourceSelection = generateDepthRecordGqlFieldsFromFields({
          objectMetadataItems,
          sourceObjectMetadataItem: person,
          fields: [source],
          depth: 1,
        })[source.name];
        const query = generateFindManyRecordsQuery({
          objectMetadataItem: target,
          objectMetadataItems,
          objectPermissionsByObjectMetadataId,
          recordGqlFields: {
            ...(typeof sourceSelection === 'object'
              ? sourceSelection
              : { id: true }),
            [inverse.name]: { id: true },
          },
        });
        // Page the target collection: table relation previews are capped at 60.
        for (let offset = 0; offset < personIds.length; offset += 500) {
          let lastCursor: string | null = null;
          do {
            const response: { data?: RecordGqlOperationFindManyResult } =
              await client.query<RecordGqlOperationFindManyResult>({
                query,
                fetchPolicy: 'network-only',
                variables: {
                  filter: {
                    [`${inverse.name}Id`]: {
                      in: personIds.slice(offset, offset + 500),
                    },
                  },
                  orderBy: [{ id: OrderByDirection.AscNullsLast }],
                  limit: 500,
                  lastCursor,
                },
              });
            const connection:
              | RecordGqlOperationFindManyResult[string]
              | undefined = response.data?.[target.namePlural];
            if (!isDefined(connection))
              throw new Error('Linked relation export query returned no data');
            for (const edge of connection.edges) {
              const record = getRecordFromRecordNode({ recordNode: edge.node });
              const personId = record[inverse.name]?.id;
              if (!isDefined(personId)) continue;
              const related = byPerson.get(personId) ?? [];
              related.push(record);
              byPerson.set(personId, related);
            }
            const nextCursor: string | null = connection.pageInfo.hasNextPage
              ? connection.pageInfo.endCursor
              : null;
            if (
              connection.pageInfo.hasNextPage &&
              (!nextCursor || nextCursor === lastCursor)
            )
              throw new Error(
                'Linked relation export could not continue pagination',
              );
            lastCursor = nextCursor;
          } while (lastCursor);
        }
        for (const record of result)
          record[field.name] = byPerson.get(record[`${path.name}Id`]) ?? [];
      }

      const junction = resolveJunctionConfig({
        settings: field.settings,
        relationObjectMetadataId: target.id,
        relationTargetFieldMetadataId: source.relation?.targetFieldMetadata.id,
        sourceObjectMetadataId: object.id,
        objectMetadataItems,
      });
      if (isDefined(junction) && !junction.isValid) {
        for (const record of result) record[field.name] = '';
        continue;
      }
      const label = (record: ObjectRecord, objectNameSingular: string) =>
        identifierChipGeneratorPerObject?.[objectNameSingular]?.(record).name ??
        generateDefaultRecordChipData({ record, objectNameSingular }).name;
      for (const record of result) {
        const value = record[field.name];
        const related: ObjectRecord[] = Array.isArray(value)
          ? value
          : isDefined(value)
            ? [value]
            : [];
        record[field.name] = junction?.isValid
          ? extractTargetRecordsFromJunction({
              junctionRecords: related,
              targetFields: junction.targetFields,
              objectMetadataItems,
              includeRecord: true,
            })
              .map((item) => {
                const terminal = objectMetadataItems.find(
                  (object) => object.id === item.objectMetadataId,
                );
                return isDefined(item.record) && isDefined(terminal)
                  ? label(item.record, terminal.nameSingular)
                  : '';
              })
              .join('; ')
          : related.map((item) => label(item, target.nameSingular)).join('; ');
      }
    }
    return result;
  };
  return { completeLinkedRelations };
};
