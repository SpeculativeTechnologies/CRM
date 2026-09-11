import { renderHook } from '@testing-library/react';
import { useApolloCoreClient } from '@/object-metadata/hooks/useApolloCoreClient';
import { useObjectMetadataItems } from '@/object-metadata/hooks/useObjectMetadataItems';
import { type EnrichedObjectMetadataItem } from '@/object-metadata/types/EnrichedObjectMetadataItem';
import { type FieldMetadataItem } from '@/object-metadata/types/FieldMetadataItem';
import { useExportLinkedRelationValues } from '@/object-record/record-index/export/hooks/useExportLinkedRelationValues';
import { type ObjectRecord } from '@/object-record/types/ObjectRecord';
import { getMockFieldMetadataItemOrThrow } from '~/testing/utils/getMockFieldMetadataItemOrThrow';
import { getMockObjectMetadataItemOrThrow } from '~/testing/utils/getMockObjectMetadataItemOrThrow';
import { getTestEnrichedObjectMetadataItemsMock } from '~/testing/utils/getTestEnrichedObjectMetadataItemsMock';

jest.mock('@/object-metadata/hooks/useApolloCoreClient', () => ({
  useApolloCoreClient: jest.fn(),
}));
jest.mock('@/object-metadata/hooks/useObjectMetadataItems', () => ({
  useObjectMetadataItems: jest.fn(),
}));
jest.mock('@/object-record/hooks/useObjectPermissions', () => ({
  useObjectPermissions: () => ({ objectPermissionsByObjectMetadataId: {} }),
}));

const connection = (
  records: ObjectRecord[],
  endCursor: string | null = null,
) => ({
  edges: records.map((node) => ({ node })),
  pageInfo: { hasNextPage: endCursor !== null, endCursor },
});

describe('linked relation CSV values', () => {
  const company = getMockObjectMetadataItemOrThrow('company');
  const opportunity = getMockObjectMetadataItemOrThrow('opportunity');
  const source = getMockFieldMetadataItemOrThrow({
    objectMetadataItem: company,
    fieldName: 'people',
  });
  const path = getMockFieldMetadataItemOrThrow({
    objectMetadataItem: opportunity,
    fieldName: 'company',
  });
  const linked: FieldMetadataItem = {
    ...source,
    id: 'linked-people',
    universalIdentifier: 'linked-people',
    name: 'linkedPeople',
    settings: {
      ...source.settings,
      linkedField: {
        relationFieldMetadataUniversalIdentifier: path.universalIdentifier,
        sourceFieldMetadataUniversalIdentifier: source.universalIdentifier,
      },
    },
  };
  const destination: EnrichedObjectMetadataItem = {
    ...opportunity,
    fields: [...opportunity.fields, linked],
    readableFields: [...opportunity.readableFields, linked],
  };
  const records = [
    { id: 'first', companyId: 'source' },
    { id: 'second', companyId: 'source' },
    { id: 'hidden', companyId: 'hidden-source' },
    { id: 'missing', companyId: null },
  ].map((record) => ({ ...record, __typename: 'Opportunity' }));
  const query = jest.fn();
  const items = getTestEnrichedObjectMetadataItemsMock().map((item) =>
    item.id === destination.id ? destination : item,
  );
  beforeEach(() => {
    jest.clearAllMocks();
    jest
      .mocked(useApolloCoreClient)
      .mockReturnValue({ query } as unknown as ReturnType<
        typeof useApolloCoreClient
      >);
    jest
      .mocked(useObjectMetadataItems)
      .mockReturnValue({ objectMetadataItems: items } as ReturnType<
        typeof useObjectMetadataItems
      >);
  });

  it('exports every page beyond the preview and leaves hidden sources empty', async () => {
    const people = Array.from({ length: 63 }, (_, index) => ({
      id: `person-${index}`,
      __typename: 'Person',
      name: { firstName: 'Synthetic', lastName: `${index}` },
      company: { id: 'source' },
    }));
    query.mockResolvedValueOnce({
      data: {
        companies: connection([
          {
            id: 'source',
            __typename: 'Company',
            people: connection(people.slice(0, 1)),
          },
        ]),
      },
    });
    query.mockResolvedValueOnce({
      data: { people: connection(people.slice(0, 61), 'next-page') },
    });
    query.mockResolvedValueOnce({
      data: { people: connection(people.slice(61)) },
    });
    const { result } = renderHook(useExportLinkedRelationValues);
    const exported = await result.current.completeLinkedRelations(
      records,
      destination,
    );
    expect(exported[0].linkedPeople).toBe(
      people.map((person) => `Synthetic ${person.name.lastName}`).join('; '),
    );
    expect(exported[1].linkedPeople).toBe(exported[0].linkedPeople);
    expect(exported[2].linkedPeople).toBe('');
    expect(exported[3].linkedPeople).toBe('');
    expect(query.mock.calls[2][0].variables.lastCursor).toBe('next-page');
    expect(records[0]).not.toHaveProperty('linkedPeople');
  });

  it('leaves ordinary exported values untouched and does not fetch hidden columns', async () => {
    const rawJson = { edges: [{ node: { id: 'json-data' } }], arbitrary: true };
    const { result } = renderHook(useExportLinkedRelationValues);
    const exported = await result.current.completeLinkedRelations(
      [{ ...records[0], rawJson }],
      destination,
      ['rawJson'],
    );
    expect(exported[0].rawJson).toBe(rawJson);
    expect(query).not.toHaveBeenCalled();
  });

  it('exports a to-one source label without querying a list or changing its ID', async () => {
    const person = getMockObjectMetadataItemOrThrow('person');
    const companyField = getMockFieldMetadataItemOrThrow({
      objectMetadataItem: person,
      fieldName: 'company',
    });
    const personPath = getMockFieldMetadataItemOrThrow({
      objectMetadataItem: opportunity,
      fieldName: 'pointOfContact',
    });
    const linkedCompany = {
      ...companyField,
      id: 'linked-company',
      universalIdentifier: 'linked-company',
      name: 'linkedCompany',
      settings: {
        ...companyField.settings,
        linkedField: {
          relationFieldMetadataUniversalIdentifier:
            personPath.universalIdentifier,
          sourceFieldMetadataUniversalIdentifier:
            companyField.universalIdentifier,
        },
      },
    };
    const companyDestination = {
      ...opportunity,
      fields: [...opportunity.fields, linkedCompany],
      readableFields: [...opportunity.readableFields, linkedCompany],
    };
    query.mockResolvedValueOnce({
      data: {
        people: connection([
          {
            id: 'person',
            __typename: 'Person',
            company: { id: 'company', name: 'Synthetic Company' },
          },
        ]),
      },
    });
    const { result } = renderHook(useExportLinkedRelationValues);
    const exported = await result.current.completeLinkedRelations(
      [{ id: 'root', __typename: 'Opportunity', pointOfContactId: 'person' }],
      companyDestination,
    );
    expect(exported).toMatchObject([
      { linkedCompany: 'Synthetic Company', pointOfContactId: 'person' },
    ]);
    expect(query).toHaveBeenCalledTimes(1);
  });

  it('does not export cached values after source-field access is removed', async () => {
    jest.mocked(useObjectMetadataItems).mockReturnValue({
      objectMetadataItems: items.map((item) =>
        item.id === company.id
          ? {
              ...company,
              readableFields: company.readableFields.filter(
                (field) => field.id !== source.id,
              ),
            }
          : item,
      ),
    } as ReturnType<typeof useObjectMetadataItems>);
    const { result } = renderHook(useExportLinkedRelationValues);
    expect(
      await result.current.completeLinkedRelations(
        [{ ...records[0], linkedPeople: 'previously visible' }],
        destination,
      ),
    ).toMatchObject([{ linkedPeople: '' }]);
    expect(query).not.toHaveBeenCalled();
  });

  it('fails an incomplete export if the server cannot advance its cursor', async () => {
    query.mockResolvedValueOnce({
      data: {
        companies: connection([{ id: 'source', __typename: 'Company' }]),
      },
    });
    query.mockResolvedValue({
      data: { people: connection([], 'stuck-cursor') },
    });
    const { result } = renderHook(useExportLinkedRelationValues);
    await expect(
      result.current.completeLinkedRelations(records, destination),
    ).rejects.toThrow('could not continue pagination');
  });
});
