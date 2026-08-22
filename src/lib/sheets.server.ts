import { gatewayCall, type HireLite, type ToolStepResult } from "./gateway.server";

const TRACKER_NAME = "Keystone Onboarding Tracker";

type DriveList = { files?: { id?: string; name?: string }[] };
type SheetCreate = { spreadsheetId?: string; spreadsheetUrl?: string };

async function trackerId(): Promise<string | null> {
  const q = encodeURIComponent(
    `name='${TRACKER_NAME}' and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false`,
  );
  const found = await gatewayCall<DriveList>(
    "google_drive",
    `/drive/v3/files?q=${q}&fields=files(id,name)&pageSize=1`,
  );
  const existing = found.data?.files?.[0]?.id;
  if (existing) return existing;

  const created = await gatewayCall<SheetCreate>("google_sheets", "/v4/spreadsheets", {
    method: "POST",
    body: { properties: { title: TRACKER_NAME } },
  });
  return created.data?.spreadsheetId ?? null;
}

/** Appends the hire to the shared onboarding tracker sheet. */
export async function appendHireToTracker(hire: HireLite): Promise<ToolStepResult> {
  const id = await trackerId();
  if (!id) return { ok: false, error: "tracker_missing", detail: "Could not open the tracker sheet" };

  const res = await gatewayCall(
    "google_sheets",
    `/v4/spreadsheets/${id}/values/A1:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
    {
      method: "POST",
      body: {
        values: [
          [
            hire.full_name,
            hire.email ?? "",
            hire.role,
            hire.department,
            hire.start_date ?? "",
            hire.owning_team ?? "",
            hire.slack_channel_name ? `#${hire.slack_channel_name}` : "",
            new Date().toISOString(),
          ],
        ],
      },
    },
  );
  if (!res.ok) return { ok: false, error: res.error, detail: res.raw.slice(0, 400) };
  return {
    ok: true,
    detail: `Row appended to ${TRACKER_NAME}`,
    patch: { sheets_row_synced_at: new Date().toISOString() },
  };
}
