import { FieldMetadataType } from '@/types/FieldMetadataType';

// A linked column follows one Person relationship, so relation traversal and
// file ownership cannot be inferred from its displayed value.
export const LINKED_FIELD_SUPPORTED_TYPES: readonly FieldMetadataType[] = [
  FieldMetadataType.ACTOR,
  FieldMetadataType.ADDRESS,
  FieldMetadataType.ARRAY,
  FieldMetadataType.BOOLEAN,
  FieldMetadataType.CURRENCY,
  FieldMetadataType.DATE,
  FieldMetadataType.DATE_TIME,
  FieldMetadataType.EMAILS,
  FieldMetadataType.FULL_NAME,
  FieldMetadataType.LINKS,
  FieldMetadataType.MULTI_SELECT,
  FieldMetadataType.NUMBER,
  FieldMetadataType.NUMERIC,
  FieldMetadataType.PHONES,
  FieldMetadataType.RATING,
  FieldMetadataType.RAW_JSON,
  FieldMetadataType.RICH_TEXT,
  FieldMetadataType.SELECT,
  FieldMetadataType.TEXT,
  FieldMetadataType.UUID,
];
