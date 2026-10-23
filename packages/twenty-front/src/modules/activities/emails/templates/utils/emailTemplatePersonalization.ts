import {
  type EmailDocumentNode,
  parseEmailDocument,
  parseJson,
  transformEmailDocumentStrings,
  TIPTAP_DOCUMENT_SCHEMA_VERSION,
} from 'twenty-shared/utils';

import { type EmailTemplateContent } from '@/activities/emails/templates/types/EmailTemplate';
import { type PersonRecordForPlaceholders } from '@/activities/emails/mass-email/utils/emailPlaceholders';

export const EMAIL_TEMPLATE_FIELDS = [
  'firstName',
  'lastName',
  'fullName',
  'email',
  'jobTitle',
  'city',
] as const;
export type EmailTemplateField = (typeof EMAIL_TEMPLATE_FIELDS)[number];
export type EmailTemplateValues = Record<EmailTemplateField, string>;

const VARIABLE_PATTERN = /\{\{\s*([a-zA-Z][a-zA-Z0-9_.]*)\s*\}\}/g;
const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

export const buildEmailTemplateValues = (
  person: PersonRecordForPlaceholders,
): EmailTemplateValues => {
  const firstName = person.name?.firstName ?? '';
  const lastName = person.name?.lastName ?? '';

  return {
    firstName,
    lastName,
    fullName: [firstName, lastName].filter(Boolean).join(' '),
    email: person.emails?.primaryEmail ?? '',
    jobTitle: person.jobTitle ?? '',
    city: person.city ?? '',
  };
};

// Work on document nodes, never on serialized JSON: a recipient's quote,
// newline or backslash must stay text rather than corrupt the email document.
export const resolveEmailTemplate = (
  content: EmailTemplateContent,
  values: EmailTemplateValues,
) => {
  const usedFields = new Set<string>();
  const missingFields = new Set<string>();
  const resolve = (value: string, shouldEscape = false): string =>
    value.replace(VARIABLE_PATTERN, (_match, field: string) => {
      usedFields.add(field);
      const resolved = values[field as EmailTemplateField] ?? '';

      if (!resolved.trim()) missingFields.add(field);

      return shouldEscape ? escapeHtml(resolved) : resolved;
    });
  const parsed = parseEmailDocument(parseJson<unknown>(content.body));

  if (!parsed.success) throw new Error('Invalid email template body');

  const resolveNode = (node: EmailDocumentNode): EmailDocumentNode[] => {
    if (
      node.type === 'variableTag' &&
      typeof node.attrs?.variable === 'string'
    ) {
      const text = resolve(node.attrs.variable);

      return text
        ? [{ type: 'text', text, ...(node.marks && { marks: node.marks }) }]
        : [];
    }

    const { content: children, ...rest } = node;
    const resolved = transformEmailDocumentStrings(rest, (value, context) =>
      resolve(value, context === 'html'),
    );

    return [
      {
        ...resolved,
        ...(children && { content: children.flatMap(resolveNode) }),
      },
    ];
  };

  const subject = resolve(content.subject).replace(/[\r\n]/g, ' ');
  const [document] = resolveNode(parsed.document);

  return {
    subject,
    body: JSON.stringify({
      ...document,
      attrs: {
        ...document.attrs,
        schemaVersion: TIPTAP_DOCUMENT_SCHEMA_VERSION,
      },
    }),
    usedFields: [...usedFields],
    missingFields: [...missingFields],
  };
};

const LEGACY_NAMES: Record<EmailTemplateField, string> = {
  firstName: 'first_name',
  lastName: 'last_name',
  fullName: 'full_name',
  email: 'email',
  jobTitle: 'job_title',
  city: 'city',
};

// The existing mailbox mass composer uses single-brace placeholders. Convert
// at insertion so its per-recipient previews and overrides keep their behavior.
export const toMassEmailTemplate = (
  content: EmailTemplateContent,
): EmailTemplateContent => {
  const values = Object.fromEntries(
    EMAIL_TEMPLATE_FIELDS.map((field) => [field, `{${LEGACY_NAMES[field]}}`]),
  ) as EmailTemplateValues;

  return resolveEmailTemplate(content, values);
};
