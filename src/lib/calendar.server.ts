import { dayOneAt, gatewayCall, type HireLite, type ToolStepResult } from "./gateway.server";

type EventResponse = { id?: string; htmlLink?: string };

async function createEvent(input: {
  summary: string;
  description: string;
  startIso: string;
  endIso: string;
  attendee: string | null;
}): Promise<{ ok: boolean; id: string | null; error: string | null; detail: string }> {
  const res = await gatewayCall<EventResponse>(
    "google_calendar",
    "/calendar/v3/calendars/primary/events?sendUpdates=all",
    {
      method: "POST",
      body: {
        summary: input.summary,
        description: input.description,
        start: { dateTime: input.startIso, timeZone: "UTC" },
        end: { dateTime: input.endIso, timeZone: "UTC" },
        attendees: input.attendee ? [{ email: input.attendee }] : undefined,
      },
    },
  );
  return {
    ok: res.ok,
    id: res.data?.id ?? null,
    error: res.error,
    detail: res.ok ? (res.data?.htmlLink ?? "event created") : res.raw.slice(0, 400),
  };
}

/** Books day-1 orientation and the first 1:1 with the owning team. */
export async function bookOnboardingMeetings(hire: HireLite): Promise<ToolStepResult> {
  const orientation = await createEvent({
    summary: `Day 1 orientation — ${hire.full_name}`,
    description: `Welcome session for ${hire.full_name} (${hire.role}, ${hire.department}).`,
    startIso: dayOneAt(hire.start_date, 9),
    endIso: dayOneAt(hire.start_date, 10),
    attendee: hire.email,
  });
  if (!orientation.ok) {
    return { ok: false, error: orientation.error, detail: orientation.detail };
  }

  const oneOnOne = await createEvent({
    summary: `First 1:1 — ${hire.full_name} & ${hire.owning_team ?? hire.department} lead`,
    description: `First one-to-one for ${hire.full_name}.`,
    startIso: dayOneAt(hire.start_date, 14),
    endIso: dayOneAt(hire.start_date, 15),
    attendee: hire.email,
  });

  return {
    ok: true,
    detail: `Orientation booked${oneOnOne.ok ? " and first 1:1 booked" : `; 1:1 failed: ${oneOnOne.detail}`}`,
    patch: {
      calendar_orientation_event_id: orientation.id,
      calendar_first_1on1_event_id: oneOnOne.id,
    },
  };
}
