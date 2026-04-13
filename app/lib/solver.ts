import { teamToPit, pitToCoords } from "./pit-data";
import type { PitCoords } from "./pit-data";
import { distance } from "./distance";

export interface RouteStop {
  team: number;
  pit: string;
  coords: PitCoords;
}

/** Hall A uses columns A-H; Hall E uses columns J-R */
function isHallA(coords: PitCoords): boolean {
  return coords.letter <= "H";
}

/** Nearest-neighbor greedy TSP starting from the given index */
function nearestNeighbor(stops: RouteStop[], startIdx: number): RouteStop[] {
  const unvisited = new Set<number>(stops.map((_, i) => i));
  const route: RouteStop[] = [];

  let current = startIdx;
  unvisited.delete(current);
  route.push(stops[current]);

  while (unvisited.size > 0) {
    let nearest = -1;
    let nearestDist = Infinity;
    for (const idx of unvisited) {
      const d = distance(stops[current].coords, stops[idx].coords);
      if (d < nearestDist) {
        nearestDist = d;
        nearest = idx;
      }
    }
    unvisited.delete(nearest);
    current = nearest;
    route.push(stops[current]);
  }

  return route;
}

/** Total route distance */
function routeDistance(route: RouteStop[]): number {
  let total = 0;
  for (let i = 0; i + 1 < route.length; i++) {
    total += distance(route[i].coords, route[i + 1].coords);
  }
  return total;
}

/** Single pass of 2-opt improvement */
function twoOpt(route: RouteStop[]): RouteStop[] {
  const n = route.length;
  let improved = true;
  let best = route.slice();
  let bestDist = routeDistance(best);

  while (improved) {
    improved = false;
    for (let i = 0; i < n - 1; i++) {
      for (let j = i + 2; j < n; j++) {
        // Reverse the segment between i+1 and j
        const candidate = [
          ...best.slice(0, i + 1),
          ...best.slice(i + 1, j + 1).reverse(),
          ...best.slice(j + 1),
        ];
        const candidateDist = routeDistance(candidate);
        if (candidateDist < bestDist - 1e-9) {
          best = candidate;
          bestDist = candidateDist;
          improved = true;
        }
      }
    }
  }

  return best;
}

/** Pick the best starting point by trying all options and keeping shortest route */
function solvePartition(stops: RouteStop[]): RouteStop[] {
  if (stops.length === 0) return [];
  if (stops.length === 1) return stops;

  let best: RouteStop[] = [];
  let bestDist = Infinity;

  for (let i = 0; i < stops.length; i++) {
    const candidate = nearestNeighbor(stops, i);
    const d = routeDistance(candidate);
    if (d < bestDist) {
      bestDist = d;
      best = candidate;
    }
  }

  return twoOpt(best);
}

/**
 * Compute a near-optimal visiting route for the given team numbers.
 *
 * Strategy:
 * 1. Split teams into Hall A (A-H) and Hall E (J-R).
 * 2. Solve each hall independently with nearest-neighbor + 2-opt.
 * 3. Concatenate: all of one hall first, then cross once, then the other hall.
 *    The hall that ends closer to the crossover point goes first.
 *
 * If `startTeam` is provided, the route starts and ends at that team's pit
 * (round trip). Hall splitting is skipped so the fixed start is respected.
 */
export function planRoute(teams: number[], startTeam?: number): RouteStop[] {
  // Build RouteStop list, silently skipping unknown teams
  const stops: RouteStop[] = [];
  for (const team of teams) {
    const pit = teamToPit.get(team);
    if (!pit) continue;
    const coords = pitToCoords.get(pit);
    if (!coords) continue;
    stops.push({ team, pit, coords });
  }

  if (stops.length === 0) return [];

  // Fixed-start round-trip mode
  if (startTeam !== undefined) {
    const startPit = teamToPit.get(startTeam);
    const startCoords = startPit ? pitToCoords.get(startPit) : undefined;
    if (startPit && startCoords) {
      const startStop: RouteStop = { team: startTeam, pit: startPit, coords: startCoords };
      // Pin startTeam first; remove it from the middle if it was in the visit list
      const rest = stops.filter((s) => s.team !== startTeam);
      const allStops = [startStop, ...rest];
      const route = nearestNeighbor(allStops, 0);
      const optimized = twoOpt(route);
      return [...optimized, startStop]; // return to start
    }
  }

  const hallA = stops.filter((s) => isHallA(s.coords));
  const hallE = stops.filter((s) => !isHallA(s.coords));

  // If teams are only in one hall, just solve that
  if (hallA.length === 0) return solvePartition(hallE);
  if (hallE.length === 0) return solvePartition(hallA);

  // Solve each hall independently
  const routeA = solvePartition(hallA);
  const routeE = solvePartition(hallE);

  // Decide order: which hall's route ends closer to the other hall?
  // Hall A is on the left (lower x), Hall E on the right (higher x).
  // We prefer the last stop in Hall A to be near the Hall E side (high x within Hall A),
  // and the last stop in Hall E to be near the Hall A side (low x within Hall E).
  const lastA = routeA[routeA.length - 1].coords;
  const lastE = routeE[routeE.length - 1].coords;
  const firstA = routeA[0].coords;
  const firstE = routeE[0].coords;

  // Compare crossing cost in each direction
  const crossingAE = distance(lastA, firstE);
  const crossingEA = distance(lastE, firstA);

  return crossingAE <= crossingEA
    ? [...routeA, ...routeE]
    : [...routeE, ...routeA];
}
