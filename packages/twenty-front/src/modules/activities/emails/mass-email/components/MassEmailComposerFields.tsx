import { useQuery } from '@apollo/client/react';
import { styled } from '@linaria/react';

import { type MassEmailComposerState } from '@/activities/emails/mass-email/hooks/useMassEmailComposerState';
import { EMAIL_PLACEHOLDER_KEYS } from '@/activities/emails/mass-email/utils/emailPlaceholders';
import { FormAdvancedTextFieldInput } from '@/object-record/record-field/ui/form-types/components/FormAdvancedTextFieldInput';
import { FormTextFieldInput } from '@/object-record/record-field/ui/form-types/components/FormTextFieldInput';
import { GET_MY_CONNECTED_ACCOUNTS } from '@/settings/accounts/graphql/queries/getMyConnectedAccounts';
import { Select } from '@/ui/input/components/Select';
import { InputLabel } from '@/ui/input/components/InputLabel';
import { t } from '@lingui/core/macro';
import { IconX } from 'twenty-ui/icon';
import { LightIconButton, type SelectOption } from 'twenty-ui/input';
import { themeCssVariables } from 'twenty-ui/theme-constants';

const StyledFieldsContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[1]};
  padding: ${themeCssVariables.spacing[3]} ${themeCssVariables.spacing[2]};
`;

const StyledRecipientChips = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${themeCssVariables.spacing[1]};
`;

const StyledRecipientChip = styled.div`
  align-items: center;
  background-color: ${themeCssVariables.background.transparent.light};
  border-radius: ${themeCssVariables.border.radius.sm};
  color: ${themeCssVariables.font.color.primary};
  display: flex;
  font-size: ${themeCssVariables.font.size.sm};
  gap: ${themeCssVariables.spacing[1]};
  padding: 0 ${themeCssVariables.spacing[1]};
`;

const StyledHint = styled.div`
  color: ${themeCssVariables.font.color.tertiary};
  font-size: ${themeCssVariables.font.size.xs};
  padding: ${themeCssVariables.spacing[1]} 0;
`;

const StyledPlaceholderToken = styled.code`
  background-color: ${themeCssVariables.background.transparent.light};
  border-radius: ${themeCssVariables.border.radius.sm};
  font-size: ${themeCssVariables.font.size.xs};
  padding: 0 ${themeCssVariables.spacing[1]};
`;

type MassEmailComposerFieldsProps = {
  composerState: MassEmailComposerState;
};

export const MassEmailComposerFields = ({
  composerState,
}: MassEmailComposerFieldsProps) => {
  const { data: accountsData } = useQuery<{
    myConnectedAccounts: { id: string; handle: string }[];
  }>(GET_MY_CONNECTED_ACCOUNTS);

  const accountOptions: SelectOption<string>[] =
    accountsData?.myConnectedAccounts?.map((account) => ({
      label: account.handle,
      value: account.id,
    })) ?? [];

  const hasMultipleAccounts = accountOptions.length > 1;

  return (
    <StyledFieldsContainer>
      {hasMultipleAccounts && (
        <Select
          dropdownId="mass-email-composer-from-account"
          label={t`From`}
          fullWidth
          value={composerState.connectedAccountId}
          options={accountOptions}
          onChange={(value) => composerState.setConnectedAccountId(value)}
        />
      )}
      <InputLabel>{t`To`}</InputLabel>
      <StyledRecipientChips>
        {composerState.includedRecipients.map((recipient) => (
          <StyledRecipientChip key={recipient.personId}>
            {recipient.displayName}
            <LightIconButton
              Icon={IconX}
              size="small"
              accent="tertiary"
              onClick={() => composerState.excludeRecipient(recipient.personId)}
            />
          </StyledRecipientChip>
        ))}
      </StyledRecipientChips>
      {composerState.skippedWithoutEmailCount > 0 && (
        <StyledHint>
          {t`${composerState.skippedWithoutEmailCount} selected people have no email address and were skipped.`}
        </StyledHint>
      )}
      <FormTextFieldInput
        label={t`Subject`}
        defaultValue={composerState.subjectTemplate}
        onChange={composerState.setSubjectTemplate}
        placeholder={t`Subject`}
      />
      <FormAdvancedTextFieldInput
        defaultValue={composerState.bodyTemplate}
        onChange={composerState.setBodyTemplate}
        placeholder={t`Type something or press "/" to see commands`}
        minHeight={120}
        maxWidth={600}
        contentType="html"
      />
      <StyledHint>
        {t`Personalize for each recipient with placeholders:`}{' '}
        {EMAIL_PLACEHOLDER_KEYS.map((placeholderKey) => (
          <StyledPlaceholderToken key={placeholderKey}>
            {`{${placeholderKey}}`}
          </StyledPlaceholderToken>
        ))}
      </StyledHint>
    </StyledFieldsContainer>
  );
};
