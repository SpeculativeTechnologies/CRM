import { render, screen } from '@testing-library/react';
import { type ComponentProps, type ReactNode } from 'react';

import { FieldWidgetJunctionRelationCard } from '@/page-layout/widgets/field/components/FieldWidgetJunctionRelationCard';
import { useTargetRecord } from '@/ui/layout/contexts/useTargetRecord';

jest.mock('@/ui/layout/contexts/useTargetRecord');
jest.mock(
  '@/page-layout/widgets/field/hooks/useFieldWidgetJunctionRelationRecords',
  () => ({
    useFieldWidgetJunctionRelationRecords: () => [
      { record: { id: 'person-1' }, objectNameSingular: 'person' },
      { record: { id: 'person-2' }, objectNameSingular: 'person' },
    ],
  }),
);
jest.mock('@/opportunity/components/OpportunityPrimaryContactAction', () => ({
  OpportunityPrimaryContactAction: ({ personId }: { personId: string }) => (
    <button>Make {personId} primary</button>
  ),
}));
jest.mock(
  '@/page-layout/widgets/field/components/FieldWidgetRelationRecordsCard',
  () => ({
    FieldWidgetRelationRecordsCard: ({
      relationRecords,
      isReadOnly,
      renderAdditionalAction,
    }: {
      relationRecords: {
        record: { id: string };
        objectNameSingular: string;
        fieldMetadataId: string;
      }[];
      isReadOnly: boolean;
      renderAdditionalAction?: (record: {
        record: { id: string };
        objectNameSingular: string;
        fieldMetadataId: string;
      }) => ReactNode;
    }) => (
      <div>
        {!isReadOnly && <button>Detach</button>}
        {relationRecords.map((record) => (
          <div key={record.record.id}>{renderAdditionalAction?.(record)}</div>
        ))}
      </div>
    ),
  }),
);

const props = {
  fieldDefinition: { fieldMetadataId: 'contacts' },
  relationValue: [],
  isInSidePanel: false,
  junctionConfig: {
    junctionObjectMetadata: { nameSingular: 'opportunityContact' },
  },
} as ComponentProps<typeof FieldWidgetJunctionRelationCard>;

describe('opportunity junction card actions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(useTargetRecord).mockReturnValue({
      id: 'opportunity-1',
      targetObjectNameSingular: 'opportunity',
    });
  });

  it('offers primary selection for each contact while keeping direct detach unavailable', () => {
    render(
      <FieldWidgetJunctionRelationCard
        fieldDefinition={props.fieldDefinition}
        relationValue={props.relationValue}
        isInSidePanel={props.isInSidePanel}
        junctionConfig={props.junctionConfig}
      />,
    );
    expect(
      screen.getByRole('button', { name: 'Make person-1 primary' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Make person-2 primary' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Detach' }),
    ).not.toBeInTheDocument();
  });

  it('does not show opportunity actions on a person record', () => {
    jest
      .mocked(useTargetRecord)
      .mockReturnValue({ id: 'person-1', targetObjectNameSingular: 'person' });
    render(
      <FieldWidgetJunctionRelationCard
        fieldDefinition={props.fieldDefinition}
        relationValue={props.relationValue}
        isInSidePanel={props.isInSidePanel}
        junctionConfig={props.junctionConfig}
      />,
    );
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
