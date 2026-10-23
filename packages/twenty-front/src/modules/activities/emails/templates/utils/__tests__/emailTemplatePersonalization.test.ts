import {
  buildPersonPlaceholderValues,
  resolveEmailPlaceholders,
} from '@/activities/emails/mass-email/utils/emailPlaceholders';
import {
  buildEmailTemplateValues,
  resolveEmailTemplate,
  toMassEmailTemplate,
} from '@/activities/emails/templates/utils/emailTemplatePersonalization';

const content = {
  subject: 'Hello {{firstName}} — {{jobTitle}}',
  body: JSON.stringify({
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [
          { type: 'text', text: 'Dear ' },
          { type: 'variableTag', attrs: { variable: '{{fullName}}' } },
          { type: 'text', text: ', {{city}}' },
        ],
      },
    ],
  }),
};

describe('email template personalization', () => {
  it('should personalize both fields and variable chips for each person', () => {
    const ada = resolveEmailTemplate(
      content,
      buildEmailTemplateValues({
        name: { firstName: 'Ada', lastName: 'Lovelace' },
        jobTitle: 'Researcher',
        city: 'London',
      }),
    );
    const grace = resolveEmailTemplate(
      content,
      buildEmailTemplateValues({
        name: { firstName: 'Grace', lastName: 'Hopper' },
        jobTitle: 'Engineer',
        city: 'New York',
      }),
    );

    expect(ada.subject).toBe('Hello Ada — Researcher');
    expect(ada.body).toContain('Ada Lovelace');
    expect(grace.body).toContain('Grace Hopper');
    expect(grace.body).not.toContain('Ada');
    expect(ada.body).not.toContain('variableTag');
    expect(content.body).toContain('{{fullName}}');
  });

  it('should preserve quotes, backslashes and line breaks as document text', () => {
    const name = 'Alex "Ace" \\ Example\nSecond line <&>';
    const resolved = resolveEmailTemplate(
      content,
      buildEmailTemplateValues({ name: { firstName: name } }),
    );
    const body = JSON.parse(resolved.body);

    expect(body.content[0].content[1].text).toBe(name);
    expect(resolved.subject).not.toContain('\n');
  });

  it('should report missing values and remove empty variable chips', () => {
    const resolved = resolveEmailTemplate(
      content,
      buildEmailTemplateValues({}),
    );

    expect(resolved.missingFields).toEqual(
      expect.arrayContaining(['firstName', 'fullName', 'city', 'jobTitle']),
    );
    expect(resolved.body).not.toContain('variableTag');
    expect(resolved.body).not.toContain('{{');
  });

  it('should escape personalization in raw HTML and preserve ordinary rich text', () => {
    const resolved = resolveEmailTemplate(
      {
        subject: '{{firstName}}',
        body: JSON.stringify({
          type: 'doc',
          content: [{ type: 'html', attrs: { html: '<p>{{firstName}}</p>' } }],
        }),
      },
      buildEmailTemplateValues({ name: { firstName: '<script>&"' } }),
    );

    expect(resolved.subject).toBe('<script>&"');
    expect(resolved.body).not.toContain('<script>');
    expect(resolved.body).toContain('&lt;script&gt;&amp;&quot;');
  });

  it('should keep placeholders through campaign insertion and adapt them for mass email', () => {
    const converted = toMassEmailTemplate(content);
    const resolved = resolveEmailPlaceholders(
      converted.body,
      buildPersonPlaceholderValues({
        name: { firstName: 'Ada "Ace"', lastName: 'Lovelace' },
        city: 'London',
      }),
      { escapeValues: true },
    );

    expect(converted.subject).toBe('Hello {first_name} — {job_title}');
    expect(converted.body).not.toContain('variableTag');
    expect(JSON.parse(resolved.resolved).content[0].content[1].text).toBe(
      'Ada "Ace" Lovelace',
    );
    expect(content.subject).toContain('{{firstName}}');
  });

  it('should reject a malformed email body', () => {
    expect(() =>
      resolveEmailTemplate(
        { subject: 'Hi', body: 'not JSON' },
        buildEmailTemplateValues({}),
      ),
    ).toThrow('Invalid email template body');
  });
});
