import { CoreObjectNamePlural } from '@/object-metadata/types/CoreObjectNamePlural';
import { type EnrichedObjectMetadataItem } from '@/object-metadata/types/EnrichedObjectMetadataItem';
import { type FieldMetadataItem } from '@/object-metadata/types/FieldMetadataItem';
import { generateActivityTargetGqlFields } from '@/object-record/graphql/record-gql-fields/utils/generateActivityTargetGqlFields';
import { generateDepthRecordGqlFieldsFromFields } from '@/object-record/graphql/record-gql-fields/utils/generateDepthRecordGqlFieldsFromFields';
import { type RecordGqlOperationSignatureFactory } from '@/object-record/graphql/types/RecordGqlOperationSignatureFactory';
import {
  CoreObjectNameSingular,
  FieldMetadataType,
  RelationType,
} from 'twenty-shared/types';
import { isDefined } from 'twenty-shared/utils';

type FindOneRecordForShowPageOperationSignatureFactory = {
  objectMetadataItem: EnrichedObjectMetadataItem;
  objectMetadataItems: EnrichedObjectMetadataItem[];
  visibleFieldIdentifiers?: Set<string>;
};

// To-many relations are the expensive part of the findOne: each one fans out
// into its own server-side query returning up to 60 nested rows.
const isToManyRelationField = (fieldMetadataItem: FieldMetadataItem) =>
  (fieldMetadataItem.type === FieldMetadataType.RELATION ||
    fieldMetadataItem.type === FieldMetadataType.MORPH_RELATION) &&
  (fieldMetadataItem.settings?.relationType === RelationType.ONE_TO_MANY ||
    fieldMetadataItem.relation?.type === RelationType.ONE_TO_MANY);

export const buildFindOneRecordForShowPageOperationSignature: RecordGqlOperationSignatureFactory<
  FindOneRecordForShowPageOperationSignatureFactory
> = ({
  objectMetadataItem,
  objectMetadataItems,
  visibleFieldIdentifiers,
}: FindOneRecordForShowPageOperationSignatureFactory) => {
  // Scalar and to-one fields are always fetched; to-many relations only when
  // the record page layout can actually display them (or when the layout
  // cannot be resolved, in which case visibleFieldIdentifiers is undefined).
  const fieldsToFetch = isDefined(visibleFieldIdentifiers)
    ? objectMetadataItem.fields.filter(
        (fieldMetadataItem) =>
          !isToManyRelationField(fieldMetadataItem) ||
          visibleFieldIdentifiers.has(fieldMetadataItem.id) ||
          visibleFieldIdentifiers.has(fieldMetadataItem.name),
      )
    : objectMetadataItem.fields;

  const shouldFetchActivityTargets = (
    activityTargetsFieldName:
      | CoreObjectNamePlural.NoteTarget
      | CoreObjectNamePlural.TaskTarget,
  ) =>
    fieldsToFetch.some(
      (fieldMetadataItem) =>
        fieldMetadataItem.name === activityTargetsFieldName,
    );

  return {
    objectNameSingular: objectMetadataItem.nameSingular,
    variables: {},
    fields: {
      ...generateDepthRecordGqlFieldsFromFields({
        objectMetadataItems,
        fields: fieldsToFetch,
        depth: 1,
      }),
      ...(shouldFetchActivityTargets(CoreObjectNamePlural.NoteTarget)
        ? {
            noteTargets: generateActivityTargetGqlFields({
              activityObjectNameSingular: CoreObjectNameSingular.Note,
              loadRelations: 'both',
              objectMetadataItems,
            }),
          }
        : {}),
      ...(shouldFetchActivityTargets(CoreObjectNamePlural.TaskTarget)
        ? {
            taskTargets: generateActivityTargetGqlFields({
              activityObjectNameSingular: CoreObjectNameSingular.Task,
              loadRelations: 'both',
              objectMetadataItems,
            }),
          }
        : {}),
    },
  };
};
