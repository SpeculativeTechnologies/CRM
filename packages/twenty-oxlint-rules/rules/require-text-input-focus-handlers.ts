import { defineRule } from '@oxlint/plugins';

export const RULE_NAME = 'require-text-input-focus-handlers';

const NON_TEXT_INPUT_TYPES = [
  'button',
  'checkbox',
  'color',
  'file',
  'hidden',
  'image',
  'radio',
  'range',
  'reset',
  'submit',
];

const RAW_TEXT_INPUT_TAGS = ['input', 'textarea'];

export const rule = defineRule({
  meta: {
    type: 'problem',
    docs: {
      description:
        'Ensure raw text inputs register themselves in the focus stack while focused',
    },
    messages: {
      missingFocusHandlers:
        'Raw <{{tagName}}> needs onFocus and onBlur from useTextInputFocusStack, otherwise global hotkeys such as "/", "@" and "?" fire while typing and swallow the character.',
    },
    schema: [],
  },
  create: (context) => {
    const styledTextInputNames = new Set<string>();

    const getStyledTagName = (node: any): string | null => {
      if (node?.type !== 'TaggedTemplateExpression') return null;

      const tag = node.tag;

      if (
        tag?.type !== 'MemberExpression' ||
        tag.object?.type !== 'Identifier' ||
        tag.object.name !== 'styled' ||
        tag.property?.type !== 'Identifier'
      ) {
        return null;
      }

      return tag.property.name;
    };

    const getAttribute = (node: any, attributeName: string) =>
      node.attributes?.find(
        (attribute: any) =>
          attribute.type === 'JSXAttribute' &&
          attribute.name?.type === 'JSXIdentifier' &&
          attribute.name.name === attributeName,
      );

    const hasSpreadAttribute = (node: any) =>
      node.attributes?.some(
        (attribute: any) => attribute.type === 'JSXSpreadAttribute',
      ) === true;

    const isNonTextInput = (node: any) => {
      const typeAttribute = getAttribute(node, 'type');

      return (
        typeAttribute?.value?.type === 'Literal' &&
        NON_TEXT_INPUT_TYPES.includes(typeAttribute.value.value)
      );
    };

    return {
      VariableDeclarator: (node: any) => {
        const styledTagName = getStyledTagName(node.init);

        if (
          node.id?.type === 'Identifier' &&
          styledTagName !== null &&
          RAW_TEXT_INPUT_TAGS.includes(styledTagName)
        ) {
          styledTextInputNames.add(node.id.name);
        }
      },
      JSXOpeningElement: (node: any) => {
        if (node.name?.type !== 'JSXIdentifier') return;

        const tagName = node.name.name;

        if (
          !RAW_TEXT_INPUT_TAGS.includes(tagName) &&
          !styledTextInputNames.has(tagName)
        ) {
          return;
        }

        if (hasSpreadAttribute(node) || isNonTextInput(node)) return;

        const hasFocusHandlers =
          getAttribute(node, 'onFocus') !== undefined &&
          getAttribute(node, 'onBlur') !== undefined;

        if (hasFocusHandlers) return;

        context.report({
          node,
          messageId: 'missingFocusHandlers',
          data: { tagName },
        });
      },
    };
  },
});
