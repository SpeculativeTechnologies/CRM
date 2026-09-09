import { type LocalFirstChange } from 'twenty-shared/types';

import { parseLocalFirstChangeResult } from '@/local-first/utils/parseLocalFirstChangeResult';

const OPERATION: LocalFirstChange = {
  operationId: 'operation',
  objectId: 'object',
  recordId: 'record',
  changes: [{ fieldId: 'title', before: 'Old', after: 'New' }],
};

it('should accept only receipts for the operation that was sent', () => {
  expect(
    parseLocalFirstChangeResult(
      { status: 'applied', operationId: 'operation' },
      OPERATION,
    ),
  ).toEqual({ status: 'applied', operationId: 'operation' });
  expect(() =>
    parseLocalFirstChangeResult(
      { status: 'applied', operationId: 'other' },
      OPERATION,
    ),
  ).toThrow();
});

it.each([
  {},
  { title: undefined },
  { title: { value: 'Server' } },
  { title: NaN },
  { title: 'Server', unrelated: 'Value' },
])(
  'should keep intent pending when a conflict receipt is incomplete or malformed: %p',
  (current) => {
    expect(() =>
      parseLocalFirstChangeResult(
        { status: 'conflict', operationId: 'operation', current },
        OPERATION,
      ),
    ).toThrow();
  },
);

it('should preserve a complete conflict including an empty server value', () => {
  expect(
    parseLocalFirstChangeResult(
      {
        status: 'conflict',
        operationId: 'operation',
        current: { title: null },
      },
      OPERATION,
    ),
  ).toEqual({
    status: 'conflict',
    operationId: 'operation',
    current: { title: null },
  });
});
