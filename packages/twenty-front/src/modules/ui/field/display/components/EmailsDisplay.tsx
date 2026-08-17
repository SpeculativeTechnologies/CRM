import React, { useMemo } from 'react';

import { FieldDisplayList } from '@/object-record/record-field/ui/components/FieldDisplayList';
import { type FieldEmailsValue } from '@/object-record/record-field/ui/types/FieldMetadata';
import { isDefined } from 'twenty-shared/utils';
import { RoundedLink } from 'twenty-ui/navigation';

type EmailsDisplayProps = {
  value?: FieldEmailsValue;
  isFocused?: boolean;
  onEmailClick?: (email: string, event: React.MouseEvent<HTMLElement>) => void;
};

export const EmailsDisplay = ({
  value,
  isFocused,
  onEmailClick,
}: EmailsDisplayProps) => {
  const emails = useMemo(
    () =>
      [
        value?.primaryEmail ? value.primaryEmail : null,
        ...(value?.additionalEmails ?? []),
      ].filter(isDefined),
    [value?.primaryEmail, value?.additionalEmails],
  );

  return (
    <FieldDisplayList isChipCountDisplayed={isFocused}>
      {emails.map((email) => (
        <RoundedLink
          key={email}
          label={email}
          href={`mailto:${email}`}
          onClick={(event) => onEmailClick?.(email, event)}
        />
      ))}
    </FieldDisplayList>
  );
};
