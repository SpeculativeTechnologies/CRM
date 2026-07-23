import { styled } from '@linaria/react';
import { useNavigate } from 'react-router-dom';

import { MassEmailWorkspace } from '@/activities/emails/mass-email/components/MassEmailWorkspace';
import { massEmailPersonIdsState } from '@/activities/emails/mass-email/states/massEmailPersonIdsState';
import { useFirstConnectedAccount } from '@/activities/emails/hooks/useFirstConnectedAccount';
import { PageContainer } from '@/ui/layout/page/components/PageContainer';
import { PageHeader } from '@/ui/layout/page/components/PageHeader';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';
import { CoreObjectNamePlural } from '@/object-metadata/types/CoreObjectNamePlural';
import { t } from '@lingui/core/macro';
import { AppPath, SettingsPath } from 'twenty-shared/types';
import { isDefined } from 'twenty-shared/utils';
import { IconMail } from 'twenty-ui/icon';
import { Button } from 'twenty-ui/input';
import { themeCssVariables } from 'twenty-ui/theme-constants';
import { useNavigateApp } from '~/hooks/useNavigateApp';
import { useNavigateSettings } from '~/hooks/useNavigateSettings';

const StyledEmptyState = styled.div`
  align-items: center;
  color: ${themeCssVariables.font.color.tertiary};
  display: flex;
  flex: 1;
  flex-direction: column;
  font-size: ${themeCssVariables.font.size.md};
  gap: ${themeCssVariables.spacing[4]};
  justify-content: center;
`;

export const MassEmailPage = () => {
  const massEmailPersonIds = useAtomStateValue(massEmailPersonIdsState);
  const { connectedAccountId, loading: accountLoading } =
    useFirstConnectedAccount();

  const navigate = useNavigate();
  const navigateApp = useNavigateApp();
  const navigateSettings = useNavigateSettings();

  const goToPeople = () =>
    navigateApp(AppPath.RecordIndexPage, {
      objectNamePlural: CoreObjectNamePlural.Person,
    });

  const hasRecipients = massEmailPersonIds.length > 0;

  return (
    <PageContainer>
      <PageHeader
        title={t`Mass email`}
        Icon={IconMail}
        hasClosePageButton
        onClosePage={() => navigate(-1)}
      />
      {!hasRecipients ? (
        <StyledEmptyState>
          {t`No recipients selected.`}
          <Button
            size="small"
            variant="secondary"
            title={t`Go to People`}
            onClick={goToPeople}
          />
        </StyledEmptyState>
      ) : accountLoading ? null : !isDefined(connectedAccountId) ? (
        <StyledEmptyState>
          {t`Connect an email account to send emails.`}
          <Button
            size="small"
            variant="secondary"
            title={t`Connect account`}
            onClick={() => navigateSettings(SettingsPath.NewAccount)}
          />
        </StyledEmptyState>
      ) : (
        <MassEmailWorkspace
          connectedAccountId={connectedAccountId}
          personIds={massEmailPersonIds}
          onSent={goToPeople}
        />
      )}
    </PageContainer>
  );
};
