import { useLingui } from '@lingui/react/macro';
import { fieldMetadataItemsSelector } from '@/metadata-store/states/fieldMetadataItemsSelector';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';
import { getLinkedFieldReference, isDefined } from 'twenty-shared/utils';
import { IconLock } from 'twenty-ui/icon';

export const LinkedFieldSourceIndicator = ({
  fieldMetadataId,
  showSource = false,
}: {
  fieldMetadataId?: string;
  showSource?: boolean;
}) => {
  const { t } = useLingui();
  const fieldMetadataItems = useAtomStateValue(fieldMetadataItemsSelector);
  const field = fieldMetadataItems.find(
    (candidate) => candidate.id === fieldMetadataId,
  );
  const reference = getLinkedFieldReference(field?.settings);
  if (!isDefined(reference)) {
    return null;
  }
  const relation = fieldMetadataItems.find(
    (candidate) =>
      candidate.universalIdentifier ===
      reference.relationFieldMetadataUniversalIdentifier,
  );
  const source = fieldMetadataItems.find(
    (candidate) =>
      candidate.universalIdentifier ===
      reference.sourceFieldMetadataUniversalIdentifier,
  );
  const sourcePath = `${relation?.label ?? t`Person`} → ${source?.label ?? t`Source field`}`;
  const description = t`Linked to ${sourcePath}. Edit this value on the Person record.`;

  return (
    <span title={description} aria-label={description}>
      <IconLock size={14} />
      {showSource && <span>{sourcePath}</span>}
    </span>
  );
};
