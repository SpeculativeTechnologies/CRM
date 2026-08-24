import { render, screen } from '@testing-library/react';

import { RecordInlineCellAnchoredPortal } from '@/object-record/record-inline-cell/components/RecordInlineCellAnchoredPortal';
import { type EnrichedObjectMetadataItem } from '@/object-metadata/types/EnrichedObjectMetadataItem';
import { type FieldMetadataItem } from '@/object-metadata/types/FieldMetadataItem';
import { FieldMetadataType } from 'twenty-shared/types';

jest.mock('@/object-metadata/hooks/useObjectMetadataItems', () => ({
  useObjectMetadataItems: () => ({ objectMetadataItems: [] }),
}));
jest.mock('@/object-record/hooks/useObjectPermissions', () => ({
  useObjectPermissions: () => ({ objectPermissionsByObjectMetadataId: {} }),
}));
jest.mock('@/object-record/hooks/useUpdateOneRecord', () => ({
  useUpdateOneRecord: () => ({ updateOneRecord: jest.fn() }),
}));
jest.mock('@/object-record/read-only/hooks/useIsRecordFieldReadOnly', () => ({
  useIsRecordFieldReadOnly: () => false,
}));
jest.mock(
  '@/object-record/record-field/ui/utils/junction/isJunctionRelationForbidden',
  () => ({ isJunctionRelationForbidden: () => false }),
);
jest.mock(
  '@/object-record/record-field/ui/contexts/FieldFocusContextProvider',
  () => ({
    FieldFocusStaticFocusedProvider: ({
      children,
    }: {
      children: React.ReactNode;
    }) => children,
  }),
);
jest.mock(
  '@/object-record/record-inline-cell/components/RecordInlineCellAnchoredPortalContext',
  () => ({
    RecordInlineCellAnchoredPortalContext: ({
      children,
    }: {
      children: React.ReactNode;
    }) => children,
  }),
);
jest.mock(
  '@/object-record/record-inline-cell/components/RecordInlineCellCloseOnSidePanelOpeningEffect',
  () => ({ RecordInlineCellCloseOnSidePanelOpeningEffect: () => null }),
);

const fieldMetadataItem = {
  id: 'field-id',
  universalIdentifier: 'field-universal-id',
  name: 'name',
  type: FieldMetadataType.TEXT,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  label: 'Name',
  settings: null,
  relation: null,
} as unknown as FieldMetadataItem;

const objectMetadataItem = {
  id: 'object-id',
  nameSingular: 'opportunity',
} as unknown as EnrichedObjectMetadataItem;

describe('RecordInlineCellAnchoredPortal', () => {
  it('should render outside a LayoutRenderingProvider', () => {
    const anchorElement = document.createElement('div');
    anchorElement.id = 'board-card-record-id-name';
    document.body.appendChild(anchorElement);

    render(
      <RecordInlineCellAnchoredPortal
        fieldMetadataItem={fieldMetadataItem}
        objectMetadataItem={objectMetadataItem}
        recordId="record-id"
        instanceIdPrefix="board-card"
      >
        <div>cell content</div>
      </RecordInlineCellAnchoredPortal>,
    );

    expect(screen.getByText('cell content')).toBeInTheDocument();
  });
});
