import { useLingui } from '@lingui/react/macro';
import { Dropdown, IconButton } from 'twenty-ui/components';
import { IconFilter } from 'twenty-ui/icon';

import { SidePanelObjectFilterDropdownContent } from '@/side-panel/components/SidePanelObjectFilterDropdownContent';
import { DropdownRoot } from '@/ui/layout/dropdown/components/DropdownRoot';
import { DropdownContent } from '@/ui/layout/dropdown/components/DropdownContent';

const OBJECT_FILTER_DROPDOWN_ID = 'side-panel-object-filter-dropdown';

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
    <DropdownRoot dropdownId={OBJECT_FILTER_DROPDOWN_ID} type="picker">
      <Dropdown.Trigger
        render={
          <IconButton
            variant="ghost"
            color={isFilterActive ? 'accent' : 'neutral'}
            size="sm"
            aria-label={t`Filter by object type`}
          >
            <IconFilter />
          </IconButton>
        }
      />
      <DropdownContent side="bottom" align="end">
        <SidePanelObjectFilterDropdownContent
          selectedObjectNameSingulars={selectedObjectNameSingulars}
          onChangeSelectedObjects={onChangeSelectedObjects}
        />
      </DropdownContent>
    </DropdownRoot>
  );
};
