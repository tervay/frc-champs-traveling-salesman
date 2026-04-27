import * as fs from "fs";
import * as path from "path";

const DIVISIONS = [
  "archimedes", "curie", "daly", "galileo",
  "hopper", "johnson", "milstein", "newton",
];

interface NexusPit {
  position: { x: number; y: number };
  size: { x: number; y: number };
  team?: string;
}

const pitToCoords: Record<string, { x: number; y: number; letter: string; row: number }> = {};
const teamToPit: Record<number, string> = {};

for (const div of DIVISIONS) {
  const jsonPath = path.join(process.cwd(), "scripts", "nexus", `${div}.json`);
  const data = JSON.parse(fs.readFileSync(jsonPath, "utf-8")) as {
    pits: Record<string, NexusPit>;
  };

  for (const [nexusLabel, pit] of Object.entries(data.pits)) {
    const letter = nexusLabel[0];
    const rowNum = parseInt(nexusLabel.slice(1), 10);
    // Nexus uses "J2"; canonical label pads to two digits: "J02"
    const canonLabel = `${letter}${String(rowNum).padStart(2, "0")}`;

    // Center of pit (Nexus position is top-left corner, size always 100×100)
    const cx = pit.position.x + pit.size.x / 2;
    const cy = pit.position.y + pit.size.y / 2;

    // Coords are identical across all divisions for the same hall; first write wins.
    if (!pitToCoords[canonLabel]) {
      pitToCoords[canonLabel] = { x: cx, y: cy, letter, row: rowNum };
    }

    if (pit.team) {
      teamToPit[parseInt(pit.team, 10)] = canonLabel;
    }
  }
}

const sortedTeams = Object.keys(teamToPit).map(Number).sort((a, b) => a - b);
const sortedPits = Object.keys(pitToCoords).sort();

const output = `// Auto-generated from Nexus API (scripts/nexus/*.json)
// Run scripts/parse-pit-data.ts to regenerate

export interface PitCoords {
  /**
   * X pit center in Nexus local coordinates.
   * Hall A: A-odd=401 … H-even=2701 (column pitch 300 units ≈ 30 ft → 10 units/ft).
   * Hall E: J-odd=200 … R-even=2500 (same scale, separate local origin).
   * Use globalX() in distance.ts when comparing across halls.
   */
  x: number;
  /** Y pit center in Nexus coordinates. Row 52 ≈ 136 (top), row 1 ≈ 2436 (bottom). */
  y: number;
  /** Aisle letter (A-H for Hall A, J-R for Hall E) */
  letter: string;
  /** Row number (1-52) */
  row: number;
}

/** Maps team number -> pit label (e.g. 254 -> "B36") */
export const teamToPit: Map<number, string> = new Map([
${sortedTeams.map((t) => `  [${t}, "${teamToPit[t]}"]`).join(",\n")},
]);

/** Maps pit label -> grid coordinates for distance calculation */
export const pitToCoords: Map<string, PitCoords> = new Map([
${sortedPits
  .map((p) => {
    const c = pitToCoords[p];
    return `  ["${p}", { x: ${c.x}, y: ${c.y}, letter: "${c.letter}", row: ${c.row} }]`;
  })
  .join(",\n")},
]);

/** All valid team numbers as a Set for O(1) lookup */
export const validTeams: Set<number> = new Set(teamToPit.keys());
`;

const outPath = path.join(process.cwd(), "app/lib/pit-data.ts");
fs.writeFileSync(outPath, output);
console.log(`Written ${sortedTeams.length} teams and ${sortedPits.length} pits to ${outPath}`);
