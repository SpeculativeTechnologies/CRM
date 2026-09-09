import {
  defineObject,
  FieldType,
  OnDeleteAction,
  RelationType,
  STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS,
} from 'twenty-sdk/define';

import {
  CONTACT_LOG_CHANNELS,
  CONTACT_LOG_DIRECTIONS,
} from 'src/constants/contact-log-options';
import {
  CONTACT_LOG_OBJECT_UNIVERSAL_IDENTIFIER,
  CONTACT_LOG_NAME_FIELD_UNIVERSAL_IDENTIFIER,
  CONTACT_LOG_OCCURRED_AT_FIELD_UNIVERSAL_IDENTIFIER,
  CONTACT_LOG_CHANNEL_FIELD_UNIVERSAL_IDENTIFIER,
  CONTACT_LOG_DIRECTION_FIELD_UNIVERSAL_IDENTIFIER,
  CONTACT_LOG_NOTES_FIELD_UNIVERSAL_IDENTIFIER,
  CONTACT_LOG_PERSON_FIELD_UNIVERSAL_IDENTIFIER,
  PERSON_CONTACT_LOGS_FIELD_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';

export default defineObject({
  universalIdentifier: CONTACT_LOG_OBJECT_UNIVERSAL_IDENTIFIER,
  nameSingular: 'contactLog',
  namePlural: 'contactLogs',
  labelSingular: 'Contact log',
  labelPlural: 'Contact logs',
  description:
    'Contact through LinkedIn, text, phone, or another channel, logged against a person.',
  icon: 'IconMessages',
  labelIdentifierFieldMetadataUniversalIdentifier:
    CONTACT_LOG_NAME_FIELD_UNIVERSAL_IDENTIFIER,
  fields: [
    {
      universalIdentifier: CONTACT_LOG_NAME_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'name',
      label: 'Summary',
      icon: 'IconAbc',
    },
    {
      universalIdentifier: CONTACT_LOG_OCCURRED_AT_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.DATE_TIME,
      name: 'occurredAt',
      label: 'Contact date',
      description:
        'When the contact happened. Future dates do not count as contact.',
      icon: 'IconClock',
      isNullable: false,
      defaultValue: 'now',
    },
    {
      universalIdentifier: CONTACT_LOG_CHANNEL_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.SELECT,
      name: 'channel',
      label: 'Channel',
      icon: 'IconMessages',
      isNullable: false,
      defaultValue: "'OTHER'",
      options: CONTACT_LOG_CHANNELS.map((option) => ({ ...option })),
    },
    {
      universalIdentifier: CONTACT_LOG_DIRECTION_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.SELECT,
      name: 'direction',
      label: 'Direction',
      icon: 'IconArrowsExchange',
      isNullable: false,
      defaultValue: "'OUTBOUND'",
      options: CONTACT_LOG_DIRECTIONS.map((option) => ({ ...option })),
    },
    {
      universalIdentifier: CONTACT_LOG_NOTES_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'notes',
      label: 'Notes',
      icon: 'IconNotes',
    },
    {
      universalIdentifier: CONTACT_LOG_PERSON_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.RELATION,
      name: 'person',
      label: 'Person',
      icon: 'IconUser',
      isNullable: true,
      relationTargetObjectMetadataUniversalIdentifier:
        STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.person.universalIdentifier,
      relationTargetFieldMetadataUniversalIdentifier:
        PERSON_CONTACT_LOGS_FIELD_UNIVERSAL_IDENTIFIER,
      universalSettings: {
        relationType: RelationType.MANY_TO_ONE,
        onDelete: OnDeleteAction.SET_NULL,
        joinColumnName: 'personId',
      },
    },
  ],
});
