import { styled } from '@linaria/react';
import { useState } from 'react';

import { type MassEmailComposerState } from '@/activities/emails/mass-email/hooks/useMassEmailComposerState';
import { FormAdvancedTextFieldInput } from '@/object-record/record-field/ui/form-types/components/FormAdvancedTextFieldInput';
import { FormTextFieldInput } from '@/object-record/record-field/ui/form-types/components/FormTextFieldInput';
import { t } from '@lingui/core/macro';
import {
  IconChevronLeft,
  IconChevronRight,
  IconRestore,
  IconX,
} from 'twenty-ui/icon';
import { LightIconButton } from 'twenty-ui/input';
import { themeCssVariables } from 'twenty-ui/theme-constants';

const StyledContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[1]};
  padding: ${themeCssVariables.spacing[3]} ${themeCssVariables.spacing[2]};
`;

const StyledPagerRow = styled.div`
  align-items: center;
  display: flex;
  gap: ${themeCssVariables.spacing[1]};
  justify-content: space-between;
`;

const StyledPagerControls = styled.div`
  align-items: center;
  color: ${themeCssVariables.font.color.secondary};
  display: flex;
  font-size: ${themeCssVariables.font.size.sm};
  gap: ${themeCssVariables.spacing[1]};
`;

const StyledRecipientRow = styled.div`
  color: ${themeCssVariables.font.color.primary};
  font-size: ${themeCssVariables.font.size.sm};
`;

const StyledRecipientEmail = styled.span`
  color: ${themeCssVariables.font.color.tertiary};
`;

const StyledCustomizedRow = styled.div`
  align-items: center;
  color: ${themeCssVariables.font.color.tertiary};
  display: flex;
  font-size: ${themeCssVariables.font.size.xs};
  gap: ${themeCssVariables.spacing[1]};
`;

const StyledMissingWarning = styled.div`
  color: ${themeCssVariables.color.yellow};
  font-size: ${themeCssVariables.font.size.xs};
`;

const StyledEmptyState = styled.div`
  color: ${themeCssVariables.font.color.tertiary};
  font-size: ${themeCssVariables.font.size.sm};
  padding: ${themeCssVariables.spacing[4]};
  text-align: center;
`;

type MassEmailPreviewProps = {
  composerState: MassEmailComposerState;
};

export const MassEmailPreview = ({ composerState }: MassEmailPreviewProps) => {
  const [previewIndex, setPreviewIndex] = useState(0);
  const [resetNonce, setResetNonce] = useState(0);

  const recipients = composerState.includedRecipients;

  if (recipients.length === 0) {
    return <StyledEmptyState>{t`No recipients to preview.`}</StyledEmptyState>;
  }

  const clampedIndex = Math.max(
    0,
    Math.min(previewIndex, recipients.length - 1),
  );
  const recipient = recipients[clampedIndex];
  const resolved = composerState.resolveForRecipient(recipient);

  const editorKey = `${recipient.personId}:${resetNonce}`;

  const handleReset = () => {
    composerState.resetRecipientOverride(recipient.personId);
    setResetNonce((previousNonce) => previousNonce + 1);
  };

  const handleRemoveRecipient = () => {
    composerState.excludeRecipient(recipient.personId);
    setPreviewIndex(Math.min(clampedIndex, recipients.length - 2));
  };

  return (
    <StyledContainer>
      <StyledPagerRow>
        <StyledPagerControls>
          <LightIconButton
            Icon={IconChevronLeft}
            size="small"
            accent="secondary"
            disabled={clampedIndex === 0}
            onClick={() => setPreviewIndex(clampedIndex - 1)}
          />
          {t`Recipient ${clampedIndex + 1} of ${recipients.length}`}
          <LightIconButton
            Icon={IconChevronRight}
            size="small"
            accent="secondary"
            disabled={clampedIndex === recipients.length - 1}
            onClick={() => setPreviewIndex(clampedIndex + 1)}
          />
        </StyledPagerControls>
        <LightIconButton
          Icon={IconX}
          size="small"
          accent="tertiary"
          onClick={handleRemoveRecipient}
        />
      </StyledPagerRow>
      <StyledRecipientRow>
        {recipient.displayName}{' '}
        <StyledRecipientEmail>{`<${recipient.email}>`}</StyledRecipientEmail>
      </StyledRecipientRow>
      {resolved.isCustomized && (
        <StyledCustomizedRow>
          {t`Customized for this recipient`}
          <LightIconButton
            Icon={IconRestore}
            size="small"
            accent="tertiary"
            onClick={handleReset}
          />
        </StyledCustomizedRow>
      )}
      {resolved.missingPlaceholderKeys.length > 0 && (
        <StyledMissingWarning>
          {t`Missing data for:`}{' '}
          {resolved.missingPlaceholderKeys
            .map((placeholderKey) => `{${placeholderKey}}`)
            .join(', ')}
        </StyledMissingWarning>
      )}
      <FormTextFieldInput
        key={`subject:${editorKey}`}
        label={t`Subject`}
        defaultValue={resolved.subject}
        onChange={(value) =>
          composerState.setRecipientSubject(recipient.personId, value)
        }
        placeholder={t`Subject`}
      />
      <FormAdvancedTextFieldInput
        key={`body:${editorKey}`}
        defaultValue={resolved.body}
        onChange={(value) =>
          composerState.setRecipientBody(recipient.personId, value)
        }
        placeholder={t`Email body`}
        minHeight={120}
        maxWidth={600}
        contentType="html"
      />
    </StyledContainer>
  );
};
