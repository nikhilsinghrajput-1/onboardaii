# Remove demo data — show only real viaSocket data

Right now the database holds 3 seeded demo hires (WD-10041/42/43), 14 demo tasks, and 1 demo alert
entry. Everything the dashboard displays comes from those rows. The app code itself contains no mock
data — all pages already read live from the database.

## What changes

- Delete the seeded demo rows: all hires, their onboarding tasks, and the alert log entry (approvals
  table is already empty). Tasks and alerts are removed automatically with their hire.
- After the cleanup, the dashboard, hire detail, and approval queue show their empty states until
  viaSocket posts real data. Those empty states already exist ("No hires yet. Once the HR trigger
  fires, they appear here.").

## To get real data flowing

The webhook endpoints are live and waiting; nothing further is needed in the app. In viaSocket, point
the flow at:

- Hire created: `POST /api/public/viasocket/hire`
- Task state change: `POST /api/public/viasocket/task`

Both require the `x-viasocket-signature` HMAC header signed with the shared webhook secret. The
Integrations page in the app lists both URLs, the payload shapes, and the current secret/Slack
configuration status.

## Technical notes

- Single data-deletion statement against `hires` (cascades to `onboarding_tasks`), plus a delete of
  `alert_log`. No schema or policy changes.
