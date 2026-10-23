import {
  parseEmailDocument,
  parseJson,
  transformEmailDocumentStrings,
} from 'twenty-shared/utils';

export const EMAIL_PLACEHOLDER_KEYS = [
  'first_name',
  'last_name',
  'full_name',
  'email',
  'job_title',
  'city',
  'company',
] as const;

export type EmailPlaceholderKey = (typeof EMAIL_PLACEHOLDER_KEYS)[number];

export type EmailPlaceholderValues = Record<EmailPlaceholderKey, string>;

const EMAIL_PLACEHOLDER_PATTERN = /\{\s*([a-z][a-z0-9_]*)\s*\}/g;

const isKnownPlaceholderKey = (key: string): key is EmailPlaceholderKey =>
  (EMAIL_PLACEHOLDER_KEYS as readonly string[]).includes(key);

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

type ResolveEmailPlaceholdersResult = {
  resolved: string;
  missingPlaceholderKeys: EmailPlaceholderKey[];
};

export const resolveEmailPlaceholders = (
  template: string,
  values: EmailPlaceholderValues,
  { escapeValues }: { escapeValues: boolean },
): ResolveEmailPlaceholdersResult => {
  const missingPlaceholderKeys = new Set<EmailPlaceholderKey>();

  const resolveString = (valueToResolve: string, shouldEscape: boolean) =>
    valueToResolve.replace(EMAIL_PLACEHOLDER_PATTERN, (match, key: string) => {
      if (!isKnownPlaceholderKey(key)) {
        return match;
      }

      const value = values[key].trim();

      if (value === '') {
        missingPlaceholderKeys.add(key);

        return '';
      }

      return shouldEscape ? escapeHtml(value) : value;
    });

  const parsed = parseEmailDocument(parseJson<unknown>(template));
  const resolved = parsed.success
    ? JSON.stringify(
        transformEmailDocumentStrings(parsed.document, (value, context) =>
          resolveString(value, context === 'html'),
        ),
      )
    : resolveString(template, escapeValues);

  return { resolved, missingPlaceholderKeys: [...missingPlaceholderKeys] };
};

export type PersonRecordForPlaceholders = {
  name?: { firstName?: string | null; lastName?: string | null } | null;
  emails?: { primaryEmail?: string | null } | null;
  jobTitle?: string | null;
  city?: string | null;
  company?: { name?: string | null } | null;
};

export const buildPersonPlaceholderValues = (
  person: PersonRecordForPlaceholders,
): EmailPlaceholderValues => {
  const firstName = person.name?.firstName?.trim() ?? '';
  const lastName = person.name?.lastName?.trim() ?? '';

  return {
    first_name: firstName,
    last_name: lastName,
    full_name: [firstName, lastName].filter(Boolean).join(' '),
    email: person.emails?.primaryEmail?.trim() ?? '',
    job_title: person.jobTitle?.trim() ?? '',
    city: person.city?.trim() ?? '',
    company: person.company?.name?.trim() ?? '',
  };
};
