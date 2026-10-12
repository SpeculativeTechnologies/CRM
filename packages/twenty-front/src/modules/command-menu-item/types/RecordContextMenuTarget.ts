import { type PositionType } from '@/command-menu-item/types/PositionType';
import { type EnrichedObjectMetadataItem } from '@/object-metadata/types/EnrichedObjectMetadataItem';

export type RecordContextMenuTarget = {
  dropdownId: string;
  objectMetadataItem: EnrichedObjectMetadataItem;
  recordId: string;
  position: PositionType;
};
