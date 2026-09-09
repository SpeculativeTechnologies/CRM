import { defineFrontComponent } from 'twenty-sdk/define';
import { useSelectedRecordIds } from 'twenty-sdk/front-component';

import { LOG_CONTACT_TAB_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { LogContact } from 'src/components/log-contact';

export const LogContactTab = () => {
  const selectedRecordIds = useSelectedRecordIds();

  return <LogContact key={selectedRecordIds.join(',')} presentation="tab" />;
};

export default defineFrontComponent({
  universalIdentifier: LOG_CONTACT_TAB_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
  name: 'log-contact-tab',
  description: 'Record contact directly from the person page.',
  component: LogContactTab,
});
