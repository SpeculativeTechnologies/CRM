import { styled } from '@linaria/react';
import { useLingui } from '@lingui/react/macro';
import { useState } from 'react';
import { useDebouncedCallback } from 'use-debounce';
import { IconMailCog } from 'twenty-ui/icon';
import { Card } from 'twenty-ui/surfaces';
import { themeCssVariables } from 'twenty-ui/theme-constants';

import { EMAIL_SIGNATURE_EDITOR_PROFILE } from '@/activities/emails/signature/constants/EmailSignatureEditorProfile';
import { isEmailSignatureBlank } from '@/activities/emails/signature/utils/emailSignatureDocument';
import { currentWorkspaceMemberState } from '@/auth/states/currentWorkspaceMemberState';
import { FormAdvancedTextFieldInput } from '@/advanced-text-editor/components/FormAdvancedTextFieldInput';
import { SettingsOptionCardContentToggle } from '@/settings/components/SettingsOptions/SettingsOptionCardContentToggle';
import { useUpdateWorkspaceMemberSettings } from '@/settings/profile/hooks/useUpdateWorkspaceMemberSettings';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';
import { logError } from '~/utils/logError';

const StyledContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[4]};
`;

export const SettingsProfileEmailSignature = () => {
  const { t } = useLingui();
  const currentWorkspaceMember = useAtomStateValue(currentWorkspaceMemberState);
  const { updateWorkspaceMemberSettings } = useUpdateWorkspaceMemberSettings();

  const workspaceMemberId = currentWorkspaceMember?.id;
  const storedSignature = currentWorkspaceMember?.emailSignature ?? '';
  const isIncludedByDefault =
    currentWorkspaceMember?.isEmailSignatureIncludedByDefault ?? false;

  const [initialSignature] = useState(storedSignature);

  const persistSignature = useDebouncedCallback(
    async (serializedSignature: string) => {
      try {
        if (workspaceMemberId === undefined) {
          throw new Error('User is not logged in');
        }

        await updateWorkspaceMemberSettings({
          workspaceMemberId,
          update: { emailSignature: serializedSignature },
        });
      } catch (error) {
        logError(error);
      }
    },
    500,
  );

  const handleIncludedByDefaultChange = async (isEnabled: boolean) => {
    try {
      if (workspaceMemberId === undefined) {
        throw new Error('User is not logged in');
      }

      await updateWorkspaceMemberSettings({
        workspaceMemberId,
        update: { isEmailSignatureIncludedByDefault: isEnabled },
      });
    } catch (error) {
      logError(error);
    }
  };

  return (
    <StyledContainer>
      <FormAdvancedTextFieldInput
        defaultValue={initialSignature}
        onChange={persistSignature}
        placeholder={t`Your name, role, and anything else you want at the end of your emails`}
        profile={EMAIL_SIGNATURE_EDITOR_PROFILE}
      />
      <Card rounded>
        <SettingsOptionCardContentToggle
          Icon={IconMailCog}
          title={t`Add my signature to new emails by default`}
          description={t`Off by default. You can still switch the signature on or off for each email you write.`}
          checked={isIncludedByDefault}
          disabled={isEmailSignatureBlank(storedSignature)}
          onChange={handleIncludedByDefaultChange}
        />
      </Card>
    </StyledContainer>
  );
};
