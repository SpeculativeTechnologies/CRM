import { RuleTester } from 'oxlint/plugins-dev';

import { rule, RULE_NAME } from './require-text-input-focus-handlers';

const ruleTester = new RuleTester();

ruleTester.run(RULE_NAME, rule, {
  valid: [
    {
      code: 'const Component = () => <input onFocus={handleFocus} onBlur={handleBlur} />;',
      filename: 'test.tsx',
    },
    {
      code: 'const StyledInput = styled.input``; const Component = () => <StyledInput onFocus={handleFocus} onBlur={handleBlur} />;',
      filename: 'test.tsx',
    },
    {
      code: 'const Component = () => <input type="file" onChange={handleChange} />;',
      filename: 'test.tsx',
    },
    {
      code: 'const Component = (props) => <input {...props} />;',
      filename: 'test.tsx',
    },
    {
      code: 'const StyledContainer = styled.div``; const Component = () => <StyledContainer />;',
      filename: 'test.tsx',
    },
  ],
  invalid: [
    {
      code: 'const Component = () => <input value={value} onChange={handleChange} />;',
      errors: [{ messageId: 'missingFocusHandlers' }],
      filename: 'test.tsx',
    },
    {
      code: 'const Component = () => <textarea value={value} onChange={handleChange} />;',
      errors: [{ messageId: 'missingFocusHandlers' }],
      filename: 'test.tsx',
    },
    {
      code: 'const StyledSubjectInput = styled.input``; const Component = () => <StyledSubjectInput value={value} onChange={handleChange} />;',
      errors: [{ messageId: 'missingFocusHandlers' }],
      filename: 'test.tsx',
    },
    {
      code: 'const Component = () => <input onFocus={handleFocus} />;',
      errors: [{ messageId: 'missingFocusHandlers' }],
      filename: 'test.tsx',
    },
    {
      code: 'const Component = () => <input type="date" value={value} onChange={handleChange} />;',
      errors: [{ messageId: 'missingFocusHandlers' }],
      filename: 'test.tsx',
    },
  ],
});
