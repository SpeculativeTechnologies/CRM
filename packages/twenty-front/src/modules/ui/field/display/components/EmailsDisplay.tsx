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
  const emails = useMemo(() => {
    const primaryEmail = value?.primaryEmail;

    return [
      ...(primaryEmail ? [{ email: primaryEmail, isPrimary: true }] : []),
      ...(value?.additionalEmails ?? [])
        .filter(isDefined)
        .map((email) => ({ email, isPrimary: false })),
    ];
  }, [value?.primaryEmail, value?.additionalEmails]);

  return (
    <FieldDisplayList isChipCountDisplayed={isFocused}>
      {emails.map(({ email, isPrimary }) => (
        <RoundedLink
          key={email}
          label={email}
          href={`mailto:${email}`}
          accent={isPrimary ? 'gold' : undefined}
          onClick={(event) => onEmailClick?.(email, event)}
        />
      ))}
    </FieldDisplayList>
  );
};
