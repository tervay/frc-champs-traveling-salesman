# Traveling Salesman Pit Route Planner - Implementation Plan

## Overview

A React app that helps FIRST Robotics Championship attendees plan an efficient walking route through team pits. Users input a list of team numbers they want to visit, and the app computes a near-optimal route using a greedy nearest-neighbor algorithm, displayed on an interactive pit map.

## Data Format (from CSV)

The CSV has alternating row pairs: pit labels then team numbers. The grid has column sections A-R (skipping I and O) and row numbers 01-52. Each pit label like "A51" maps to a team number in the row below. The venue is split into 8 named divisions/areas:
- **Row 14 divider**: ARCHIMEDES, DALY, HOPPER, MILSTEIN
- **Row 45 divider**: CURIE, GALILEO, JOHNSON, NEWTON

Special cells to skip: `INSPECTION`, `COL`, `PIT ADMIN`, `EMT`, empty cells, and the header row.

## Tech Stack

- **React Router 7** (already scaffolded)
- **Tailwind CSS 4** (already installed)
- **shadcn/ui** (to be installed - buttons, input, badge, card, etc.)
- **No backend needed** - all computation is client-side

---

## Step 1: Install and Configure shadcn/ui

1. Run `pnpm dlx shadcn@latest init` to set up shadcn in the project
2. Accept defaults or configure for the existing Tailwind v4 + React Router setup
3. Install needed components: `button`, `input`, `badge`, `card`, `scroll-area`, `separator`

## Step 2: Parse the CSV and Build the Pit Data Module

Create `app/lib/pit-data.ts`:

1. **Hardcode or embed the parsed pit data** as a static TypeScript map rather than loading the CSV at runtime. This is championship-specific data that doesn't change.
2. Build two data structures:
   - `teamToPit: Map<number, string>` - maps team number to pit label (e.g., `4 -> "A51"`)
   - `pitToCoords: Map<string, {x: number, y: number}>` - maps pit label to grid coordinates for distance calculation
3. **Coordinate system**: Derive x,y from the pit label. The physical layout is **aisle-based**: all pits sharing the same letter (e.g., all "G" pits) are in the same aisle. Odd-numbered pits are on one side, even-numbered on the other. Walking down an aisle lets you see teams on both sides with minimal extra cost.
   - **X-axis (aisle)**: Map column letters to aisle positions. Columns left to right: A, B, C, D, E, F, G, H, J, K, L, M, N, P, Q, R. Map A=0, B=1, ... H=7 for Hall A, then J=15, K=16, ... R=22 for Hall E. The large gap between H (7) and J (15) represents the **massive physical distance between Hall A and Hall E** — this is a long walk between separate halls, not just another aisle.
   - **Y-axis (row)**: The numeric part of the pit label (01-52). Higher numbers = one end, lower = other end.
   - **Odd/even offset**: Within each aisle, odd and even pit numbers are on opposite sides (e.g., A51 and A52 face each other across the aisle). Give them a small x offset (~0.3) so the solver slightly prefers staying on one side, but the cost to cross an aisle is near-zero (you just turn around).

## Step 3: Distance Calculation

Create `app/lib/distance.ts`:

1. Use **Manhattan distance** (not Euclidean) since attendees walk along aisles, not diagonally:
   `distance(a, b) = |a.x - b.x| * X_SCALE + |a.y - b.y| * Y_SCALE`
2. Apply a scale factor for x vs y since walking between aisles is farther than walking along a row. Reasonable starting values: X_SCALE = 3, Y_SCALE = 1.
3. **Same-aisle bonus**: If two pits share the same letter, the x-distance is essentially zero (just walk along the aisle). The distance function should recognize this: if `pitA.aisleLetter === pitB.aisleLetter`, the cost is just `|a.y - b.y| * Y_SCALE` — no x penalty at all.
4. **Hall crossing penalty**: The gap between H and J is already encoded as a large x-distance (7 units vs 1 unit between normal aisles). This naturally makes the solver avoid crossing halls unless necessary.

## Step 4: Greedy TSP Solver

Create `app/lib/solver.ts`:

1. **Hall-aware partitioning**: Before solving, split the selected teams into Hall A (columns A-H) and Hall E (columns J-R). If teams exist in both halls, solve each hall independently, then concatenate: visit all teams in one hall first, cross once, visit all teams in the other hall. This ensures **at most one hall crossing**.
2. **Nearest-neighbor heuristic** (within each hall partition):
   - Start from the team nearest to the hall entrance/edge
   - At each step, visit the nearest unvisited pit
   - Time complexity: O(n^2) which is trivially fast for n < 100
3. **2-opt improvement pass** (within each hall partition):
   - After the greedy solution, do a single pass of 2-opt swaps to remove obvious crossings
   - For each pair of edges, check if swapping them reduces total distance
   - O(n^2) per pass, run 1-3 passes - still instant for small n
4. Return an ordered array of `{team: number, pit: string, coords: {x, y}}` representing the route.

## Step 5: Build the UI

### Main Page (`app/routes/home.tsx`)

Replace the default content with the app layout. Single-page app with three sections:

#### 5a: Team Input Panel (left/top)
- **Text input** area where users type or paste team numbers (comma or newline separated)
- **Validation**: As teams are entered, show badges for valid teams (with pit label), highlight invalid team numbers in red
- **"Plan Route" button** - triggers the solver
- **"Clear" button** - resets everything

#### 5b: Route Results Panel (right/bottom on mobile)
- **Ordered list** of the planned route: step number, team number, pit label
- Each entry is a card or list item showing: `Step 1: Team 254 - Pit B36`
- **Total estimated distance** displayed at top
- **"Reverse Route" button** - in case the user wants to walk it backwards

#### 5c: Pit Map Visualization
- **SVG or CSS grid** rendering of the pit layout, matching the CSV grid structure
- All pits shown as small rectangles in a grid layout
- **Selected teams highlighted** in a distinct color
- **Route drawn** as a line/path connecting the selected pits in order, with step numbers
- The 8 division labels displayed as headers at their proper positions
- Color-code: unselected pits gray, selected pits blue, current route path as a colored line with arrows
- The map should be pannable/zoomable on mobile (use CSS `overflow: auto` with a large inner container, or simple transform-based zoom)

### Layout
- Desktop: side-by-side (input panel left, map + route right)
- Mobile: stacked (input on top, map, then route list)
- Use shadcn `Card` components for panels

## Step 6: Responsive Design and Polish

1. Ensure the app works well on phones (most attendees will use phones at the event)
2. The pit map should be scrollable/zoomable on small screens
3. Add a brief instruction/welcome message explaining the app
4. Add the app title: "FIRST Championship Pit Route Planner" or similar

## File Structure Summary

```
app/
  lib/
    pit-data.ts        # Static team-to-pit mapping and coordinate data
    distance.ts        # Manhattan distance calculation
    solver.ts          # Nearest-neighbor + 2-opt TSP solver
  routes/
    home.tsx           # Main (only) page with all UI
  components/
    team-input.tsx     # Team number input + validation
    route-list.tsx     # Ordered route display
    pit-map.tsx        # SVG pit map visualization
  root.tsx             # (already exists, minimal changes)
  routes.ts            # (already exists, no changes)
  app.css              # (already exists, extend with any custom styles)
```

## Implementation Order

1. **Step 1** - Install shadcn (dependency for everything else)
2. **Step 2** - Parse CSV / build pit data module (foundation for everything)
3. **Step 3** - Distance calculation (needed by solver)
4. **Step 4** - Solver (needed by UI)
5. **Step 5a** - Team input component
6. **Step 5c** - Pit map visualization (can be done in parallel with 5a)
7. **Step 5b** - Route results panel
8. **Step 6** - Polish, responsive design, testing

## Key Design Decisions

- **Client-side only**: No server endpoints needed. All data is static and computation is trivial.
- **Greedy is good enough**: For ~20-30 teams (typical use case), nearest-neighbor + 2-opt produces routes that are within ~10-15% of optimal, and runs in <1ms.
- **Manhattan distance**: More realistic for a convention hall than Euclidean.
- **Static data**: The pit map is embedded as a TypeScript module, not loaded from CSV at runtime. The CSV is reference data used during development.
- **Aisle-based movement**: Pits sharing a letter are in the same aisle — you can see teams on both sides just by walking down. The distance function treats same-aisle travel as cheap (y-distance only).
- **Hall crossing minimization**: Hall A (A-H) and Hall E (J-R) are physically far apart. The solver partitions teams by hall and solves each side independently, crossing at most once. The coordinate gap (H=7, J=15) also makes the distance function naturally penalize unnecessary crossings.
