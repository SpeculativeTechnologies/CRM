import { atom } from 'jotai';

export type LocalFirstSyncStatus = 'idle' | 'syncing' | 'upToDate' | 'offline';

export const localFirstSyncStatusState = atom<LocalFirstSyncStatus>('idle');
