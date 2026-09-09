import {
  type PersonalTool,
  type PersonalToolView,
} from '@/local-first/types/PersonalTool';

export const projectPersonalTool = (
  tool: PersonalTool,
  view: PersonalToolView,
) => {
  const records = tool.records.filter(
    (record) =>
      !view.filter ||
      String(record.values[view.filter.fieldId] ?? '')
        .toLocaleLowerCase()
        .includes(view.filter.value.toLocaleLowerCase()),
  );
  const sort = view.sort;
  if (sort)
    records.sort((left, right) => {
      const leftValue = left.values[sort.fieldId];
      const rightValue = right.values[sort.fieldId];
      const order =
        typeof leftValue === 'number' && typeof rightValue === 'number'
          ? leftValue - rightValue
          : String(leftValue ?? '').localeCompare(String(rightValue ?? ''));
      return (
        (sort.direction === 'ascending' ? 1 : -1) * order ||
        left.id.localeCompare(right.id)
      );
    });
  return records;
};
