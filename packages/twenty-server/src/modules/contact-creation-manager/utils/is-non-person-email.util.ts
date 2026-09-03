import psl from 'psl';

import { isParsedDomain } from 'src/modules/contact-creation-manager/types/is-psl-parsed-domain.type';

// Shared inboxes and system mailboxes. A person's local part is essentially
// never one of these plain role words, so matching the whole normalized local
// part is safe.
const ROLE_LOCAL_PARTS = new Set([
  'abuse',
  'accounting',
  'accounts',
  'admin',
  'administrator',
  'admins',
  'advancement',
  'alert',
  'alerts',
  'all',
  'alumni',
  'announce',
  'announcements',
  'applications',
  'apply',
  'auto',
  'automated',
  'awards',
  'banking',
  'billing',
  'bizdev',
  'board',
  'booking',
  'bookings',
  'bot',
  'bounce',
  'bounces',
  'calendar',
  'cards',
  'careers',
  'centre',
  'center',
  'comms',
  'communications',
  'community',
  'compliance',
  'concierge',
  'connect',
  'contact',
  'contactus',
  'customerservice',
  'customersuccess',
  'daemon',
  'daily',
  'development',
  'digest',
  'donate',
  'donations',
  'donotreply',
  'editor',
  'editors',
  'email',
  'engagement',
  'enquiries',
  'enquiry',
  'event',
  'events',
  'everyone',
  'expense',
  'expenses',
  'external',
  'faculty',
  'feedback',
  'finance',
  'foundation',
  'frontdesk',
  'general',
  'giving',
  'grants',
  'group',
  'groups',
  'guest',
  'guests',
  'hello',
  'hellothere',
  'help',
  'helpdesk',
  'hi',
  'hiring',
  'hostmaster',
  'hr',
  'info',
  'inquiries',
  'inquiry',
  'institute',
  'internal',
  'interns',
  'invite',
  'invites',
  'invoice',
  'invoices',
  'jobs',
  'join',
  'legal',
  'list',
  'lists',
  'mail',
  'mailer',
  'mailerdaemon',
  'marketing',
  'media',
  'meetings',
  'members',
  'membership',
  'monthly',
  'news',
  'newsletter',
  'newsletters',
  'noreply',
  'notice',
  'notices',
  'notification',
  'notifications',
  'notify',
  'office',
  'onboarding',
  'operations',
  'ops',
  'order',
  'orders',
  'outreach',
  'partners',
  'partnerships',
  'payment',
  'payments',
  'payroll',
  'postmaster',
  'pr',
  'press',
  'privacy',
  'procurement',
  'program',
  'programs',
  'purchasing',
  'receipt',
  'receipts',
  'reception',
  'recruiting',
  'recruitment',
  'register',
  'registration',
  'replies',
  'reply',
  'reservations',
  'return',
  'returns',
  'robot',
  'root',
  'rsvp',
  'sales',
  'schedule',
  'scheduling',
  'security',
  'service',
  'services',
  'shipping',
  'staff',
  'statement',
  'statements',
  'students',
  'submissions',
  'subscribe',
  'subscriptions',
  'suppliers',
  'support',
  'survey',
  'surveys',
  'sysadmin',
  'system',
  'talent',
  'team',
  'tickets',
  'trustees',
  'unsubscribe',
  'update',
  'updates',
  'vendors',
  'visitor',
  'visitors',
  'webmaster',
  'weekly',
  'welcome',
]);

// Matched as substrings of the normalized local part so that variants like
// "drive-shares-dm-noreply" and "MAILER-DAEMON" are caught.
const MACHINE_LOCAL_PART_FRAGMENTS = [
  'noreply',
  'donotreply',
  'dontreply',
  'mailerdaemon',
  'postmaster',
  'unsubscribe',
];

// Subdomain labels that bulk senders and transactional mail hide behind
// (em.stripe.com, reply.github.com, bounces.google.com). Only checked against
// labels below the registrable domain, so an employee at hubspot.com is not
// affected. Trailing digits are allowed (unsubscribe2.customer.io).
const BULK_SUBDOMAIN_LABELS = new Set([
  'alerts',
  'amazonses',
  'beehiiv',
  'bounce',
  'bounces',
  'campaign',
  'ccsend',
  'click',
  'cmail',
  'constantcontact',
  'discourse',
  'em',
  'email',
  'freshdesk',
  'govdelivery',
  'helpscout',
  'hubspot',
  'inbound',
  'info',
  'intercom',
  'link',
  'links',
  'list',
  'lists',
  'mailchimp',
  'mailer',
  'mailgun',
  'mandrill',
  'marketing',
  'mta',
  'news',
  'notifications',
  'notify',
  'out',
  'outbound',
  'relay',
  'reply',
  'send',
  'sendgrid',
  'smtp',
  'sparkpost',
  'track',
  'unsub',
  'unsubscribe',
  'updates',
  'zendesk',
]);

// Email service provider domains that only ever appear as envelope or
// tracking senders, never as a person's own address.
const BULK_SENDER_DOMAINS = new Set([
  'activehosted.com',
  'amazonses.com',
  'convertkit.com',
  'createsend.com',
  'customeriomail.com',
  'discoursemail.com',
  'eloqua.com',
  'exacttarget.com',
  'hsforms.com',
  'intercom-mail.com',
  'mailanyone.net',
  'mailerlite.com',
  'mailgun.org',
  'mailjet.com',
  'mcdlv.net',
  'mcsv.net',
  'mktomail.com',
  'pardot.com',
  'postmarkapp.com',
  'responsys.net',
  'rsgsv.net',
  'sendgrid.net',
  'sendinblue.com',
  'sparkpostmail.com',
]);

const normalize = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9]/g, '');

const hasMachineLocalPart = (localPart: string): boolean => {
  const [baseLocalPart, ...plusTags] = localPart.split('+');
  const normalizedBase = normalize(baseLocalPart);

  if (normalizedBase.length === 0) {
    return true;
  }

  if (ROLE_LOCAL_PARTS.has(normalizedBase)) {
    return true;
  }

  const normalizedLocalPart = normalize(localPart);

  if (
    MACHINE_LOCAL_PART_FRAGMENTS.some((fragment) =>
      normalizedLocalPart.includes(fragment),
    )
  ) {
    return true;
  }

  // "customer-service", "sales.team": every token is a role word.
  const tokens = baseLocalPart.split(/[._-]+/).filter(Boolean);

  if (
    tokens.length > 1 &&
    tokens.every((token) => ROLE_LOCAL_PARTS.has(normalize(token)))
  ) {
    return true;
  }

  // Tracking and threading tokens: long digit strings, hex hashes, and long
  // opaque plus-tags (reply+<40 chars>@reply.github.com).
  if (localPart.replace(/\D/g, '').length >= 10) {
    return true;
  }

  if (localPart.length >= 20 && /[0-9a-f]{12,}/i.test(localPart)) {
    return true;
  }

  if (plusTags.some((tag) => tag.length >= 16 && /\d/.test(tag))) {
    return true;
  }

  return false;
};

const hasMachineDomain = (
  normalizedLocalPart: string,
  domain: string,
): boolean => {
  const parsed = psl.parse(domain);

  if (!isParsedDomain(parsed) || !parsed.domain || !parsed.sld) {
    return true;
  }

  if (BULK_SENDER_DOMAINS.has(parsed.domain)) {
    return true;
  }

  // adobesign@adobesign.com, docusign@docusign.net: the local part is just the
  // brand, so this is the service itself writing.
  if (normalizedLocalPart === normalize(parsed.sld)) {
    return true;
  }

  const subdomainLabels = (parsed.subdomain ?? '').split('.').filter(Boolean);

  if (subdomainLabels.length === 0) {
    return false;
  }

  // e.stripe.com, t.newsletter.example.org. Two-letter labels are left alone
  // because academic departments use them for real people (cs.stanford.edu).
  if (subdomainLabels[0].length === 1) {
    return true;
  }

  return subdomainLabels.some((label) =>
    BULK_SUBDOMAIN_LABELS.has(label.replace(/\d+$/, '')),
  );
};

// Decides whether an email address belongs to a shared inbox, an automated
// sender, or a bulk mail system rather than to a person. Used to keep contact
// auto-creation from turning receipts@, noreply@ and the like into People.
export const isNonPersonEmail = (email: string): boolean => {
  const trimmedEmail = email.trim().toLowerCase();
  const atIndex = trimmedEmail.lastIndexOf('@');

  if (atIndex <= 0 || atIndex === trimmedEmail.length - 1) {
    return true;
  }

  const localPart = trimmedEmail.slice(0, atIndex);
  const domain = trimmedEmail.slice(atIndex + 1);

  if (hasMachineLocalPart(localPart)) {
    return true;
  }

  return hasMachineDomain(normalize(localPart.split('+')[0]), domain);
};
