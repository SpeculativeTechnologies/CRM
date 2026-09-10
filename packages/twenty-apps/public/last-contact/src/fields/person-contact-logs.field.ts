import {
  defineField,
  FieldType,
  RelationType,
  STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS,
} from 'twenty-sdk/define';
import {
  CONTACT_LOG_OBJECT_UNIVERSAL_IDENTIFIER,
  CONTACT_LOG_PERSON_FIELD_UNIVERSAL_IDENTIFIER,
  PERSON_CONTACT_LOGS_FIELD_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';

export default defineField({
  universalIdentifier: PERSON_CONTACT_LOGS_FIELD_UNIVERSAL_IDENTIFIER,
  objectUniversalIdentifier:
    STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.person.universalIdentifier,
  type: FieldType.RELATION,
  name: 'contactLogs',
  label: 'Contact logs',
  icon: 'IconMessages',
  isNullable: true,
  description:
    'Log contact through LinkedIn, text, phone, or another channel. Dated entries count toward last contact.',
  relationTargetObjectMetadataUniversalIdentifier:
    CONTACT_LOG_OBJECT_UNIVERSAL_IDENTIFIER,
  relationTargetFieldMetadataUniversalIdentifier:
    CONTACT_LOG_PERSON_FIELD_UNIVERSAL_IDENTIFIER,
  universalSettings: { relationType: RelationType.ONE_TO_MANY },
});
