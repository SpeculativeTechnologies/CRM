import { generate, lexer, parse } from 'css-tree';

// Keep email typography and table layouts, without positioning, generated
// content, animation, external resources or properties that hide the message.
const ALLOWED_PROPERTIES = new Set([
  'background',
  'background-color',
  'border',
  'border-bottom',
  'border-bottom-color',
  'border-bottom-style',
  'border-bottom-width',
  'border-collapse',
  'border-color',
  'border-left',
  'border-left-color',
  'border-left-style',
  'border-left-width',
  'border-radius',
  'border-right',
  'border-right-color',
  'border-right-style',
  'border-right-width',
  'border-spacing',
  'border-style',
  'border-top',
  'border-top-color',
  'border-top-style',
  'border-top-width',
  'border-width',
  'color',
  'direction',
  'display',
  'font',
  'font-family',
  'font-size',
  'font-style',
  'font-variant',
  'font-weight',
  'height',
  'letter-spacing',
  'line-height',
  'list-style-position',
  'list-style-type',
  'margin',
  'margin-bottom',
  'margin-left',
  'margin-right',
  'margin-top',
  'max-height',
  'max-width',
  'min-height',
  'min-width',
  'overflow-wrap',
  'padding',
  'padding-bottom',
  'padding-left',
  'padding-right',
  'padding-top',
  'table-layout',
  'text-align',
  'text-decoration',
  'text-indent',
  'text-transform',
  'vertical-align',
  'white-space',
  'width',
  'word-break',
  'word-spacing',
  'word-wrap',
]);

const ALLOWED_DISPLAYS = new Set([
  'block',
  'inline',
  'inline-block',
  'table',
  'inline-table',
  'table-row',
  'table-cell',
  'table-row-group',
  'table-header-group',
  'table-footer-group',
  'table-column',
  'table-column-group',
  'table-caption',
]);

const isSafeValue = (value: string): boolean => {
  // Only numeric colour functions are supported. In particular, no url(),
  // expression(), var(), attr(), escapes or comments can survive serialization.
  const withoutColors = value.replace(
    /\b(?:rgb|rgba|hsl|hsla)\([\d.,%\s/+\-deg]*\)/gi,
    '',
  );

  return /^[\p{L}\d\s#.,%'"/+\-]*$/u.test(withoutColors);
};

export const sanitizeOutboundEmailStyle = (value: string): string => {
  try {
    const declarations = parse(value, { context: 'declarationList' });

    if (declarations.type !== 'DeclarationList') {
      return '';
    }

    declarations.children.forEach((declaration, item, list) => {
      if (
        declaration.type !== 'Declaration' ||
        declaration.value.type !== 'Value'
      ) {
        list.remove(item);

        return;
      }

      const property = declaration.property.toLowerCase();
      const propertyValue = generate(declaration.value);

      if (
        !ALLOWED_PROPERTIES.has(property) ||
        !isSafeValue(propertyValue) ||
        (property === 'display' &&
          !ALLOWED_DISPLAYS.has(propertyValue.toLowerCase())) ||
        lexer.matchProperty(property, declaration.value).matched === null
      ) {
        list.remove(item);

        return;
      }

      declaration.property = property;
    });

    // Serialize only parsed, validated declarations. Never splice raw CSS back
    // into the attribute, including parser recovery nodes or unknown functions.
    return generate(declarations);
  } catch {
    return '';
  }
};
