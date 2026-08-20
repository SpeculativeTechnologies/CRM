import { type FieldDefinition } from '@/object-record/record-field/ui/types/FieldDefinition';
import { type FieldMetadata } from '@/object-record/record-field/ui/types/FieldMetadata';
import {
  getFieldDisplayLabelText,
  type FieldDisplayLabelTextFormatters,
} from '@/object-record/record-field/ui/utils/getFieldDisplayLabelText';
import { FieldMetadataType, RelationType } from '~/generated-metadata/graphql';

const buildFieldDefinition = (
  type: FieldMetadataType,
  metadata: Record<string, unknown> = {},
): FieldDefinition<FieldMetadata> =>
  ({
    fieldMetadataId: 'fieldMetadataId',
    label: 'Field',
    iconName: 'IconAbc',
    type,
    metadata: { fieldName: 'fieldName', ...metadata },
  }) as FieldDefinition<FieldMetadata>;

const formatters: FieldDisplayLabelTextFormatters = {
  getRecordLabelText: (record) => String(record.name ?? ''),
  getActorLabelText: (actorValue) => actorValue.name,
  formatDateFieldValue: ({ value }) => `date(${value})`,
  formatDateTimeFieldValue: ({ value }) => `dateTime(${value})`,
  formatNumberFieldValue: ({ value, decimals }) => value.toFixed(decimals ?? 0),
};

const getDisplayLabelText = (
  fieldDefinition: FieldDefinition<FieldMetadata>,
  fieldValue: unknown,
) => getFieldDisplayLabelText({ fieldDefinition, fieldValue, formatters });

describe('getFieldDisplayLabelText', () => {
  describe('relation fields', () => {
    const relationToOneFieldDefinition = buildFieldDefinition(
      FieldMetadataType.RELATION,
      {
        relationType: RelationType.MANY_TO_ONE,
        relationObjectMetadataNameSingular: 'company',
      },
    );

    it('should return the linked record name when the cell points at one record', () => {
      expect(
        getDisplayLabelText(relationToOneFieldDefinition, {
          id: 'company-id',
          name: 'Acme Inc',
        }),
      ).toBe('Acme Inc');
    });

    it('should resolve the label against the related object when the cell points at one record', () => {
      const getRecordLabelText = jest.fn().mockReturnValue('Acme Inc');

      getFieldDisplayLabelText({
        fieldDefinition: relationToOneFieldDefinition,
        fieldValue: { id: 'company-id', name: 'Acme Inc' },
        formatters: { ...formatters, getRecordLabelText },
      });

      expect(getRecordLabelText).toHaveBeenCalledWith(
        { id: 'company-id', name: 'Acme Inc' },
        'company',
      );
    });

    it('should return an empty string when the cell points at no record', () => {
      expect(getDisplayLabelText(relationToOneFieldDefinition, null)).toBe('');
    });

    it('should return every linked record name when the cell points at many records', () => {
      const relationFromManyFieldDefinition = buildFieldDefinition(
        FieldMetadataType.RELATION,
        {
          relationType: RelationType.ONE_TO_MANY,
          relationObjectMetadataNameSingular: 'person',
        },
      );

      expect(
        getDisplayLabelText(relationFromManyFieldDefinition, [
          { id: 'person-1', name: 'Jane Doe' },
          { id: 'person-2', name: 'John Smith' },
        ]),
      ).toBe('Jane Doe, John Smith');
    });

    it('should return the linked record name for a morph relation pointing at one record', () => {
      const morphRelationToOneFieldDefinition = buildFieldDefinition(
        FieldMetadataType.MORPH_RELATION,
        { relationType: RelationType.MANY_TO_ONE, morphRelations: [] },
      );

      expect(
        getDisplayLabelText(morphRelationToOneFieldDefinition, {
          objectNameSingular: 'company',
          objectNamePlural: 'companies',
          value: { id: 'company-id', name: 'Acme Inc' },
          foreignKeyFieldValue: 'company-id',
        }),
      ).toBe('Acme Inc');
    });

    it('should return every linked record name for a morph relation pointing at many records', () => {
      const morphRelationFromManyFieldDefinition = buildFieldDefinition(
        FieldMetadataType.MORPH_RELATION,
        { relationType: RelationType.ONE_TO_MANY, morphRelations: [] },
      );

      expect(
        getDisplayLabelText(morphRelationFromManyFieldDefinition, [
          {
            objectNameSingular: 'company',
            objectNamePlural: 'companies',
            value: [{ id: 'company-id', name: 'Acme Inc' }],
          },
          {
            objectNameSingular: 'person',
            objectNamePlural: 'people',
            value: [{ id: 'person-id', name: 'Jane Doe' }],
          },
        ]),
      ).toBe('Acme Inc, Jane Doe');
    });
  });

  describe('actor fields', () => {
    const actorFieldDefinition = buildFieldDefinition(FieldMetadataType.ACTOR);

    it('should return the workspace member name of the cell', () => {
      expect(
        getDisplayLabelText(actorFieldDefinition, {
          source: 'MANUAL',
          workspaceMemberId: 'workspace-member-id',
          name: 'Jane Doe',
          context: null,
        }),
      ).toBe('Jane Doe');
    });

    it('should return an empty string when the cell has no actor', () => {
      expect(getDisplayLabelText(actorFieldDefinition, undefined)).toBe('');
    });
  });

  describe('select fields', () => {
    const options = [
      { label: 'Option A', color: 'blue' as const, value: 'OPTION_A' },
      { label: 'Option B', color: 'red' as const, value: 'OPTION_B' },
      { label: 'Option C', color: 'green' as const, value: 'OPTION_C' },
    ];

    it('should return the selected option label', () => {
      expect(
        getDisplayLabelText(
          buildFieldDefinition(FieldMetadataType.SELECT, { options }),
          'OPTION_B',
        ),
      ).toBe('Option B');
    });

    it('should return an empty string when no option is selected', () => {
      expect(
        getDisplayLabelText(
          buildFieldDefinition(FieldMetadataType.SELECT, { options }),
          null,
        ),
      ).toBe('');
    });

    it('should return every selected option label of a multi select', () => {
      expect(
        getDisplayLabelText(
          buildFieldDefinition(FieldMetadataType.MULTI_SELECT, { options }),
          ['OPTION_C', 'OPTION_A'],
        ),
      ).toBe('Option A, Option C');
    });
  });

  describe('currency fields', () => {
    it('should return the currency code and the short amount by default', () => {
      expect(
        getDisplayLabelText(buildFieldDefinition(FieldMetadataType.CURRENCY), {
          amountMicros: 1500000000,
          currencyCode: 'USD',
        }),
      ).toBe('USD 1.5k');
    });

    it('should return the currency code and the full amount when the field is formatted in full', () => {
      expect(
        getDisplayLabelText(
          buildFieldDefinition(FieldMetadataType.CURRENCY, {
            settings: { format: 'full', decimals: 2 },
          }),
          { amountMicros: 1500000000, currencyCode: 'EUR' },
        ),
      ).toBe('EUR 1500.00');
    });

    it('should return an empty string when the cell has no amount', () => {
      expect(
        getDisplayLabelText(buildFieldDefinition(FieldMetadataType.CURRENCY), {
          amountMicros: null,
          currencyCode: 'USD',
        }),
      ).toBe('');
    });
  });

  describe('date fields', () => {
    it('should return the formatted date', () => {
      expect(
        getDisplayLabelText(
          buildFieldDefinition(FieldMetadataType.DATE),
          '2026-08-19',
        ),
      ).toBe('date(2026-08-19)');
    });

    it('should return the formatted date time', () => {
      expect(
        getDisplayLabelText(
          buildFieldDefinition(FieldMetadataType.DATE_TIME),
          '2026-08-19T10:00:00.000Z',
        ),
      ).toBe('dateTime(2026-08-19T10:00:00.000Z)');
    });
  });

  describe('plain text and number fields', () => {
    it('should return the text of a text cell unchanged', () => {
      expect(
        getDisplayLabelText(
          buildFieldDefinition(FieldMetadataType.TEXT),
          'Acme Inc',
        ),
      ).toBe('Acme Inc');
    });

    it('should return the uuid of a uuid cell unchanged', () => {
      expect(
        getDisplayLabelText(
          buildFieldDefinition(FieldMetadataType.UUID),
          '20202020-0000-0000-0000-000000000001',
        ),
      ).toBe('20202020-0000-0000-0000-000000000001');
    });

    it('should return the number of a number cell unchanged', () => {
      expect(
        getDisplayLabelText(buildFieldDefinition(FieldMetadataType.NUMBER), 42),
      ).toBe('42');
    });

    it('should return a percentage number as it is displayed', () => {
      expect(
        getDisplayLabelText(
          buildFieldDefinition(FieldMetadataType.NUMBER, {
            settings: { type: 'percentage' },
          }),
          0.25,
        ),
      ).toBe('25%');
    });

    it('should return a short number as it is displayed', () => {
      expect(
        getDisplayLabelText(
          buildFieldDefinition(FieldMetadataType.NUMBER, {
            settings: { type: 'shortNumber' },
          }),
          1500,
        ),
      ).toBe('1.5k');
    });

    it('should return an empty string when the number cell is empty', () => {
      expect(
        getDisplayLabelText(
          buildFieldDefinition(FieldMetadataType.NUMBER),
          null,
        ),
      ).toBe('');
    });
  });

  describe('other field types', () => {
    it('should return the full name of a full name cell', () => {
      expect(
        getDisplayLabelText(buildFieldDefinition(FieldMetadataType.FULL_NAME), {
          firstName: 'Jane',
          lastName: 'Doe',
        }),
      ).toBe('Jane Doe');
    });

    it('should return the boolean label of a boolean cell', () => {
      const booleanFieldDefinition = buildFieldDefinition(
        FieldMetadataType.BOOLEAN,
      );

      expect(getDisplayLabelText(booleanFieldDefinition, true)).toBe('True');
      expect(getDisplayLabelText(booleanFieldDefinition, false)).toBe('False');
      expect(getDisplayLabelText(booleanFieldDefinition, undefined)).toBe('');
    });

    it('should return the number of stars of a rating cell', () => {
      expect(
        getDisplayLabelText(
          buildFieldDefinition(FieldMetadataType.RATING),
          'RATING_3',
        ),
      ).toBe('3');
    });

    it('should return every email of an emails cell', () => {
      expect(
        getDisplayLabelText(buildFieldDefinition(FieldMetadataType.EMAILS), {
          primaryEmail: 'jane@acme.test',
          additionalEmails: ['john@acme.test'],
        }),
      ).toBe('jane@acme.test, john@acme.test');
    });

    it('should return every phone number of a phones cell as displayed', () => {
      expect(
        getDisplayLabelText(buildFieldDefinition(FieldMetadataType.PHONES), {
          primaryPhoneNumber: '612345678',
          primaryPhoneCountryCode: 'FR',
          primaryPhoneCallingCode: '+33',
          additionalPhones: [],
        }),
      ).toBe('+33 6 12 34 56 78');
    });

    it('should return the link label of a links cell, falling back to the hostname', () => {
      expect(
        getDisplayLabelText(buildFieldDefinition(FieldMetadataType.LINKS), {
          primaryLinkLabel: 'Website',
          primaryLinkUrl: 'https://acme.test',
          secondaryLinks: [{ label: null, url: 'https://docs.acme.test' }],
        }),
      ).toBe('Website, docs.acme.test');
    });

    it('should return the joined address of an address cell', () => {
      expect(
        getDisplayLabelText(buildFieldDefinition(FieldMetadataType.ADDRESS), {
          addressStreet1: '1 Main Street',
          addressStreet2: null,
          addressCity: 'Paris',
          addressState: null,
          addressPostcode: null,
          addressCountry: 'France',
          addressLat: null,
          addressLng: null,
        }),
      ).toBe('1 Main Street,Paris,France');
    });

    it('should return the serialized value of a raw json cell', () => {
      expect(
        getDisplayLabelText(buildFieldDefinition(FieldMetadataType.RAW_JSON), {
          key: 'value',
        }),
      ).toBe('{"key":"value"}');
    });

    it('should return every item of an array cell', () => {
      expect(
        getDisplayLabelText(buildFieldDefinition(FieldMetadataType.ARRAY), [
          'first',
          'second',
        ]),
      ).toBe('first, second');
    });

    it('should return every file label of a files cell', () => {
      expect(
        getDisplayLabelText(buildFieldDefinition(FieldMetadataType.FILES), [
          { fileId: 'file-1', label: 'contract.pdf' },
          { fileId: 'file-2', label: 'invoice.pdf' },
        ]),
      ).toBe('contract.pdf, invoice.pdf');
    });

    it('should return the first non empty line of a rich text cell', () => {
      expect(
        getDisplayLabelText(buildFieldDefinition(FieldMetadataType.RICH_TEXT), {
          blocknote: JSON.stringify([
            { type: 'paragraph', content: [] },
            { type: 'paragraph', content: [{ type: 'text', text: 'Summary' }] },
          ]),
          markdown: null,
        }),
      ).toBe('Summary');
    });

    it('should return an empty string for a field type without a display label', () => {
      expect(
        getDisplayLabelText(buildFieldDefinition(FieldMetadataType.POSITION), {
          unexpected: 'value',
        }),
      ).toBe('');
    });
  });
});
