import { parseLocalFirstChange } from 'src/engine/core-modules/local-first/utils/parse-local-first-change.util';

const OPERATION = {
  operationId: '00000000-0000-4000-8000-000000000001',
  objectId: '00000000-0000-4000-8000-000000000002',
  recordId: '00000000-0000-4000-8000-000000000003',
  changes: [
    {
      fieldId: '00000000-0000-4000-8000-000000000004',
      before: null,
      after: 'Example',
    },
  ],
};

describe('parseLocalFirstChange', () => {
  it('should produce the same receipt input regardless of JSON field order', () => {
    const later = {
      fieldId: '00000000-0000-4000-8000-000000000005',
      after: 3,
      before: 2,
    };
    expect(
      parseLocalFirstChange({
        ...OPERATION,
        changes: [later, ...OPERATION.changes],
      }),
    ).toEqual(
      parseLocalFirstChange({
        ...OPERATION,
        changes: [...OPERATION.changes, later],
      }),
    );
  });

  it.each([
    undefined,
    null,
    {},
    { ...OPERATION, operationId: 'not-an-id' },
    { ...OPERATION, changes: [] },
    {
      ...OPERATION,
      changes: Array.from({ length: 51 }, () => OPERATION.changes[0]),
    },
  ])('should reject an invalid envelope', (input) => {
    expect(() => parseLocalFirstChange(input)).toThrow('Invalid local change');
  });

  it.each([undefined, {}, [], NaN, Infinity, 'x'.repeat(100001)])(
    'should reject values that cannot be safely replayed',
    (after) => {
      expect(() =>
        parseLocalFirstChange({
          ...OPERATION,
          changes: [{ ...OPERATION.changes[0], after }],
        }),
      ).toThrow('Invalid local field change');
    },
  );

  it('should reject two instructions for the same field', () => {
    expect(() =>
      parseLocalFirstChange({
        ...OPERATION,
        changes: [OPERATION.changes[0], OPERATION.changes[0]],
      }),
    ).toThrow('Invalid local field change');
  });

  it('should exclude unknown properties from the operation contract', () => {
    expect(
      parseLocalFirstChange({
        ...OPERATION,
        execute: 'sendEmail',
        changes: [{ ...OPERATION.changes[0], extra: 'ignored' }],
      }),
    ).toEqual(OPERATION);
  });
});
