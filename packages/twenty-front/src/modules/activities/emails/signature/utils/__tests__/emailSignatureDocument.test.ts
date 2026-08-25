import {
  TIPTAP_DOCUMENT_SCHEMA_VERSION,
  type TipTapNode,
} from 'twenty-shared/utils';

import {
  canInsertEmailSignature,
  hasEmailSignature,
  insertEmailSignature,
  isEmailSignatureBlank,
  parseEmailSignatureBlocks,
  removeEmailSignature,
  setEmailSignatureIncluded,
} from '@/activities/emails/signature/utils/emailSignatureDocument';

const serializeDocument = (
  content: TipTapNode[],
  attrs: Record<string, unknown> = {
    schemaVersion: TIPTAP_DOCUMENT_SCHEMA_VERSION,
  },
): string => JSON.stringify({ type: 'doc', attrs, content });

const paragraph = (text: string): TipTapNode => ({
  type: 'paragraph',
  content: [{ type: 'text', text }],
});

const emptyParagraph: TipTapNode = { type: 'paragraph' };

const signature = serializeDocument([
  paragraph('Ada Lovelace'),
  paragraph('Analyst, Speculative Technologies'),
]);

const parseContent = (serializedDocument: string): TipTapNode[] =>
  JSON.parse(serializedDocument).content;

describe('emailSignatureDocument', () => {
  describe('parseEmailSignatureBlocks', () => {
    it('should return the signature blocks', () => {
      expect(parseEmailSignatureBlocks(signature)).toEqual([
        paragraph('Ada Lovelace'),
        paragraph('Analyst, Speculative Technologies'),
      ]);
    });

    it.each([
      ['unset', null],
      ['undefined', undefined],
      ['empty', ''],
      ['whitespace only', '   '],
      ['not a canonical document', '<p>Ada</p>'],
      [
        'a document with only blank paragraphs',
        serializeDocument([emptyParagraph]),
      ],
      [
        'a document with only whitespace text',
        serializeDocument([paragraph('  ')]),
      ],
    ])('should return no block when the signature is %s', (_label, value) => {
      expect(parseEmailSignatureBlocks(value)).toEqual([]);
      expect(isEmailSignatureBlank(value)).toBe(true);
    });

    it('should treat an image-only signature as filled in', () => {
      const imageSignature = serializeDocument([
        { type: 'image', attrs: { src: 'https://example.com/logo.png' } },
      ]);

      expect(isEmailSignatureBlank(imageSignature)).toBe(false);
    });
  });

  describe('insertEmailSignature', () => {
    it('should append the signature below the body, separated by a blank line', () => {
      const body = serializeDocument([paragraph('Hello Grace')]);

      const nextBody = insertEmailSignature({
        serializedBody: body,
        serializedSignature: signature,
      });

      expect(parseContent(nextBody)).toEqual([
        paragraph('Hello Grace'),
        emptyParagraph,
        paragraph('Ada Lovelace'),
        paragraph('Analyst, Speculative Technologies'),
      ]);
    });

    it('should append the signature to an empty body and keep a line to type in', () => {
      const nextBody = insertEmailSignature({
        serializedBody: '',
        serializedSignature: signature,
      });

      expect(parseContent(nextBody)).toEqual([
        emptyParagraph,
        paragraph('Ada Lovelace'),
        paragraph('Analyst, Speculative Technologies'),
      ]);
    });

    it('should preserve document attributes such as the campaign canvas theme', () => {
      const body = serializeDocument([paragraph('Hello')], {
        schemaVersion: TIPTAP_DOCUMENT_SCHEMA_VERSION,
        canvasTheme: { width: 600 },
      });

      const nextBody = insertEmailSignature({
        serializedBody: body,
        serializedSignature: signature,
      });

      expect(JSON.parse(nextBody).attrs).toEqual({
        schemaVersion: TIPTAP_DOCUMENT_SCHEMA_VERSION,
        canvasTheme: { width: 600 },
      });
    });

    it('should not insert twice when called repeatedly', () => {
      const body = serializeDocument([paragraph('Hello Grace')]);

      const insertedOnce = insertEmailSignature({
        serializedBody: body,
        serializedSignature: signature,
      });
      const insertedTwice = insertEmailSignature({
        serializedBody: insertedOnce,
        serializedSignature: signature,
      });

      expect(insertedTwice).toEqual(insertedOnce);
    });

    it('should be a no-op when the signature is blank', () => {
      const body = serializeDocument([paragraph('Hello Grace')]);

      expect(
        insertEmailSignature({ serializedBody: body, serializedSignature: '' }),
      ).toEqual(body);
    });

    it('should be a no-op when the body is legacy html', () => {
      expect(
        insertEmailSignature({
          serializedBody: '<p>Hello Grace</p>',
          serializedSignature: signature,
        }),
      ).toEqual('<p>Hello Grace</p>');
    });
  });

  describe('hasEmailSignature', () => {
    it('should recognise a signature it inserted', () => {
      const body = insertEmailSignature({
        serializedBody: serializeDocument([paragraph('Hello Grace')]),
        serializedSignature: signature,
      });

      expect(
        hasEmailSignature({
          serializedBody: body,
          serializedSignature: signature,
        }),
      ).toBe(true);
    });

    it('should recognise a signature whose nodes gained default attributes', () => {
      // The composer schema fills defaults in when it reparses the document.
      const reparsedBody = serializeDocument([
        paragraph('Hello Grace'),
        { type: 'paragraph', attrs: { textAlign: 'left' } },
        {
          type: 'paragraph',
          attrs: { textAlign: 'left' },
          content: [{ type: 'text', text: 'Ada Lovelace', marks: [] }],
        },
        {
          type: 'paragraph',
          attrs: { textAlign: 'left' },
          content: [
            {
              type: 'text',
              text: 'Analyst, Speculative Technologies',
              marks: [],
            },
          ],
        },
      ]);

      expect(
        hasEmailSignature({
          serializedBody: reparsedBody,
          serializedSignature: signature,
        }),
      ).toBe(true);
    });

    it('should not report a signature when the body does not end with it', () => {
      const body = serializeDocument([
        paragraph('Ada Lovelace'),
        paragraph('Hello Grace'),
      ]);

      expect(
        hasEmailSignature({
          serializedBody: body,
          serializedSignature: signature,
        }),
      ).toBe(false);
    });

    it('should not report a signature when the body is shorter than it', () => {
      expect(
        hasEmailSignature({
          serializedBody: serializeDocument([paragraph('Ada Lovelace')]),
          serializedSignature: signature,
        }),
      ).toBe(false);
    });
  });

  describe('removeEmailSignature', () => {
    it('should remove the inserted signature and its blank line, keeping the body', () => {
      const body = serializeDocument([paragraph('Hello Grace')]);

      const withSignature = insertEmailSignature({
        serializedBody: body,
        serializedSignature: signature,
      });
      const withoutSignature = removeEmailSignature({
        serializedBody: withSignature,
        serializedSignature: signature,
      });

      expect(parseContent(withoutSignature)).toEqual([
        paragraph('Hello Grace'),
      ]);
    });

    it('should leave an emptied body with a single blank paragraph', () => {
      const withSignature = insertEmailSignature({
        serializedBody: '',
        serializedSignature: signature,
      });

      expect(
        parseContent(
          removeEmailSignature({
            serializedBody: withSignature,
            serializedSignature: signature,
          }),
        ),
      ).toEqual([emptyParagraph]);
    });

    it('should not touch the body when the signature was edited by the user', () => {
      const editedBody = serializeDocument([
        paragraph('Hello Grace'),
        emptyParagraph,
        paragraph('Ada Lovelace'),
        paragraph('Analyst, somewhere else'),
      ]);

      expect(
        removeEmailSignature({
          serializedBody: editedBody,
          serializedSignature: signature,
        }),
      ).toEqual(editedBody);
    });

    it('should be a no-op when the signature is not in the body', () => {
      const body = serializeDocument([paragraph('Hello Grace')]);

      expect(
        removeEmailSignature({
          serializedBody: body,
          serializedSignature: signature,
        }),
      ).toEqual(body);
    });

    it('should be a no-op when the signature is blank', () => {
      const body = serializeDocument([paragraph('Hello Grace')]);

      expect(
        removeEmailSignature({
          serializedBody: body,
          serializedSignature: null,
        }),
      ).toEqual(body);
    });
  });

  describe('setEmailSignatureIncluded', () => {
    it('should round-trip the body across repeated toggling', () => {
      const body = serializeDocument([paragraph('Hello Grace')]);

      let currentBody = body;

      for (const isIncluded of [true, true, false, false, true, false]) {
        currentBody = setEmailSignatureIncluded({
          serializedBody: currentBody,
          serializedSignature: signature,
          isIncluded,
        });
      }

      expect(parseContent(currentBody)).toEqual([paragraph('Hello Grace')]);
    });
  });

  describe('canInsertEmailSignature', () => {
    it('should allow insertion into an empty body with a filled-in signature', () => {
      expect(
        canInsertEmailSignature({
          serializedBody: '',
          serializedSignature: signature,
        }),
      ).toBe(true);
    });

    it('should refuse a blank signature', () => {
      expect(
        canInsertEmailSignature({
          serializedBody: '',
          serializedSignature: '',
        }),
      ).toBe(false);
    });

    it('should refuse a legacy html body', () => {
      expect(
        canInsertEmailSignature({
          serializedBody: '<p>Hello</p>',
          serializedSignature: signature,
        }),
      ).toBe(false);
    });
  });
});
