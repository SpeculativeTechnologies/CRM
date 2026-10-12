import { RelatedPersonRelationList } from '@/activities/emails/related-people/components/RelatedPersonRelationList';
import { COMMAND_MENU_DROPDOWN_CLICK_OUTSIDE_ID } from '@/command-menu-item/constants/CommandMenuDropdownClickOutsideId';
import { RecordContextMenuEditFieldPage } from '@/command-menu-item/components/RecordContextMenuEditFieldPage';
import { RecordContextMenuFieldEditor } from '@/command-menu-item/components/RecordContextMenuFieldEditor';
import { RecordContextMenuFieldItems } from '@/command-menu-item/components/RecordContextMenuFieldItems';
import { RECORD_CONTEXT_MENU_EDIT_FIELD_PAGE_ID } from '@/command-menu-item/constants/RecordContextMenuEditFieldPageId';
import { CommandMenuContext } from '@/command-menu-item/contexts/CommandMenuContext';
import { CommandMenuItemRenderer } from '@/command-menu-item/display/components/CommandMenuItemRenderer';
import { recordIndexCommandMenuDropdownPositionComponentState } from '@/command-menu-item/states/recordIndexCommandMenuDropdownPositionComponentState';
import { createVirtualElementFromPosition } from '@/command-menu-item/utils/createVirtualElementFromPosition';
import { getCommandMenuDropdownIdFromCommandMenuId } from '@/command-menu-item/utils/getCommandMenuDropdownIdFromCommandMenuId';
import { CommandMenuComponentInstanceContext } from '@/command-menu/states/contexts/CommandMenuComponentInstanceContext';
import { useContextStoreObjectMetadataItem } from '@/context-store/hooks/useContextStoreObjectMetadataItem';
import { contextStoreTargetedRecordsRuleComponentState } from '@/context-store/states/contextStoreTargetedRecordsRuleComponentState';
import { useSidePanelMenu } from '@/side-panel/hooks/useSidePanelMenu';
import { DropdownContent } from '@/ui/layout/dropdown/components/DropdownContent';
import { DropdownRoot } from '@/ui/layout/dropdown/components/DropdownRoot';
import { useCloseDropdown } from '@/ui/layout/dropdown/hooks/useCloseDropdown';
import { useWorkspaceSurface } from '@/ui/layout/hooks/useWorkspaceSurface';
import { useAvailableComponentInstanceIdOrThrow } from '@/ui/utilities/state/component-state/hooks/useAvailableComponentInstanceIdOrThrow';
import { useAtomComponentStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomComponentStateValue';
import { useLingui } from '@lingui/react/macro';
import { useContext } from 'react';
import { isDefined } from 'twenty-shared/utils';
import { Dropdown } from 'twenty-ui/components';
import { IconLayoutSidebarRightExpand } from 'twenty-ui/icon';
import { CommandMenuItemAvailabilityType } from '~/generated-metadata/graphql';

export const RecordIndexCommandMenuDropdown = () => {
  const { t } = useLingui();
  const { commandMenuItems } = useContext(CommandMenuContext);
  const workspaceSurface = useWorkspaceSurface();
  const shouldShowMoreActions = workspaceSurface.type === 'main';

  const recordIndexCommandMenuItems = commandMenuItems.filter(
    (item) =>
      item.availabilityType ===
      CommandMenuItemAvailabilityType.RECORD_SELECTION,
  );

  const commandMenuId = useAvailableComponentInstanceIdOrThrow(
    CommandMenuComponentInstanceContext,
  );

  const dropdownId = getCommandMenuDropdownIdFromCommandMenuId(commandMenuId);

  const recordIndexCommandMenuDropdownPosition = useAtomComponentStateValue(
    recordIndexCommandMenuDropdownPositionComponentState,
    dropdownId,
  );

  const { openSidePanelMenu } = useSidePanelMenu();
  const { closeDropdown } = useCloseDropdown();

  const relatedPeopleSelectableListInstanceId = `${dropdownId}-related-people`;

  const contextStoreTargetedRecordsRule = useAtomComponentStateValue(
    contextStoreTargetedRecordsRuleComponentState,
  );
  const { objectMetadataItem } = useContextStoreObjectMetadataItem();

  // Field editing only makes sense for one record; a multi-row selection keeps
  // the bulk actions alone.
  const targetedRecordId =
    contextStoreTargetedRecordsRule.mode === 'selection' &&
    contextStoreTargetedRecordsRule.selectedRecordIds.length === 1
      ? contextStoreTargetedRecordsRule.selectedRecordIds[0]
      : undefined;

  const recordContextMenuTarget =
    isDefined(targetedRecordId) && isDefined(objectMetadataItem)
      ? {
          dropdownId,
          objectMetadataItem,
          recordId: targetedRecordId,
          position: recordIndexCommandMenuDropdownPosition,
        }
      : undefined;

  return (
    <>
      <DropdownRoot dropdownId={dropdownId} type="menu">
        <DropdownContent
          anchor={createVirtualElementFromPosition(
            recordIndexCommandMenuDropdownPosition,
          )}
          aria-label={t`Actions`}
        >
          <Dropdown.Page id="root">
            {isDefined(recordContextMenuTarget) && (
              <RecordContextMenuFieldItems
                recordContextMenuTarget={recordContextMenuTarget}
              />
            )}
            <Dropdown.Section
              data-click-outside-id={COMMAND_MENU_DROPDOWN_CLICK_OUTSIDE_ID}
            >
              {recordIndexCommandMenuItems.map((item) => (
                <CommandMenuItemRenderer item={item} key={item.id} />
              ))}
              {shouldShowMoreActions && (
                <Dropdown.ActionItem
                  startIcon={<IconLayoutSidebarRightExpand />}
                  onClick={() => openSidePanelMenu()}
                >
                  {t`More actions`}
                </Dropdown.ActionItem>
              )}
            </Dropdown.Section>
          </Dropdown.Page>
          {/* Choosing which relation to email through happens in a submenu page */}
          <Dropdown.Page id="related-people">
            <Dropdown.Back>{t`Send Email`}</Dropdown.Back>
            <Dropdown.Section>
              <RelatedPersonRelationList
                selectableListInstanceId={relatedPeopleSelectableListInstanceId}
                onComposed={() => {
                  closeDropdown(dropdownId);
                }}
              />
            </Dropdown.Section>
          </Dropdown.Page>
          <Dropdown.Page id={RECORD_CONTEXT_MENU_EDIT_FIELD_PAGE_ID}>
            {isDefined(recordContextMenuTarget) && (
              <RecordContextMenuEditFieldPage
                recordContextMenuTarget={recordContextMenuTarget}
              />
            )}
          </Dropdown.Page>
        </DropdownContent>
      </DropdownRoot>
      <RecordContextMenuFieldEditor dropdownId={dropdownId} />
    </>
  );
};
