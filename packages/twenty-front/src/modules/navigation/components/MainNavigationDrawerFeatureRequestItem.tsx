import { useLingui } from '@lingui/react/macro';
import { IconBrandGithub } from 'twenty-ui/icon';

import { CRM_FEATURE_REQUEST_URL } from '@/navigation/constants/CrmFeatureRequestUrl';
import { NavigationDrawerItem } from '@/ui/navigation/navigation-drawer/components/NavigationDrawerItem';

export const MainNavigationDrawerFeatureRequestItem = () => {
  const { t } = useLingui();

  return (
    <NavigationDrawerItem
      label={t`Request a feature`}
      Icon={IconBrandGithub}
      to={CRM_FEATURE_REQUEST_URL}
    />
  );
};
