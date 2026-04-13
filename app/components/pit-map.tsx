import { useState } from "react";
import { pitToCoords } from "~/lib/pit-data";
import type { PitCoords } from "~/lib/pit-data";
import type { RouteStop } from "~/lib/solver";

// ── SVG coordinate constants ──────────────────────────────────────────────────
//
// Physical layout (feet, from pit-data.ts):
//   Hall A: x ∈ [-10, 220] (A-odd center=-10, H-even center=220)
//   Hall E: x ∈ [700, 930] (J-odd center=700, R-even center=930)
//   y      ∈ [25, 260]     (top pit pair y=25, bottom pair y=260)
//
// Each column: odd pit center at baseX-10, even at baseX+10 (20 ft aisle gap).
// Adjacent columns share a 10 ft back-to-back gap (e.g. A-even x=10, B-odd x=20).
//
// SVG mapping (1 ft = 1 SVG unit):
//   Hall A → shift +10, PAD_X=9 keeps A-odd (x=-10) at svgX=9
//   Hall E → (x-700) + HALL_A_W + HALL_GAP
//   y      → PAD_TOP + (y - 20)
//
// The container uses minWidth so the SVG renders at natural scale on small
// screens (scrollable) and scales up to fill wide screens automatically.

const PAD_X = 9;
const PAD_TOP = 15; // room for hall / aisle labels above pits
const PAD_BOT = 4;
const HALL_A_W = 235; // width of Hall A in SVG units (A-odd at 9, H-even at 239)
const HALL_GAP = 32; // compressed visual gap between halls

const SVG_W = PAD_X * 2 + HALL_A_W + HALL_GAP + HALL_A_W; // 520
const SVG_H = PAD_TOP + PAD_BOT + 245; // 263

const HALL_GAP_X = PAD_X + HALL_A_W; // x where gap begins  (244)
const HALL_E_X = HALL_GAP_X + HALL_GAP; // x where Hall E starts (276)

function toSvgX(coords: PitCoords): number {
  if (coords.letter <= "H") {
    return PAD_X + coords.x + 10;
  }
  return PAD_X + (coords.x - 700) + HALL_A_W + HALL_GAP;
}

function toSvgY(coords: PitCoords): number {
  return PAD_TOP + coords.y - 20;
}

const HALL_A_LETTERS = ["A", "B", "C", "D", "E", "F", "G", "H"];
const HALL_E_LETTERS = ["J", "K", "L", "M", "N", "P", "Q", "R"];

const aisleLabels = [
  ...HALL_A_LETTERS.map((letter, i) => ({
    letter,
    svgX: PAD_X + i * 30 + 10,
  })),
  ...HALL_E_LETTERS.map((letter, i) => ({
    letter,
    svgX: PAD_X + i * 30 + 10 + HALL_A_W + HALL_GAP,
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
  tipBg: "#ffffff",
  tipBorder: "#d1d5db",
  tipTitle: "#111827",
  tipSub: "#6b7280",
};

// ── Tooltip constants ─────────────────────────────────────────────────────────
const TIP_W = 54;
const TIP_H = 16;

interface ActiveStop {
  stop: RouteStop;
  step: number;
  svgX: number;
  svgY: number;
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
    coords: PitCoords,
    e: React.MouseEvent
  ) {
    e.stopPropagation();
    const entry = routeByPit.get(pit);
    if (!entry) return;
    setActive((prev) =>
      prev?.stop.pit === pit
        ? null
        : {
            stop: entry.stop,
            step: entry.step,
            svgX: toSvgX(coords),
            svgY: toSvgY(coords),
          }
    );
  }

  // Clamp tooltip so it stays inside SVG bounds
  const tipX = active
    ? Math.min(active.svgX + 7, SVG_W - TIP_W - 2)
    : 0;
  const tipY = active ? Math.max(active.svgY - TIP_H - 5, PAD_TOP) : 0;

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
                <rect
                  x={cx - 4.5}
                  y={cy - 4.5}
                  width={9}
                  height={9}
                  rx={1}
                  fill={isActive ? C.activePit : isHome ? C.myTeamPit : C.routePit}
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

          {/* ── Tap/click tooltip ── */}
          {active && (
            <g style={{ pointerEvents: "none" }}>
              <rect
                x={tipX}
                y={tipY}
                width={TIP_W}
                height={TIP_H}
                rx={2}
                fill={C.tipBg}
                stroke={C.tipBorder}
                strokeWidth={0.75}
              />
              <text
                x={tipX + 3}
                y={tipY + 6}
                fontSize={4}
                fontWeight="700"
                fill={C.tipTitle}
              >
                Team {active.stop.team}
              </text>
              <text x={tipX + 3} y={tipY + 12} fontSize={3.5} fill={C.tipSub}>
                Pit {active.stop.pit} · Stop {active.step}
              </text>
            </g>
          )}
        </svg>
      </div>
    </div>
    </div>
  );
}
