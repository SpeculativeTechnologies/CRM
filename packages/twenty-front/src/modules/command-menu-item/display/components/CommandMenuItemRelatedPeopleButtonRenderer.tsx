import { CommandMenuContext } from '@/command-menu-item/contexts/CommandMenuContext';
import { interpolateCommandMenuItemFields } from '@/command-menu-item/display/utils/interpolateCommandMenuItemFields';
import { CommandMenuButton } from '@/command-menu/components/CommandMenuButton';
import { ContextStoreComponentInstanceContext } from '@/context-store/states/contexts/ContextStoreComponentInstanceContext';
import { useOpenComposeEmailToRelatedPeoplePickerInSidePanel } from '@/side-panel/hooks/useOpenComposeEmailToRelatedPeoplePickerInSidePanel';
import { useAvailableComponentInstanceIdOrThrow } from '@/ui/utilities/state/component-state/hooks/useAvailableComponentInstanceIdOrThrow';
import { COMMAND_MENU_DEFAULT_ICON } from '@/workflow/workflow-trigger/constants/CommandMenuDefaultIcon';
import { useContext } from 'react';
import { useIcons } from 'twenty-ui/icon';
import { type CommandMenuItemFieldsFragment } from '~/generated-metadata/graphql';

type CommandMenuItemRelatedPeopleButtonRendererProps = {
  item: CommandMenuItemFieldsFragment;
  isPrimaryAction: boolean;
};

export const CommandMenuItemRelatedPeopleButtonRenderer = ({
  item,
  isPrimaryAction,
}: CommandMenuItemRelatedPeopleButtonRendererProps) => {
  const { commandMenuContextApi } = useContext(CommandMenuContext);
  const { getIcon } = useIcons();
  const { openComposeEmailToRelatedPeoplePickerInSidePanel } =
    useOpenComposeEmailToRelatedPeoplePickerInSidePanel();
  const contextStoreInstanceId = useAvailableComponentInstanceIdOrThrow(
    ContextStoreComponentInstanceContext,
  );

  const { iconKey, label, shortLabel } = interpolateCommandMenuItemFields(
    item,
    commandMenuContextApi,
  );

  const Icon = getIcon(iconKey, COMMAND_MENU_DEFAULT_ICON);

  return (
    <CommandMenuButton
      command={{ key: item.id, label, shortLabel, Icon }}
      isPrimaryAction={isPrimaryAction}
      onClick={() =>
        openComposeEmailToRelatedPeoplePickerInSidePanel({
          contextStoreInstanceId,
        })
      }
    />
  );
};
