import { isNonPersonEmail } from 'src/modules/contact-creation-manager/utils/is-non-person-email.util';

describe('isNonPersonEmail', () => {
  describe('people', () => {
    it.each([
      'john@example.com',
      'john.doe@acme.com',
      'jane_doe-smith@acme.io',
      'jdoe@cs.stanford.edu',
      'student@mail.mcgill.ca',
      'alexandrapetrova1990@gmail.com',
      'john+crm@example.com',
      'john+2024@example.com',
      'grant@acme.com',
      'anne@hubspot.com',
      'sam@zendesk.com',
      'writer@substack.com',
      'jane@salesforce.com',
      'j.smith@co.uk.example.com',
      'olivier@t.co',
      'Person.Name@Example.COM',
      'sales.lee@acme.com',
    ])('keeps %s', (email) => {
      expect(isNonPersonEmail(email)).toBe(false);
    });
  });

  describe('role and shared inboxes', () => {
    it.each([
      'info@acme.com',
      'hello@acme.com',
      'hi@acme.com',
      'support@acme.com',
      'sales@acme.com',
      'team@acme.com',
      'receipts@stripe.com',
      'billing@acme.com',
      'careers@acme.com',
      'newsletter@acme.com',
      'events@acme.com',
      'admin@acme.com',
      'Info@Acme.com',
      'customer-service@acme.com',
      'sales.team@acme.com',
      'support_help@acme.com',
      'info+tag@acme.com',
    ])('rejects %s', (email) => {
      expect(isNonPersonEmail(email)).toBe(true);
    });
  });

  describe('automated senders', () => {
    it.each([
      'noreply@acme.com',
      'no-reply@acme.com',
      'no_reply@acme.com',
      'no.reply@acme.com',
      'do-not-reply@acme.com',
      'donotreply@acme.com',
      'drive-shares-dm-noreply@google.com',
      'comments-noreply@docs.google.com',
      'calendar-notification@google.com',
      'MAILER-DAEMON@googlemail.com',
      'postmaster@acme.com',
      'notifications@github.com',
      'adobesign@adobesign.com',
      'docusign@docusign.net',
      'stripe@stripe.com',
    ])('rejects %s', (email) => {
      expect(isNonPersonEmail(email)).toBe(true);
    });
  });

  describe('bulk mail systems', () => {
    it.each([
      'reply+ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789ABCD@reply.github.com',
      '32.MRTVISTNM5XUEQKON@unsubscribe2.customer.io',
      'updates@em.stripe.com',
      'promo@e.stripe.com',
      'calendar-server@bounces.google.com',
      'bounces+12345-abcd@sendgrid.net',
      'msprvs1=18989=@bounces.mailjet.com',
      '0100018c9a1b2c3d-4e5f6a7b-8c9d-0e1f-2a3b-4c5d6e7f8a9b-000000@amazonses.com',
      'campaign@news.acme.com',
      'digest@notifications.acme.com',
      'weekly@marketing.acme.com',
      'a1b2c3d4e5f6a7b8c9d0e1f2@example.com',
    ])('rejects %s', (email) => {
      expect(isNonPersonEmail(email)).toBe(true);
    });
  });

  describe('malformed handles', () => {
    it.each(['', 'not-an-email', '@acme.com', 'john@', 'john@localhost'])(
      'rejects %s',
      (email) => {
        expect(isNonPersonEmail(email)).toBe(true);
      },
    );
  });
});
