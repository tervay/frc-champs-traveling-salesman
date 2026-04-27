import { useState } from "react";
import { pitToCoords } from "~/lib/pit-data";
import type { PitCoords } from "~/lib/pit-data";
import type { RouteStop } from "~/lib/solver";

// ── SVG coordinate constants ──────────────────────────────────────────────────
//
// Nexus coordinate system (pit centers):
//   Hall A: x ∈ [401, 2701]  (A-odd=401, H-even=2701; column pitch = 300 units ≈ 30 ft)
//   Hall E: x ∈ [200, 2500]  (J-odd=200, R-even=2500; same pitch, separate local origin)
//   Both:   y ∈ [136, 2436]  (row 52 ≈ 136 at top, row 1 ≈ 2436 at bottom)
//   Span: 2300 units on each axis (x and y) → uniform scale in both halls.
//
// SVG mapping: both halls map to equal-width SVG regions separated by HALL_GAP.
//   scale = HALL_A_W / 2300
//   Hall A svgX = PAD_X + (x - 401) * scale
//   Hall E svgX = PAD_X + HALL_A_W + HALL_GAP + (x - 200) * scale
//   svgY        = PAD_TOP + (y - 136) * (SVG_H - PAD_TOP - PAD_BOT) / 2300
//
// The container uses minWidth so the SVG renders at natural scale on small
// screens (scrollable) and scales up to fill wide screens automatically.

const PAD_X = 9;
const PAD_TOP = 15; // room for hall / aisle labels above pits
const PAD_BOT = 4;
const HALL_A_W = 235; // SVG width for each hall (same for Hall A and Hall E)
const HALL_GAP = 32;  // compressed visual gap between the two halls

const SVG_W = PAD_X * 2 + HALL_A_W + HALL_GAP + HALL_A_W; // 520
const SVG_H = PAD_TOP + PAD_BOT + 245; // 264

const HALL_GAP_X = PAD_X + HALL_A_W;      // SVG x where gap begins (244)
const HALL_E_X   = HALL_GAP_X + HALL_GAP; // SVG x where Hall E starts (276)

const NEXUS_X_RANGE = 2300; // both halls span 2300 Nexus units in x
const NEXUS_A_X_MIN = 401;  // Hall A leftmost pit center (A-odd)
const NEXUS_E_X_MIN = 200;  // Hall E leftmost pit center (J-odd)
const NEXUS_Y_MIN   = 136;  // topmost pit center y (row 52)
const NEXUS_Y_RANGE = 2300; // y span (136 → 2436)
const SVG_CONTENT_H = SVG_H - PAD_TOP - PAD_BOT; // 245

function toSvgX(coords: PitCoords): number {
  if (coords.letter <= "H") {
    return PAD_X + (coords.x - NEXUS_A_X_MIN) * HALL_A_W / NEXUS_X_RANGE;
  }
  return HALL_E_X + (coords.x - NEXUS_E_X_MIN) * HALL_A_W / NEXUS_X_RANGE;
}

function toSvgY(coords: PitCoords): number {
  // Nexus y increases downward; row 52 has small y (top), row 1 has large y (bottom).
  return PAD_TOP + (coords.y - NEXUS_Y_MIN) * SVG_CONTENT_H / NEXUS_Y_RANGE;
}

const HALL_A_LETTERS = ["A", "B", "C", "D", "E", "F", "G", "H"];
const HALL_E_LETTERS = ["J", "K", "L", "M", "N", "P", "Q", "R"];

// Column aisle centers in Nexus units: first column center = 100 units from hall edge,
// then +300 per column (both halls share this geometry).
const COL_PITCH_SVG = 300 * HALL_A_W / NEXUS_X_RANGE; // ≈ 30.65 SVG units per column
const COL_FIRST_SVG = 100 * HALL_A_W / NEXUS_X_RANGE; // ≈ 10.2 SVG units from hall edge

const aisleLabels = [
  ...HALL_A_LETTERS.map((letter, i) => ({
    letter,
    svgX: PAD_X + COL_FIRST_SVG + i * COL_PITCH_SVG,
  })),
  ...HALL_E_LETTERS.map((letter, i) => ({
    letter,
    svgX: HALL_E_X + COL_FIRST_SVG + i * COL_PITCH_SVG,
  })),
];

// ── Colours (hardcoded Tailwind-palette values for reliable SVG rendering) ──
const C = {
  hallGap: "#f3f4f6",
  label: "#9ca3af",
  pit: "#d1d5db",
  routePit: "#2563eb",
  myTeamPit: "#16a34a",
  activePit: "#ea580c",
  routeLine: "#2563eb",
  stepText: "#ffffff",
};

interface ActiveStop {
  stop: RouteStop;
  step: number;
}

interface PitMapProps {
  route: RouteStop[];
}

export function PitMap({ route }: PitMapProps) {
  const [active, setActive] = useState<ActiveStop | null>(null);

  const isRoundTrip =
    route.length >= 2 && route[0].team === route[route.length - 1].team;
  const myTeamPit = isRoundTrip ? route[0].pit : null;
  // For rendering, skip the duplicate return stop at the end of a round trip
  const displayRoute = isRoundTrip ? route.slice(0, -1) : route;

  const routePitSet = new Set(route.map((s) => s.pit));
  const routeByPit = new Map(
    route.map((s, i) => [s.pit, { stop: s, step: i + 1 }])
  );

  const routePoints = route
    .map((s) => `${toSvgX(s.coords)},${toSvgY(s.coords)}`)
    .join(" ");

  function handleRouteClick(
    pit: string,
    _coords: PitCoords,
    e: React.MouseEvent
  ) {
    e.stopPropagation();
    const entry = routeByPit.get(pit);
    if (!entry) return;
    setActive((prev) =>
      prev?.stop.pit === pit
        ? null
        : { stop: entry.stop, step: entry.step }
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="rounded-md border border-yellow-300 bg-yellow-50 px-3 py-2 text-xs text-yellow-800 dark:border-yellow-700 dark:bg-yellow-950 dark:text-yellow-300">
        <strong>Note:</strong> Pit assignments are not guaranteed to be correct.
        Always verify with the official event pit map.
      </p>
      <div className="overflow-auto rounded-lg border bg-card">
      {/* minWidth keeps natural 1:1 scale on small screens (scrollable).
          width:100% lets it expand to fill larger containers automatically. */}
      <div style={{ minWidth: SVG_W }}>
        <svg
          viewBox={`0 0 ${SVG_W} ${SVG_H}`}
          style={{ width: "100%", height: "auto", display: "block" }}
          aria-label="Pit map with planned route"
          onClick={() => setActive(null)}
          role="img"
        >
          {/* ── Hall gap shaded region ── */}
          <rect
            x={HALL_GAP_X}
            y={0}
            width={HALL_GAP}
            height={SVG_H}
            fill={C.hallGap}
          />

          {/* ── Hall labels ── */}
          <text
            x={PAD_X + HALL_A_W / 2}
            y={7}
            textAnchor="middle"
            fontSize={6}
            fontWeight="600"
            fill={C.label}
          >
            Hall A
          </text>
          <text
            x={HALL_E_X + HALL_A_W / 2}
            y={7}
            textAnchor="middle"
            fontSize={6}
            fontWeight="600"
            fill={C.label}
          >
            Hall E
          </text>

          {/* ── Hall gap label (rotated) ── */}
          <text
            x={HALL_GAP_X + HALL_GAP / 2}
            y={SVG_H / 2}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={5}
            fill={C.label}
            transform={`rotate(-90 ${HALL_GAP_X + HALL_GAP / 2} ${SVG_H / 2})`}
          >
            ~500 ft
          </text>

          {/* ── Aisle column letters ── */}
          {aisleLabels.map(({ letter, svgX }) => (
            <text
              key={letter}
              x={svgX}
              y={13}
              textAnchor="middle"
              fontSize={4.5}
              fill={C.label}
            >
              {letter}
            </text>
          ))}

          {/* ── Non-route pits (gray background) ── */}
          {Array.from(pitToCoords.entries())
            .filter(([label]) => !routePitSet.has(label))
            .map(([label, coords]) => (
              <rect
                key={label}
                x={toSvgX(coords) - 4.5}
                y={toSvgY(coords) - 4.5}
                width={9}
                height={9}
                rx={1}
                fill={C.pit}
                opacity={0.55}
              >
                <title>{label}</title>
              </rect>
            ))}

          {/* ── Route polyline ── */}
          {route.length > 1 && (
            <polyline
              points={routePoints}
              fill="none"
              stroke={C.routeLine}
              strokeWidth={1.5}
              strokeOpacity={0.5}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          )}

          {/* ── Route pits — rendered after polyline so they sit on top ── */}
          {displayRoute.map((stop, i) => {
            const cx = toSvgX(stop.coords);
            const cy = toSvgY(stop.coords);
            const isActive = active?.stop.pit === stop.pit;
            const isHome = stop.pit === myTeamPit;
            return (
              <g
                key={`${stop.pit}-${i}`}
                style={{ cursor: "pointer" }}
                onClick={(e) => handleRouteClick(stop.pit, stop.coords, e)}
              >
                <title>
                  Stop {i + 1} · Team {stop.team} · Pit {stop.pit}
                  {isHome ? " · Your pit" : ""}
                </title>
                {/* Invisible larger hit area for easier touch targeting */}
                <rect
                  x={cx - 9}
                  y={cy - 9}
                  width={18}
                  height={18}
                  fill="transparent"
                />
                <rect
                  x={cx - 4.5}
                  y={cy - 4.5}
                  width={9}
                  height={9}
                  rx={1}
                  fill={isActive ? C.activePit : isHome ? C.myTeamPit : C.routePit}
                  stroke={isActive ? "#fff" : "none"}
                  strokeWidth={0.75}
                />
                <text
                  x={cx}
                  y={cy}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={i + 1 < 10 ? 4 : 3.5}
                  fontWeight="bold"
                  fill={C.stepText}
                  style={{ pointerEvents: "none" }}
                >
                  {i + 1}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* ── Active stop info strip (replaces SVG tooltip for mobile readability) ── */}
      <div
        className="border-t px-3 py-2 text-sm"
        style={{ minWidth: SVG_W }}
      >
        {active ? (
          <div className="flex items-center justify-between gap-2">
            <span className="font-semibold">
              Stop {active.step} &mdash; Team {active.stop.team}
            </span>
            <span className="text-muted-foreground">
              Pit {active.stop.pit}
              {active.stop.pit === myTeamPit ? " · Your pit" : ""}
            </span>
          </div>
        ) : (
          <p className="text-muted-foreground text-xs">
            Tap a highlighted pit to see stop details.
          </p>
        )}
      </div>
    </div>
    </div>
  );
}
