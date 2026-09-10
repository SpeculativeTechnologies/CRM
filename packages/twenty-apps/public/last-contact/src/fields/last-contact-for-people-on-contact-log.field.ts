import {
  defineField,
  FieldType,
  RelationType,
  STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS,
} from 'twenty-sdk/define';

import {
  LAST_CONTACT_FOR_PEOPLE_ON_CONTACT_LOG_FIELD_UNIVERSAL_IDENTIFIER,
  LAST_CONTACT_ITEM_CONTACT_LOG_FIELD_UNIVERSAL_IDENTIFIER,
  CONTACT_LOG_OBJECT_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';

export default defineField({
  universalIdentifier:
    LAST_CONTACT_FOR_PEOPLE_ON_CONTACT_LOG_FIELD_UNIVERSAL_IDENTIFIER,
  objectUniversalIdentifier: CONTACT_LOG_OBJECT_UNIVERSAL_IDENTIFIER,
  type: FieldType.RELATION,
  name: 'lastContactForPeople',
  label: 'Last contact for',
  description: 'People whose most recent contact was this contact log.',
  icon: 'IconUser',
  isNullable: true,
  relationTargetObjectMetadataUniversalIdentifier:
    STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.person.universalIdentifier,
  relationTargetFieldMetadataUniversalIdentifier:
    LAST_CONTACT_ITEM_CONTACT_LOG_FIELD_UNIVERSAL_IDENTIFIER,
  universalSettings: {
    relationType: RelationType.ONE_TO_MANY,
  },
  isUIEditable: false,
});
