import { type FieldDefinition } from '@/object-record/record-field/ui/types/FieldDefinition';
import { type FieldRelationMetadata } from '@/object-record/record-field/ui/types/FieldMetadata';
import { type ValidResolvedJunctionConfig } from '@/object-record/record-field/ui/utils/junction/types/ValidResolvedJunctionConfig';
import { FieldWidgetRelationRecordsCard } from '@/page-layout/widgets/field/components/FieldWidgetRelationRecordsCard';
import { useFieldWidgetJunctionRelationRecords } from '@/page-layout/widgets/field/hooks/useFieldWidgetJunctionRelationRecords';
import { OpportunityPrimaryContactAction } from '@/opportunity/components/OpportunityPrimaryContactAction';
import { useTargetRecord } from '@/ui/layout/contexts/useTargetRecord';

type FieldWidgetJunctionRelationCardProps = {
  fieldDefinition: FieldDefinition<FieldRelationMetadata>;
  relationValue: any;
  isInSidePanel: boolean;
  junctionConfig: ValidResolvedJunctionConfig;
};

export const FieldWidgetJunctionRelationCard = ({
  fieldDefinition,
  relationValue,
  isInSidePanel,
  junctionConfig,
}: FieldWidgetJunctionRelationCardProps) => {
  const targetRecord = useTargetRecord();
  const junctionRelationRecords = useFieldWidgetJunctionRelationRecords({
    relationValue,
    junctionConfig,
  });

  // Detach/delete in RecordDetailRelationRecordsListItem assumes a direct
  // relation, so junction cards are forced read-only to prevent data corruption.
  return (
    <FieldWidgetRelationRecordsCard
      fieldDefinition={fieldDefinition}
      relationRecords={junctionRelationRecords.map(
        (junctionRelationRecord) => ({
          ...junctionRelationRecord,
          fieldMetadataId: '',
        }),
      )}
      isInSidePanel={isInSidePanel}
      isReadOnly
      renderAdditionalAction={({ record, objectNameSingular }) =>
        junctionConfig.junctionObjectMetadata.nameSingular ===
          'opportunityContact' &&
        targetRecord.targetObjectNameSingular === 'opportunity' &&
        objectNameSingular === 'person' ? (
          <OpportunityPrimaryContactAction
            opportunityId={targetRecord.id}
            personId={record.id}
          />
        ) : undefined
      }
    />
  );
};
