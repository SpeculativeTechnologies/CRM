import { type FieldMetadataItem } from '@/object-metadata/types/FieldMetadataItem';
import { type FieldsWidgetGroup } from '@/page-layout/widgets/fields/types/FieldsWidgetGroup';
import { ensurePreferredNameFieldVisible } from '@/page-layout/widgets/fields/utils/ensurePreferredNameFieldVisible';

const preferredNameField = {
  id: 'preferred',
  name: 'preferredName',
} as FieldMetadataItem;
const emailField = { id: 'emails', name: 'emails' } as FieldMetadataItem;
const groups: FieldsWidgetGroup[] = [
  {
    id: 'existing',
    name: 'General',
    position: 0,
    isVisible: true,
    fields: [
      {
        fieldMetadataItem: emailField,
        position: 0,
        globalIndex: 0,
        isVisible: true,
      },
    ],
  },
];

describe('ensurePreferredNameFieldVisible', () => {
  it('should expose the editable metadata field on existing profiles without inspecting its value', () => {
    const result = ensurePreferredNameFieldVisible(groups, preferredNameField);
    expect(
      result[0].fields.map((field) => field.fieldMetadataItem.name),
    ).toEqual(['preferredName', 'emails']);
    expect(result[0].fields.map((field) => field.globalIndex)).toEqual([0, 1]);
    expect(groups[0].fields).toHaveLength(1);
  });

  it('should preserve the position of a preferred name already displayed', () => {
    const visible = ensurePreferredNameFieldVisible(groups, preferredNameField);
    expect(ensurePreferredNameFieldVisible(visible, preferredNameField)).toBe(
      visible,
    );
  });

  it('should display preferred name even when the saved profile has no visible groups', () => {
    expect(
      ensurePreferredNameFieldVisible([], preferredNameField)[0].fields[0]
        .fieldMetadataItem,
    ).toBe(preferredNameField);
  });

  it('should leave workspaces without the field unchanged', () => {
    expect(ensurePreferredNameFieldVisible(groups, undefined)).toBe(groups);
  });
});
