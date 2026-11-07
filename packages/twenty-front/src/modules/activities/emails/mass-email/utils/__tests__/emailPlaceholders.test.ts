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
  it('should use the preferred name for greetings while preserving the full name', () => {
    const preferredValues = buildPersonPlaceholderValues({
      name: { firstName: 'Timothy', lastName: 'McGee' },
      preferredName: ' Tim ',
    });

    expect(preferredValues.first_name).toBe('Tim');
    expect(preferredValues.full_name).toBe('Timothy McGee');
    expect(
      resolveEmailPlaceholders('Hi {first_name}', preferredValues, {
        escapeValues: false,
      }).resolved,
    ).toBe('Hi Tim');
  });

  it.each([undefined, null, '', '   '])(
    'should fall back to first name when preferred name is %p',
    (preferredName) => {
      expect(
        buildPersonPlaceholderValues({
          name: { firstName: ' Timothy ' },
          preferredName,
        }).first_name,
      ).toBe('Timothy');
    },
  );

  it('should use and escape a preferred name even without a first name', () => {
    const preferredValues = buildPersonPlaceholderValues({
      preferredName: '<b>Tim & "T"</b>',
    });

    expect(
      resolveEmailPlaceholders('<p>Hi {first_name}</p>', preferredValues, {
        escapeValues: true,
      }),
    ).toEqual({
      resolved: '<p>Hi &lt;b&gt;Tim &amp; &quot;T&quot;&lt;/b&gt;</p>',
      missingPlaceholderKeys: [],
    });
  });

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
