import { TextColorMark } from '@/advanced-text-editor/extensions/text-color/TextColorMark';
import { Editor } from '@tiptap/core';
import { Document } from '@tiptap/extension-document';
import { Link } from '@tiptap/extension-link';
import { Paragraph } from '@tiptap/extension-paragraph';
import { Text } from '@tiptap/extension-text';

describe('TextColorMark', () => {
  let editor: Editor;

  beforeEach(() => {
    editor = new Editor({
      extensions: [
        Document,
        Paragraph,
        Text,
        Link.configure({ openOnClick: false }),
        TextColorMark,
      ],
      content: '<p></p>',
    });
  });

  afterEach(() => {
    editor?.destroy();
  });

  it('should register as a mark named textColor', () => {
    expect(editor.schema.marks.textColor).toBeDefined();
  });

  describe('renderHTML', () => {
    it('should render a span carrying the palette name and the themed colour', () => {
      editor.commands.setContent('<p>Regards</p>');
      editor.commands.selectAll();
      editor.commands.setTextColor('blue');

      expect(editor.getHTML()).toBe(
        '<p><span data-text-color="blue" style="color: var(--t-tag-text-blue);">Regards</span></p>',
      );
    });

    it('should store the palette name rather than a colour value', () => {
      editor.commands.setContent('<p>Regards</p>');
      editor.commands.selectAll();
      editor.commands.setTextColor('red');

      expect(editor.getJSON()).toEqual({
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: 'Regards',
                marks: [{ type: 'textColor', attrs: { color: 'red' } }],
              },
            ],
          },
        ],
      });
    });

    it('should render nothing for an unknown stored name', () => {
      editor.commands.setContent({
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: 'Regards',
                marks: [{ type: 'textColor', attrs: { color: 'chartreuse' } }],
              },
            ],
          },
        ],
      });

      expect(editor.getHTML()).toBe('<p><span>Regards</span></p>');
    });

    it('should never emit a stored value into the style declaration', () => {
      editor.commands.setContent({
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: 'Regards',
                marks: [
                  {
                    type: 'textColor',
                    attrs: {
                      color: 'red; background: url(javascript:alert(1))',
                    },
                  },
                ],
              },
            ],
          },
        ],
      });

      expect(editor.getHTML()).not.toContain('javascript');
    });
  });

  describe('parseHTML', () => {
    it('should round-trip a coloured span', () => {
      editor.commands.setContent(
        '<p><span data-text-color="green" style="color: var(--t-tag-text-green)">Regards</span></p>',
      );

      expect(editor.getJSON().content?.[0].content?.[0].marks).toEqual([
        { type: 'textColor', attrs: { color: 'green' } },
      ]);
    });

    it('should ignore a span naming a colour outside the palette', () => {
      editor.commands.setContent(
        '<p><span data-text-color="chartreuse">Regards</span></p>',
      );

      expect(editor.getJSON().content?.[0].content?.[0].marks).toBeUndefined();
    });

    // Signatures written before this mark existed are plain HTML with no data
    // attribute, and must keep parsing exactly as they did.
    it('should leave a document written before the mark untouched', () => {
      editor.commands.setContent(
        '<p><strong>Regards</strong>, <span style="color: red">Ada</span></p>',
      );

      const paragraphContent = editor.getJSON().content?.[0].content ?? [];

      expect(
        paragraphContent.every(
          (node) =>
            !(node.marks ?? []).some((mark) => mark.type === 'textColor'),
        ),
      ).toBe(true);
      expect(editor.getText()).toBe('Regards, Ada');
    });
  });

  describe('commands', () => {
    it('should remove the mark rather than set an explicit colour', () => {
      editor.commands.setContent('<p>Regards</p>');
      editor.commands.selectAll();
      editor.commands.setTextColor('purple');
      editor.commands.unsetTextColor();

      expect(editor.getHTML()).toBe('<p>Regards</p>');
      expect(editor.getJSON().content?.[0].content?.[0].marks).toBeUndefined();
    });

    it('should colour text inside a link', () => {
      editor.commands.setContent(
        '<p><a href="https://twenty.com">Twenty</a></p>',
      );
      editor.commands.selectAll();
      editor.commands.setTextColor('sky');

      expect(editor.getAttributes('textColor').color).toBe('sky');
    });
  });
});
