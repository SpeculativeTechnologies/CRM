import {
  buildPersonPlaceholderValues,
  resolveEmailPlaceholders,
} from '@/activities/emails/mass-email/utils/emailPlaceholders';

const values = buildPersonPlaceholderValues({
  name: { firstName: 'Ada', lastName: 'Lovelace' },
  emails: { primaryEmail: 'ada@example.com' },
  jobTitle: 'Engineer',
  city: 'London',
  company: { name: 'Analytical Engines' },
});

describe('resolveEmailPlaceholders', () => {
  it('should replace known placeholders with person values', () => {
    const { resolved, missingPlaceholderKeys } = resolveEmailPlaceholders(
      'Hi {first_name}, greetings from {company}!',
      values,
      { escapeValues: false },
    );

    expect(resolved).toBe('Hi Ada, greetings from Analytical Engines!');
    expect(missingPlaceholderKeys).toEqual([]);
  });

  it('should tolerate whitespace inside braces', () => {
    const { resolved } = resolveEmailPlaceholders(
      'Hi { first_name }!',
      values,
      { escapeValues: false },
    );

    expect(resolved).toBe('Hi Ada!');
  });

  it('should leave unknown placeholders untouched', () => {
    const { resolved, missingPlaceholderKeys } = resolveEmailPlaceholders(
      'Hi {first_name}, your {favorite_color} order shipped.',
      values,
      { escapeValues: false },
    );

    expect(resolved).toBe('Hi Ada, your {favorite_color} order shipped.');
    expect(missingPlaceholderKeys).toEqual([]);
  });

  it('should report known placeholders with no value and replace them with an empty string', () => {
    const { resolved, missingPlaceholderKeys } = resolveEmailPlaceholders(
      'Hi {first_name} from {city}',
      { ...values, city: '' },
      { escapeValues: false },
    );

    expect(resolved).toBe('Hi Ada from ');
    expect(missingPlaceholderKeys).toEqual(['city']);
  });

  it('should escape html in values when requested', () => {
    const { resolved } = resolveEmailPlaceholders(
      '<p>Hi {first_name}</p>',
      { ...values, first_name: '<b>Ada</b>' },
      { escapeValues: true },
    );

    expect(resolved).toBe('<p>Hi &lt;b&gt;Ada&lt;/b&gt;</p>');
  });
});

describe('buildPersonPlaceholderValues', () => {
  it('should build values from a person record', () => {
    expect(values).toEqual({
      first_name: 'Ada',
      last_name: 'Lovelace',
      full_name: 'Ada Lovelace',
      email: 'ada@example.com',
      job_title: 'Engineer',
      city: 'London',
      company: 'Analytical Engines',
    });
  });

  it('should fall back to empty strings for missing fields', () => {
    expect(buildPersonPlaceholderValues({})).toEqual({
      first_name: '',
      last_name: '',
      full_name: '',
      email: '',
      job_title: '',
      city: '',
      company: '',
    });
  });
});
