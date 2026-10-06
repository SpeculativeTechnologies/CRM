import { type RecordPickerPickableMorphItem } from '@/object-record/record-picker/types/RecordPickerPickableMorphItem';
import { type SearchRecord } from '~/generated/graphql';

// Picked and unpicked records arrive from two separate search queries, so
// their concatenation order would always list picked records first. Rank
// every item by search relevance instead, then alphabetically, so a checked
// record stays where it would naturally appear among the results.
const compareSearchRecords = (a: SearchRecord, b: SearchRecord): number => {
  if (a.tsRankCD !== b.tsRankCD) {
    return b.tsRankCD - a.tsRankCD;
  }

  if (a.tsRank !== b.tsRank) {
    return b.tsRank - a.tsRank;
  }

  // Records without a label render as a placeholder, so keep them last.
  if (a.label === '' || b.label === '') {
    if (a.label === b.label) return a.recordId < b.recordId ? -1 : 1;

    return a.label === '' ? 1 : -1;
  }

  const labelComparison = a.label.localeCompare(b.label, undefined, {
    sensitivity: 'base',
    numeric: true,
  });

  if (labelComparison !== 0) {
    return labelComparison;
  }

  if (a.recordId === b.recordId) {
    return 0;
  }

  return a.recordId < b.recordId ? -1 : 1;
};

export const sortMorphItems = (
  morphItems: RecordPickerPickableMorphItem[],
  searchRecords: SearchRecord[],
): RecordPickerPickableMorphItem[] => {
  const searchRecordByRecordId = new Map<string, SearchRecord>();
  searchRecords.forEach((record) => {
    searchRecordByRecordId.set(record.recordId, record);
  });

  return morphItems.sort((a, b) => {
    const aSearchRecord = searchRecordByRecordId.get(a.recordId);
    const bSearchRecord = searchRecordByRecordId.get(b.recordId);

    if (!aSearchRecord && !bSearchRecord) return 0;
    if (!aSearchRecord) return -1;
    if (!bSearchRecord) return 1;

    return compareSearchRecords(aSearchRecord, bSearchRecord);
  });
};
