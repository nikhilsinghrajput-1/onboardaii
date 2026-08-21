# Multi-organization onboarding control

Turn the current single-tenant dashboard into a per-organization workspace: sign in, create or pick an
organization, then see that org's hires, tasks, approvals, and its own connected tools.

## Flow after sign-in

1. Sign in at `/auth` (unchanged).
2. Land on `/orgs`: a list of the organizations you belong to, plus "Create organization" (name +
   auto slug). No orgs yet means the create form is shown directly.
3. Picking an org stores it as the active org and goes to `/dashboard`. The header gets an org
   switcher so you can move between orgs or go back to `/orgs`.
4. Dashboard, hire detail, approvals, and wiring all read and write only the active org's data.

Joining someone else's org is out of scope for now — each user creates their own. (Invites can come
later without changing this structure.)

## Data scoping

- New `organizations` and `organization_members` tables; the creator becomes owner.
- `hires`, `onboarding_tasks` (via hire), `approvals`, and `alert_log` get an org column, and every
  read policy narrows to "orgs I'm a member of". Nothing leaks between orgs.
- Each org gets its own webhook signing secret and its own webhook URLs, so the automation flow for
  one org can never write into another's data.

## Wiring page, per organization

Each org connects its own accounts — Gmail, Slack, Teams/Outlook, Google Drive/Sheets/Calendar,
Notion, Linear, HubSpot, Salesforce and the rest of the available catalog. The page lists the
available tools with Connect / Reconnect / Disconnect, shows which are live for this org, and keeps
the existing endpoint + payload reference, now showing that org's own URLs and secret.

Connections are stored encrypted, keyed to the org, and are only ever used by server-side code.
Approvals and failure alerts then go out through that org's own Slack (or email) connection rather
than one shared workspace connection.

One prerequisite: each provider needs an OAuth client registered once at the Lovable workspace level
before orgs can connect it. I'll set up the first ones (Gmail, Slack, Teams) with you in-chat and the
page will show any not-yet-available tool as "setup needed" rather than a broken button.

## Not doing

No "Action required" badge in the navigation, per your call.

## Technical notes

- Migration: `organizations`, `organization_members` (role enum owner/member), `org_id uuid not null`
  on `hires`, `approvals`, `alert_log`, and `onboarding_tasks`; `webhook_secret` on `organizations`.
  `GRANT`s for `authenticated` + `service_role`, RLS with a `is_org_member(org_id)` security-definer
  helper; existing "signed_in read everything" policies replaced by org-scoped ones.
- Active org: persisted per user (`profiles.active_org_id` or localStorage + validation server-side);
  every server fn and query derives `org_id` from membership, never from client input alone.
- Webhook routes become `/api/public/viasocket/:orgSlug/hire` and `.../task`, HMAC-verified against
  that org's `webhook_secret` (lookup with the admin client, constant-time compare). Old unscoped
  paths keep working only if a single org exists, otherwise 404.
- Per-org connections use the App User Connector flow: `app_user_connections` table keyed by
  `(org_id, connector_id)` with the `lovack_*` key AES-GCM-encrypted via
  `APP_USER_CONNECTION_KEY_SECRET`; popup + one-time code exchanged in a server fn. Connector
  clients linked with `connector_app_user--connect_client`.
- `decisions.server.ts` / `ops.server.ts` take the org's connection instead of the workspace Slack
  secret, falling back to "no channel configured" logging when an org hasn't connected anything.
- New routes: `src/routes/_authenticated/orgs.tsx`, `oauth/$connector/return.tsx`; org switcher in
  `_authenticated/route.tsx`.

## Build order

1. Migration + org-scoped RLS, active-org resolution server-side.
2. `/orgs` create/select screen, header switcher, org-scoped dashboard/approvals/hire detail.
3. Per-org webhook URLs and secrets; wiring page reference updated.
4. Per-org connector connect/disconnect; route approvals and alerts through the org's own connection.
