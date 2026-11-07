import { renderHook } from '@testing-library/react';

import { useMassEmailRecipients } from '@/activities/emails/mass-email/hooks/useMassEmailRecipients';
import { useFindManyRecords } from '@/object-record/hooks/useFindManyRecords';

let mockFields: { name: string; type: string; isActive: boolean }[] = [];
jest.mock('@/object-metadata/hooks/useObjectMetadataItem', () => ({
  useObjectMetadataItem: () => ({
    objectMetadataItem: { nameSingular: 'person', fields: mockFields },
  }),
}));
jest.mock('@/object-record/hooks/useFindManyRecords', () => ({
  useFindManyRecords: jest.fn(),
}));

const mockedFindMany = jest.mocked(useFindManyRecords);

describe('useMassEmailRecipients preferred names', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFields = [];
    mockedFindMany.mockReturnValue({
      records: [
        {
          __typename: 'Person',
          id: 'person-1',
          name: { firstName: 'Timothy', lastName: 'McGee' },
          preferredName: ' Tim ',
          emails: { primaryEmail: 'tim@example.com' },
        },
      ],
      loading: false,
    } as unknown as ReturnType<typeof useFindManyRecords>);
  });

  it('should fetch preferred names and build personalized values for mass email', () => {
    mockFields = [{ name: 'preferredName', type: 'TEXT', isActive: true }];
    const { result } = renderHook(() => useMassEmailRecipients(['person-1']));

    expect(mockedFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        recordGqlFields: expect.objectContaining({ preferredName: true }),
      }),
    );
    expect(result.current.recipients[0].placeholderValues.first_name).toBe(
      'Tim',
    );
    expect(result.current.recipients[0].placeholderValues.full_name).toBe(
      'Timothy McGee',
    );
  });

  it.each([
    { fields: [] },
    { fields: [{ name: 'preferredName', type: 'TEXT', isActive: false }] },
    { fields: [{ name: 'preferredName', type: 'NUMBER', isActive: true }] },
  ])('should omit unsupported preferred-name fields $fields', ({ fields }) => {
    mockFields = fields;
    renderHook(() => useMassEmailRecipients(['person-1']));

    expect(
      mockedFindMany.mock.calls.at(-1)?.[0].recordGqlFields,
    ).not.toHaveProperty('preferredName');
  });
});
