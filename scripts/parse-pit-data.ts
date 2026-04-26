import * as fs from "fs";
import * as path from "path";

// Parse CSV with proper handling of quoted cells containing newlines
function parseCSV(content: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = "";
  let inQuotes = false;

  for (let i = 0; i < content.length; i++) {
    const char = content[i];

    if (char === '"') {
      if (inQuotes && content[i + 1] === '"') {
        currentCell += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      currentRow.push(currentCell.trim());
      currentCell = "";
    } else if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && content[i + 1] === "\n") i++;
      currentRow.push(currentCell.trim());
      currentCell = "";
      if (currentRow.some((c) => c)) rows.push(currentRow);
      currentRow = [];
    } else {
      currentCell += char;
    }
  }

  if (currentCell || currentRow.length > 0) {
    currentRow.push(currentCell.trim());
    if (currentRow.some((c) => c)) rows.push(currentRow);
  }

  return rows;
}

// Physical dimensions (feet)
const PIT_SIZE = 10; // each pit is 10'x10'
const VERTICAL_AISLE_WIDTH = 10; // aisles running along columns (N-S)
const HORIZONTAL_AISLE_WIDTH = 15; // aisles running between rows (E-W)
const H_TO_J_GAP = 500; // approximate distance between Hall A (H) and Hall E (J)

// Center-to-center spacing between adjacent aisles:
// pits back-to-back on either side + the aisle itself
const AISLE_SPACING = 2 * PIT_SIZE + VERTICAL_AISLE_WIDTH; // 30'

const HALL_A_LETTERS = ["A", "B", "C", "D", "E", "F", "G", "H"];
const HALL_E_LETTERS = ["J", "K", "L", "M", "N", "P", "Q", "R"];

const HALL_A_END_X = (HALL_A_LETTERS.length - 1) * AISLE_SPACING; // H = 210'

// Column letter to X coordinate (feet from aisle A center)
const COL_LETTER_TO_X: Record<string, number> = {};
HALL_A_LETTERS.forEach((letter, i) => {
  COL_LETTER_TO_X[letter] = i * AISLE_SPACING;
});
HALL_E_LETTERS.forEach((letter, i) => {
  COL_LETTER_TO_X[letter] = HALL_A_END_X + H_TO_J_GAP + i * AISLE_SPACING;
});

function isPitLabel(cell: string): boolean {
  return /^[A-HJ-NP-R]\d{2}$/.test(cell);
}

function isTeamNumber(cell: string): boolean {
  return /^\d+$/.test(cell);
}

interface PitCoords {
  x: number;
  y: number;
  letter: string;
  row: number;
}

const teamToPit: Record<number, string> = {};
const pitToCoords: Record<string, PitCoords> = {};

const CSV_FILE = "2026 CMPTX Pit Map(pit map).csv";
const csvPath = path.join(process.cwd(), CSV_FILE);
const content = fs.readFileSync(csvPath, "utf-8");
const rows = parseCSV(content);

// Section divider rows (e.g. "ARCHIMEDES / DALY / CURIE / GALILEO") mark horizontal aisles.
// Detected automatically: a row with no pit labels and no team numbers but with known section names.
const SECTION_NAMES = new Set([
  "ARCHIMEDES", "DALY", "HOPPER", "MILSTEIN",
  "CURIE", "GALILEO", "JOHNSON", "NEWTON",
]);
function isSectionDivider(row: string[]): boolean {
  return !row.some(isPitLabel) && row.some((c) => SECTION_NAMES.has(c.trim().toUpperCase()));
}

let i = 0;
let yOffset = 0;
while (i < rows.length) {
  if (isSectionDivider(rows[i])) {
    yOffset += HORIZONTAL_AISLE_WIDTH;
  }

  const row = rows[i];
  const hasLabels = row.some((cell) => isPitLabel(cell));

  if (hasLabels && i + 1 < rows.length) {
    const labelRow = row;
    const teamRow = rows[i + 1];

    for (
      let col = 0;
      col < Math.max(labelRow.length, teamRow.length);
      col++
    ) {
      const label = (labelRow[col] || "").trim();
      const teamStr = (teamRow[col] || "").trim();

      if (isPitLabel(label) && isTeamNumber(teamStr)) {
        const team = parseInt(teamStr, 10);
        const letter = label[0];
        const rowNum = parseInt(label.slice(1), 10);
        const baseX = COL_LETTER_TO_X[letter];
        // Odd pits are on the west/left side of the aisle, even on east/right.
        // Each pit is PIT_SIZE deep, so the center is PIT_SIZE/2 past the aisle
        // edge. The aisle edge is at VERTICAL_AISLE_WIDTH/2 from the aisle center.
        // Total offset = VERTICAL_AISLE_WIDTH/2 + PIT_SIZE/2.
        const xOffset = rowNum % 2 !== 0
          ? -(VERTICAL_AISLE_WIDTH / 2 + PIT_SIZE / 2)
          : (VERTICAL_AISLE_WIDTH / 2 + PIT_SIZE / 2);

        teamToPit[team] = label;
        pitToCoords[label] = {
          x: baseX + xOffset,
          // Opposite-side pits (e.g. A51/A52) share the same Y position.
          // ceil(rowNum/2) collapses each facing pair to one Y, then scale to feet.
          y: Math.ceil(rowNum / 2) * PIT_SIZE + yOffset,
          letter,
          row: rowNum,
        };
      }
    }

    i += 2;
  } else {
    i++;
  }
}

// Sort for readability
const sortedTeams = Object.keys(teamToPit)
  .map(Number)
  .sort((a, b) => a - b);
const sortedPits = Object.keys(pitToCoords).sort();

const output = `// Auto-generated from "${CSV_FILE}"
// Run scripts/parse-pit-data.ts to regenerate

export interface PitCoords {
  /** X position in feet. Pit centers: Hall A odd=-10..H-even=220 (aisle centers 0,30,…,210), Hall E J-odd=700..R-even=930 */
  x: number;
  /** Y position in feet. Each pit pair occupies PIT_SIZE feet; horizontal aisles add 15' each */
  y: number;
  /** Aisle letter (A-H, J-R) */
  letter: string;
  /** Row number (01-52) */
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
