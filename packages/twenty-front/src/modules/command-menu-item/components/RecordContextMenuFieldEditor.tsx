import { RECORD_CONTEXT_MENU_FIELD_INPUT_PREFIX } from '@/command-menu-item/constants/RecordContextMenuFieldInputPrefix';
import {
  type RecordContextMenuFieldEditor as RecordContextMenuFieldEditorType,
  recordContextMenuFieldEditorState,
} from '@/command-menu-item/states/recordContextMenuFieldEditorState';
import { useObjectMetadataItems } from '@/object-metadata/hooks/useObjectMetadataItems';
import { formatFieldMetadataItemAsFieldDefinition } from '@/object-metadata/utils/formatFieldMetadataItemAsFieldDefinition';
import { FieldInput } from '@/object-record/record-field/ui/components/FieldInput';
import { FieldInputEventContextProvider } from '@/object-record/record-field/ui/components/FieldInputEventContextProvider';
import { useOpenFieldInputEditMode } from '@/object-record/record-field/ui/hooks/useOpenFieldInputEditMode';
import { RecordInlineCellAnchoredPortal } from '@/object-record/record-inline-cell/components/RecordInlineCellAnchoredPortal';
import { RecordInlineCellEditMode } from '@/object-record/record-inline-cell/components/RecordInlineCellEditMode';
import { getRecordFieldInputInstanceId } from '@/object-record/utils/getRecordFieldInputId';
import { useAtomState } from '@/ui/utilities/state/jotai/hooks/useAtomState';
import { styled } from '@linaria/react';
import { useState } from 'react';
import { isDefined } from 'twenty-shared/utils';

const StyledAnchor = styled.div`
  height: 24px;
  pointer-events: none;
  position: fixed;
  width: 240px;
`;

type RecordContextMenuFieldEditorProps = {
  dropdownId: string;
};

// Edits one field of the right-clicked record in a popover at the cursor, so
// the field does not need a visible column or an open record page.
export const RecordContextMenuFieldEditor = ({
  dropdownId,
}: RecordContextMenuFieldEditorProps) => {
  const [recordContextMenuFieldEditor, setRecordContextMenuFieldEditor] =
    useAtomState(recordContextMenuFieldEditorState);

  if (
    !isDefined(recordContextMenuFieldEditor) ||
    recordContextMenuFieldEditor.dropdownId !== dropdownId
  ) {
    return null;
  }

  return (
    <RecordContextMenuFieldEditorPopover
      key={`${recordContextMenuFieldEditor.recordId}-${recordContextMenuFieldEditor.fieldMetadataItemId}`}
      editor={recordContextMenuFieldEditor}
      onClose={() => setRecordContextMenuFieldEditor(null)}
    />
  );
};

type RecordContextMenuFieldEditorPopoverProps = {
  editor: RecordContextMenuFieldEditorType;
  onClose: () => void;
};

const RecordContextMenuFieldEditorPopover = ({
  editor,
  onClose,
}: RecordContextMenuFieldEditorPopoverProps) => {
  const { objectMetadataItems } = useObjectMetadataItems();
  const { closeFieldInput } = useOpenFieldInputEditMode();
  const [anchorElement, setAnchorElement] = useState<HTMLDivElement | null>(
    null,
  );

  const objectMetadataItem = objectMetadataItems.find(
    (item) => item.id === editor.objectMetadataItemId,
  );

  const fieldMetadataItem = objectMetadataItem?.fields.find(
    (field) => field.id === editor.fieldMetadataItemId,
  );

  if (!isDefined(objectMetadataItem) || !isDefined(fieldMetadataItem)) {
    return null;
  }

  const handleClose = () => {
    closeFieldInput({
      fieldDefinition: formatFieldMetadataItemAsFieldDefinition({
        field: fieldMetadataItem,
        objectMetadataItem,
      }),
      recordId: editor.recordId,
      prefix: RECORD_CONTEXT_MENU_FIELD_INPUT_PREFIX,
    });
    onClose();
  };

  return (
    <>
      <StyledAnchor
        ref={setAnchorElement}
        id={getRecordFieldInputInstanceId({
          recordId: editor.recordId,
          fieldName: fieldMetadataItem.name,
          prefix: RECORD_CONTEXT_MENU_FIELD_INPUT_PREFIX,
        })}
        style={{
          left: editor.position.x ?? 0,
          top: editor.position.y ?? 0,
        }}
      />
      {isDefined(anchorElement) && (
        <RecordInlineCellAnchoredPortal
          fieldMetadataItem={fieldMetadataItem}
          objectMetadataItem={objectMetadataItem}
          recordId={editor.recordId}
          instanceIdPrefix={RECORD_CONTEXT_MENU_FIELD_INPUT_PREFIX}
        >
          <FieldInputEventContextProvider onClose={handleClose}>
            <RecordInlineCellEditMode>
              <FieldInput />
            </RecordInlineCellEditMode>
          </FieldInputEventContextProvider>
        </RecordInlineCellAnchoredPortal>
      )}
    </>
  );
};
