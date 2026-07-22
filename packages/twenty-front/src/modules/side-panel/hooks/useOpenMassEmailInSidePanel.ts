import { useCallback } from 'react';

import { useStore } from 'jotai';
import { SidePanelPages } from 'twenty-shared/types';
import { IconMail } from 'twenty-ui/icon';
import { v4 } from 'uuid';

import { useSidePanelMenu } from '@/side-panel/hooks/useSidePanelMenu';
import { massEmailConnectedAccountIdComponentState } from '@/side-panel/pages/mass-email/states/massEmailConnectedAccountIdComponentState';
import { massEmailPersonIdsComponentState } from '@/side-panel/pages/mass-email/states/massEmailPersonIdsComponentState';
import { t } from '@lingui/core/macro';

type OpenMassEmailParams = {
  connectedAccountId: string;
  personIds: string[];
};

export const useOpenMassEmailInSidePanel = () => {
  const store = useStore();
  const { navigateSidePanelMenu } = useSidePanelMenu();

  const openMassEmailInSidePanel = useCallback(
    (params: OpenMassEmailParams) => {
      const pageId = v4();

      store.set(
        massEmailConnectedAccountIdComponentState.atomFamily({
          instanceId: pageId,
        }),
        params.connectedAccountId,
      );

      store.set(
        massEmailPersonIdsComponentState.atomFamily({
          instanceId: pageId,
        }),
        params.personIds,
      );

      navigateSidePanelMenu({
        page: SidePanelPages.MassEmail,
        pageTitle: t`Mass email`,
        pageIcon: IconMail,
        pageId,
      });
    },
    [navigateSidePanelMenu, store],
  );

  return { openMassEmailInSidePanel };
};
