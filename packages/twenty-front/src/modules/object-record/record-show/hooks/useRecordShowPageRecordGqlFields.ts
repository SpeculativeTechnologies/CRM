import { isLayoutCustomizationModeEnabledState } from '@/layout-customization/states/isLayoutCustomizationModeEnabledState';
import { useObjectMetadataItem } from '@/object-metadata/hooks/useObjectMetadataItem';
import { useObjectMetadataItems } from '@/object-metadata/hooks/useObjectMetadataItems';
import { buildFindOneRecordForShowPageOperationSignature } from '@/object-record/record-show/graphql/operations/factories/findOneRecordForShowPageOperationSignatureFactory';
import { recordPageLayoutByObjectMetadataIdFamilySelector } from '@/page-layout/states/selectors/recordPageLayoutByObjectMetadataIdFamilySelector';
import { computePageLayoutVisibleFieldIdentifiers } from '@/page-layout/utils/computePageLayoutVisibleFieldIdentifiers';
import { useAtomFamilySelectorValue } from '@/ui/utilities/state/jotai/hooks/useAtomFamilySelectorValue';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';
import { viewsByIdMapSelector } from '@/views/states/selectors/viewsByIdMapSelector';
import { useMemo } from 'react';

// The single source of the record show page findOne field set. The show page
// effect and the hover prefetch must build byte-identical queries, otherwise
// the prefetched data misses the show page's cache read.
export const useRecordShowPageRecordGqlFields = ({
  objectNameSingular,
}: {
  objectNameSingular: string;
}) => {
  const { objectMetadataItem } = useObjectMetadataItem({ objectNameSingular });
  const { objectMetadataItems } = useObjectMetadataItems();

  const pageLayout = useAtomFamilySelectorValue(
    recordPageLayoutByObjectMetadataIdFamilySelector,
    { objectMetadataId: objectMetadataItem.id },
  );

  const viewsById = useAtomStateValue(viewsByIdMapSelector);

  // In layout customization mode any field can become visible, so the full
  // field set must be available.
  const isLayoutCustomizationModeEnabled = useAtomStateValue(
    isLayoutCustomizationModeEnabledState,
  );

  const recordGqlFields = useMemo(() => {
    const visibleFieldIdentifiersResult =
      computePageLayoutVisibleFieldIdentifiers({
        pageLayout,
        viewsById,
      });

    const visibleFieldIdentifiers =
      !isLayoutCustomizationModeEnabled &&
      visibleFieldIdentifiersResult.canRestrictToVisibleFields
        ? visibleFieldIdentifiersResult.fieldIdentifiers
        : undefined;

    return buildFindOneRecordForShowPageOperationSignature({
      objectMetadataItem,
      objectMetadataItems,
      visibleFieldIdentifiers,
    }).fields;
  }, [
    pageLayout,
    viewsById,
    isLayoutCustomizationModeEnabled,
    objectMetadataItem,
    objectMetadataItems,
  ]);

  return { recordGqlFields };
};
