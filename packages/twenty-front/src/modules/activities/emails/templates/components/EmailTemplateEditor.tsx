import { styled } from '@linaria/react';
import { t } from '@lingui/core/macro';
import { type Editor } from '@tiptap/core';
import { useState } from 'react';
import { themeCssVariables } from 'twenty-ui/theme';

import { INLINE_EMAIL_BODY_EDITOR_PROFILE } from '@/activities/emails/editor/constants/InlineEmailBodyEditorProfile';
import { FormAdvancedTextFieldInput } from '@/advanced-text-editor/components/FormAdvancedTextFieldInput';
import { Select } from '@/ui/input/components/Select';
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
  const [editor, setEditor] = useState<Editor | null>(null);
  const exampleField = '{{firstName}}';
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
  const fieldOptions = EMAIL_TEMPLATE_FIELDS.map((field) => ({
    value: `{{${field}}}`,
    label: labels[field],
  }));

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
      <Select
        dropdownId="email-template-subject-field"
        fullWidth
        value=""
        options={fieldOptions}
        emptyOption={{ value: '', label: t`Insert a field in the subject` }}
        disabled={disabled}
        onChange={(value) => {
          if (value) onChange({ ...content, subject: content.subject + value });
        }}
      />
      <Select
        dropdownId="email-template-body-field"
        fullWidth
        value=""
        options={fieldOptions}
        emptyOption={{ value: '', label: t`Insert a field in the body` }}
        disabled={disabled}
        onChange={(value) => {
          if (value) editor?.commands.insertVariableTag(value);
        }}
      />
      <FormAdvancedTextFieldInput
        label={t`Body`}
        defaultValue={content.body}
        profile={INLINE_EMAIL_BODY_EDITOR_PROFILE}
        readonly={disabled}
        onChange={(body) => onChange({ ...content, body })}
        onEditorReady={setEditor}
        minHeight={180}
        enableFullScreen={false}
      />
      <div>{t`Fields such as ${exampleField} are filled from each person's record. Missing values become blank.`}</div>
    </StyledFields>
  );
};
