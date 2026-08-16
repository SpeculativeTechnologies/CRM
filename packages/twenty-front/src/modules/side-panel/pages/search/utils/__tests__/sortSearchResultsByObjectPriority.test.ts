import { sortSearchResultsByObjectPriority } from '@/side-panel/pages/search/utils/sortSearchResultsByObjectPriority';

describe('sortSearchResultsByObjectPriority', () => {
  it('should rank people and companies above other object types', () => {
    const searchResults = [
      { objectNameSingular: 'note', label: 'A note' },
      { objectNameSingular: 'opportunity', label: 'An opportunity' },
      { objectNameSingular: 'company', label: 'A company' },
      { objectNameSingular: 'task', label: 'A task' },
      { objectNameSingular: 'person', label: 'A person' },
    ];

    const sortedResults = sortSearchResultsByObjectPriority(searchResults);

    expect(sortedResults.map((result) => result.objectNameSingular)).toEqual([
      'company',
      'person',
      'note',
      'opportunity',
      'task',
    ]);
  });

  it('should preserve relevance order within each tier', () => {
    const searchResults = [
      { objectNameSingular: 'person', label: 'First person' },
      { objectNameSingular: 'task', label: 'First task' },
      { objectNameSingular: 'company', label: 'First company' },
      { objectNameSingular: 'person', label: 'Second person' },
      { objectNameSingular: 'task', label: 'Second task' },
    ];

    const sortedResults = sortSearchResultsByObjectPriority(searchResults);

    expect(sortedResults.map((result) => result.label)).toEqual([
      'First person',
      'First company',
      'Second person',
      'First task',
      'Second task',
    ]);
  });

  it('should not mutate the input array', () => {
    const searchResults = [
      { objectNameSingular: 'task', label: 'A task' },
      { objectNameSingular: 'person', label: 'A person' },
    ];

    sortSearchResultsByObjectPriority(searchResults);

    expect(searchResults.map((result) => result.objectNameSingular)).toEqual([
      'task',
      'person',
    ]);
  });
});
