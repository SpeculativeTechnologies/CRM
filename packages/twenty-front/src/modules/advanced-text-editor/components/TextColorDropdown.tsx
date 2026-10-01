import { BubbleMenuIconButton } from '@/advanced-text-editor/components/BubbleMenuIconButton';
import { TEXT_COLOR_LABELS } from '@/advanced-text-editor/constants/TextColorLabels';
import {
  TEXT_COLOR_NAMES,
  type TextColorName,
} from '@/advanced-text-editor/constants/TextColorNames';
import { Dropdown } from '@/ui/layout/dropdown/components/Dropdown';
import { DropdownContent } from '@/ui/layout/dropdown/components/DropdownContent';
import { DropdownMenuItemsContainer } from '@/ui/layout/dropdown/components/DropdownMenuItemsContainer';
import { DropdownMenuSeparator } from '@/ui/layout/dropdown/components/DropdownMenuSeparator';
import { useToggleDropdown } from '@/ui/layout/dropdown/hooks/useToggleDropdown';
import { useLingui } from '@lingui/react/macro';
import { type Editor } from '@tiptap/react';
import { useId } from 'react';
import { IconCircleOff, IconColorSwatch } from 'twenty-ui/icon';
import { type ColorLabels, DEFAULT_COLOR_LABELS } from 'twenty-ui/components';
import { ColorSample } from 'twenty-ui/primitives/data-display';
import { ListItem } from 'twenty-ui/primitives/navigation';
import { useTheme } from 'twenty-ui/theme';

type TextColorDropdownProps = {
  editor: Editor;
  activeColor: TextColorName | undefined;
};

export const TextColorDropdown = ({
  editor,
  activeColor,
}: TextColorDropdownProps) => {
  const theme = useTheme();
  const { t, i18n } = useLingui();
  const instanceId = useId();
  const dropdownId = `text-color-dropdown-${instanceId}`;
  const { toggleDropdown } = useToggleDropdown();

  // MenuItemSelectColor labels every theme colour, so the translated names of
  // the offered swatches are layered over the untranslated defaults.
  const colorLabels: ColorLabels = {
    ...DEFAULT_COLOR_LABELS,
    ...Object.fromEntries(
      TEXT_COLOR_NAMES.map((colorName) => [
        colorName,
        i18n._(TEXT_COLOR_LABELS[colorName]),
      ]),
    ),
  };

  const closeDropdown = () =>
    toggleDropdown({ dropdownComponentInstanceIdFromProps: dropdownId });

  return (
    <Dropdown
      dropdownId={dropdownId}
      clickableComponent={
        <BubbleMenuIconButton
          label={t`Text color`}
          Icon={IconColorSwatch}
          isActive={activeColor !== undefined}
        />
      }
      dropdownComponents={
        <DropdownContent>
          <DropdownMenuItemsContainer>
            <ListItem
              startIcon={<IconCircleOff />}
              selected={activeColor === undefined}
              indicator="check"
              onClick={() => {
                editor.chain().focus().unsetTextColor().run();
                closeDropdown();
              }}
            >
              {t`Default`}
            </ListItem>
          </DropdownMenuItemsContainer>
          <DropdownMenuSeparator />
          <DropdownMenuItemsContainer hasMaxHeight>
            {TEXT_COLOR_NAMES.map((colorName) => (
              <ListItem
                key={colorName}
                startIcon={<ColorSample colorName={colorName} />}
                selected={colorName === activeColor}
                indicator="check"
                onClick={() => {
                  editor.chain().focus().setTextColor(colorName).run();
                  closeDropdown();
                }}
              >
                {colorLabels[colorName]}
              </ListItem>
            ))}
          </DropdownMenuItemsContainer>
        </DropdownContent>
      }
      dropdownOffset={{ y: parseInt(theme.spacing[1], 10) }}
    />
  );
};
