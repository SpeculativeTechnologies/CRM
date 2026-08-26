import { coerceValueForLocalColumn } from '@/local-first/utils/coerceValueForLocalColumn';

describe('coerceValueForLocalColumn', () => {
  // Electric sends Postgres text format, and PGlite rejects those strings
  // outright, which silently synced nothing for tables carrying these types.
  it('should coerce boolean text into booleans', () => {
    expect(coerceValueForLocalColumn('false', 'boolean')).toBe(false);
    expect(coerceValueForLocalColumn('true', 'boolean')).toBe(true);
    expect(coerceValueForLocalColumn('f', 'boolean')).toBe(false);
    expect(coerceValueForLocalColumn('t', 'boolean')).toBe(true);
    expect(coerceValueForLocalColumn(true, 'boolean')).toBe(true);
  });

  it('should coerce numeric text into numbers', () => {
    expect(coerceValueForLocalColumn('1234.5', 'numeric')).toBe(1234.5);
    expect(coerceValueForLocalColumn('42', 'integer')).toBe(42);
    expect(coerceValueForLocalColumn(7, 'double precision')).toBe(7);
  });

  it('should pass through text, json and unknown types untouched', () => {
    expect(coerceValueForLocalColumn('hello', 'text')).toBe('hello');
    expect(coerceValueForLocalColumn('2026-01-01', 'date')).toBe('2026-01-01');

    const json = { a: 1 };

    expect(coerceValueForLocalColumn(json, 'jsonb')).toBe(json);
  });

  it('should map null and unparseable values to null', () => {
    expect(coerceValueForLocalColumn(null, 'boolean')).toBeNull();
    expect(coerceValueForLocalColumn('maybe', 'boolean')).toBeNull();
    expect(coerceValueForLocalColumn('abc', 'numeric')).toBeNull();
  });
});
