import {
  defineCommandMenuItem,
  STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS,
} from 'twenty-sdk/define';

import {
  LOG_CONTACT_COMMAND_UNIVERSAL_IDENTIFIER,
  LOG_CONTACT_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';

export default defineCommandMenuItem({
  universalIdentifier: LOG_CONTACT_COMMAND_UNIVERSAL_IDENTIFIER,
  label: 'Log contact',
  shortLabel: 'Log contact',
  isPinned: false,
  availabilityType: 'RECORD_SELECTION',
  availabilityObjectUniversalIdentifier:
    STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.person.universalIdentifier,
  frontComponentUniversalIdentifier:
    LOG_CONTACT_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
});
