import { useRecordContextMenuFields } from '@/command-menu-item/hooks/useRecordContextMenuFields';
import { type RecordContextMenuTarget } from '@/command-menu-item/types/RecordContextMenuTarget';
import { useLingui } from '@lingui/react/macro';
import { useState } from 'react';
import { Dropdown } from 'twenty-ui/components';
import { useIcons } from 'twenty-ui/icon';

type RecordContextMenuEditFieldPageProps = {
  recordContextMenuTarget: RecordContextMenuTarget;
};

export const RecordContextMenuEditFieldPage = ({
  recordContextMenuTarget,
}: RecordContextMenuEditFieldPageProps) => {
  const { t } = useLingui();
  const { editableFieldMetadataItems, openFieldEditor } =
    useRecordContextMenuFields(recordContextMenuTarget);
  const { getIcon } = useIcons();
  const [searchInput, setSearchInput] = useState('');

  const normalizedSearchInput = searchInput.trim().toLocaleLowerCase();

  const filteredFieldMetadataItems = editableFieldMetadataItems.filter(
    (fieldMetadataItem) =>
      fieldMetadataItem.label
        .toLocaleLowerCase()
        .includes(normalizedSearchInput),
  );

  return (
    <>
      <Dropdown.Back>{t`Edit field`}</Dropdown.Back>
      <Dropdown.Search
        value={searchInput}
        placeholder={t`Search fields`}
        aria-label={t`Search fields`}
        onValueChange={setSearchInput}
      />
      <Dropdown.Section scrollable>
        {filteredFieldMetadataItems.length === 0 ? (
          <Dropdown.Empty>{t`No results`}</Dropdown.Empty>
        ) : (
          filteredFieldMetadataItems.map((fieldMetadataItem) => {
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
          })
        )}
      </Dropdown.Section>
    </>
  );
};
