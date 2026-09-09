import { defineView } from 'twenty-sdk/define';
import {
  CONTACT_LOG_OBJECT_UNIVERSAL_IDENTIFIER,
  CONTACT_LOG_VIEW_UNIVERSAL_IDENTIFIER,
  CONTACT_LOG_NAME_FIELD_UNIVERSAL_IDENTIFIER,
  CONTACT_LOG_VIEW_NAME_FIELD_UNIVERSAL_IDENTIFIER,
  CONTACT_LOG_PERSON_FIELD_UNIVERSAL_IDENTIFIER,
  CONTACT_LOG_VIEW_PERSON_FIELD_UNIVERSAL_IDENTIFIER,
  CONTACT_LOG_CHANNEL_FIELD_UNIVERSAL_IDENTIFIER,
  CONTACT_LOG_VIEW_CHANNEL_FIELD_UNIVERSAL_IDENTIFIER,
  CONTACT_LOG_DIRECTION_FIELD_UNIVERSAL_IDENTIFIER,
  CONTACT_LOG_VIEW_DIRECTION_FIELD_UNIVERSAL_IDENTIFIER,
  CONTACT_LOG_OCCURRED_AT_FIELD_UNIVERSAL_IDENTIFIER,
  CONTACT_LOG_VIEW_OCCURRED_AT_FIELD_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';

export default defineView({
  universalIdentifier: CONTACT_LOG_VIEW_UNIVERSAL_IDENTIFIER,
  name: 'All contact logs',
  objectUniversalIdentifier: CONTACT_LOG_OBJECT_UNIVERSAL_IDENTIFIER,
  icon: 'IconMessages',
  position: 0,
  fields: [
    {
      universalIdentifier: CONTACT_LOG_VIEW_NAME_FIELD_UNIVERSAL_IDENTIFIER,
      fieldMetadataUniversalIdentifier:
        CONTACT_LOG_NAME_FIELD_UNIVERSAL_IDENTIFIER,
      position: 0,
      isVisible: true,
      size: 240,
    },
    {
      universalIdentifier: CONTACT_LOG_VIEW_PERSON_FIELD_UNIVERSAL_IDENTIFIER,
      fieldMetadataUniversalIdentifier:
        CONTACT_LOG_PERSON_FIELD_UNIVERSAL_IDENTIFIER,
      position: 1,
      isVisible: true,
      size: 180,
    },
    {
      universalIdentifier: CONTACT_LOG_VIEW_CHANNEL_FIELD_UNIVERSAL_IDENTIFIER,
      fieldMetadataUniversalIdentifier:
        CONTACT_LOG_CHANNEL_FIELD_UNIVERSAL_IDENTIFIER,
      position: 2,
      isVisible: true,
      size: 180,
    },
    {
      universalIdentifier:
        CONTACT_LOG_VIEW_DIRECTION_FIELD_UNIVERSAL_IDENTIFIER,
      fieldMetadataUniversalIdentifier:
        CONTACT_LOG_DIRECTION_FIELD_UNIVERSAL_IDENTIFIER,
      position: 3,
      isVisible: true,
      size: 180,
    },
    {
      universalIdentifier:
        CONTACT_LOG_VIEW_OCCURRED_AT_FIELD_UNIVERSAL_IDENTIFIER,
      fieldMetadataUniversalIdentifier:
        CONTACT_LOG_OCCURRED_AT_FIELD_UNIVERSAL_IDENTIFIER,
      position: 4,
      isVisible: true,
      size: 180,
    },
  ],
});
