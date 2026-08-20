import { useGetFieldDisplayLabelText } from '@/object-record/record-field/ui/hooks/useGetFieldDisplayLabelText';
import { recordIndexAllRecordIdsComponentSelector } from '@/object-record/record-index/states/selectors/recordIndexAllRecordIdsComponentSelector';
import { recordStoreFamilyState } from '@/object-record/record-store/states/recordStoreFamilyState';
import { useRecordIndexContextOrThrow } from '@/object-record/record-index/contexts/RecordIndexContext';
import { useRecordTableContextOrThrow } from '@/object-record/record-table/contexts/RecordTableContext';
import { recordTableCellRangeComponentState } from '@/object-record/record-table/record-table-cell-range/states/recordTableCellRangeComponentState';
import { formatRecordTableCellRangeAsText } from '@/object-record/record-table/record-table-cell-range/utils/formatRecordTableCellRangeAsText';
import { useAtomComponentStateCallbackState } from '@/ui/utilities/state/jotai/hooks/useAtomComponentStateCallbackState';
import { useAtomComponentSelectorCallbackState } from '@/ui/utilities/state/jotai/hooks/useAtomComponentSelectorCallbackState';
import { isNonEmptyString } from '@sniptt/guards';
import { useStore } from 'jotai';
import { useCallback } from 'react';
import { isDefined } from 'twenty-shared/utils';
import { useCopyToClipboard } from '~/hooks/useCopyToClipboard';

export const useCopyRecordTableCellRange = () => {
  const { recordTableId, visibleRecordFields } = useRecordTableContextOrThrow();
  const { fieldDefinitionByFieldMetadataItemId } =
    useRecordIndexContextOrThrow();

  const recordTableCellRange = useAtomComponentStateCallbackState(
    recordTableCellRangeComponentState,
    recordTableId,
  );

  const recordIndexAllRecordIds = useAtomComponentSelectorCallbackState(
    recordIndexAllRecordIdsComponentSelector,
    recordTableId,
  );

  const { getFieldDisplayLabelText } = useGetFieldDisplayLabelText();
  const { copyToClipboard } = useCopyToClipboard();
  const store = useStore();

  const copyRecordTableCellRange = useCallback(() => {
    const cellRange = store.get(recordTableCellRange);

    if (!isDefined(cellRange)) {
      return false;
    }

    const allRecordIds = store.get(recordIndexAllRecordIds);

    const rows: string[][] = [];

    for (let row = cellRange.fromRow; row <= cellRange.toRow; row++) {
      const recordId = allRecordIds[row];

      if (!isNonEmptyString(recordId)) {
        continue;
      }

      const record = store.get(recordStoreFamilyState.atomFamily(recordId));

      const cells: string[] = [];

      for (
        let column = cellRange.fromColumn;
        column <= cellRange.toColumn;
        column++
      ) {
        const recordField = visibleRecordFields[column];

        const fieldDefinition = isDefined(recordField)
          ? fieldDefinitionByFieldMetadataItemId[
              recordField.fieldMetadataItemId
            ]
          : undefined;

        if (!isDefined(record) || !isDefined(fieldDefinition)) {
          cells.push('');
          continue;
        }

        cells.push(
          getFieldDisplayLabelText({
            fieldDefinition,
            fieldValue: record[fieldDefinition.metadata.fieldName],
          }),
        );
      }

      rows.push(cells);
    }

    const text = formatRecordTableCellRangeAsText(rows);

    if (!isNonEmptyString(text)) {
      return false;
    }

    copyToClipboard(text);

    return true;
  }, [
    copyToClipboard,
    fieldDefinitionByFieldMetadataItemId,
    getFieldDisplayLabelText,
    recordIndexAllRecordIds,
    recordTableCellRange,
    store,
    visibleRecordFields,
  ]);

  return { copyRecordTableCellRange };
};
