import {
  type LocalFirstChange,
  type LocalFirstChangeResult,
  type LocalFirstValue,
} from 'twenty-shared/types';

export const parseLocalFirstChangeResult = (
  input: unknown,
  operation: LocalFirstChange,
): LocalFirstChangeResult => {
  if (!input || typeof input !== 'object')
    throw new Error('Invalid local edit receipt');
  const result = input as Record<string, unknown>;
  if (result.operationId !== operation.operationId)
    throw new Error('The server returned a receipt for another operation');
  if (result.status === 'applied')
    return { status: 'applied', operationId: operation.operationId };
  if (
    result.status !== 'conflict' ||
    !result.current ||
    typeof result.current !== 'object' ||
    Array.isArray(result.current)
  )
    throw new Error('Invalid local edit receipt');
  const current = result.current as Record<string, unknown>;
  if (
    Object.keys(current).length !== operation.changes.length ||
    operation.changes.some(({ fieldId }) => {
      const value = current[fieldId];
      return !(
        value === null ||
        typeof value === 'string' ||
        typeof value === 'boolean' ||
        (typeof value === 'number' && Number.isFinite(value))
      );
    })
  )
    throw new Error('Incomplete conflict receipt');
  return {
    status: 'conflict',
    operationId: operation.operationId,
    current: current as Record<string, LocalFirstValue>,
  };
};
