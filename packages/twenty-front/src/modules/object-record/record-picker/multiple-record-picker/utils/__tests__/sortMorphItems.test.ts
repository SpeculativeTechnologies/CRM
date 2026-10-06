import { type RecordPickerPickableMorphItem } from '@/object-record/record-picker/types/RecordPickerPickableMorphItem';
import { type SearchRecord } from '~/generated/graphql';
import { sortMorphItems } from '@/object-record/record-picker/multiple-record-picker/utils/sortMorphItems';

const createMorphItem = (
  recordId: string,
  isSelected: boolean,
): RecordPickerPickableMorphItem => ({
  recordId,
  objectMetadataId: 'object-1',
  isSelected,
  isMatchingSearchFilter: true,
});

const createSearchRecord = (
  recordId: string,
  ranks: { tsRank?: number; tsRankCD?: number; label?: string } = {},
): SearchRecord => ({
  recordId,
  label: ranks.label ?? `Record ${recordId}`,
  objectNameSingular: 'person',
  objectLabelSingular: 'Person',
  tsRank: ranks.tsRank ?? 0,
  tsRankCD: ranks.tsRankCD ?? 0,
});

describe('sortMorphItems', () => {
  it('should keep selected items in their natural position instead of moving them to the top', () => {
    const morphItems: RecordPickerPickableMorphItem[] = [
      createMorphItem('1', false),
      createMorphItem('2', true),
      createMorphItem('3', false),
    ];
    const searchRecords: SearchRecord[] = [
      createSearchRecord('1'),
      createSearchRecord('2'),
      createSearchRecord('3'),
    ];

    const result = sortMorphItems(morphItems, searchRecords);

    expect(result.map((item) => item.recordId)).toEqual(['1', '2', '3']);
    expect(result[1].isSelected).toBe(true);
  });

  it('should interleave picked and unpicked records alphabetically when the search has no ranks', () => {
    const morphItems: RecordPickerPickableMorphItem[] = [
      createMorphItem('b', true),
      createMorphItem('d', true),
      createMorphItem('a', false),
      createMorphItem('c', false),
    ];
    const pickedSearchRecords = [
      createSearchRecord('b'),
      createSearchRecord('d'),
    ];
    const unpickedSearchRecords = [
      createSearchRecord('a'),
      createSearchRecord('c'),
    ];

    const result = sortMorphItems(morphItems, [
      ...pickedSearchRecords,
      ...unpickedSearchRecords,
    ]);

    expect(result.map((item) => item.recordId)).toEqual(['a', 'b', 'c', 'd']);
  });

  it('should order by relevance before id, with higher ranks first', () => {
    const morphItems: RecordPickerPickableMorphItem[] = [
      createMorphItem('a', true),
      createMorphItem('b', false),
      createMorphItem('c', false),
      createMorphItem('d', true),
    ];
    const searchRecords: SearchRecord[] = [
      createSearchRecord('a', { tsRankCD: 0.1 }),
      createSearchRecord('d', { tsRankCD: 0.5 }),
      createSearchRecord('b', { tsRankCD: 0.5, tsRank: 0.2 }),
      createSearchRecord('c', { tsRankCD: 0.5, tsRank: 0.1 }),
    ];

    const result = sortMorphItems(morphItems, searchRecords);

    expect(result.map((item) => item.recordId)).toEqual(['b', 'c', 'd', 'a']);
  });

  it('should order equally ranked records by label before id, ignoring case', () => {
    const morphItems: RecordPickerPickableMorphItem[] = [
      createMorphItem('1', true),
      createMorphItem('2', false),
      createMorphItem('3', false),
    ];
    const searchRecords: SearchRecord[] = [
      createSearchRecord('1', { label: 'zoe' }),
      createSearchRecord('2', { label: 'Alice' }),
      createSearchRecord('3', { label: 'bob' }),
    ];

    const result = sortMorphItems(morphItems, searchRecords);

    expect(result.map((item) => item.recordId)).toEqual(['2', '3', '1']);
  });

  it('should place records without a label after labelled ones', () => {
    const morphItems: RecordPickerPickableMorphItem[] = [
      createMorphItem('1', true),
      createMorphItem('2', false),
      createMorphItem('3', true),
    ];
    const searchRecords: SearchRecord[] = [
      createSearchRecord('1', { label: '' }),
      createSearchRecord('2', { label: 'Zed' }),
      createSearchRecord('3', { label: '' }),
    ];

    const result = sortMorphItems(morphItems, searchRecords);

    expect(result.map((item) => item.recordId)).toEqual(['2', '1', '3']);
  });

  it('should handle empty morphItems array', () => {
    const morphItems: RecordPickerPickableMorphItem[] = [];
    const searchRecords: SearchRecord[] = [createSearchRecord('1')];

    const result = sortMorphItems(morphItems, searchRecords);

    expect(result).toEqual([]);
  });

  it('should preserve the existing order when there are no search records', () => {
    const morphItems: RecordPickerPickableMorphItem[] = [
      createMorphItem('1', false),
      createMorphItem('2', true),
    ];
    const searchRecords: SearchRecord[] = [];

    const result = sortMorphItems(morphItems, searchRecords);

    expect(result.map((item) => item.recordId)).toEqual(['1', '2']);
  });

  it('should place items not present in searchRecords before indexed items', () => {
    const morphItems: RecordPickerPickableMorphItem[] = [
      createMorphItem('1', false),
      createMorphItem('unknown', false),
    ];
    const searchRecords: SearchRecord[] = [createSearchRecord('1')];

    const result = sortMorphItems(morphItems, searchRecords);

    expect(result.map((item) => item.recordId)).toEqual(['unknown', '1']);
  });
});
