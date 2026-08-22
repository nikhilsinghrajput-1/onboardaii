# Single-tenant pivot: Acropolis only

The app becomes an internal tool for one organization, Acropolis. No org creation, no org
switching, no per-org onboarding. Access is restricted to people who have been added as members.

## What changes for you

- Sign in goes straight to the dashboard. The "Your organizations" screen and the header org
  switcher are gone.
- Everything (hires, approvals, wiring, relay) always shows Acropolis data.
- The Wiring page becomes the single settings page for Acropolis: its Slack/Gmail connections,
  its webhook URLs, its webhook secret, and its flow trigger URL.
- Webhook URLs simplify to fixed paths (no org slug in the URL). Your automation URLs get
  updated, so the viaSocket/Make side needs the new URLs pasted in once.
- A new **Members** section on the Wiring page lists who has access and lets an admin add or
  remove people by email. Anyone who signs in without being a member sees a plain
  "Ask an admin for access" screen instead of the dashboard.

## Data cleanup

All existing organizations and their data are deleted (5 orgs, 10 hires, tasks, approvals,
alert log, connections), then one fresh Acropolis organization is created. Your Slack connection
will need to be reconnected once from the Wiring page. The relay delivery log is untouched.

## Access model

- Members are stored in a members table keyed to the single org. You (the current signed-in
  owner) are seeded as admin.
- Adding a member by email pre-authorises them: when that email signs in, they are matched and
  linked automatically. Admins can promote/remove; the last admin cannot remove themselves.

## Technical notes

- Keep the `organizations` table and the `org_id` columns rather than ripping them out — that
  keeps RLS, existing policies, FKs, and the per-org secret model intact with no risky wide
  refactor. Enforce singleton-ness instead:
  - Migration: delete all rows from `alert_log`, `approvals`, `onboarding_tasks`, `hires`,
    `org_connections`, `organization_members`, `organizations`; insert one row
    (`name: 'Acropolis'`, `slug: 'acropolis'`, fresh `webhook_secret`); add a unique index so
    only one organization row can ever exist; drop `create_organization()`.
  - `organization_members` gains `email text` and a `pending` state so members can be
    pre-authorised before first sign-in; a trigger/`link_member_on_login` server fn matches
    `auth.email()` to a pending row and claims it. RLS: members read their own org's rows;
    admins (existing `is_org_owner`) insert/update/delete.
  - New server helper `getSingleOrg()` in `org-ops.server.ts` (cached select of the only row).
    `loadOrgBySlug` kept only for backwards-compatible legacy webhook paths.
- Frontend: replace `src/lib/org-context.tsx` with a provider that resolves the single org and
  the caller's membership (`activeOrg`, `membership`, `isMember`). Delete
  `src/routes/_authenticated/orgs.tsx` and the `OrgSwitcher`; `OrgGate` becomes a
  membership gate rendering the no-access screen. `dashboard.tsx`, `approvals.tsx`,
  `hires.$hireId.tsx`, `integrations.tsx` keep using `activeOrg.id`, so their queries need no
  change beyond the removal of the "no org yet" branches.
- Webhooks: add `src/routes/api/public/onboarding/hire.ts` and `.../task.ts` that resolve the
  single org and verify HMAC against its secret; keep the existing
  `/api/public/viasocket/$orgSlug/*` routes working (they resolve the same single org when the
  slug matches or is `acropolis`) so nothing breaks mid-migration.
- Head metadata on remaining routes updated to name Acropolis.

## Build order

1. Migration: wipe data, seed the single Acropolis org, singleton index, member email/pending
   columns + policies.
2. Single-org context + membership gate; delete `/orgs` and the switcher.
3. Members management UI on the Wiring page; unslugged webhook routes and updated URL reference.
