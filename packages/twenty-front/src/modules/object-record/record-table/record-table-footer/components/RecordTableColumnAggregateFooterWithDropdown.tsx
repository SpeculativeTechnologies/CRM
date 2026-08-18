import { useDropdownContextCurrentContentId } from '@/dropdown-context-state-management/hooks/useDropdownContextCurrentContentId';
import { useRecordTableContextOrThrow } from '@/object-record/record-table/contexts/RecordTableContext';
import { RecordTableColumnAggregateFooterCellContext } from '@/object-record/record-table/record-table-footer/components/RecordTableColumnAggregateFooterCellContext';
import { RecordTableColumnAggregateFooterDropdownContent } from '@/object-record/record-table/record-table-footer/components/RecordTableColumnAggregateFooterDropdownContent';
import { RecordTableColumnAggregateFooterDropdownContext } from '@/object-record/record-table/record-table-footer/components/RecordTableColumnAggregateFooterDropdownContext';
import { RecordTableColumnAggregateFooterValueCell } from '@/object-record/record-table/record-table-footer/components/RecordTableColumnAggregateFooterValueCell';
import { type RecordTableFooterAggregateContentId } from '@/object-record/record-table/record-table-footer/types/RecordTableFooterAggregateContentId';
import { Dropdown } from '@/ui/layout/dropdown/components/Dropdown';
import { useCloseAnyOpenDropdown } from '@/ui/layout/dropdown/hooks/useCloseAnyOpenDropdown';
import { useOpenDropdown } from '@/ui/layout/dropdown/hooks/useOpenDropdown';
import { isDropdownOpenComponentState } from '@/ui/layout/dropdown/states/isDropdownOpenComponentState';
import { useToggleScrollWrapper } from '@/ui/utilities/scroll/hooks/useToggleScrollWrapper';
import { useAtomComponentStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomComponentStateValue';
import { type MouseEvent, useCallback, useContext } from 'react';

type RecordTableColumnFooterWithDropdownProps = {
  isFirstCell: boolean;
  currentRecordGroupId?: string;
};

export const RecordTableColumnFooterWithDropdown = ({
  currentRecordGroupId,
  isFirstCell,
}: RecordTableColumnFooterWithDropdownProps) => {
  const { currentContentId, handleContentChange, handleResetContent } =
    useDropdownContextCurrentContentId<RecordTableFooterAggregateContentId>();

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
    handleResetContent();
    toggleScrollXWrapper(true);
    toggleScrollYWrapper(true);
  }, [handleResetContent, toggleScrollXWrapper, toggleScrollYWrapper]);

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
    <Dropdown
      onOpen={handleDropdownOpen}
      onClose={handleDropdownClose}
      dropdownId={dropdownId}
      clickableComponent={
        <RecordTableColumnAggregateFooterValueCell
          dropdownId={dropdownId}
          isFirstCell={isFirstCell}
          onContextMenu={handleContextMenu}
        />
      }
      dropdownComponents={
        <RecordTableColumnAggregateFooterDropdownContext.Provider
          value={{
            currentContentId,
            onContentChange: handleContentChange,
            resetContent: handleResetContent,
            dropdownId: dropdownId,
            fieldMetadataId: fieldMetadataId,
            fieldMetadataType: fieldMetadata?.type,
          }}
        >
          <RecordTableColumnAggregateFooterDropdownContent />
        </RecordTableColumnAggregateFooterDropdownContext.Provider>
      }
      dropdownOffset={{ x: -1 }}
      dropdownPlacement="bottom-start"
    />
  );
};
