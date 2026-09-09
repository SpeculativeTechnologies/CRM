import { defineFrontComponent } from 'twenty-sdk/define';

import { LogContact } from 'src/components/log-contact';
import { LOG_CONTACT_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';

export default defineFrontComponent({
  universalIdentifier: LOG_CONTACT_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
  name: 'log-contact',
  description:
    'Log contact with a person through LinkedIn, text, phone, or another channel.',
  component: LogContact,
});
