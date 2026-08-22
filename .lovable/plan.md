# Keka-style landing page for Keystone

Today `/` immediately redirects signed-in and signed-out visitors to `/dashboard`. This replaces that with a real marketing landing page in Keka's structure, styled in Keystone's own control-room identity (dark slate + amber, Space Grotesk / JetBrains Mono) rather than Keka's purple.

## What the page contains

Following Keka's page rhythm, top to bottom:

1. **Sticky nav** — Keystone mark, links (Product, Workflow, Features, Security, Roadmap), "Sign in" ghost button and "Open control room" primary button.
2. **Hero** — headline ("One hire. One record. Every tool. Zero chaos."), sub-line, two CTAs, plus a live-looking dashboard mock panel to the side (tool-health dots, hires-in-flight counters) built from real markup, not a screenshot.
3. **Trust strip** — the connected tool wordmarks/labels: Slack, Gmail, Calendar, Drive, Sheets, Notion, Teams, Outlook.
4. **Problem → outcome band** — "Before Keystone / With Keystone" two-column contrast.
5. **Feature grid** — the four flagship features (Daily AI Briefing, AI Onboarding Plan, Approval Risk Copilot, Ask Keystone) plus Activity Log and Live Tool Health.
6. **Workflow section** — the 6-step onboarding flow as a numbered stepper.
7. **Metrics band** — tabular-numeral stat cards (tools orchestrated, steps automated per hire, audit coverage).
8. **Security & compliance** — RLS, audit trail, human approval gates, least-privilege access.
9. **FAQ** — accordion, 5 questions.
10. **Final CTA + footer** — "Built for Acropolis", sign-in link.

## Behaviour

- `/` renders the landing page for everyone; no auto-redirect. Signed-in users get there via the "Open control room" button (which goes to `/dashboard`), and the auth gate keeps `/dashboard` protected as it is now.
- CTAs point to `/auth` (sign in) and `/dashboard`.
- Fully responsive, single `<h1>`, semantic sections, scroll-anchored nav links.

## Technical notes

- Rewrite `src/routes/index.tsx`: drop the `beforeLoad` redirect, add a `component`, keep and refine its `head()` metadata (landing-specific title/description/og).
- Build sections as local components in one new file (`src/components/landing/…`) so the route file stays thin; use existing shadcn `button`, `card`, `badge`, `accordion`, `separator`.
- Colors come only from existing semantic tokens (`primary`, `card`, `muted-foreground`, `ok`/`run`/`wait`, `--gradient-keystone`). No hardcoded color utilities, no new dependencies, no backend or logic changes.

## Out of scope

- No pricing section (internal tool, no plans).
- No changes to auth, dashboard, connectors, or database.
