import { isNonEmptyString } from '@sniptt/guards';

export const getPreferredFirstName = (
  firstName: string | null | undefined,
  preferredName: unknown,
): string =>
  isNonEmptyString(preferredName) && preferredName.trim().length > 0
    ? preferredName.trim()
    : (firstName ?? '');
