import { t } from '@lingui/core/macro';
import { IconLogin2, IconRefresh } from 'twenty-ui/icon';

import { useRecoverAuthProxySession } from '@/apollo/hooks/useRecoverAuthProxySession';
import { isAuthProxySessionExpiredState } from '@/apollo/states/isAuthProxySessionExpiredState';
import { InformationBanner } from '@/information-banner/components/InformationBanner';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';
import { reloadWindow } from '~/utils/reloadWindow';

const COMPONENT_INSTANCE_ID = 'information-banner-session-expired';

export const InformationBannerSessionExpired = () => {
  const isAuthProxySessionExpired = useAtomStateValue(
    isAuthProxySessionExpiredState,
  );

  useRecoverAuthProxySession();

  if (!isAuthProxySessionExpired) {
    return null;
  }

  // A new tab, not this one: signing in is a document navigation, which is the
  // only thing that follows the proxy's redirect. Doing it here would discard
  // the view, the scroll position and every unsaved edit on the page.
  const openSignInInNewTab = () => {
    window.open(window.location.origin, '_blank', 'noopener,noreferrer');
  };

  return (
    <InformationBanner
      componentInstanceId={COMPONENT_INSTANCE_ID}
      color="danger"
      message={t`Your session expired. Sign in again in a new tab to keep this page and any unsaved changes.`}
      buttonTitle={t`Sign in again`}
      buttonIcon={IconLogin2}
      buttonOnClick={openSignInInNewTab}
      secondaryButtonTitle={t`Reload`}
      secondaryButtonIcon={IconRefresh}
      secondaryButtonOnClick={reloadWindow}
    />
  );
};
