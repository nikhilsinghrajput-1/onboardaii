import { gatewayCall, type HireLite, type ToolStepResult } from "./gateway.server";

type Listing = { value?: { id?: string; displayName?: string }[] };

/** Posts the arrival note into the first available Teams channel. */
export async function postTeamsArrivalNote(hire: HireLite): Promise<ToolStepResult> {
  const teams = await gatewayCall<Listing>("microsoft_teams", "/v1.0/me/joinedTeams");
  const teamId = teams.data?.value?.[0]?.id;
  if (!teamId) {
    return {
      ok: false,
      error: teams.error ?? "no_team",
      detail: teams.raw.slice(0, 400) || "No Teams team available",
    };
  }

  const channels = await gatewayCall<Listing>("microsoft_teams", `/v1.0/teams/${teamId}/channels`);
  const channelId =
    channels.data?.value?.find((c) => c.displayName === "General")?.id ??
    channels.data?.value?.[0]?.id;
  if (!channelId) {
    return {
      ok: false,
      error: channels.error ?? "no_channel",
      detail: channels.raw.slice(0, 400) || "No Teams channel available",
    };
  }

  const body = `<b>${hire.full_name}</b> joins as ${hire.role} in ${hire.department}${
    hire.start_date ? ` on ${hire.start_date}` : ""
  }. Keystone is provisioning their access now.`;

  const res = await gatewayCall(
    "microsoft_teams",
    `/v1.0/teams/${teamId}/channels/${channelId}/messages`,
    { method: "POST", body: { body: { contentType: "html", content: body } } },
  );
  if (!res.ok) return { ok: false, error: res.error, detail: res.raw.slice(0, 400) };
  return {
    ok: true,
    detail: "Arrival note posted to Teams",
    patch: { teams_notified_at: new Date().toISOString() },
  };
}
