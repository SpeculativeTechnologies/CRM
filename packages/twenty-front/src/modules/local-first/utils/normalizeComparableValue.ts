const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}T/;

// The same value arrives differently from the two sources: the API sends JSON
// (ISO date strings, numbers), PGlite returns native values (Date objects,
// floats). Normalising before comparison is what keeps serialisation noise
// from being reported as divergent data.
export const normalizeComparableValue = (value: unknown): string => {
  if (value === null || value === undefined) return '';

  if (value instanceof Date) return String(value.getTime());

  if (typeof value === 'number') {
    // Floats (position) differ in the last bits between the two paths.
    return Number.isInteger(value) ? String(value) : value.toFixed(6);
  }

  if (typeof value === 'boolean') return String(value);

  if (typeof value === 'string') {
    if (ISO_DATE_PATTERN.test(value)) {
      const parsed = Date.parse(value);

      if (!Number.isNaN(parsed)) return String(parsed);
    }

    return value;
  }

  // jsonb columns (additionalEmails, secondaryLinks) come back parsed on both
  // sides; key order is stable because both derive from the same stored JSON.
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
};
