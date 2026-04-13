import type { RouteStop } from "~/lib/solver";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { ScrollArea } from "~/components/ui/scroll-area";
import { Separator } from "~/components/ui/separator";

interface RouteListProps {
  route: RouteStop[];
  onRouteChange: (route: RouteStop[]) => void;
}

/** Physical Manhattan distance in feet (coordinates are already in feet). */
function physicalDistanceFt(route: RouteStop[]): number {
  let total = 0;
  for (let i = 0; i + 1 < route.length; i++) {
    const a = route[i].coords;
    const b = route[i + 1].coords;
    total += Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
  }
  return Math.round(total);
}

export function RouteList({ route, onRouteChange }: RouteListProps) {
  const distFt = physicalDistanceFt(route);
  const walkMins = Math.ceil(distFt / 300); // ~300 ft/min casual walking

  const isRoundTrip =
    route.length >= 2 && route[0].team === route[route.length - 1].team;
  const stopCount = isRoundTrip ? route.length - 1 : route.length;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base">
            Route &mdash; {stopCount} stop{stopCount !== 1 ? "s" : ""}
            {isRoundTrip && " + return"}
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onRouteChange([...route].reverse())}
          >
            Reverse
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          ~{distFt.toLocaleString()} ft &middot; ~{walkMins} min walk
        </p>
      </CardHeader>
      <Separator />
      <ScrollArea className="h-64">
        <CardContent className="py-3">
          <ol className="flex flex-col gap-0.5">
            {route.map((stop, i) => {
              const isReturn = isRoundTrip && i === route.length - 1;
              return (
                <li
                  key={`${stop.pit}-${i}`}
                  className="flex items-center gap-2.5 rounded px-1 py-1 text-sm hover:bg-muted/50"
                >
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground tabular-nums">
                    {isReturn ? "↩" : i + 1}
                  </span>
                  <span className="font-mono font-medium">{stop.team}</span>
                  <span className="text-muted-foreground">
                    {isReturn ? `${stop.pit} — return` : stop.pit}
                  </span>
                </li>
              );
            })}
          </ol>
        </CardContent>
      </ScrollArea>
    </Card>
  );
}
