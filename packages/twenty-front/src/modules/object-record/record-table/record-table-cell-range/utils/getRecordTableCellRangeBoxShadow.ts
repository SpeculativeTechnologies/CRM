const EDGE_SHADOWS: Record<string, string> = {
  top: 'inset 0 1px 0 0',
  bottom: 'inset 0 -1px 0 0',
  left: 'inset 1px 0 0 0',
  right: 'inset -1px 0 0 0',
};

export const getRecordTableCellRangeBoxShadow = ({
  selectedRangeEdges,
  color,
}: {
  selectedRangeEdges: string;
  color: string;
}): string | undefined => {
  const shadows = Object.entries(EDGE_SHADOWS)
    .filter(([edge]) => selectedRangeEdges.includes(edge))
    .map(([, shadow]) => `${shadow} ${color}`);

  return shadows.length === 0 ? undefined : shadows.join(', ');
};
