import {
  EMAIL_DOCUMENT_MARK_CATALOG,
  isEmailDocumentMarkType,
} from '../email-document-mark-catalog';
import { EMAIL_DOCUMENT_SCHEMA_VERSION } from '../email-document-schema-version';
import { parseEmailDocument } from '../parse-email-document';
import { TIPTAP_MARK_TYPES } from '../tiptap-mark-types';
import { TIPTAP_MARKS_RENDER_ORDER } from '../tiptap-marks-render-order';
import {
  isTipTapTextColorName,
  resolveTipTapTextColor,
  TIPTAP_TEXT_COLOR_NAMES,
  TIPTAP_TEXT_COLORS,
} from '../tiptap-text-colors';
import { transformEmailDocumentStrings } from '../transform-email-document-strings';

// The same list is pinned by TextColorPalette.test.ts in twenty-front, so a
// swatch offered on one side but unknown to the other fails one of the two.
const OFFERED_COLOR_NAMES = [
  'gray',
  'brown',
  'red',
  'orange',
  'yellow',
  'green',
  'turquoise',
  'sky',
  'blue',
  'purple',
  'pink',
];

const colouredDocument = (color: unknown) => ({
  type: 'doc',
  attrs: { schemaVersion: EMAIL_DOCUMENT_SCHEMA_VERSION },
  content: [
    {
      type: 'paragraph',
      content: [
        {
          type: 'text',
          text: 'Regards',
          marks: [{ type: TIPTAP_MARK_TYPES.TEXT_COLOR, attrs: { color } }],
        },
      ],
    },
  ],
});

describe('tiptap text colours', () => {
  it('should offer exactly the palette the editor offers', () => {
    expect(TIPTAP_TEXT_COLOR_NAMES).toEqual(OFFERED_COLOR_NAMES);
  });

  it('should resolve every offered name to an sRGB hex a mail client understands', () => {
    for (const colorName of TIPTAP_TEXT_COLOR_NAMES) {
      expect(TIPTAP_TEXT_COLORS[colorName]).toMatch(/^#[0-9a-f]{6}$/);
      expect(resolveTipTapTextColor(colorName)).toBe(
        TIPTAP_TEXT_COLORS[colorName],
      );
    }
  });

  it('should refuse to resolve anything that is not an offered name', () => {
    expect(isTipTapTextColorName('chartreuse')).toBe(false);
    expect(resolveTipTapTextColor('chartreuse')).toBeUndefined();
    expect(resolveTipTapTextColor('red; background: url(x)')).toBeUndefined();
    expect(resolveTipTapTextColor('#ff0000')).toBeUndefined();
    expect(resolveTipTapTextColor(null)).toBeUndefined();
    expect(resolveTipTapTextColor(undefined)).toBeUndefined();
    expect(resolveTipTapTextColor('toString')).toBeUndefined();
  });
});

describe('text colour mark registration', () => {
  it('should be a known email document mark', () => {
    expect(isEmailDocumentMarkType(TIPTAP_MARK_TYPES.TEXT_COLOR)).toBe(true);
    expect(
      EMAIL_DOCUMENT_MARK_CATALOG[TIPTAP_MARK_TYPES.TEXT_COLOR]
        .stringAttributes,
    ).toEqual({});
  });

  it('should render innermost so it wins over a surrounding link colour', () => {
    expect(
      TIPTAP_MARKS_RENDER_ORDER.indexOf(TIPTAP_MARK_TYPES.TEXT_COLOR),
    ).toBe(0);
    expect(
      TIPTAP_MARKS_RENDER_ORDER.indexOf(TIPTAP_MARK_TYPES.TEXT_COLOR),
    ).toBeLessThan(TIPTAP_MARKS_RENDER_ORDER.indexOf(TIPTAP_MARK_TYPES.LINK));
  });

  it('should leave the colour name alone while transforming document strings', () => {
    const transformed = transformEmailDocumentStrings(
      colouredDocument('blue'),
      (value) => `${value}!`,
    );

    expect(transformed.content?.[0].content?.[0].marks?.[0]).toEqual({
      type: TIPTAP_MARK_TYPES.TEXT_COLOR,
      attrs: { color: 'blue' },
    });
    expect(transformed.content?.[0].content?.[0].text).toBe('Regards!');
  });
});

describe('text colour in the outbound document schema', () => {
  it('should accept a coloured document', () => {
    expect(parseEmailDocument(colouredDocument('blue')).success).toBe(true);
  });

  it('should accept a document written before the mark existed', () => {
    expect(
      parseEmailDocument({
        type: 'doc',
        attrs: { schemaVersion: EMAIL_DOCUMENT_SCHEMA_VERSION },
        content: [
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: 'Regards',
                marks: [{ type: TIPTAP_MARK_TYPES.BOLD }],
              },
            ],
          },
        ],
      }).success,
    ).toBe(true);
  });

  it('should reject a colour attribute carrying anything but a bare name', () => {
    expect(
      parseEmailDocument(colouredDocument('red; color: white')).success,
    ).toBe(false);
    expect(parseEmailDocument(colouredDocument('#ff0000')).success).toBe(false);
    expect(parseEmailDocument(colouredDocument(42)).success).toBe(false);
  });
});
