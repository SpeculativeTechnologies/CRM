import { RECORD_CONTEXT_MENU_FIELD_INPUT_PREFIX } from '@/command-menu-item/constants/RecordContextMenuFieldInputPrefix';
import { recordContextMenuFieldEditorState } from '@/command-menu-item/states/recordContextMenuFieldEditorState';
import { type RecordContextMenuTarget } from '@/command-menu-item/types/RecordContextMenuTarget';
import { getRecordContextMenuFieldMetadataItems } from '@/command-menu-item/utils/getRecordContextMenuFieldMetadataItems';
import { useGetIsMetadataItemFromStandardApplication } from '@/object-metadata/hooks/useGetIsMetadataItemFromStandardApplication';
import { useObjectMetadataItems } from '@/object-metadata/hooks/useObjectMetadataItems';
import { type FieldMetadataItem } from '@/object-metadata/types/FieldMetadataItem';
import { formatFieldMetadataItemAsFieldDefinition } from '@/object-metadata/utils/formatFieldMetadataItemAsFieldDefinition';
import { getObjectPermissionsForObject } from '@/object-metadata/utils/getObjectPermissionsForObject';
import { useObjectPermissions } from '@/object-record/hooks/useObjectPermissions';
import { useIsRecordReadOnly } from '@/object-record/read-only/hooks/useIsRecordReadOnly';
import { isRecordFieldReadOnly } from '@/object-record/read-only/utils/isRecordFieldReadOnly';
import { useOpenFieldInputEditMode } from '@/object-record/record-field/ui/hooks/useOpenFieldInputEditMode';
import { useCloseDropdown } from '@/ui/layout/dropdown/hooks/useCloseDropdown';
import { useSetAtomState } from '@/ui/utilities/state/jotai/hooks/useSetAtomState';

export const useRecordContextMenuFields = ({
  dropdownId,
  objectMetadataItem,
  recordId,
  position,
}: RecordContextMenuTarget) => {
  const { objectMetadataItems } = useObjectMetadataItems();
  const { objectPermissionsByObjectMetadataId } = useObjectPermissions();
  const getIsMetadataItemFromStandardApplication =
    useGetIsMetadataItemFromStandardApplication();

  const isRecordReadOnly = useIsRecordReadOnly({
    recordId,
    objectMetadataId: objectMetadataItem.id,
  });

  const isFieldReadOnly = (fieldMetadataItem: FieldMetadataItem) =>
    isRecordFieldReadOnly({
      isRecordReadOnly,
      isSystemObject: objectMetadataItem.isSystem,
      isFieldFromStandardApplication:
        getIsMetadataItemFromStandardApplication(fieldMetadataItem),
      objectPermissions: getObjectPermissionsForObject(
        objectPermissionsByObjectMetadataId,
        objectMetadataItem.id,
      ),
      fieldMetadataItem,
      fieldDefinition: formatFieldMetadataItemAsFieldDefinition({
        field: fieldMetadataItem,
        objectMetadataItem,
      }),
      objectPermissionsByObjectMetadataId,
    });

  const { contactFieldMetadataItems, editableFieldMetadataItems } =
    getRecordContextMenuFieldMetadataItems({
      objectMetadataItem,
      objectMetadataItems,
      isFieldReadOnly,
    });

  const setRecordContextMenuFieldEditor = useSetAtomState(
    recordContextMenuFieldEditorState,
  );
  const { openFieldInput } = useOpenFieldInputEditMode();
  const { closeDropdown } = useCloseDropdown();

  const openFieldEditor = (fieldMetadataItem: FieldMetadataItem) => {
    closeDropdown(dropdownId);

    setRecordContextMenuFieldEditor({
      dropdownId,
      recordId,
      objectMetadataItemId: objectMetadataItem.id,
      fieldMetadataItemId: fieldMetadataItem.id,
      position,
    });

    openFieldInput({
      fieldDefinition: formatFieldMetadataItemAsFieldDefinition({
        field: fieldMetadataItem,
        objectMetadataItem,
      }),
      recordId,
      prefix: RECORD_CONTEXT_MENU_FIELD_INPUT_PREFIX,
    });
  };

  return {
    contactFieldMetadataItems,
    editableFieldMetadataItems,
    openFieldEditor,
  };
};
