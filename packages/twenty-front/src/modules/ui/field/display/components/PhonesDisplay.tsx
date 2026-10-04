import { FieldDisplayList } from '@/object-record/record-field/ui/components/FieldDisplayList';
import { createPhonesFromFieldValue } from '@/object-record/record-field/ui/meta-types/input/utils/phonesUtils';
import { type FieldPhonesValue } from '@/object-record/record-field/ui/types/FieldMetadata';
import { parsePhoneNumber } from 'libphonenumber-js';
import React, { useMemo } from 'react';
import { isDefined } from 'twenty-shared/utils';
import { RoundedLink } from '@/ui/navigation/link/components/RoundedLink/RoundedLink';

type PhonesDisplayProps = {
  value?: FieldPhonesValue;
  isFocused?: boolean;
  onPhoneNumberClick?: (
    phoneNumber: string,
    event: React.MouseEvent<HTMLElement>,
  ) => void;
};

export const PhonesDisplay = ({
  value,
  isFocused,
  onPhoneNumberClick,
}: PhonesDisplayProps) => {
  const phones = useMemo(() => {
    if (!isDefined(value)) {
      return [];
    }

    return createPhonesFromFieldValue(value);
  }, [value]);
  const parsePhoneNumberOrReturnInvalidValue = (number: string) => {
    try {
      return { parsedPhone: parsePhoneNumber(number) };
    } catch {
      return { invalidPhone: number };
    }
  };

  return (
    <FieldDisplayList isChipCountDisplayed={isFocused}>
      {phones.map(({ number, callingCode }) => {
        const { parsedPhone, invalidPhone } =
          parsePhoneNumberOrReturnInvalidValue(callingCode + number);
        const URI = parsedPhone?.getURI();
        return (
          <RoundedLink
            key={`${callingCode}${number}`}
            href={URI || ''}
            label={
              parsedPhone ? parsedPhone.formatInternational() : invalidPhone
            }
            onClick={(event) =>
              onPhoneNumberClick?.(callingCode + number, event)
            }
          />
        );
      })}
    </FieldDisplayList>
  );
};
