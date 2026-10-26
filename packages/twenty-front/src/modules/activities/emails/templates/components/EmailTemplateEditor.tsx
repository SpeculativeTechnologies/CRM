import { styled } from '@linaria/react';
import { t } from '@lingui/core/macro';
import { themeCssVariables } from 'twenty-ui/theme';

import { INLINE_EMAIL_BODY_EDITOR_PROFILE } from '@/activities/emails/editor/constants/InlineEmailBodyEditorProfile';
import { FormAdvancedTextFieldInput } from '@/advanced-text-editor/components/FormAdvancedTextFieldInput';
import { EMAIL_TEMPLATE_FIELDS } from '@/activities/emails/templates/utils/emailTemplatePersonalization';
import { type EmailTemplateContent } from '@/activities/emails/templates/types/EmailTemplate';
import { useTextInputFocusStack } from '@/ui/input/hooks/useTextInputFocusStack';

const StyledFields = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[3]};
`;
const StyledLabel = styled.label`
  display: flex;
  flex-direction: column;
  font-size: ${themeCssVariables.font.size.md};
  gap: ${themeCssVariables.spacing[2]};
`;
const StyledInput = styled.input`
  background: ${themeCssVariables.background.primary};
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.sm};
  color: ${themeCssVariables.font.color.primary};
  font: inherit;
  padding: ${themeCssVariables.spacing[2]};
`;

const StyledFieldReference = styled.div`
  background: ${themeCssVariables.background.secondary};
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.sm};
  color: ${themeCssVariables.font.color.secondary};
  font-size: ${themeCssVariables.font.size.sm};
  padding: ${themeCssVariables.spacing[3]};
`;

const StyledTokens = styled.dl`
  display: flex;
  flex-wrap: wrap;
  gap: ${themeCssVariables.spacing[2]} ${themeCssVariables.spacing[4]};
  margin: ${themeCssVariables.spacing[2]} 0;

  > div {
    display: flex;
    gap: ${themeCssVariables.spacing[1]};
  }

  dd {
    margin: 0;
    user-select: all;
  }
`;

type EmailTemplateEditorProps = {
  content: EmailTemplateContent & { name: string };
  onChange: (content: EmailTemplateContent & { name: string }) => void;
  disabled: boolean;
};

export const EmailTemplateEditor = ({
  content,
  onChange,
  disabled,
}: EmailTemplateEditorProps) => {
  const { handleFocus: handleNameFocus, handleBlur: handleNameBlur } =
    useTextInputFocusStack({ focusId: 'email-template-name' });
  const { handleFocus: handleSubjectFocus, handleBlur: handleSubjectBlur } =
    useTextInputFocusStack({ focusId: 'email-template-subject' });
  const labels = {
    firstName: t`First name`,
    lastName: t`Last name`,
    fullName: t`Full name`,
    email: t`Email`,
    jobTitle: t`Job title`,
    city: t`City`,
  };

  return (
    <StyledFields>
      <StyledLabel>
        {t`Template name`}
        <StyledInput
          value={content.name}
          maxLength={120}
          disabled={disabled}
          onFocus={handleNameFocus}
          onBlur={handleNameBlur}
          onChange={(event) =>
            onChange({ ...content, name: event.target.value })
          }
        />
      </StyledLabel>
      <StyledLabel>
        {t`Subject`}
        <StyledInput
          value={content.subject}
          maxLength={998}
          disabled={disabled}
          onFocus={handleSubjectFocus}
          onBlur={handleSubjectBlur}
          onChange={(event) =>
            onChange({ ...content, subject: event.target.value })
          }
        />
      </StyledLabel>
      <FormAdvancedTextFieldInput
        label={t`Body`}
        defaultValue={content.body}
        profile={INLINE_EMAIL_BODY_EDITOR_PROFILE}
        readonly={disabled}
        onChange={(body) => onChange({ ...content, body })}
        minHeight={180}
        enableFullScreen={false}
      />
      <StyledFieldReference role="note" aria-label={t`Personalization fields`}>
        <strong>{t`Personalize the subject or body`}</strong>
        <div>{t`Type or copy these placeholders into your email:`}</div>
        <StyledTokens>
          {EMAIL_TEMPLATE_FIELDS.map((field) => (
            <div key={field}>
              <dt>{labels[field]}</dt>
              <dd>
                <code>{`{{${field}}}`}</code>
              </dd>
            </div>
          ))}
        </StyledTokens>
        <div>{t`Each placeholder is filled from the recipient's record. Missing values become blank.`}</div>
      </StyledFieldReference>
    </StyledFields>
  );
};
