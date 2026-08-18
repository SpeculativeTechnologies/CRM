// The server rejects any view field write that leaves the label identifier's
// view field sharing or exceeding the position of another view field of the
// same view, so a label identifier column has to be inserted strictly below
// every existing one rather than appended like any other column.
export const computeLabelIdentifierViewFieldPosition = (
  otherViewFieldPositions: number[],
): number =>
  otherViewFieldPositions.length === 0
    ? 0
    : Math.min(...otherViewFieldPositions) - 1;
