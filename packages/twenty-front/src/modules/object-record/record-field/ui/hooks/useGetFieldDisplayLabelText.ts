import { AuthContext } from '@/auth/contexts/AuthContext';
import { useNumberFormat } from '@/localization/hooks/useNumberFormat';
import { PreComputedChipGeneratorsContext } from '@/object-metadata/contexts/PreComputedChipGeneratorsContext';
import { generateDefaultRecordChipData } from '@/object-metadata/utils/generateDefaultRecordChipData';
import { type FieldDefinition } from '@/object-record/record-field/ui/types/FieldDefinition';
import {
  type FieldActorValue,
  type FieldMetadata,
} from '@/object-record/record-field/ui/types/FieldMetadata';
import {
  getFieldDisplayLabelText,
  type FieldDisplayLabelTextFormatters,
} from '@/object-record/record-field/ui/utils/getFieldDisplayLabelText';
import { type ObjectRecord } from '@/object-record/types/ObjectRecord';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';
import { UserContext } from '@/users/contexts/UserContext';
import { useCallback, useContext, useMemo } from 'react';
import { isDefined } from 'twenty-shared/utils';
import { dateLocaleState } from '~/localization/states/dateLocaleState';
import { formatDateString } from '~/utils/string/formatDateString';
import { formatDateTimeString } from '~/utils/string/formatDateTimeString';

export const useGetFieldDisplayLabelText = () => {
  const { identifierChipGeneratorPerObject } = useContext(
    PreComputedChipGeneratorsContext,
  );
  const { currentWorkspaceMembers, currentWorkspaceDeletedMembers } =
    useContext(AuthContext);
  const { dateFormat, timeFormat, timeZone } = useContext(UserContext);
  const dateLocale = useAtomStateValue(dateLocaleState);
  const { formatNumber } = useNumberFormat();

  const formatters = useMemo<FieldDisplayLabelTextFormatters>(
    () => ({
      getRecordLabelText: (
        record: ObjectRecord,
        objectNameSingular: string,
      ) => {
        const identifierChipGenerator =
          identifierChipGeneratorPerObject?.[objectNameSingular];

        return isDefined(identifierChipGenerator)
          ? identifierChipGenerator(record).name
          : generateDefaultRecordChipData({ record, objectNameSingular }).name;
      },
      getActorLabelText: (actorValue: FieldActorValue) => {
        const relatedWorkspaceMember = [
          ...(currentWorkspaceDeletedMembers ?? []),
          ...(currentWorkspaceMembers ?? []),
        ].find(
          (workspaceMember) =>
            workspaceMember.id === actorValue.workspaceMemberId,
        );

        if (!isDefined(relatedWorkspaceMember)) {
          return actorValue.name;
        }

        const { firstName, lastName } = relatedWorkspaceMember.name;

        return `${firstName} ${lastName}`;
      },
      formatDateFieldValue: ({ value, dateFieldSettings }) =>
        formatDateString({
          value,
          // Db-stored dates (yyyy-mm-dd) are converted to UTC dateTime by
          // TypeORM, so they must be read back in UTC.
          timeZone: 'UTC',
          dateFormat,
          dateFieldSettings,
          localeCatalog: dateLocale.localeCatalog,
        }),
      formatDateTimeFieldValue: ({ value, dateFieldSettings }) =>
        formatDateTimeString({
          value,
          timeZone,
          dateFormat,
          timeFormat,
          dateFieldSettings,
          localeCatalog: dateLocale.localeCatalog,
        }),
      formatNumberFieldValue: ({ value, decimals }) =>
        formatNumber(value, { decimals }),
    }),
    [
      currentWorkspaceDeletedMembers,
      currentWorkspaceMembers,
      dateFormat,
      dateLocale.localeCatalog,
      formatNumber,
      identifierChipGeneratorPerObject,
      timeFormat,
      timeZone,
    ],
  );

  const getFieldDisplayLabelTextForField = useCallback(
    ({
      fieldDefinition,
      fieldValue,
    }: {
      fieldDefinition: FieldDefinition<FieldMetadata>;
      fieldValue: unknown;
    }) => getFieldDisplayLabelText({ fieldDefinition, fieldValue, formatters }),
    [formatters],
  );

  return { getFieldDisplayLabelText: getFieldDisplayLabelTextForField };
};
