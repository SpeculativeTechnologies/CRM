import { useRecordTableContextOrThrow } from '@/object-record/record-table/contexts/RecordTableContext';
import { RecordTableColumnAggregateFooterDropdownContext } from '@/object-record/record-table/record-table-footer/components/RecordTableColumnAggregateFooterDropdownContext';
import { useViewFieldAggregateOperation } from '@/object-record/record-table/record-table-footer/hooks/useViewFieldAggregateOperation';
import { AggregateOperations } from '@/object-record/record-table/constants/AggregateOperations';
import { useCloseDropdown } from '@/ui/layout/dropdown/hooks/useCloseDropdown';
import { useLingui } from '@lingui/react/macro';
import { useContext } from 'react';
import { Dropdown } from 'twenty-ui/components';

export const RecordTableColumnAggregateFooterSelectValueMenuContent = () => {
  const { t } = useLingui();
  const { objectMetadataItem } = useRecordTableContextOrThrow();
  const { fieldMetadataId, dropdownId } = useContext(
    RecordTableColumnAggregateFooterDropdownContext,
  );
  const { closeDropdown } = useCloseDropdown();
  const {
    updateViewFieldAggregateOperation,
    currentViewFieldAggregateOperation,
    currentViewFieldAggregateValue,
  } = useViewFieldAggregateOperation();

  const options =
    objectMetadataItem.fields.find((field) => field.id === fieldMetadataId)
      ?.options ?? [];

  return (
    <>
      <Dropdown.Back>{t`Count by value`}</Dropdown.Back>
      <Dropdown.Section>
        {options.length === 0 ? (
          <Dropdown.OptionItem disabled selected={false}>
            {t`No options`}
          </Dropdown.OptionItem>
        ) : (
          options.map((option) => {
            const isSelected =
              currentViewFieldAggregateOperation ===
                AggregateOperations.COUNT &&
              currentViewFieldAggregateValue === option.value;

            return (
              <Dropdown.OptionItem
                key={option.id}
                closeOnSelect={false}
                onSelect={async () => {
                  await updateViewFieldAggregateOperation(
                    AggregateOperations.COUNT,
                    option.value,
                  );
                  closeDropdown(dropdownId);
                }}
                selected={isSelected}
              >
                {option.label}
              </Dropdown.OptionItem>
            );
          })
        )}
      </Dropdown.Section>
    </>
  );
};
