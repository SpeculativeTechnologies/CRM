import { useRecordTableContextOrThrow } from '@/object-record/record-table/contexts/RecordTableContext';
import { RecordTableColumnAggregateFooterDropdownContext } from '@/object-record/record-table/record-table-footer/components/RecordTableColumnAggregateFooterDropdownContext';
import { useViewFieldAggregateOperation } from '@/object-record/record-table/record-table-footer/hooks/useViewFieldAggregateOperation';
import { AggregateOperations } from '@/object-record/record-table/constants/AggregateOperations';
import { DropdownContent } from '@/ui/layout/dropdown/components/DropdownContent';
import { DropdownMenuHeader } from '@/ui/layout/dropdown/components/DropdownMenuHeader/DropdownMenuHeader';
import { DropdownMenuHeaderLeftComponent } from '@/ui/layout/dropdown/components/DropdownMenuHeader/internal/DropdownMenuHeaderLeftComponent';
import { DropdownMenuItemsContainer } from '@/ui/layout/dropdown/components/DropdownMenuItemsContainer';
import { useCloseDropdown } from '@/ui/layout/dropdown/hooks/useCloseDropdown';
import { useLingui } from '@lingui/react/macro';
import { useContext } from 'react';
import { IconCheck, IconChevronLeft } from 'twenty-ui/icon';
import { MenuItem } from 'twenty-ui/navigation';

export const RecordTableColumnAggregateFooterSelectValueMenuContent = () => {
  const { t } = useLingui();
  const { objectMetadataItem } = useRecordTableContextOrThrow();
  const { fieldMetadataId, dropdownId, onContentChange } = useContext(
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
    <DropdownContent>
      <DropdownMenuHeader
        StartComponent={
          <DropdownMenuHeaderLeftComponent
            onClick={() => onContentChange('countAggregateOperationsOptions')}
            Icon={IconChevronLeft}
          />
        }
      >
        {t`Count by value`}
      </DropdownMenuHeader>
      <DropdownMenuItemsContainer>
        {options.length === 0 ? (
          <MenuItem disabled text={t`No options`} accent="placeholder" />
        ) : (
          options.map((option) => {
            const isSelected =
              currentViewFieldAggregateOperation ===
                AggregateOperations.COUNT &&
              currentViewFieldAggregateValue === option.value;

            return (
              <MenuItem
                key={option.id}
                onClick={async () => {
                  await updateViewFieldAggregateOperation(
                    AggregateOperations.COUNT,
                    option.value,
                  );
                  closeDropdown(dropdownId);
                }}
                text={option.label}
                RightIcon={isSelected ? IconCheck : undefined}
                aria-selected={isSelected}
              />
            );
          })
        )}
      </DropdownMenuItemsContainer>
    </DropdownContent>
  );
};
