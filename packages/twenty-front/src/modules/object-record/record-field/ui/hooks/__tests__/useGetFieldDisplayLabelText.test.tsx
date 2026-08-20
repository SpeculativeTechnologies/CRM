import { renderHook } from '@testing-library/react';
import { type ReactNode } from 'react';

import { AuthContext, type AuthContextType } from '@/auth/contexts/AuthContext';
import { PreComputedChipGeneratorsContext } from '@/object-metadata/contexts/PreComputedChipGeneratorsContext';
import { useGetFieldDisplayLabelText } from '@/object-record/record-field/ui/hooks/useGetFieldDisplayLabelText';
import { type FieldDefinition } from '@/object-record/record-field/ui/types/FieldDefinition';
import { type FieldMetadata } from '@/object-record/record-field/ui/types/FieldMetadata';
import { DateFormat } from '@/localization/constants/DateFormat';
import { TimeFormat } from '@/localization/constants/TimeFormat';
import { UserContext } from '@/users/contexts/UserContext';
import { FieldMetadataType, RelationType } from '~/generated-metadata/graphql';

const authContextValue = {
  currentWorkspaceMembers: [
    {
      id: 'workspace-member-id',
      name: { firstName: 'Jane', lastName: 'Doe' },
      avatarUrl: null,
    },
  ],
  currentWorkspaceDeletedMembers: [],
} as unknown as AuthContextType;

const wrapper = ({ children }: { children: ReactNode }) => (
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
          identifierChipGeneratorPerObject: {
            company: (record) => ({
              recordId: record.id,
              name: `Chip ${record.name}`,
              avatarType: 'rounded',
              avatarUrl: '',
              isLabelIdentifier: true,
              objectNameSingular: 'company',
            }),
          },
        }}
      >
        {children}
      </PreComputedChipGeneratorsContext.Provider>
    </AuthContext.Provider>
  </UserContext.Provider>
);

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

const actorFieldDefinition = {
  fieldMetadataId: 'fieldMetadataId',
  label: 'Created by',
  iconName: 'IconCreativeCommonsSa',
  type: FieldMetadataType.ACTOR,
  metadata: { fieldName: 'createdBy' },
} as FieldDefinition<FieldMetadata>;

describe('useGetFieldDisplayLabelText', () => {
  it('should return the chip label of the related record for a relation field', () => {
    const { result } = renderHook(() => useGetFieldDisplayLabelText(), {
      wrapper,
    });

    expect(
      result.current.getFieldDisplayLabelText({
        fieldDefinition: relationFieldDefinition,
        fieldValue: { id: 'company-id', name: 'Acme Inc' },
      }),
    ).toBe('Chip Acme Inc');
  });

  it('should fall back to the record name when the related object has no chip generator', () => {
    const { result } = renderHook(() => useGetFieldDisplayLabelText(), {
      wrapper,
    });

    expect(
      result.current.getFieldDisplayLabelText({
        fieldDefinition: {
          ...relationFieldDefinition,
          metadata: {
            ...relationFieldDefinition.metadata,
            relationObjectMetadataNameSingular: 'person',
          },
        } as FieldDefinition<FieldMetadata>,
        fieldValue: {
          id: 'person-id',
          name: { firstName: 'John', lastName: 'Smith' },
        },
      }),
    ).toBe('John Smith');
  });

  it('should return the workspace member name for an actor field', () => {
    const { result } = renderHook(() => useGetFieldDisplayLabelText(), {
      wrapper,
    });

    expect(
      result.current.getFieldDisplayLabelText({
        fieldDefinition: actorFieldDefinition,
        fieldValue: {
          source: 'MANUAL',
          workspaceMemberId: 'workspace-member-id',
          name: 'Stale Name',
          context: null,
        },
      }),
    ).toBe('Jane Doe');
  });

  it('should fall back to the actor name when no workspace member matches', () => {
    const { result } = renderHook(() => useGetFieldDisplayLabelText(), {
      wrapper,
    });

    expect(
      result.current.getFieldDisplayLabelText({
        fieldDefinition: actorFieldDefinition,
        fieldValue: {
          source: 'API',
          workspaceMemberId: null,
          name: 'Zapier',
          context: null,
        },
      }),
    ).toBe('Zapier');
  });
});
