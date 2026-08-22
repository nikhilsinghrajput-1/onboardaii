# Keystone — onboarding operations for Acropolis

Rename the platform to **Keystone**, move navigation into a left sidebar, rebuild the dashboard as a
real operations cockpit that uses every connected tool, and add four AI capabilities on top.

## Naming and design

- Platform name **Keystone** everywhere: sidebar mark, page titles, head metadata on every route,
  auth screen, emails signature line.
- New visual direction: dark-first "control room" look — deep slate canvas, warm amber accent for the
  keystone mark, monospaced numerals for metrics, thin borders and quiet cards instead of heavy
  shadows. All values as tokens in `src/styles.css`, no hardcoded colors.
- Left sidebar app shell (shadcn `sidebar`): Overview, Hires, Approvals, Tools, Members, Admin.
  Collapsible to icons, with a live connector health strip and pending-approval count badge.

## Dashboard (Overview)

- **AI briefing** at the top: a generated paragraph plus 3 "do this next" bullets, based on the
  current hires, tasks, failures and pending approvals. Refreshable, cached per day.
- Metric row: hires in flight, tasks completed today, needs approval, failed, average time-to-ready.
- Provisioning board: one row per hire with progress ring, per-tool chips (Slack, Gmail, Calendar,
  Drive, Sheets, Notion, Teams, Outlook) showing that hire's state in each tool.
- Activity feed: reverse-chronological log of every action Keystone took, grouped by tool.
- Tool health panel: every connected connector with live/inactive state and its last successful call.

## AI capabilities

1. **Daily briefing** — server-generated summary of blockers and next actions.
2. **AI onboarding plan** — when a hire is created, AI proposes the task checklist for their
   role/department/flags across connected tools; the deterministic plan stays as a fallback and the
   proposal is shown for review before it runs.
3. **Approval risk copilot** — each pending approval gets a plain-language explanation, a risk level,
   and a recommended decision with reasoning; the human still clicks approve or reject.
4. **Ask Keystone** — chat panel that answers questions about hires and tasks from live data and can
   run re-run / approve actions after an explicit confirmation step.

## New real actions across connectors

Added as onboarding steps, each recorded as a task with its own status:

- Google Calendar: book day-1 orientation and the first 1:1 with the owning team lead.
- Google Drive: create the hire's onboarding folder and share the role's doc set.
- Google Sheets: append the hire to the onboarding tracker sheet and keep status in sync.
- Notion: create the hire's onboarding page from a template.
- Microsoft Teams / Outlook: post the arrival note to a Teams channel, send the Outlook variant of
  the welcome mail when Gmail is not the org mailer.
- Slack and Gmail keep their existing behaviour.

Linear, HubSpot, Salesforce and SharePoint stay listed as not connected — no steps for them.

## Technical notes

- Server-side only AI, via the AI SDK against the Lovable AI Gateway, called from
  `createServerFn` handlers in `src/lib/ai.functions.ts` with helpers in `src/lib/ai.server.ts`.
  Small, unconstrained output schemas; guarded parse with a plain-text fallback.
- New connector calls go through the existing gateway helper pattern in `src/lib/connections.server.ts`
  using the linked workspace `*_API_KEY` secrets — one server module per tool
  (`calendar.server.ts`, `drive.server.ts`, `sheets.server.ts`, `notion.server.ts`, `teams.server.ts`,
  `outlook.server.ts`), each surfacing the provider status and body on failure.
- `onboarding-runner.server.ts` gains those steps, skipping any tool whose key is absent so a missing
  connector never fails a run.
- Migration: `ai_briefings` (cached daily briefing), `activity_log` (tool, action, hire, outcome,
  timestamp), plus per-tool reference columns on `hires` (calendar event ids, drive folder id, notion
  page id). Every new table gets GRANTs, RLS, and member-scoped policies.
- App shell moves to `src/routes/_authenticated/route.tsx` with a `KeystoneSidebar` component; existing
  route files keep their paths so nothing breaks.

## Build order

1. Tokens, Keystone naming, sidebar shell.
2. Migration for activity log, briefings, tool reference columns.
3. Per-tool server modules and the extended runner.
4. Rebuilt Overview dashboard (metrics, board, activity, tool health).
5. AI briefing, plan proposal, approval copilot, Ask Keystone panel.
