import { RecordTableColumnAggregateFooterAggregateOperationMenuItems } from '@/object-record/record-table/record-table-footer/components/RecordTableColumnAggregateFooterAggregateOperationMenuItems';
import { type ExtendedAggregateOperations } from '@/object-record/record-table/types/ExtendedAggregateOperations';
import { type ReactNode } from 'react';
import { Dropdown } from 'twenty-ui/components';

export const RecordTableColumnAggregateFooterDropdownSubmenuContent = ({
  aggregateOperations,
  title,
  children,
}: {
  aggregateOperations: ExtendedAggregateOperations[];
  title: string;
  children?: ReactNode;
}) => {
  return (
    <>
      <Dropdown.Back>{title}</Dropdown.Back>
      <Dropdown.Section>
        <RecordTableColumnAggregateFooterAggregateOperationMenuItems
          aggregateOperations={aggregateOperations}
        >
          {children}
        </RecordTableColumnAggregateFooterAggregateOperationMenuItems>
      </Dropdown.Section>
    </>
  );
};
