import { teamToDivision } from "~/lib/pit-data";

const NEXUS_API_KEY = "5kwsClWC9kBRqIHh2N7MNxS5-Y4";

const DIVISION_EVENT_KEYS: Record<string, string> = {
  archimedes: "2026arc",
  curie: "2026cur",
  daly: "2026dal",
  galileo: "2026gal",
  hopper: "2026hop",
  johnson: "2026joh",
  milstein: "2026mil",
  newton: "2026new",
};

// Override specific divisions with test event keys for development.
const TEST_EVENT_KEY_OVERRIDES: Record<string, string> = {
  // newton: "demo2750",
};

interface NexusMatch {
  label: string;
  status: string;
  redTeams?: string[];
  blueTeams?: string[];
  times?: {
    estimatedQueueTime?: number;
  };
}

export interface QueueInfo {
  label: string;
  status: string;
  time: Date | null;
}

interface NexusEventResponse {
  matches: NexusMatch[];
}

export async function fetchNextQueueTime(team: number): Promise<QueueInfo | null> {
  try {
    const division = teamToDivision.get(team);
    if (!division) return null;

    const eventKey = TEST_EVENT_KEY_OVERRIDES[division] ?? DIVISION_EVENT_KEYS[division];
    if (!eventKey) return null;

    const res = await fetch(`https://frc.nexus/api/v1/event/${eventKey}`, {
      headers: { "Nexus-Api-Key": NEXUS_API_KEY },
    });
    if (!res.ok) return null;

    const data = (await res.json()) as NexusEventResponse;
    const teamStr = String(team);

    const nextMatch = data.matches.find(
      (m) => m.redTeams?.includes(teamStr) || m.blueTeams?.includes(teamStr)
    );

    if (!nextMatch) return null;
    const time = nextMatch.times?.estimatedQueueTime
      ? new Date(nextMatch.times.estimatedQueueTime)
      : null;
    return { label: nextMatch.label, status: nextMatch.status, time };
  } catch {
    return null;
  }
}
