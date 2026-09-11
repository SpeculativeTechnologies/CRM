import { sanitizeRecordInput } from '@/object-record/utils/sanitizeRecordInput';
import { type EnrichedObjectMetadataItem } from '@/object-metadata/types/EnrichedObjectMetadataItem';
import { FieldMetadataType } from '~/generated-metadata/graphql';

describe('sanitizeRecordInput with linked fields', () => {
  it('copies writable data while excluding computed values from the create payload', () => {
    const objectMetadataItem = {
      fields: [
        { name: 'name', type: FieldMetadataType.TEXT },
        { name: 'person', type: FieldMetadataType.RELATION },
        {
          name: 'linkedTitle',
          type: FieldMetadataType.TEXT,
          settings: {
            linkedField: {
              relationFieldMetadataUniversalIdentifier: 'person-relation',
              sourceFieldMetadataUniversalIdentifier: 'job-title',
            },
          },
        },
      ],
    } as EnrichedObjectMetadataItem;
    expect(
      sanitizeRecordInput({
        objectMetadataItem,
        recordInput: {
          name: 'Copy',
          personId: 'person-id',
          linkedTitle: 'Previous title',
        },
      }),
    ).toEqual({ name: 'Copy', personId: 'person-id' });
  });
});
