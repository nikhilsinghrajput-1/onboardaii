import { gatewayCall, type HireLite, type ToolStepResult } from "./gateway.server";

type NotionSearch = { results?: { id?: string; object?: string }[] };
type NotionPage = { id?: string; url?: string };

const NOTION_VERSION = "2022-06-28";

async function parentPageId(): Promise<string | null> {
  const res = await gatewayCall<NotionSearch>("notion", "/v1/search", {
    method: "POST",
    headers: { "Notion-Version": NOTION_VERSION },
    body: { filter: { value: "page", property: "object" }, page_size: 1 },
  });
  return res.data?.results?.[0]?.id ?? null;
}

/** Creates the hire's onboarding page in Notion. */
export async function createNotionOnboardingPage(hire: HireLite): Promise<ToolStepResult> {
  const parent = await parentPageId();
  if (!parent) {
    return { ok: false, error: "no_parent_page", detail: "No Notion page is shared with Keystone" };
  }

  const bullets = [
    `Role: ${hire.role} · ${hire.department}`,
    `Start date: ${hire.start_date ?? "TBD"}`,
    hire.slack_channel_name ? `Slack channel: #${hire.slack_channel_name}` : "Slack channel: pending",
    "Day 1: orientation, tooling walkthrough, meet the team",
    "Week 1: first 1:1, read the team docs, ship a small change",
  ];

  const res = await gatewayCall<NotionPage>("notion", "/v1/pages", {
    method: "POST",
    headers: { "Notion-Version": NOTION_VERSION },
    body: {
      parent: { page_id: parent },
      properties: {
        title: [{ type: "text", text: { content: `Onboarding — ${hire.full_name}` } }],
      },
      children: bullets.map((line) => ({
        object: "block",
        type: "bulleted_list_item",
        bulleted_list_item: { rich_text: [{ type: "text", text: { content: line } }] },
      })),
    },
  });
  if (!res.ok) return { ok: false, error: res.error, detail: res.raw.slice(0, 400) };
  return {
    ok: true,
    detail: res.data?.url ?? "Notion page created",
    patch: { notion_page_id: res.data?.id ?? null, notion_page_url: res.data?.url ?? null },
  };
}
