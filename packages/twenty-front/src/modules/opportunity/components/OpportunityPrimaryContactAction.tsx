import { useState } from 'react';
import { t } from '@lingui/core/macro';

import { useObjectMetadataItem } from '@/object-metadata/hooks/useObjectMetadataItem';
import { useCreateManyRecords } from '@/object-record/hooks/useCreateManyRecords';
import { useObjectPermissionsForObject } from '@/object-record/hooks/useObjectPermissionsForObject';
import { useUpdateOneRecord } from '@/object-record/hooks/useUpdateOneRecord';
import { useIsRecordFieldReadOnly } from '@/object-record/read-only/hooks/useIsRecordFieldReadOnly';
import { recordStoreFamilyState } from '@/object-record/record-store/states/recordStoreFamilyState';
import { useAtomFamilyStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomFamilyStateValue';
import { useToast } from 'twenty-ui/components';
import { Button } from 'twenty-ui/primitives/input';

export const OpportunityPrimaryContactAction = ({
  opportunityId,
  personId,
}: {
  opportunityId: string;
  personId: string;
}) => {
  const recordStore = useAtomFamilyStateValue(
    recordStoreFamilyState,
    opportunityId,
  );
  const { objectMetadataItem } = useObjectMetadataItem({
    objectNameSingular: 'opportunity',
  });
  const { objectMetadataItem: contactMetadata } = useObjectMetadataItem({
    objectNameSingular: 'opportunityContact',
  });
  const contactPermissions = useObjectPermissionsForObject(contactMetadata.id);
  const isReadOnly = useIsRecordFieldReadOnly({
    recordId: opportunityId,
    objectMetadataId: objectMetadataItem.id,
    fieldMetadataId:
      objectMetadataItem.fields.find((field) => field.name === 'pointOfContact')
        ?.id ?? '',
  });
  const { createManyRecords } = useCreateManyRecords({
    objectNameSingular: 'opportunityContact',
  });
  const { updateOneRecord } = useUpdateOneRecord();
  const { enqueueToast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const isPrimary = recordStore?.pointOfContactId === personId;

  const handleMakePrimary = async () => {
    if (isReadOnly || isSaving || isPrimary || !recordStore) return;
    setIsSaving(true);
    try {
      const previousPrimaryId = recordStore.pointOfContactId;
      // Retain the previous primary in the contact collection before moving
      // the pointer. If this fails, the primary remains unchanged.
      if (previousPrimaryId) {
        await createManyRecords({
          recordsToCreate: [{ opportunityId, personId: previousPrimaryId }],
          upsert: true,
        });
      }
      await updateOneRecord({
        objectNameSingular: 'opportunity',
        idToUpdate: opportunityId,
        updateOneRecordInput: { pointOfContactId: personId },
      });
    } catch {
      enqueueToast({
        variant: 'error',
        children: t`Could not change the primary contact`,
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (isPrimary) return <span>{t`Primary`}</span>;
  if (isReadOnly || !contactPermissions.canUpdateObjectRecords) return null;

  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={isSaving}
      loading={isSaving}
      onClick={handleMakePrimary}
    >
      {t`Make primary`}
    </Button>
  );
};
