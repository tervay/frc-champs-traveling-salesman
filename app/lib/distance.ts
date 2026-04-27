import type { PitCoords } from "./pit-data";

/** Scale factors for Manhattan distance calculation */
const X_SCALE = 3; // walking between aisles costs more than walking along a row
const Y_SCALE = 1;

/**
 * Offset added to Hall E local x to get a global x comparable to Hall A.
 * Derived from: H aisle center (2601) + ~500 ft gap (5000 units) - J aisle center (300) = 7301.
 * Scale: 300 Nexus units = 30 ft (one column pitch) → 10 units/ft.
 */
const HALL_E_X_OFFSET = 7301;

function globalX(c: PitCoords): number {
  return c.letter <= "H" ? c.x : c.x + HALL_E_X_OFFSET;
}

/**
 * Manhattan distance between two pit coordinates.
 *
 * Same-aisle bonus: if both pits share the same aisle letter, the x-cost is
 * zero — you just walk along the aisle and can see both sides.
 *
 * Hall crossing: Hall E x values are offset by HALL_E_X_OFFSET so the
 * ~500 ft inter-hall gap is reflected in cross-hall distances.
 */
export function distance(a: PitCoords, b: PitCoords): number {
  const xCost = a.letter === b.letter ? 0 : Math.abs(globalX(a) - globalX(b)) * X_SCALE;
  const yCost = Math.abs(a.y - b.y) * Y_SCALE;
  return xCost + yCost;
}
