import { FieldMetadataType } from '@/types/FieldMetadataType';

// Relation sources retain their cardinality and target; files require separate
// ownership rules and are not supported as linked values.
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
  FieldMetadataType.RELATION,
  FieldMetadataType.RAW_JSON,
  FieldMetadataType.RICH_TEXT,
  FieldMetadataType.SELECT,
  FieldMetadataType.TEXT,
  FieldMetadataType.UUID,
];
