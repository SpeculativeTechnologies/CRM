import { CoreObjectNameSingular } from 'twenty-shared/types';

// People and companies are what the team searches for most, so the / search
// starts with only them checked; an empty selection means all objects.
export const DEFAULT_SIDE_PANEL_SEARCH_OBJECT_FILTER: string[] = [
  CoreObjectNameSingular.Person,
  CoreObjectNameSingular.Company,
];
