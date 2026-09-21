import { VISIBILITY_RESTRICTED_FIELD_NAMES_BY_OBJECT } from '../../constants/VisibilityRestrictedFieldNamesByObject';

export const isVisibilityRestrictedField = ({
  objectNameSingular,
  fieldName,
}: {
  objectNameSingular: string;
  fieldName: string;
}): boolean =>
  VISIBILITY_RESTRICTED_FIELD_NAMES_BY_OBJECT[objectNameSingular]?.includes(
    fieldName,
  ) ?? false;
