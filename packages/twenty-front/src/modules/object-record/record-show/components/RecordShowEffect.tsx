import { isLayoutCustomizationModeEnabledState } from '@/layout-customization/states/isLayoutCustomizationModeEnabledState';
import { useObjectMetadataItem } from '@/object-metadata/hooks/useObjectMetadataItem';
import { useObjectMetadataItems } from '@/object-metadata/hooks/useObjectMetadataItems';
import { useFindOneRecord } from '@/object-record/hooks/useFindOneRecord';
import { buildFindOneRecordForShowPageOperationSignature } from '@/object-record/record-show/graphql/operations/factories/findOneRecordForShowPageOperationSignatureFactory';
import { recordStoreFamilyState } from '@/object-record/record-store/states/recordStoreFamilyState';
import { type ObjectRecord } from '@/object-record/types/ObjectRecord';
import { recordPageLayoutByObjectMetadataIdFamilySelector } from '@/page-layout/states/selectors/recordPageLayoutByObjectMetadataIdFamilySelector';
import { computePageLayoutVisibleFieldIdentifiers } from '@/page-layout/utils/computePageLayoutVisibleFieldIdentifiers';
import { useAtomFamilySelectorValue } from '@/ui/utilities/state/jotai/hooks/useAtomFamilySelectorValue';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';
import { viewsByIdMapSelector } from '@/views/states/selectors/viewsByIdMapSelector';
import { useStore } from 'jotai';
import { useCallback, useEffect, useMemo } from 'react';
import { isDefined } from 'twenty-shared/utils';

type RecordShowEffectProps = {
  objectNameSingular: string;
  recordId: string;
};

export const RecordShowEffect = ({
  objectNameSingular,
  recordId,
}: RecordShowEffectProps) => {
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

  const store = useStore();

  const { record, loading } = useFindOneRecord({
    objectRecordId: recordId,
    objectNameSingular,
    recordGqlFields,
    withSoftDeleted: true,
  });

  const setRecordStore = useCallback(
    async (newRecord: ObjectRecord | null | undefined) => {
      const previousRecordValue = store.get(
        recordStoreFamilyState.atomFamily(recordId),
      );

      if (JSON.stringify(previousRecordValue) !== JSON.stringify(newRecord)) {
        store.set(recordStoreFamilyState.atomFamily(recordId), newRecord);
      }
    },
    [recordId, store],
  );

  useEffect(() => {
    if (!loading && isDefined(record)) {
      setRecordStore(record);
    }
  }, [record, setRecordStore, loading]);

  return <></>;
};
