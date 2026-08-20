import { getFirstNonEmptyLineOfRichText } from '@/blocknote-editor/utils/getFirstNonEmptyLineOfRichText';
import { parseInitialBlocknote } from '@/blocknote-editor/utils/parseInitialBlocknote';
import { getFieldLinkDefinedLinks } from '@/object-record/record-field/ui/meta-types/input/utils/getFieldLinkDefinedLinks';
import { type FieldDefinition } from '@/object-record/record-field/ui/types/FieldDefinition';
import {
  type FieldActorValue,
  type FieldAddressValue,
  type FieldArrayValue,
  type FieldBooleanValue,
  type FieldCurrencyValue,
  type FieldDateMetadataSettings,
  type FieldEmailsValue,
  type FieldFilesValue,
  type FieldFullNameValue,
  type FieldJsonValue,
  type FieldLinksValue,
  type FieldMetadata,
  type FieldMorphRelationManyToOneValue,
  type FieldMorphRelationOneToManyValue,
  type FieldMultiSelectValue,
  type FieldPhonesValue,
  type FieldRichTextValue,
  type FieldSelectValue,
} from '@/object-record/record-field/ui/types/FieldMetadata';
import { isFieldActor } from '@/object-record/record-field/ui/types/guards/isFieldActor';
import { isFieldAddress } from '@/object-record/record-field/ui/types/guards/isFieldAddress';
import { isFieldArray } from '@/object-record/record-field/ui/types/guards/isFieldArray';
import { isFieldBoolean } from '@/object-record/record-field/ui/types/guards/isFieldBoolean';
import { isFieldCurrency } from '@/object-record/record-field/ui/types/guards/isFieldCurrency';
import { isFieldDate } from '@/object-record/record-field/ui/types/guards/isFieldDate';
import { isFieldDateTime } from '@/object-record/record-field/ui/types/guards/isFieldDateTime';
import { isFieldEmails } from '@/object-record/record-field/ui/types/guards/isFieldEmails';
import { isFieldFiles } from '@/object-record/record-field/ui/types/guards/isFieldFiles';
import { isFieldFullName } from '@/object-record/record-field/ui/types/guards/isFieldFullName';
import { isFieldLinks } from '@/object-record/record-field/ui/types/guards/isFieldLinks';
import { isFieldMorphRelationManyToOne } from '@/object-record/record-field/ui/types/guards/isFieldMorphRelationManyToOne';
import { isFieldMorphRelationOneToMany } from '@/object-record/record-field/ui/types/guards/isFieldMorphRelationOneToMany';
import { isFieldMultiSelect } from '@/object-record/record-field/ui/types/guards/isFieldMultiSelect';
import { isFieldNumber } from '@/object-record/record-field/ui/types/guards/isFieldNumber';
import { isFieldPhones } from '@/object-record/record-field/ui/types/guards/isFieldPhones';
import { isFieldRating } from '@/object-record/record-field/ui/types/guards/isFieldRating';
import { isFieldRawJson } from '@/object-record/record-field/ui/types/guards/isFieldRawJson';
import { isFieldRelationManyToOne } from '@/object-record/record-field/ui/types/guards/isFieldRelationManyToOne';
import { isFieldRelationOneToMany } from '@/object-record/record-field/ui/types/guards/isFieldRelationOneToMany';
import { isFieldRichText } from '@/object-record/record-field/ui/types/guards/isFieldRichText';
import { isFieldSelect } from '@/object-record/record-field/ui/types/guards/isFieldSelect';
import { type ObjectRecord } from '@/object-record/types/ObjectRecord';
import { t } from '@lingui/core/macro';
import { isArray, isNonEmptyString } from '@sniptt/guards';
import { parsePhoneNumber } from 'libphonenumber-js';
import { RATING_VALUES } from 'twenty-shared/constants';
import { type FieldRatingValue } from 'twenty-shared/types';
import {
  formatToShortNumber,
  getAbsoluteUrlOrThrow,
  getUrlHostnameOrThrow,
  isDefined,
} from 'twenty-shared/utils';
import { formatAddressDisplay } from '~/utils/formatAddressDisplay';
import { DEFAULT_DECIMAL_VALUE } from '~/utils/format/formatNumber';

const DISPLAY_LABEL_TEXT_SEPARATOR = ', ';

export type FieldDisplayLabelTextFormatters = {
  getRecordLabelText: (
    record: ObjectRecord,
    objectNameSingular: string,
  ) => string;
  getActorLabelText: (actorValue: FieldActorValue) => string;
  formatDateFieldValue: (args: {
    value: string | null | undefined;
    dateFieldSettings?: FieldDateMetadataSettings;
  }) => string;
  formatDateTimeFieldValue: (args: {
    value: string | null | undefined;
    dateFieldSettings?: FieldDateMetadataSettings;
  }) => string;
  formatNumberFieldValue: (args: {
    value: number;
    decimals?: number;
  }) => string;
};

type GetFieldDisplayLabelTextArgs = {
  fieldDefinition: FieldDefinition<FieldMetadata>;
  fieldValue: unknown;
  formatters: FieldDisplayLabelTextFormatters;
};

const joinDisplayLabelTexts = (displayLabelTexts: string[]) =>
  displayLabelTexts.filter(isNonEmptyString).join(DISPLAY_LABEL_TEXT_SEPARATOR);

const getLinkDisplayLabelText = ({
  url,
  label,
}: {
  url: string;
  label: string | null;
}) => {
  if (isNonEmptyString(label)) {
    return label;
  }

  try {
    return getUrlHostnameOrThrow(getAbsoluteUrlOrThrow(url));
  } catch {
    return url;
  }
};

const getPhoneDisplayLabelText = ({
  callingCode,
  number,
}: {
  callingCode: string;
  number: string;
}) => {
  try {
    return parsePhoneNumber(`${callingCode}${number}`).formatInternational();
  } catch {
    return `${callingCode}${number}`;
  }
};

// Plain-text counterpart of what a record field renders on screen, so copying a
// cell yields the label the user is looking at instead of the stored value.
export const getFieldDisplayLabelText = ({
  fieldDefinition,
  fieldValue,
  formatters,
}: GetFieldDisplayLabelTextArgs): string => {
  if (isFieldRelationManyToOne(fieldDefinition)) {
    const relatedRecord = fieldValue as ObjectRecord | null | undefined;

    if (!isDefined(relatedRecord)) {
      return '';
    }

    return formatters.getRecordLabelText(
      relatedRecord,
      fieldDefinition.metadata.relationObjectMetadataNameSingular,
    );
  }

  if (isFieldRelationOneToMany(fieldDefinition)) {
    const relatedRecords = fieldValue as ObjectRecord[] | null | undefined;

    if (!isArray(relatedRecords)) {
      return '';
    }

    return joinDisplayLabelTexts(
      relatedRecords
        .filter(isDefined)
        .map((relatedRecord) =>
          formatters.getRecordLabelText(
            relatedRecord,
            fieldDefinition.metadata.relationObjectMetadataNameSingular,
          ),
        ),
    );
  }

  if (isFieldMorphRelationManyToOne(fieldDefinition)) {
    const morphValue = fieldValue as FieldMorphRelationManyToOneValue;

    if (!isDefined(morphValue?.value)) {
      return '';
    }

    return formatters.getRecordLabelText(
      morphValue.value,
      morphValue.objectNameSingular,
    );
  }

  if (isFieldMorphRelationOneToMany(fieldDefinition)) {
    const morphValues = fieldValue as
      | FieldMorphRelationOneToManyValue
      | null
      | undefined;

    if (!isArray(morphValues)) {
      return '';
    }

    return joinDisplayLabelTexts(
      morphValues
        .filter(isDefined)
        .flatMap((morphValue) =>
          (morphValue.value ?? [])
            .filter(isDefined)
            .map((relatedRecord) =>
              formatters.getRecordLabelText(
                relatedRecord,
                morphValue.objectNameSingular,
              ),
            ),
        ),
    );
  }

  if (isFieldDateTime(fieldDefinition)) {
    return formatters.formatDateTimeFieldValue({
      value: fieldValue as string | null | undefined,
      dateFieldSettings: fieldDefinition.metadata.settings,
    });
  }

  if (isFieldDate(fieldDefinition)) {
    return formatters.formatDateFieldValue({
      value: fieldValue as string | null | undefined,
      dateFieldSettings: fieldDefinition.metadata.settings,
    });
  }

  if (isFieldNumber(fieldDefinition)) {
    if (!isDefined(fieldValue)) {
      return '';
    }

    const numericValue = Number(fieldValue);
    const { type: numberVariant, decimals } =
      fieldDefinition.metadata.settings ?? {};

    if (numberVariant === 'percentage') {
      return `${formatters.formatNumberFieldValue({
        value: numericValue * 100,
        decimals,
      })}%`;
    }

    if (numberVariant === 'shortNumber') {
      return formatToShortNumber(numericValue);
    }

    return formatters.formatNumberFieldValue({ value: numericValue, decimals });
  }

  if (isFieldCurrency(fieldDefinition)) {
    const currencyValue = fieldValue as FieldCurrencyValue | null | undefined;

    if (!isDefined(currencyValue?.amountMicros)) {
      return '';
    }

    const amount = currencyValue.amountMicros / 1000000;
    const { format, decimals } = fieldDefinition.metadata.settings ?? {};

    const amountText =
      !isDefined(format) || format === 'short'
        ? formatToShortNumber(amount)
        : formatters.formatNumberFieldValue({
            value: amount,
            decimals: decimals ?? DEFAULT_DECIMAL_VALUE,
          });

    return isNonEmptyString(currencyValue.currencyCode)
      ? `${currencyValue.currencyCode} ${amountText}`
      : amountText;
  }

  if (isFieldLinks(fieldDefinition)) {
    const linksValue = fieldValue as FieldLinksValue | null | undefined;

    if (!isDefined(linksValue)) {
      return '';
    }

    return joinDisplayLabelTexts(
      getFieldLinkDefinedLinks(linksValue).map(getLinkDisplayLabelText),
    );
  }

  if (isFieldEmails(fieldDefinition)) {
    const emailsValue = fieldValue as FieldEmailsValue | null | undefined;

    if (!isDefined(emailsValue)) {
      return '';
    }

    return joinDisplayLabelTexts([
      emailsValue.primaryEmail,
      ...(emailsValue.additionalEmails ?? []),
    ]);
  }

  if (isFieldPhones(fieldDefinition)) {
    const phonesValue = fieldValue as FieldPhonesValue | null | undefined;

    if (!isDefined(phonesValue)) {
      return '';
    }

    const phones = [
      isNonEmptyString(phonesValue.primaryPhoneNumber)
        ? {
            number: phonesValue.primaryPhoneNumber,
            callingCode:
              phonesValue.primaryPhoneCallingCode ||
              phonesValue.primaryPhoneCountryCode ||
              '',
          }
        : undefined,
      ...(phonesValue.additionalPhones ?? []),
    ].filter(isDefined);

    return joinDisplayLabelTexts(phones.map(getPhoneDisplayLabelText));
  }

  if (isFieldFullName(fieldDefinition)) {
    const fullNameValue = fieldValue as FieldFullNameValue | null | undefined;

    return [fullNameValue?.firstName, fullNameValue?.lastName]
      .filter(isNonEmptyString)
      .join(' ');
  }

  if (isFieldSelect(fieldDefinition)) {
    const selectValue = fieldValue as FieldSelectValue | undefined;

    return (
      fieldDefinition.metadata.options?.find(
        (option) => option.value === selectValue,
      )?.label ?? ''
    );
  }

  if (isFieldMultiSelect(fieldDefinition)) {
    const multiSelectValue = fieldValue as FieldMultiSelectValue | undefined;

    if (!isArray(multiSelectValue)) {
      return '';
    }

    return joinDisplayLabelTexts(
      (fieldDefinition.metadata.options ?? [])
        .filter((option) => multiSelectValue.includes(option.value))
        .map((option) => option.label),
    );
  }

  if (isFieldAddress(fieldDefinition)) {
    const addressValue = fieldValue as FieldAddressValue | undefined;
    const settings = fieldDefinition.metadata.settings;
    const subFields =
      isDefined(settings) && 'subFields' in settings
        ? settings.subFields
        : undefined;

    return formatAddressDisplay(addressValue, subFields);
  }

  if (isFieldRawJson(fieldDefinition)) {
    const jsonValue = fieldValue as FieldJsonValue | undefined;

    return isDefined(jsonValue) ? JSON.stringify(jsonValue) : '';
  }

  if (isFieldBoolean(fieldDefinition)) {
    const booleanValue = fieldValue as FieldBooleanValue | null | undefined;

    if (!isDefined(booleanValue)) {
      return '';
    }

    return booleanValue ? t`True` : t`False`;
  }

  if (isFieldRating(fieldDefinition)) {
    const ratingValue = fieldValue as FieldRatingValue | undefined;

    if (!isDefined(ratingValue)) {
      return '';
    }

    const ratingIndex = RATING_VALUES.indexOf(ratingValue);

    return ratingIndex === -1 ? '' : String(ratingIndex + 1);
  }

  if (isFieldRichText(fieldDefinition)) {
    const richTextValue = fieldValue as FieldRichTextValue | undefined;

    return getFirstNonEmptyLineOfRichText(
      parseInitialBlocknote(richTextValue?.blocknote) ?? null,
    );
  }

  if (isFieldActor(fieldDefinition)) {
    const actorValue = fieldValue as FieldActorValue | null | undefined;

    return isDefined(actorValue)
      ? formatters.getActorLabelText(actorValue)
      : '';
  }

  if (isFieldArray(fieldDefinition)) {
    const arrayValue = fieldValue as FieldArrayValue | null | undefined;

    return isArray(arrayValue) ? joinDisplayLabelTexts(arrayValue) : '';
  }

  if (isFieldFiles(fieldDefinition)) {
    const filesValue = fieldValue as FieldFilesValue[] | null | undefined;

    if (!isArray(filesValue)) {
      return '';
    }

    return joinDisplayLabelTexts(
      filesValue.filter(isDefined).map((file) => file.label),
    );
  }

  if (typeof fieldValue === 'string' || typeof fieldValue === 'number') {
    return String(fieldValue);
  }

  return '';
};
