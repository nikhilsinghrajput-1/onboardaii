# Onboarding Callback Relay

A secure relay inside this app: your automation POSTs `{ callback_url, payload, headers }` to a relay endpoint, and the relay forwards `payload` to that URL with retries, logs every attempt, and returns a delivery result. Needed because viaSocket has no usable generic HTTP request step.

## Endpoints (public, secret-protected)

Public endpoints must live under `/api/public/*` so the published site's auth doesn't block your automation:

- `POST /api/public/onboarding/task-update`
- `POST /api/public/onboarding/hire-update`
- `GET /api/public/onboarding/health` — `{ ok: true, time }`

Every relay call requires header `x-relay-secret: <RELAY_SHARED_SECRET>`. Missing/wrong secret → 401.

## Behavior

1. Verify `x-relay-secret` (timing-safe compare).
2. Rate limit per secret+IP: 60 requests/minute → 429 with `Retry-After`.
3. Validate body with Zod: `callback_url` required, must parse as `http:`/`https:` URL; `payload` required object; `headers` optional flat string map (hop-by-hop and `host`/`content-length` stripped).
4. Optional allowlist: if `RELAY_ALLOWED_HOSTS` is set (comma-separated hostnames, `*.example.com` supported), reject other hosts with 403. Unset = allow any public host. Loopback/private/link-local hosts are always rejected (SSRF guard).
5. Forward `POST callback_url` with `Content-Type: application/json`, the exact `payload` object as body, plus any supplied headers. 15s timeout per attempt.
6. Retry up to 3 attempts total on network error, timeout, or HTTP 5xx/429; exponential backoff 500ms → 1s → 2s. 4xx (except 429) is final, no retry.
7. Write a delivery-log row and return the result JSON.

Response shapes exactly as specified:
`{ ok, forwarded_to, status_code, attempts, endpoint_type }`, plus `error` on failure.

## Delivery history

New table `relay_deliveries`: `id`, `endpoint_type`, `callback_url`, `callback_host`, `status_code`, `attempts`, `ok`, `error`, `hire_id`/`hire_ref` and `event` pulled from the payload when present, `payload_preview` (payload JSON truncated to 4KB), `response_preview` (truncated), `duration_ms`, `created_at`.

- Written server-side with the admin client.
- RLS enabled; no `anon` access. Signed-in users read via an authenticated server function (`listRelayDeliveries`) with search + filters.
- Supplied `headers` are never stored, and `Authorization`/`x-relay-secret` values are redacted in logs (`Bearer ***`).

## Admin/testing UI

New authenticated page `/relay` (added to the nav):

- Endpoint type toggle (task-update / hire-update)
- Callback URL field
- Payload JSON textarea (prefilled with the example, validated client-side)
- Optional headers JSON textarea
- "Send test request" → calls an authenticated server function that invokes the relay logic directly (server-side, so the shared secret never reaches the browser)
- Result panel: ok/failed, status code, attempts, target URL, duration
- Recent deliveries table with search (URL, hire, event) and filters (endpoint type, ok/failed), auto-refresh
- Copy buttons for a ready-made example request body and for each endpoint URL

## Structured logging

Each stage logs one JSON line via `console.log`/`console.error`: `{ stage: "inbound" | "attempt" | "result", endpoint_type, callback_host, attempt, status, duration_ms }`. No secrets, no tokens, no full payloads.

## Environment variables

- `RELAY_SHARED_SECRET` (required) — you generate it; I store it via the secure secret form so you can paste the same value into viaSocket.
- `RELAY_ALLOWED_HOSTS` (optional) — e.g. `hook.eu2.make.com,flow.sokt.io`.

Secrets live in the backend secret store, not in a committed `.env`; they are read inside server handlers only, never `VITE_`-prefixed.

## Technical notes

- Stack stays as-is: TanStack Start server routes (`createFileRoute` + `server.handlers`), not Next.js.
- Shared logic in `src/lib/relay.server.ts` (validation, SSRF/allowlist checks, retry loop, logging, DB write); thin route files under `src/routes/api/public/onboarding/`; `src/lib/relay.functions.ts` for the authenticated test-send and log-list server functions.
- Rate limiter is in-memory per worker instance (adequate here); noted as best-effort.
- Migration creates `relay_deliveries` with GRANTs (`service_role` full, `authenticated` select) and RLS policies.

## What you get at the end

Final URLs to use from your automation (published site):

- `https://onboardaii.lovable.app/api/public/onboarding/task-update`
- `https://onboardaii.lovable.app/api/public/onboarding/hire-update`
- `https://onboardaii.lovable.app/api/public/onboarding/health`

Plus the exact request body/header example and the local-run and deploy notes (this project runs on Lovable's preview and publishes from the Publish button; no separate deploy pipeline needed).
