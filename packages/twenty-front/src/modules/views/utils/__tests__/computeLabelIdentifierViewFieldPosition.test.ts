import { computeLabelIdentifierViewFieldPosition } from '@/views/utils/computeLabelIdentifierViewFieldPosition';

describe('computeLabelIdentifierViewFieldPosition', () => {
  it('should return 0 when the view has no other view field', () => {
    expect(computeLabelIdentifierViewFieldPosition([])).toBe(0);
  });

  it('should return a position below the lowest existing one', () => {
    expect(computeLabelIdentifierViewFieldPosition([2, 0, 1])).toBe(-1);
  });

  it('should keep going below when the lowest position is already negative', () => {
    expect(computeLabelIdentifierViewFieldPosition([-1, 3])).toBe(-2);
  });
});
