import {
  defineField,
  FieldType,
  OnDeleteAction,
  RelationType,
  STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS,
} from 'twenty-sdk/define';

import {
  CONTACT_LOG_OBJECT_UNIVERSAL_IDENTIFIER,
  LAST_CONTACT_FOR_OPPORTUNITIES_ON_CONTACT_LOG_FIELD_UNIVERSAL_IDENTIFIER,
  OPPORTUNITY_LAST_CONTACT_ITEM_CONTACT_LOG_FIELD_UNIVERSAL_IDENTIFIER,
  OPPORTUNITY_LAST_CONTACT_ITEM_MORPH_ID,
} from 'src/constants/universal-identifiers';

export default defineField({
  universalIdentifier:
    OPPORTUNITY_LAST_CONTACT_ITEM_CONTACT_LOG_FIELD_UNIVERSAL_IDENTIFIER,
  objectUniversalIdentifier:
    STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.opportunity.universalIdentifier,
  type: FieldType.MORPH_RELATION,
  name: 'lastContactItemContactLog',
  label: 'Last contact item',
  description:
    'The email, meeting, or contact log that was the most recent contact with a person related to this opportunity.',
  icon: 'IconMessage',
  isNullable: true,
  morphId: OPPORTUNITY_LAST_CONTACT_ITEM_MORPH_ID,
  relationTargetObjectMetadataUniversalIdentifier:
    CONTACT_LOG_OBJECT_UNIVERSAL_IDENTIFIER,
  relationTargetFieldMetadataUniversalIdentifier:
    LAST_CONTACT_FOR_OPPORTUNITIES_ON_CONTACT_LOG_FIELD_UNIVERSAL_IDENTIFIER,
  universalSettings: {
    relationType: RelationType.MANY_TO_ONE,
    onDelete: OnDeleteAction.SET_NULL,
    joinColumnName: 'lastContactItemContactLogId',
  },
  isUIEditable: false,
});
