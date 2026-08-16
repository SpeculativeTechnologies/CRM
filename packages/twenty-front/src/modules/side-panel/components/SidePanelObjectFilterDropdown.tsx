import { useLingui } from '@lingui/react/macro';
import { IconFilter } from 'twenty-ui/icon';
import { IconButton } from 'twenty-ui/input';

import { SidePanelObjectFilterDropdownContent } from '@/side-panel/components/SidePanelObjectFilterDropdownContent';
import { Dropdown } from '@/ui/layout/dropdown/components/Dropdown';

export const OBJECT_FILTER_DROPDOWN_ID = 'side-panel-object-filter-dropdown';

type SidePanelObjectFilterDropdownProps = {
  selectedObjectNameSingulars: string[];
  onChangeSelectedObjects: (objectNameSingulars: string[]) => void;
};

export const SidePanelObjectFilterDropdown = ({
  selectedObjectNameSingulars,
  onChangeSelectedObjects,
}: SidePanelObjectFilterDropdownProps) => {
  const { t } = useLingui();
  const isFilterActive = selectedObjectNameSingulars.length > 0;

  return (
    <Dropdown
      dropdownId={OBJECT_FILTER_DROPDOWN_ID}
      dropdownPlacement="bottom-end"
      clickableComponent={
        <IconButton
          Icon={IconFilter}
          variant="tertiary"
          accent={isFilterActive ? 'blue' : 'default'}
          size="small"
          ariaLabel={t`Filter by object type`}
        />
      }
      dropdownComponents={
        <SidePanelObjectFilterDropdownContent
          selectedObjectNameSingulars={selectedObjectNameSingulars}
          onChangeSelectedObjects={onChangeSelectedObjects}
        />
      }
    />
  );
};
