import { type AllowedAddressSubField } from '@/types/AddressFieldsType';
import { type FieldMetadataMultiItemSettings } from '@/types/FieldMetadataMultiItemSettings';
import { type FieldMetadataType } from '@/types/FieldMetadataType';
import { type IsExactly } from '@/types/IsExactly';
import { type LinkedFieldMetadataSettings } from '@/types/LinkedFieldReference';
import { type RelationOnDeleteAction } from '@/types/RelationOnDeleteAction.type';
import { type RelationType } from '@/types/RelationType';
import { type SerializedRelation } from '@/types/SerializedRelation.type';

export enum NumberDataType {
  FLOAT = 'float',
  INT = 'int',
  BIGINT = 'bigint',
}

export enum DateDisplayFormat {
  RELATIVE = 'RELATIVE',
  USER_SETTINGS = 'USER_SETTINGS',
  CUSTOM = 'CUSTOM',
}

export type FieldNumberVariant = 'number' | 'percentage';

export type FieldCurrencyFormat = 'short' | 'full';

export const FIELD_LINKS_VARIANTS = ['url', 'domain'] as const;

export type FieldLinksVariant = (typeof FIELD_LINKS_VARIANTS)[number];

type FieldMetadataNumberSettings = {
  dataType?: NumberDataType;
  decimals?: number;
  type?: FieldNumberVariant;
};

type FieldMetadataCurrencySettings = {
  format?: FieldCurrencyFormat;
  decimals?: number;
};

export type LabelIdentifierFormulaFieldReference = {
  fieldMetadataUniversalIdentifiers: string[];
};

export type LabelIdentifierFormula = {
  template: string;
  fieldReferences: LabelIdentifierFormulaFieldReference[];
};

type FieldMetadataTextSettings = {
  displayedMaxRows?: number;
  labelIdentifierFormula?: LabelIdentifierFormula;
};

type FieldMetadataDateSettings = {
  displayFormat?: DateDisplayFormat;
};

type FieldMetadataDateTimeSettings = {
  displayFormat?: DateDisplayFormat;
};

type FieldMetadataRelationSettings = {
  relationType: RelationType;
  onDelete?: RelationOnDeleteAction;
  joinColumnName?: string | null;
  // Points to the target field on the junction object
  // For MORPH_RELATION fields, morphRelations already contains all targets
  junctionTargetFieldId?: SerializedRelation;
};

type FieldMetadataAddressSettings = {
  subFields?: AllowedAddressSubField[];
};

type FieldMetadataLinksSettings = FieldMetadataMultiItemSettings & {
  type?: FieldLinksVariant;
};

type FieldMetadataFilesSettings = {
  maxNumberOfValues: number;
};

type FieldMetadataTypeSpecificSettingsMapping = {
  [FieldMetadataType.NUMBER]: FieldMetadataNumberSettings | null;
  [FieldMetadataType.CURRENCY]: FieldMetadataCurrencySettings | null;
  [FieldMetadataType.DATE]: FieldMetadataDateSettings | null;
  [FieldMetadataType.DATE_TIME]: FieldMetadataDateTimeSettings | null;
  [FieldMetadataType.TEXT]: FieldMetadataTextSettings | null;
  [FieldMetadataType.RELATION]: FieldMetadataRelationSettings &
    LinkedFieldMetadataSettings;
  [FieldMetadataType.ADDRESS]: FieldMetadataAddressSettings | null;
  [FieldMetadataType.MORPH_RELATION]: FieldMetadataRelationSettings;
  [FieldMetadataType.TS_VECTOR]: null;
  [FieldMetadataType.PHONES]: FieldMetadataMultiItemSettings | null;
  [FieldMetadataType.EMAILS]: FieldMetadataMultiItemSettings | null;
  [FieldMetadataType.LINKS]: FieldMetadataLinksSettings | null;
  [FieldMetadataType.ARRAY]: FieldMetadataMultiItemSettings | null;
  [FieldMetadataType.FILES]: FieldMetadataFilesSettings;
};

export type FieldMetadataSettingsMapping = {
  [TFieldType in FieldMetadataType]: TFieldType extends
    | FieldMetadataType.RELATION
    | FieldMetadataType.MORPH_RELATION
    | FieldMetadataType.FILES
    | FieldMetadataType.TS_VECTOR
    ? FieldMetadataTypeSpecificSettingsMapping[TFieldType]
    : TFieldType extends FieldMetadataType.POSITION
      ? null
      : TFieldType extends keyof FieldMetadataTypeSpecificSettingsMapping
        ?
            | ([
                Exclude<
                  FieldMetadataTypeSpecificSettingsMapping[TFieldType],
                  null
                >,
              ] extends [never]
                ? LinkedFieldMetadataSettings
                : Exclude<
                    FieldMetadataTypeSpecificSettingsMapping[TFieldType],
                    null
                  > &
                    LinkedFieldMetadataSettings)
            | (null extends FieldMetadataTypeSpecificSettingsMapping[TFieldType]
                ? null
                : never)
        : LinkedFieldMetadataSettings | null;
};

export type AllFieldMetadataSettings =
  FieldMetadataSettingsMapping[keyof FieldMetadataSettingsMapping];

export type FieldMetadataSettings<
  T extends FieldMetadataType = FieldMetadataType,
> =
  IsExactly<T, FieldMetadataType> extends true
    ? null | AllFieldMetadataSettings
    : T extends keyof FieldMetadataSettingsMapping
      ? FieldMetadataSettingsMapping[T]
      : never | null;
