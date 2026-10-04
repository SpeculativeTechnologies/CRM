import { useRecordTableContextOrThrow } from '@/object-record/record-table/contexts/RecordTableContext';
import { RecordTableColumnAggregateFooterCellContext } from '@/object-record/record-table/record-table-footer/components/RecordTableColumnAggregateFooterCellContext';
import { RecordTableColumnAggregateFooterDropdownContent } from '@/object-record/record-table/record-table-footer/components/RecordTableColumnAggregateFooterDropdownContent';
import { RecordTableColumnAggregateFooterDropdownContext } from '@/object-record/record-table/record-table-footer/components/RecordTableColumnAggregateFooterDropdownContext';
import { RecordTableColumnAggregateFooterValueCell } from '@/object-record/record-table/record-table-footer/components/RecordTableColumnAggregateFooterValueCell';
import { DropdownContent } from '@/ui/layout/dropdown/components/DropdownContent';
import { DropdownRoot } from '@/ui/layout/dropdown/components/DropdownRoot';
import { useCloseAnyOpenDropdown } from '@/ui/layout/dropdown/hooks/useCloseAnyOpenDropdown';
import { useOpenDropdown } from '@/ui/layout/dropdown/hooks/useOpenDropdown';
import { isDropdownOpenComponentState } from '@/ui/layout/dropdown/states/isDropdownOpenComponentState';
import { useToggleScrollWrapper } from '@/ui/utilities/scroll/hooks/useToggleScrollWrapper';
import { useAtomComponentStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomComponentStateValue';
import { type MouseEvent, useCallback, useContext } from 'react';
import { Dropdown } from 'twenty-ui/components';

type RecordTableColumnFooterWithDropdownProps = {
  isFirstCell: boolean;
  currentRecordGroupId?: string;
};

export const RecordTableColumnFooterWithDropdown = ({
  currentRecordGroupId,
  isFirstCell,
}: RecordTableColumnFooterWithDropdownProps) => {
  const { fieldMetadataId } = useContext(
    RecordTableColumnAggregateFooterCellContext,
  );

  const { objectMetadataItem } = useRecordTableContextOrThrow();

  const fieldMetadata = objectMetadataItem.fields.find(
    (field) => field.id === fieldMetadataId,
  );

  const { toggleScrollXWrapper, toggleScrollYWrapper } =
    useToggleScrollWrapper();

  const dropdownId = currentRecordGroupId
    ? `${fieldMetadataId}-footer-${currentRecordGroupId}`
    : `${fieldMetadataId}-footer`;

  const isDropdownOpen = useAtomComponentStateValue(
    isDropdownOpenComponentState,
    dropdownId,
  );

  const { openDropdown } = useOpenDropdown();
  const { closeAnyOpenDropdown } = useCloseAnyOpenDropdown();

  const handleDropdownOpen = useCallback(() => {
    toggleScrollXWrapper(false);
    toggleScrollYWrapper(false);
  }, [toggleScrollXWrapper, toggleScrollYWrapper]);

  const handleDropdownClose = useCallback(() => {
    toggleScrollXWrapper(true);
    toggleScrollYWrapper(true);
  }, [toggleScrollXWrapper, toggleScrollYWrapper]);

  // Right click does not emit a click event, so the click outside listener
  // cannot close the dropdowns that are already open
  const handleContextMenu = useCallback(
    (event: MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();

      const wasDropdownOpen = isDropdownOpen;

      closeAnyOpenDropdown();

      if (!wasDropdownOpen) {
        openDropdown({ dropdownComponentInstanceIdFromProps: dropdownId });
      }
    },
    [closeAnyOpenDropdown, dropdownId, isDropdownOpen, openDropdown],
  );

  return (
    <DropdownRoot
      dropdownId={dropdownId}
      type="picker"
      onOpenChange={(open) => {
        if (open) {
          handleDropdownOpen();
          return;
        }
        handleDropdownClose();
      }}
    >
      <Dropdown.Trigger render={<div />} nativeButton={false}>
        <RecordTableColumnAggregateFooterValueCell
          dropdownId={dropdownId}
          isFirstCell={isFirstCell}
          onContextMenu={handleContextMenu}
        />
      </Dropdown.Trigger>
      <DropdownContent align="start" alignOffset={-1}>
        <RecordTableColumnAggregateFooterDropdownContext.Provider
          value={{
            dropdownId,
            fieldMetadataId,
            fieldMetadataType: fieldMetadata?.type,
          }}
        >
          <RecordTableColumnAggregateFooterDropdownContent />
        </RecordTableColumnAggregateFooterDropdownContext.Provider>
      </DropdownContent>
    </DropdownRoot>
  );
};
