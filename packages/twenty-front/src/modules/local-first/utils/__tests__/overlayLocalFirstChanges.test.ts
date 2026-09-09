import { type LocalFirstJournalEntry } from '@/local-first/types/LocalFirstJournalEntry';
import { overlayLocalFirstChanges } from '@/local-first/utils/overlayLocalFirstChanges';

const entry: LocalFirstJournalEntry = {
  sequence: 1,
  operation: {
    objectId: 'object',
    operationId: 'operation',
    recordId: 'record',
    changes: [{ fieldId: 'field', before: 'Old', after: 'Local' }],
  },
  objectName: 'person',
  fieldNames: { field: 'jobTitle' },
  state: 'pending',
  current: null,
  error: null,
  createdAt: '2026-09-09',
};
const record = {
  __typename: 'Person',
  id: 'record',
  jobTitle: 'Server',
  city: 'Boston',
};

it('should preserve pending edits in nested records without replacing independent server fields', () => {
  expect(
    overlayLocalFirstChanges({ people: { edges: [{ node: record }] } }, [
      entry,
    ]),
  ).toEqual({
    people: { edges: [{ node: { ...record, jobTitle: 'Local' } }] },
  });
  expect(record.jobTitle).toBe('Server');
});

it('should respect record and object identity and the selected fields', () => {
  const otherObject = { ...record, __typename: 'Company' };
  const otherRecord = { ...record, id: 'another' };
  const partial = { __typename: 'Person', id: 'record' };
  expect(
    overlayLocalFirstChanges([otherObject, otherRecord, partial], [entry]),
  ).toEqual([otherObject, otherRecord, partial]);
});

it('should retain conflicted values until resolved and let acknowledged edits use fresh server values', () => {
  expect(
    overlayLocalFirstChanges(record, [{ ...entry, state: 'conflict' }]),
  ).toEqual({ ...record, jobTitle: 'Local' });
  expect(
    overlayLocalFirstChanges(record, [{ ...entry, state: 'applied' }]),
  ).toEqual(record);
  expect(
    overlayLocalFirstChanges(record, [{ ...entry, state: 'superseded' }]),
  ).toEqual(record);
});
