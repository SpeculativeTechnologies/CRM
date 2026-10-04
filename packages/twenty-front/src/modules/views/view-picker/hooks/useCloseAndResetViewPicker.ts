import { useCallback } from 'react';

import { useCloseDropdown } from '@/ui/layout/dropdown/hooks/useCloseDropdown';
import { useSetAtomComponentState } from '@/ui/utilities/state/jotai/hooks/useSetAtomComponentState';
import { useRecordIndexContextOrThrow } from '@/object-record/record-index/contexts/RecordIndexContext';
import { getViewPickerDropdownId } from '@/views/view-picker/utils/getViewPickerDropdownId';
import { viewPickerIsPersistingComponentState } from '@/views/view-picker/states/viewPickerIsPersistingComponentState';
import { viewPickerModeComponentState } from '@/views/view-picker/states/viewPickerModeComponentState';
import { viewPickerParentViewIdComponentState } from '@/views/view-picker/states/viewPickerParentViewIdComponentState';

export const useCloseAndResetViewPicker = () => {
  const setViewPickerMode = useSetAtomComponentState(
    viewPickerModeComponentState,
  );

  const setViewPickerIsPersisting = useSetAtomComponentState(
    viewPickerIsPersistingComponentState,
  );

  const setViewPickerParentViewId = useSetAtomComponentState(
    viewPickerParentViewIdComponentState,
  );

  const { closeDropdown } = useCloseDropdown();
  const { recordIndexId } = useRecordIndexContextOrThrow();

  const closeAndResetViewPicker = useCallback(() => {
    const viewPickerDropdownId = getViewPickerDropdownId(recordIndexId);

    setViewPickerIsPersisting(false);
    setViewPickerMode('list');
    setViewPickerParentViewId('');
    closeDropdown(`${viewPickerDropdownId}-calendar-field`);
    closeDropdown(`${viewPickerDropdownId}-kanban-field`);
    closeDropdown(`${viewPickerDropdownId}-view-type`);
    closeDropdown(viewPickerDropdownId);
  }, [
    closeDropdown,
    recordIndexId,
    setViewPickerIsPersisting,
    setViewPickerMode,
    setViewPickerParentViewId,
  ]);

  return { closeAndResetViewPicker };
};
