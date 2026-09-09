import {
  type LocalFirstChange,
  type LocalFirstValue,
} from 'twenty-shared/types';

export type LocalFirstJournalEntry = {
  sequence: number;
  operation: LocalFirstChange;
  objectName: string;
  fieldNames: Record<string, string>;
  state:
    | 'pending'
    | 'sending'
    | 'applied'
    | 'conflict'
    | 'rejected'
    | 'superseded';
  current: Record<string, LocalFirstValue> | null;
  error: string | null;
  createdAt: string;
};
