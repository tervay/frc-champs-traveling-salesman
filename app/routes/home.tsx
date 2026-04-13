import { useState } from "react";
import type { Route } from "./+types/home";
import { TeamInput } from "~/components/team-input";
import { RouteList } from "~/components/route-list";
import { PitMap } from "~/components/pit-map";
import { Card, CardContent } from "~/components/ui/card";
import type { RouteStop } from "~/lib/solver";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "FIRST Championship Pit Route Planner" },
    {
      name: "description",
      content: "Plan an efficient walking route through FIRST Championship team pits.",
    },
  ];
}

function Instructions() {
  return (
    <Card>
      <CardContent className="py-5">
        <p className="mb-3 text-sm font-medium">How to use</p>
        <ol className="flex flex-col gap-2 text-sm text-muted-foreground">
          <li>
            <span className="font-medium text-foreground">1.</span> Type or
            paste team numbers in the box — one per line or comma-separated.
          </li>
          <li>
            <span className="font-medium text-foreground">2.</span> Valid teams
            appear as badges showing their pit label. Unrecognized numbers
            appear in red.
          </li>
          <li>
            <span className="font-medium text-foreground">3.</span> Click{" "}
            <strong>Plan Route</strong> to compute an optimized walking order.
          </li>
          <li>
            <span className="font-medium text-foreground">4.</span> Tap any
            highlighted pit on the map to see the team number and stop details.
          </li>
        </ol>
        <p className="mt-4 text-xs text-muted-foreground">
          The route minimizes total walking distance using a nearest-neighbor
          heuristic. Teams in Hall A (A–H) and Hall E (J–R) are solved
          separately so you cross between halls at most once.
        </p>
      </CardContent>
    </Card>
  );
}

export default function Home() {
  const [route, setRoute] = useState<RouteStop[] | null>(null);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b px-4 py-3">
        <h1 className="text-lg font-semibold">
          FIRST Championship Pit Route Planner
        </h1>
        <p className="text-sm text-muted-foreground">
          Enter the teams you want to visit and get an optimized walking route.
        </p>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6">
        <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
          {/* Left panel: team input */}
          <div className="flex flex-col gap-4">
            <TeamInput onRouteChange={setRoute} />
          </div>

          {/* Right panel: instructions → replaced by pit map + route list */}
          <div className="flex flex-col gap-4">
            {route ? (
              <>
                <div className="order-2 lg:order-1">
                  <PitMap route={route} />
                </div>
                <div className="order-1 lg:order-2">
                  <RouteList route={route} onRouteChange={setRoute} />
                </div>
              </>
            ) : (
              <Instructions />
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
