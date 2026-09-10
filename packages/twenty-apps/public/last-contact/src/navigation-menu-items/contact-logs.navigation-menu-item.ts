import {
  defineNavigationMenuItem,
  NavigationMenuItemType,
} from 'twenty-sdk/define';
import {
  CONTACT_LOG_NAVIGATION_MENU_ITEM_UNIVERSAL_IDENTIFIER,
  CONTACT_LOG_VIEW_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';

export default defineNavigationMenuItem({
  universalIdentifier: CONTACT_LOG_NAVIGATION_MENU_ITEM_UNIVERSAL_IDENTIFIER,
  name: 'Contact logs',
  icon: 'IconMessages',
  color: 'blue',
  position: 1,
  type: NavigationMenuItemType.VIEW,
  viewUniversalIdentifier: CONTACT_LOG_VIEW_UNIVERSAL_IDENTIFIER,
});
