import { useState, useCallback } from "react";
import { teamToPit } from "~/lib/pit-data";
import { planRoute } from "~/lib/solver";
import type { RouteStop } from "~/lib/solver";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "~/components/ui/card";

interface ParsedTeam {
  raw: string;
  number: number | null;
  pit: string | null;
  valid: boolean;
}

interface TeamInputProps {
  onRouteChange: (route: RouteStop[] | null) => void;
}

function parseTeams(input: string): ParsedTeam[] {
  if (!input.trim()) return [];
  return input
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .map((raw) => {
      const n = parseInt(raw, 10);
      if (isNaN(n) || String(n) !== raw) {
        return { raw, number: null, pit: null, valid: false };
      }
      const pit = teamToPit.get(n) ?? null;
      return { raw, number: n, pit, valid: pit !== null };
    });
}

export function TeamInput({ onRouteChange }: TeamInputProps) {
  const [inputValue, setInputValue] = useState("");
  const [myTeamValue, setMyTeamValue] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const teams = parseTeams(inputValue);
  const validTeams = teams.filter((t) => t.valid);
  const invalidTeams = teams.filter((t) => !t.valid);
  const hasInput = inputValue.trim().length > 0;

  const myTeamParsed = parseTeams(myTeamValue)[0] ?? null;
  const myTeamValid = myTeamParsed?.valid ?? false;
  const myTeamNumber = myTeamValid ? myTeamParsed!.number! : undefined;

  const handlePlanRoute = useCallback(() => {
    const teamNumbers = validTeams
      .map((t) => t.number!)
      .filter((n, i, arr) => arr.indexOf(n) === i); // dedupe
    if (teamNumbers.length === 0) return;
    const route = planRoute(teamNumbers, myTeamNumber);
    onRouteChange(route);
    setSubmitted(true);
  }, [validTeams, myTeamNumber, onRouteChange]);

  const handleClear = useCallback(() => {
    setInputValue("");
    setMyTeamValue("");
    setSubmitted(false);
    onRouteChange(null);
  }, [onRouteChange]);

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Teams to Visit</CardTitle>
        <CardDescription>
          Enter team numbers separated by commas or new lines.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted-foreground">
            Your team number{" "}
            <span className="font-normal">(optional — sets start &amp; end)</span>
          </label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              inputMode="numeric"
              className="w-28 rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
              placeholder="e.g. 254"
              value={myTeamValue}
              onChange={(e) => {
                setMyTeamValue(e.target.value.trim());
                setSubmitted(false);
              }}
              spellCheck={false}
            />
            {myTeamValue.length > 0 && (
              <Badge
                variant={myTeamValid ? "secondary" : "destructive"}
                className="font-mono"
              >
                {myTeamValid
                  ? `${myTeamParsed!.number} · ${myTeamParsed!.pit}`
                  : myTeamValue}
              </Badge>
            )}
          </div>
        </div>

        <textarea
          className="h-32 w-full resize-none rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
          placeholder={"254\n1114\n2056\n1323"}
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value);
            setSubmitted(false);
          }}
          spellCheck={false}
        />

        {teams.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {validTeams.map((t) => (
              <Badge key={t.number} variant="secondary" className="font-mono">
                {t.number} &middot; {t.pit}
              </Badge>
            ))}
            {invalidTeams.map((t) => (
              <Badge key={t.raw} variant="destructive" className="font-mono">
                {t.raw}
              </Badge>
            ))}
          </div>
        )}

        {hasInput && invalidTeams.length > 0 && (
          <p className="text-xs text-destructive">
            {invalidTeams.length} team{invalidTeams.length !== 1 ? "s" : ""} not
            found in pit map
          </p>
        )}
      </CardContent>
      <CardFooter className="gap-2">
        <Button
          onClick={handlePlanRoute}
          disabled={validTeams.length < 1}
          size="sm"
        >
          Plan Route
        </Button>
        <Button
          onClick={handleClear}
          disabled={!hasInput}
          variant="outline"
          size="sm"
        >
          Clear
        </Button>
        {submitted && validTeams.length >= 1 && (
          <span className="ml-auto text-xs text-muted-foreground">
            {validTeams.length} pit{validTeams.length !== 1 ? "s" : ""}
          </span>
        )}
      </CardFooter>
    </Card>
  );
}
