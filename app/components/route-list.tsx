import { useEffect, useState } from "react";
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
import { fetchNextQueueTime, type QueueInfo } from "~/lib/nexus";
import { globalX, UNITS_PER_FOOT } from "~/lib/distance";

interface RouteListProps {
  route: RouteStop[];
  onRouteChange: (route: RouteStop[]) => void;
}

function physicalDistanceFt(route: RouteStop[]): number {
  let total = 0;
  for (let i = 0; i + 1 < route.length; i++) {
    const a = route[i].coords;
    const b = route[i + 1].coords;
    total += Math.abs(globalX(a) - globalX(b)) + Math.abs(a.y - b.y);
  }
  return Math.round(total / UNITS_PER_FOOT);
}

export function RouteList({ route, onRouteChange }: RouteListProps) {
  const [queueTimes, setQueueTimes] = useState<Map<number, QueueInfo | null>>(new Map());

  useEffect(() => {
    setQueueTimes(new Map());
    const uniqueTeams = [...new Set(route.map((s) => s.team))];
    for (const team of uniqueTeams) {
      fetchNextQueueTime(team).then((date) => {
        setQueueTimes((prev) => new Map(prev).set(team, date));
      });
    }
  }, [route]);

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
                  <a
                    href={`https://www.thebluealliance.com/team/${stop.team}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono font-medium text-blue-500 underline"
                  >
                    {stop.team}
                  </a>
                  <span className="text-muted-foreground">
                    {isReturn ? `${stop.pit} — return` : stop.pit}
                    {!isReturn && queueTimes.get(stop.team) != null && (() => {
                      const qi = queueTimes.get(stop.team)!;
                      let text: string;
                      if (qi.status === "On field" || qi.status === "On deck") {
                        text = `${qi.status} (${qi.label})`;
                      } else if (qi.time) {
                        const mins = Math.max(1, Math.round((qi.time.getTime() - Date.now()) / 60000));
                        text = `Queueing in ~${mins} min (${qi.label})`;
                      } else {
                        return null;
                      }
                      return (
                        <span className="ml-1.5 text-xs">&middot; {text}</span>
                      );
                    })()}
                  </span>
                </li>
              );
            })}
          </ol>
        </CardContent>
      </ScrollArea>
      <Separator />
      <p className="px-4 py-2 text-[11px] text-muted-foreground">
        Queue times provided by{" "}
        <a
          href="https://frc.nexus"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-foreground"
        >
          FRC Nexus
        </a>
      </p>
    </Card>
  );
}
