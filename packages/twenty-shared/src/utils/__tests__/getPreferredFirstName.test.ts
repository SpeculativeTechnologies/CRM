import { getPreferredFirstName } from '../getPreferredFirstName';

describe('getPreferredFirstName', () => {
  it('should use the preferred name without changing the stored first name', () => {
    expect(getPreferredFirstName('Timothy', ' Tim ')).toBe('Tim');
  });

  it.each([undefined, null, '', '   ', 42, {}])(
    'should fall back to the stored first name for %p',
    (preferredName) => {
      expect(getPreferredFirstName('Timothy', preferredName)).toBe('Timothy');
    },
  );

  it('should support a preferred name when the stored first name is empty', () => {
    expect(getPreferredFirstName(null, 'Tim')).toBe('Tim');
    expect(getPreferredFirstName(undefined, null)).toBe('');
  });
});
