import { useContext, type ReactElement } from 'react';

import { FieldContext } from '@/object-record/record-field/ui/contexts/FieldContext';
import { ExpandableList } from '@/ui/layout/expandable-list/components/ExpandableList';

export const FieldDisplayList = ({
  children,
  isChipCountDisplayed,
  maxInlineCount,
}: {
  children: ReactElement[];
  isChipCountDisplayed?: boolean;
  maxInlineCount?: number;
}) => {
  const { isInSidePanel, isInPinnedTab } = useContext(FieldContext);

  return (
    <ExpandableList
      isChipCountDisplayed={isChipCountDisplayed}
      isVertical={isInSidePanel || isInPinnedTab}
      maxInlineCount={maxInlineCount}
    >
      {children}
    </ExpandableList>
  );
};
