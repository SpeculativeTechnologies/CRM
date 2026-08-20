import { act, renderHook } from '@testing-library/react';
import { type ReactNode } from 'react';

import { AuthContext, type AuthContextType } from '@/auth/contexts/AuthContext';
import { DateFormat } from '@/localization/constants/DateFormat';
import { TimeFormat } from '@/localization/constants/TimeFormat';
import { PreComputedChipGeneratorsContext } from '@/object-metadata/contexts/PreComputedChipGeneratorsContext';
import { FieldContext } from '@/object-record/record-field/ui/contexts/FieldContext';
import { useCopyFieldDisplayLabel } from '@/object-record/record-field/ui/hooks/useCopyFieldDisplayLabel';
import { type FieldDefinition } from '@/object-record/record-field/ui/types/FieldDefinition';
import { type FieldMetadata } from '@/object-record/record-field/ui/types/FieldMetadata';
import { recordStoreFamilyState } from '@/object-record/record-store/states/recordStoreFamilyState';
import { type ObjectRecord } from '@/object-record/types/ObjectRecord';
import { useSetAtomFamilyState } from '@/ui/utilities/state/jotai/hooks/useSetAtomFamilyState';
import { UserContext } from '@/users/contexts/UserContext';
import { FieldMetadataType, RelationType } from '~/generated-metadata/graphql';

const copyToClipboardMock = jest.fn();

jest.mock('~/hooks/useCopyToClipboard', () => ({
  useCopyToClipboard: () => ({ copyToClipboard: copyToClipboardMock }),
}));

const authContextValue = {
  currentWorkspaceMembers: [],
  currentWorkspaceDeletedMembers: [],
} as unknown as AuthContextType;

const relationFieldDefinition = {
  fieldMetadataId: 'fieldMetadataId',
  label: 'Company',
  iconName: 'IconBuildingSkyscraper',
  type: FieldMetadataType.RELATION,
  metadata: {
    fieldName: 'company',
    relationType: RelationType.MANY_TO_ONE,
    relationObjectMetadataNameSingular: 'company',
  },
} as FieldDefinition<FieldMetadata>;

const getWrapper =
  (recordId: string) =>
  ({ children }: { children: ReactNode }) => (
    <UserContext.Provider
      value={{
        dateFormat: DateFormat.MONTH_FIRST,
        timeFormat: TimeFormat.HOUR_24,
        timeZone: 'UTC',
      }}
    >
      <AuthContext.Provider value={authContextValue}>
        <PreComputedChipGeneratorsContext.Provider
          value={{
            chipGeneratorPerObjectPerField: {},
            identifierChipGeneratorPerObject: {},
          }}
        >
          <FieldContext.Provider
            value={{
              recordId,
              fieldDefinition: relationFieldDefinition,
              isLabelIdentifier: false,
              isRecordFieldReadOnly: false,
            }}
          >
            {children}
          </FieldContext.Provider>
        </PreComputedChipGeneratorsContext.Provider>
      </AuthContext.Provider>
    </UserContext.Provider>
  );

const renderCopyFieldDisplayLabel = (
  recordId: string,
  record: ObjectRecord,
) => {
  const { result } = renderHook(
    () => ({
      setRecord: useSetAtomFamilyState(recordStoreFamilyState, recordId),
      ...useCopyFieldDisplayLabel(),
    }),
    { wrapper: getWrapper(recordId) },
  );

  act(() => {
    result.current.setRecord(record);
  });

  return result;
};

describe('useCopyFieldDisplayLabel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should copy the linked record name of a relation cell', () => {
    const result = renderCopyFieldDisplayLabel('record-with-company', {
      __typename: 'Person',
      id: 'record-with-company',
      company: { id: 'company-id', name: 'Acme Inc' },
    });

    act(() => {
      result.current.copyFieldDisplayLabel();
    });

    expect(copyToClipboardMock).toHaveBeenCalledWith('Acme Inc');
  });

  it('should not copy anything when the cell is empty', () => {
    const result = renderCopyFieldDisplayLabel('record-without-company', {
      __typename: 'Person',
      id: 'record-without-company',
      company: null,
    });

    act(() => {
      result.current.copyFieldDisplayLabel();
    });

    expect(copyToClipboardMock).not.toHaveBeenCalled();
  });
});
