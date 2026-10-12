import { RECORD_CONTEXT_MENU_EDIT_FIELD_PAGE_ID } from '@/command-menu-item/constants/RecordContextMenuEditFieldPageId';
import { useRecordContextMenuFields } from '@/command-menu-item/hooks/useRecordContextMenuFields';
import { type RecordContextMenuTarget } from '@/command-menu-item/types/RecordContextMenuTarget';
import { useLingui } from '@lingui/react/macro';
import { Dropdown } from 'twenty-ui/components';
import { IconPencil, useIcons } from 'twenty-ui/icon';

type RecordContextMenuFieldItemsProps = {
  recordContextMenuTarget: RecordContextMenuTarget;
};

export const RecordContextMenuFieldItems = ({
  recordContextMenuTarget,
}: RecordContextMenuFieldItemsProps) => {
  const { t } = useLingui();
  const { contactFieldMetadataItems, openFieldEditor } =
    useRecordContextMenuFields(recordContextMenuTarget);
  const { getIcon } = useIcons();

  return (
    <>
      <Dropdown.Section>
        <Dropdown.ActionItem
          page={RECORD_CONTEXT_MENU_EDIT_FIELD_PAGE_ID}
          hasSubmenu
          startIcon={<IconPencil />}
        >
          {t`Edit field`}
        </Dropdown.ActionItem>
      </Dropdown.Section>
      {contactFieldMetadataItems.length > 0 && (
        <Dropdown.Section label={t`Contact info`}>
          {contactFieldMetadataItems.map((fieldMetadataItem) => {
            const FieldIcon = getIcon(fieldMetadataItem.icon);

            return (
              <Dropdown.ActionItem
                key={fieldMetadataItem.id}
                closeOnClick={false}
                startIcon={<FieldIcon />}
                onClick={() => openFieldEditor(fieldMetadataItem)}
              >
                {fieldMetadataItem.label}
              </Dropdown.ActionItem>
            );
          })}
        </Dropdown.Section>
      )}
      <Dropdown.Separator />
    </>
  );
};
