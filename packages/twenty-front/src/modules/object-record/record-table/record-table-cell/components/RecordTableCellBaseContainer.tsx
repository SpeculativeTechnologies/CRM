import { styled } from '@linaria/react';
import { useContext, type ReactNode } from 'react';

import { FieldContext } from '@/object-record/record-field/ui/contexts/FieldContext';
import { isFieldIdentifierDisplay } from '@/object-record/record-field/ui/meta-types/display/utils/isFieldIdentifierDisplay';
import { RECORD_CHIP_CLICK_OUTSIDE_ID } from '@/object-record/record-table/constants/RecordChipClickOutsideId';
import { RecordTableCellContext } from '@/object-record/record-table/contexts/RecordTableCellContext';
import { useRecordTableContextOrThrow } from '@/object-record/record-table/contexts/RecordTableContext';
import { useOpenRecordTableCellFromCell } from '@/object-record/record-table/record-table-cell/hooks/useOpenRecordTableCellFromCell';
import { recordTableCellRangeComponentState } from '@/object-record/record-table/record-table-cell-range/states/recordTableCellRangeComponentState';
import { isCellInRecordTableCellRangeComponentFamilySelector } from '@/object-record/record-table/record-table-cell-range/states/selectors/isCellInRecordTableCellRangeComponentFamilySelector';
import { getRecordTableCellId } from '@/object-record/record-table/utils/getRecordTableCellId';
import { useAtomComponentFamilySelectorValue } from '@/ui/utilities/state/jotai/hooks/useAtomComponentFamilySelectorValue';
import { useSetAtomComponentState } from '@/ui/utilities/state/jotai/hooks/useSetAtomComponentState';
import { ThemeContext } from 'twenty-ui/theme-constants';

const StyledBaseContainer = styled.div<{
  fontColorMedium: string;
  backgroundColorSecondary: string;
  fontColorSecondary: string;
  isReadOnly: boolean;
  selectedRangeBackgroundColor: string | undefined;
}>`
  align-items: center;
  background-color: ${({ selectedRangeBackgroundColor }) =>
    selectedRangeBackgroundColor ?? 'unset'};
  box-sizing: border-box;
  cursor: ${({ isReadOnly }) => (isReadOnly ? 'default' : 'pointer')};
  display: flex;
  height: 32px;
  position: relative;

  user-select: none;

  @media (hover: hover) {
    &:hover {
      background-color: ${({ isReadOnly, backgroundColorSecondary }) =>
        isReadOnly ? backgroundColorSecondary : 'unset'};
      border-radius: ${({ isReadOnly }) => (isReadOnly ? '0px' : 'unset')};
      color: ${({ isReadOnly, fontColorSecondary }) =>
        isReadOnly ? fontColorSecondary : 'unset'};
      outline: ${({ isReadOnly, fontColorMedium }) =>
        isReadOnly ? `1px solid ${fontColorMedium}` : 'unset'};

      svg {
        color: ${({ isReadOnly, fontColorSecondary }) =>
          isReadOnly ? fontColorSecondary : 'unset'};
      }

      img {
        opacity: ${({ isReadOnly }) => (isReadOnly ? '0.64' : 'unset')};
      }
    }
  }
`;

export const RecordTableCellBaseContainer = ({
  children,
}: {
  children: ReactNode;
}) => {
  const {
    isRecordFieldReadOnly: isReadOnly,
    fieldDefinition,
    isLabelIdentifier,
  } = useContext(FieldContext);
  const { openTableCell } = useOpenRecordTableCellFromCell();
  const { theme } = useContext(ThemeContext);

  const { cellPosition } = useContext(RecordTableCellContext);
  const { recordTableId } = useRecordTableContextOrThrow();

  const setRecordTableCellRange = useSetAtomComponentState(
    recordTableCellRangeComponentState,
    recordTableId,
  );

  const isInSelectedRange = useAtomComponentFamilySelectorValue(
    isCellInRecordTableCellRangeComponentFamilySelector,
    cellPosition,
    recordTableId,
  );

  const isChipDisplay = isFieldIdentifierDisplay(
    fieldDefinition,
    isLabelIdentifier,
  );

  const handleContainerClick = () => {
    setRecordTableCellRange(null);
    openTableCell();
  };

  return (
    <StyledBaseContainer
      onClick={handleContainerClick}
      backgroundColorSecondary={theme.background.secondary}
      fontColorSecondary={theme.font.color.secondary}
      fontColorMedium={theme.border.color.medium}
      isReadOnly={isReadOnly ?? false}
      selectedRangeBackgroundColor={
        isInSelectedRange ? theme.accent.quaternary : undefined
      }
      id={getRecordTableCellId(
        recordTableId,
        cellPosition.column,
        cellPosition.row,
      )}
      data-record-table-col={cellPosition.column}
      data-record-table-row={cellPosition.row}
      data-click-outside-id={
        isChipDisplay ? RECORD_CHIP_CLICK_OUTSIDE_ID : undefined
      }
    >
      {children}
    </StyledBaseContainer>
  );
};
