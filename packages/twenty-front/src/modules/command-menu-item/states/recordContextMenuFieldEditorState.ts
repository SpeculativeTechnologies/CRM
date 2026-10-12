import { type PositionType } from '@/command-menu-item/types/PositionType';
import { createAtomState } from '@/ui/utilities/state/jotai/utils/createAtomState';

export type RecordContextMenuFieldEditor = {
  dropdownId: string;
  recordId: string;
  objectMetadataItemId: string;
  fieldMetadataItemId: string;
  position: PositionType;
};

export const recordContextMenuFieldEditorState =
  createAtomState<RecordContextMenuFieldEditor | null>({
    key: 'command-menu-item/recordContextMenuFieldEditorState',
    defaultValue: null,
  });
