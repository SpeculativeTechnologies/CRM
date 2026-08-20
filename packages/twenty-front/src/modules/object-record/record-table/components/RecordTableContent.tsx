import { RecordTableColumnWidthEffect } from '@/object-record/record-table/components/RecordTableColumnWidthEffect';
import { RecordTableScrollAndZIndexEffect } from '@/object-record/record-table/components/RecordTableScrollAndZIndexEffect';
import {
  getRecordTableColumnWidthInlineStyles,
  RecordTableStyleWrapper,
} from '@/object-record/record-table/components/RecordTableStyleWrapper';
import { useIsRecordTableCheckboxColumnHidden } from '@/object-record/record-table/hooks/useIsRecordTableCheckboxColumnHidden';
import { isRecordTableDragColumnHiddenComponentState } from '@/object-record/record-table/states/isRecordTableDragColumnHiddenComponentState';
import { RecordTableWidthEffect } from '@/object-record/record-table/components/RecordTableWidthEffect';
import { getRecordTableHtmlId } from '@/object-record/record-table/utils/getRecordTableHtmlId';
import { useRecordTableContextOrThrow } from '@/object-record/record-table/contexts/RecordTableContext';
import { useRecordShowPagePrefetchOnRowHover } from '@/object-record/record-table/hooks/useRecordShowPagePrefetchOnRowHover';
import { RecordTableNoRecordGroupBody } from '@/object-record/record-table/record-table-body/components/RecordTableNoRecordGroupBody';
import { RecordTableRecordGroupsBody } from '@/object-record/record-table/record-table-body/components/RecordTableRecordGroupsBody';
import { RecordTableHeader } from '@/object-record/record-table/record-table-header/components/RecordTableHeader';
import { RecordTableCellRangeHotkeysEffect } from '@/object-record/record-table/record-table-cell-range/components/RecordTableCellRangeHotkeysEffect';
import { RecordTableCellRangeResetOnClickEffect } from '@/object-record/record-table/record-table-cell-range/components/RecordTableCellRangeResetOnClickEffect';
import { useUpdateRecordTableCellRangeFromSelectionBox } from '@/object-record/record-table/record-table-cell-range/hooks/useUpdateRecordTableCellRangeFromSelectionBox';
import { useMoveHoverToCurrentCell } from '@/object-record/record-table/record-table-cell/hooks/useMoveHoverToCurrentCell';
import { recordTableHoverPositionComponentState } from '@/object-record/record-table/states/recordTableHoverPositionComponentState';
import { isSomeCellInEditModeComponentSelector } from '@/object-record/record-table/states/selectors/isSomeCellInEditModeComponentSelector';
import { DragSelect } from '@/ui/utilities/drag-select/components/DragSelect';
import { RECORD_INDEX_DRAG_SELECT_BOUNDARY_CLASS } from '@/ui/utilities/drag-select/constants/RecordIndecDragSelectBoundaryClass';
import { useAtomComponentSelectorCallbackState } from '@/ui/utilities/state/jotai/hooks/useAtomComponentSelectorCallbackState';
import { useAtomComponentStateCallbackState } from '@/ui/utilities/state/jotai/hooks/useAtomComponentStateCallbackState';
import { useAtomComponentStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomComponentStateValue';
import { styled } from '@linaria/react';
import { useStore } from 'jotai';
import { useCallback, useMemo, useRef, useState } from 'react';

const StyledTableContainer = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  position: relative;
  width: fit-content;
`;

export interface RecordTableContentProps {
  tableBodyRef: React.RefObject<HTMLDivElement | null>;
  handleDragSelectionStart: () => void;
  handleDragSelectionEnd: () => void;
  hasRecordGroups: boolean;
  recordTableId: string;
}

export const RecordTableContent = ({
  tableBodyRef,
  handleDragSelectionStart,
  handleDragSelectionEnd,
  hasRecordGroups,
  recordTableId,
}: RecordTableContentProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const {
    updateRecordTableCellRangeFromSelectionBox,
    resetRecordTableAxisBounds,
  } = useUpdateRecordTableCellRangeFromSelectionBox({
    containerRef,
    recordTableId,
  });

  const handleDragStart = () => {
    setIsDragging(true);
    resetRecordTableAxisBounds();
    handleDragSelectionStart();
  };

  const handleDragEnd = () => {
    setIsDragging(false);
    resetRecordTableAxisBounds();

    handleDragSelectionEnd();
  };

  const store = useStore();

  const recordTableScrollWrapperId = `record-table-scroll-${recordTableId}`;

  const { visibleRecordFields } = useRecordTableContextOrThrow();

  const recordTableHoverPositionCallbackState =
    useAtomComponentStateCallbackState(
      recordTableHoverPositionComponentState,
      recordTableId,
    );

  const isSomeCellInEditMode = useAtomComponentSelectorCallbackState(
    isSomeCellInEditModeComponentSelector,
    recordTableId,
  );

  const { handleRowHoverPrefetch, cancelPendingRowHoverPrefetch } =
    useRecordShowPagePrefetchOnRowHover();

  const handleMouseLeave = useCallback(() => {
    cancelPendingRowHoverPrefetch();

    const cellInEditMode = store.get(isSomeCellInEditMode);

    if (!cellInEditMode) {
      store.set(recordTableHoverPositionCallbackState, null);
    }
  }, [
    cancelPendingRowHoverPrefetch,
    store,
    isSomeCellInEditMode,
    recordTableHoverPositionCallbackState,
  ]);

  const { moveHoverToCurrentCell } = useMoveHoverToCurrentCell(recordTableId);

  const handleDelegatedMouseMove = useCallback(
    (event: React.MouseEvent) => {
      handleRowHoverPrefetch(event);

      const target = event.target as HTMLElement;
      const cellElement = target.closest<HTMLElement>(
        '[data-record-table-col]',
      );

      if (!cellElement) {
        return;
      }

      const column = Number(cellElement.dataset.recordTableCol);
      const row = Number(cellElement.dataset.recordTableRow);

      if (isNaN(column) || isNaN(row)) {
        return;
      }

      moveHoverToCurrentCell({ column, row });
    },
    [handleRowHoverPrefetch, moveHoverToCurrentCell],
  );

  const isRecordTableDragColumnHidden = useAtomComponentStateValue(
    isRecordTableDragColumnHiddenComponentState,
  );

  const isRecordTableCheckboxColumnHidden =
    useIsRecordTableCheckboxColumnHidden();

  const columnWidthStyles = useMemo(
    () =>
      getRecordTableColumnWidthInlineStyles({
        visibleRecordFields,
        isDragColumnHidden: isRecordTableDragColumnHidden,
        isCheckboxColumnHidden: isRecordTableCheckboxColumnHidden,
      }),
    [
      visibleRecordFields,
      isRecordTableDragColumnHidden,
      isRecordTableCheckboxColumnHidden,
    ],
  );

  return (
    <StyledTableContainer ref={containerRef}>
      <RecordTableStyleWrapper
        ref={tableBodyRef}
        isDragging={isDragging}
        style={columnWidthStyles}
        id={getRecordTableHtmlId(recordTableId)}
        onMouseMove={handleDelegatedMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        <RecordTableHeader />
        {hasRecordGroups ? (
          <RecordTableRecordGroupsBody />
        ) : (
          <RecordTableNoRecordGroupBody />
        )}
        <RecordTableScrollAndZIndexEffect />
        <RecordTableColumnWidthEffect />
        <RecordTableWidthEffect />
      </RecordTableStyleWrapper>
      <RecordTableCellRangeHotkeysEffect containerRef={containerRef} />
      <RecordTableCellRangeResetOnClickEffect />
      <DragSelect
        selectableItemsContainerRef={containerRef}
        onDragSelectionStart={handleDragStart}
        onDragSelectionBoxChange={updateRecordTableCellRangeFromSelectionBox}
        onDragSelectionEnd={handleDragEnd}
        scrollWrapperComponentInstanceId={recordTableScrollWrapperId}
        selectionBoundaryClass={RECORD_INDEX_DRAG_SELECT_BOUNDARY_CLASS}
      />
    </StyledTableContainer>
  );
};
