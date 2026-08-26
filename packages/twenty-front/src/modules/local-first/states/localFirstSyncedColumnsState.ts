import { atom } from 'jotai';

// Column names the server reported as syncable for the person table, resolved
// at sync start. Empty until then, which makes every local read refuse.
export const localFirstSyncedColumnsState = atom<string[]>([]);
