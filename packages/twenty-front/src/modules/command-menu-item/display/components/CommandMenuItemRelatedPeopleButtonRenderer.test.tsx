import { EMPTY_COMMAND_MENU_CONTEXT_API } from '@/command-menu-item/constants/EmptyCommandMenuContextApi';
import { CommandMenuContext } from '@/command-menu-item/contexts/CommandMenuContext';
import { CommandMenuItemRelatedPeopleButtonRenderer } from '@/command-menu-item/display/components/CommandMenuItemRelatedPeopleButtonRenderer';
import { CommandMenuItemContainerType } from '@/command-menu-item/types/CommandMenuItemContainerType';
import { ContextStoreComponentInstanceContext } from '@/context-store/states/contexts/ContextStoreComponentInstanceContext';
import { fireEvent, render, screen } from '@testing-library/react';
import { type CommandMenuItemFieldsFragment } from '~/generated-metadata/graphql';

const mockOpenRelatedPeoplePicker = jest.fn();

jest.mock(
  '@/side-panel/hooks/useOpenComposeEmailToRelatedPeoplePickerInSidePanel',
  () => ({
    useOpenComposeEmailToRelatedPeoplePickerInSidePanel: () => ({
      openComposeEmailToRelatedPeoplePickerInSidePanel:
        mockOpenRelatedPeoplePicker,
    }),
  }),
);

jest.mock(
  '@/command-menu-item/display/utils/interpolateCommandMenuItemFields',
  () => ({
    interpolateCommandMenuItemFields: () => ({
      iconKey: 'IconMail',
      label: 'Send Email',
      shortLabel: 'Send Email',
    }),
  }),
);

jest.mock('twenty-ui/icon', () => ({
  useIcons: () => ({ getIcon: () => () => null }),
}));

jest.mock('@/command-menu/components/CommandMenuButton', () => ({
  CommandMenuButton: ({ onClick }: { onClick: () => void }) => (
    <button onClick={onClick}>Send Email</button>
  ),
}));

describe('CommandMenuItemRelatedPeopleButtonRenderer', () => {
  it('opens the related-person picker for the selected records context', () => {
    const item = { id: 'send-email' } as CommandMenuItemFieldsFragment;

    render(
      <ContextStoreComponentInstanceContext.Provider
        value={{ instanceId: 'recruitment-selection' }}
      >
        <CommandMenuContext.Provider
          value={{
            commandMenuContextApi: EMPTY_COMMAND_MENU_CONTEXT_API,
            commandMenuItems: [],
            containerType: CommandMenuItemContainerType.CommandMenuList,
            displayType: 'button',
            isInPreviewMode: false,
          }}
        >
          <CommandMenuItemRelatedPeopleButtonRenderer
            item={item}
            isPrimaryAction
          />
        </CommandMenuContext.Provider>
      </ContextStoreComponentInstanceContext.Provider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Send Email' }));

    expect(mockOpenRelatedPeoplePicker).toHaveBeenCalledWith({
      contextStoreInstanceId: 'recruitment-selection',
    });
  });
});
