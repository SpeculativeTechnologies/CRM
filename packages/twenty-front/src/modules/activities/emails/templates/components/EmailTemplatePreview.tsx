import { t } from '@lingui/core/macro';
import { useState } from 'react';
import { EmailTemplateActionButton as Button } from '@/activities/emails/templates/components/EmailTemplateActionButton';

import { INLINE_EMAIL_BODY_EDITOR_PROFILE } from '@/activities/emails/editor/constants/InlineEmailBodyEditorProfile';
import { type PersonRecordForPlaceholders } from '@/activities/emails/mass-email/utils/emailPlaceholders';
import { type EmailTemplateContent } from '@/activities/emails/templates/types/EmailTemplate';
import {
  buildEmailTemplateValues,
  resolveEmailTemplate,
} from '@/activities/emails/templates/utils/emailTemplatePersonalization';
import { FormAdvancedTextFieldInput } from '@/advanced-text-editor/components/FormAdvancedTextFieldInput';
import { useFindOneRecord } from '@/object-record/hooks/useFindOneRecord';
import { useObjectMetadataItem } from '@/object-metadata/hooks/useObjectMetadataItem';
import { FormSingleRecordPicker } from '@/object-record/record-field/ui/form-types/components/FormSingleRecordPicker';

type EmailTemplatePreviewProps = {
  content: EmailTemplateContent;
  personalize: boolean;
  defaultPersonId?: string;
  disabled: boolean;
  replacesContent: boolean;
  onApply: (content: EmailTemplateContent) => Promise<void>;
};

export const EmailTemplatePreview = ({
  content,
  personalize,
  defaultPersonId,
  disabled,
  replacesContent,
  onApply,
}: EmailTemplatePreviewProps) => {
  const [personId, setPersonId] = useState<string | null>(
    defaultPersonId ?? null,
  );
  const { objectMetadataItem } = useObjectMetadataItem({
    objectNameSingular: 'person',
  });
  const hasCityField = objectMetadataItem.fields.some(
    (field) => field.name === 'city',
  );
  const { record, loading, error } = useFindOneRecord({
    objectNameSingular: 'person',
    objectRecordId: personId ?? undefined,
    recordGqlFields: {
      id: true,
      name: true,
      emails: true,
      jobTitle: true,
      ...(hasCityField && { city: true }),
    },
    skip: !personId,
  });
  const resolved = resolveEmailTemplate(
    content,
    buildEmailTemplateValues((record ?? {}) as PersonRecordForPlaceholders),
  );
  const hasPersonalizedFields = resolved.usedFields.length > 0;
  const needsPerson = personalize && hasPersonalizedFields;
  const canApply =
    !disabled && (!needsPerson || (!!record && !loading && !error));

  return (
    <>
      {hasPersonalizedFields && (
        <FormSingleRecordPicker
          isDropdownInModal
          label={personalize ? t`Personalize for` : t`Preview for`}
          objectNameSingulars={['person']}
          defaultValue={personId}
          onChange={setPersonId}
        />
      )}
      {(!hasPersonalizedFields || !!record) && (
        <>
          <strong>{t`Preview`}</strong>
          <div>{resolved.subject}</div>
          <FormAdvancedTextFieldInput
            key={resolved.body}
            defaultValue={resolved.body}
            profile={INLINE_EMAIL_BODY_EDITOR_PROFILE}
            readonly
            minHeight={80}
            enableFullScreen={false}
          />
          {resolved.missingFields.length > 0 && (
            <div role="status">
              {t`These fields are blank for this person:`}{' '}
              {resolved.missingFields.join(', ')}
            </div>
          )}
        </>
      )}
      {needsPerson && !record && (
        <div>{t`Choose a person to preview and fill personalized fields.`}</div>
      )}
      {error && (
        <div role="alert">{t`This person could not be loaded. Choose another person.`}</div>
      )}
      {!personalize && (
        <div>{t`Personalized fields will be filled separately for each recipient.`}</div>
      )}
      <Button
        title={replacesContent ? t`Replace email content` : t`Use template`}
        variant="primary"
        disabled={!canApply}
        onClick={() => void onApply(personalize ? resolved : content)}
      />
    </>
  );
};
