import type { PitCoords } from "./pit-data";

/** Scale factors for Manhattan distance calculation */
const X_SCALE = 3; // walking between aisles costs more than walking along a row
const Y_SCALE = 1;

/**
 * Manhattan distance between two pit coordinates.
 *
 * Same-aisle bonus: if both pits share the same aisle letter, the x-cost is
 * zero — you just walk along the aisle and can see both sides.
 *
 * Hall crossing: the coordinate gap between H (x≈7) and J (x≈15) naturally
 * penalizes crossing between Hall A and Hall E without any special-casing.
 */
export function distance(a: PitCoords, b: PitCoords): number {
  const xCost = a.letter === b.letter ? 0 : Math.abs(a.x - b.x) * X_SCALE;
  const yCost = Math.abs(a.y - b.y) * Y_SCALE;
  return xCost + yCost;
}
