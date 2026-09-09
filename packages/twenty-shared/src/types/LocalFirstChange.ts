export type LocalFirstValue = string | number | boolean | null;

export type LocalFirstFieldChange = {
  fieldId: string;
  before: LocalFirstValue;
  after: LocalFirstValue;
};

export type LocalFirstChange = {
  operationId: string;
  objectId: string;
  recordId: string;
  changes: LocalFirstFieldChange[];
};

export type LocalFirstChangeResult =
  | { status: 'applied'; operationId: string }
  | {
      status: 'conflict';
      operationId: string;
      current: Record<string, LocalFirstValue>;
    };
