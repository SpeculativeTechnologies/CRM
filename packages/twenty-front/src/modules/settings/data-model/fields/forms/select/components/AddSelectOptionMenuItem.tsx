import { t } from '@lingui/core/macro';
import { isNonEmptyString } from '@sniptt/guards';
import { useState } from 'react';
import { isDefined } from 'twenty-shared/utils';
import { OverflowingTextWithTooltip } from 'twenty-ui/primitives/typography';
import { IconPlus } from 'twenty-ui/icon';
import { ListItem } from 'twenty-ui/primitives/navigation';

type AddSelectOptionMenuItemProps = {
  name: string;
  onAddSelectOption?: (optionName: string) => void | Promise<unknown>;
};

export const AddSelectOptionMenuItem = ({
  name,
  onAddSelectOption,
}: AddSelectOptionMenuItemProps) => {
  const [isAddingSelectOption, setIsAddingSelectOption] = useState(false);

  const trimmedName = name.trim();
  const showAddOption =
    isNonEmptyString(trimmedName) && isDefined(onAddSelectOption);

  const handleClick = async () => {
    if (!isDefined(onAddSelectOption) || isAddingSelectOption) {
      return;
    }

    setIsAddingSelectOption(true);

    try {
      await onAddSelectOption(trimmedName);
    } finally {
      setIsAddingSelectOption(false);
    }
  };

  if (!showAddOption) {
    return null;
  }

  return (
    <ListItem
      onClick={handleClick}
      disabled={isAddingSelectOption}
      startIcon={<IconPlus />}
    >
      <OverflowingTextWithTooltip
        text={
          isAddingSelectOption
            ? t`Adding "${trimmedName}"...`
            : t`Add "${trimmedName}" to options`
        }
      />
    </ListItem>
  );
};
