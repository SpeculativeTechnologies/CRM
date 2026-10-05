import { HeadlessEngineCommandWrapperEffect } from '@/command-menu-item/engine-command/components/HeadlessEngineCommandWrapperEffect';
import { useHeadlessCommandContextApi } from '@/command-menu-item/engine-command/hooks/useHeadlessCommandContextApi';
import { useOpenComposeEmailToRelatedPeoplePickerInSidePanel } from '@/side-panel/hooks/useOpenComposeEmailToRelatedPeoplePickerInSidePanel';

// Reached from the command menu list. The pinned button opens this same picker
// directly; the record index dropdown picks the relation inline.
export const ComposeEmailToRelatedPeopleCommand = () => {
  const { contextStoreInstanceId } = useHeadlessCommandContextApi();

  const { openComposeEmailToRelatedPeoplePickerInSidePanel } =
    useOpenComposeEmailToRelatedPeoplePickerInSidePanel();

  const handleExecute = () => {
    openComposeEmailToRelatedPeoplePickerInSidePanel({
      contextStoreInstanceId,
    });
  };

  return <HeadlessEngineCommandWrapperEffect execute={handleExecute} />;
};
