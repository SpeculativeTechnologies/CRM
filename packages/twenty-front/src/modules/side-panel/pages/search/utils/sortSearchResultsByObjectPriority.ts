import { CoreObjectNameSingular } from 'twenty-shared/types';

const PRIORITIZED_OBJECT_NAME_SINGULARS: string[] = [
  CoreObjectNameSingular.Person,
  CoreObjectNameSingular.Company,
];

// People and companies are what the team searches for most, so they rank
// above other object types; backend relevance order is preserved within
// each tier because Array.prototype.sort is stable.
export const sortSearchResultsByObjectPriority = <
  TSearchResult extends { objectNameSingular: string },
>(
  searchResults: TSearchResult[],
): TSearchResult[] =>
  [...searchResults].sort(
    (firstResult, secondResult) =>
      Number(
        !PRIORITIZED_OBJECT_NAME_SINGULARS.includes(
          firstResult.objectNameSingular,
        ),
      ) -
      Number(
        !PRIORITIZED_OBJECT_NAME_SINGULARS.includes(
          secondResult.objectNameSingular,
        ),
      ),
  );
