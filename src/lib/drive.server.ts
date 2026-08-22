import { gatewayCall, type HireLite, type ToolStepResult } from "./gateway.server";

type DriveFile = { id?: string; webViewLink?: string; name?: string };
type DriveList = { files?: DriveFile[] };

async function findFolder(name: string): Promise<DriveFile | null> {
  const q = encodeURIComponent(
    `name='${name.replace(/'/g, "\\'")}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
  );
  const res = await gatewayCall<DriveList>(
    "google_drive",
    `/drive/v3/files?q=${q}&fields=files(id,name,webViewLink)&pageSize=1`,
  );
  return res.data?.files?.[0] ?? null;
}

/** Creates the hire's onboarding folder inside a shared "Keystone Onboarding" root. */
export async function createOnboardingFolder(hire: HireLite): Promise<ToolStepResult> {
  let root = await findFolder("Keystone Onboarding");
  if (!root) {
    const created = await gatewayCall<DriveFile>(
      "google_drive",
      "/drive/v3/files?fields=id,webViewLink",
      {
        method: "POST",
        body: { name: "Keystone Onboarding", mimeType: "application/vnd.google-apps.folder" },
      },
    );
    if (!created.ok) return { ok: false, error: created.error, detail: created.raw.slice(0, 400) };
    root = created.data ?? null;
  }

  const folder = await gatewayCall<DriveFile>(
    "google_drive",
    "/drive/v3/files?fields=id,webViewLink",
    {
      method: "POST",
      body: {
        name: `${hire.full_name} — onboarding`,
        mimeType: "application/vnd.google-apps.folder",
        parents: root?.id ? [root.id] : undefined,
      },
    },
  );
  if (!folder.ok) return { ok: false, error: folder.error, detail: folder.raw.slice(0, 400) };

  if (hire.email && folder.data?.id) {
    await gatewayCall("google_drive", `/drive/v3/files/${folder.data.id}/permissions`, {
      method: "POST",
      body: { role: "writer", type: "user", emailAddress: hire.email },
    });
  }

  return {
    ok: true,
    detail: folder.data?.webViewLink ?? "folder created",
    patch: {
      drive_folder_id: folder.data?.id ?? null,
      drive_folder_url: folder.data?.webViewLink ?? null,
    },
  };
}
