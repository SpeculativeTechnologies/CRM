import { BadRequestException } from '@nestjs/common';

import { isUUID } from 'class-validator';
import {
  type LocalFirstChange,
  type LocalFirstValue,
} from 'twenty-shared/types';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isValue = (value: unknown): value is LocalFirstValue =>
  value === null ||
  typeof value === 'boolean' ||
  (typeof value === 'number' && Number.isFinite(value)) ||
  (typeof value === 'string' && value.length <= 100_000);

const isId = (value: unknown): value is string =>
  typeof value === 'string' && isUUID(value);

export const parseLocalFirstChange = (input: unknown): LocalFirstChange => {
  if (
    !isRecord(input) ||
    !isId(input.operationId) ||
    !isId(input.objectId) ||
    !isId(input.recordId) ||
    !Array.isArray(input.changes) ||
    input.changes.length === 0 ||
    input.changes.length > 50
  ) {
    throw new BadRequestException('Invalid local change');
  }

  const fieldIds = new Set<string>();
  const changes = input.changes.map((change: unknown) => {
    if (
      !isRecord(change) ||
      !isId(change.fieldId) ||
      fieldIds.has(change.fieldId) ||
      !isValue(change.before) ||
      !isValue(change.after)
    ) {
      throw new BadRequestException('Invalid local field change');
    }
    fieldIds.add(change.fieldId);

    return {
      fieldId: change.fieldId,
      before: change.before,
      after: change.after,
    };
  });

  // Stable ordering makes a retried JSON request independent of key order.
  changes.sort((first, second) => first.fieldId.localeCompare(second.fieldId));

  return {
    operationId: input.operationId,
    objectId: input.objectId,
    recordId: input.recordId,
    changes,
  };
};
