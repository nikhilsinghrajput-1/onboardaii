import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  getRelayStatus,
  listRelayDeliveries,
  sendTestRelay,
} from "@/lib/relay.functions";

export const Route = createFileRoute("/_authenticated/relay")({
  head: () => ({
    meta: [
      { title: "Callback Relay · Acropolis Onboarding" },
      {
        name: "description",
        content:
          "Test and monitor the onboarding callback relay: forward task and hire updates to any runtime callback URL with retries and delivery logs.",
      },
      { property: "og:title", content: "Callback Relay" },
      {
        property: "og:description",
        content: "Forward onboarding updates to runtime callback URLs with retries and logs.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RelayPage,
});

const EXAMPLE_PAYLOAD = `{
  "event": "employee.onboarding",
  "hire_id": "H123",
  "employee_email": "newhire@company.com",
  "employee_name": "Jane Doe",
  "signature_valid": true,
  "approval_required": false,
  "tasks": []
}`;

type EndpointType = "task-update" | "hire-update";

function CopyButton({ value, label }: { value: string; label: string }) {
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          toast.success(`${label} copied.`);
        } catch {
          toast.error("Could not copy to clipboard.");
        }
      }}
    >
      Copy {label}
    </Button>
  );
}

function RelayPage() {
  const runTest = useServerFn(sendTestRelay);
  const fetchLogs = useServerFn(listRelayDeliveries);
  const fetchStatus = useServerFn(getRelayStatus);

  const [endpointType, setEndpointType] = useState<EndpointType>("task-update");
  const [callbackUrl, setCallbackUrl] = useState("");
  const [payloadText, setPayloadText] = useState(EXAMPLE_PAYLOAD);
  const [headersText, setHeadersText] = useState("");
  const [search, setSearch] = useState("");
  const [outcome, setOutcome] = useState<"all" | "ok" | "failed">("all");
  const [filterEndpoint, setFilterEndpoint] = useState<EndpointType | "all">("all");

  const status = useQuery({ queryKey: ["relay-status"], queryFn: () => fetchStatus({}) });
  const logs = useQuery({
    queryKey: ["relay-logs", search, outcome, filterEndpoint],
    queryFn: () =>
      fetchLogs({
        data: { search: search || undefined, outcome, endpointType: filterEndpoint, limit: 50 },
      }),
    refetchInterval: 15_000,
  });

  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const endpoints = useMemo(
    () => ({
      "task-update": `${origin}/api/public/onboarding/task-update`,
      "hire-update": `${origin}/api/public/onboarding/hire-update`,
      health: `${origin}/api/public/onboarding/health`,
    }),
    [origin],
  );

  const exampleRequest = `curl -X POST ${endpoints[endpointType]} \\
  -H "Content-Type: application/json" \\
  -H "x-relay-secret: <RELAY_SHARED_SECRET>" \\
  -d '{
    "callback_url": "https://example.com/callback",
    "payload": ${EXAMPLE_PAYLOAD.split("\n").join("\n    ")},
    "headers": { "Authorization": "Bearer optional-token" }
  }'`;

  const test = useMutation({
    mutationFn: async () => {
      let payload: Record<string, unknown>;
      try {
        payload = JSON.parse(payloadText) as Record<string, unknown>;
      } catch {
        throw new Error("Payload is not valid JSON.");
      }
      if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
        throw new Error("Payload must be a JSON object.");
      }
      let headers: Record<string, string> | undefined;
      if (headersText.trim()) {
        try {
          const parsed = JSON.parse(headersText) as Record<string, unknown>;
          headers = Object.fromEntries(
            Object.entries(parsed).map(([k, v]) => [k, String(v)]),
          );
        } catch {
          throw new Error("Headers are not valid JSON.");
        }
      }
      if (!callbackUrl.trim()) throw new Error("Enter a callback URL.");
      return runTest({
        data: {
          endpointType,
          callbackUrl: callbackUrl.trim(),
          payload,
          ...(headers ? { headers } : {}),
        },
      });
    },
    onSuccess: (result) => {
      if (result.ok) toast.success(`Delivered (${result.status_code}) in ${result.attempts} attempt(s).`);
      else toast.error(result.error ?? "Delivery failed.");
      void logs.refetch();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Test failed."),
  });

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Callback Relay</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Your automation POSTs <code className="font-mono text-xs">{`{ callback_url, payload, headers }`}</code>{" "}
        here and this service forwards the payload to that URL with retries, logging every attempt.
      </p>

      <section className="mt-8 grid gap-3 sm:grid-cols-3">
        {(["task-update", "hire-update", "health"] as const).map((key) => (
          <div key={key} className="rounded-xl border border-border/70 bg-card p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              {key === "health" ? "GET health" : `POST ${key}`}
            </p>
            <p className="mt-1 font-mono text-xs break-all">{endpoints[key]}</p>
            <div className="mt-3">
              <CopyButton value={endpoints[key]} label="URL" />
            </div>
          </div>
        ))}
      </section>

      <p className="mt-4 text-sm">
        Shared secret header:{" "}
        <code className="font-mono text-xs">x-relay-secret: &lt;RELAY_SHARED_SECRET&gt;</code>{" "}
        {status.data ? (
          status.data.secretConfigured ? (
            <span className="text-ok">— configured</span>
          ) : (
            <span className="text-destructive">— not configured</span>
          )
        ) : null}
        {status.data?.allowlist.length ? (
          <span className="text-muted-foreground">
            {" "}
            · allowlisted hosts: {status.data.allowlist.join(", ")}
          </span>
        ) : null}
      </p>

      <section className="mt-10 rounded-xl border border-border/70 bg-card p-6">
        <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
          Send a test request
        </h2>
        <div className="mt-4 grid gap-4">
          <div className="flex flex-wrap items-center gap-2">
            {(["task-update", "hire-update"] as const).map((type) => (
              <Button
                key={type}
                size="sm"
                variant={endpointType === type ? "default" : "outline"}
                onClick={() => setEndpointType(type)}
              >
                {type}
              </Button>
            ))}
          </div>
          <label className="text-sm">
            <span className="text-muted-foreground">Callback URL</span>
            <Input
              className="mt-1"
              value={callbackUrl}
              onChange={(e) => setCallbackUrl(e.target.value)}
              placeholder="https://hook.eu2.make.com/…"
            />
          </label>
          <label className="text-sm">
            <span className="text-muted-foreground">Payload (JSON)</span>
            <Textarea
              className="mt-1 font-mono text-xs"
              rows={12}
              value={payloadText}
              onChange={(e) => setPayloadText(e.target.value)}
            />
          </label>
          <label className="text-sm">
            <span className="text-muted-foreground">Headers (JSON, optional)</span>
            <Textarea
              className="mt-1 font-mono text-xs"
              rows={3}
              value={headersText}
              onChange={(e) => setHeadersText(e.target.value)}
              placeholder={`{ "Authorization": "Bearer token" }`}
            />
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" disabled={test.isPending} onClick={() => test.mutate()}>
              {test.isPending ? "Sending…" : "Send test request"}
            </Button>
            <CopyButton value={exampleRequest} label="example request" />
            <CopyButton value={EXAMPLE_PAYLOAD} label="example payload" />
          </div>
        </div>

        {test.data && (
          <pre className="mt-5 overflow-auto rounded-lg bg-muted p-4 font-mono text-xs whitespace-pre-wrap">
            {JSON.stringify(test.data, null, 2)}
          </pre>
        )}
      </section>

      <section className="mt-12">
        <div className="flex flex-wrap items-end gap-3">
          <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
            Recent deliveries
          </h2>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Input
              className="h-9 w-56"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search URL, hire, event, email"
            />
            {(["all", "task-update", "hire-update"] as const).map((type) => (
              <Button
                key={type}
                size="sm"
                variant={filterEndpoint === type ? "default" : "outline"}
                onClick={() => setFilterEndpoint(type)}
              >
                {type}
              </Button>
            ))}
            {(["all", "ok", "failed"] as const).map((state) => (
              <Button
                key={state}
                size="sm"
                variant={outcome === state ? "default" : "outline"}
                onClick={() => setOutcome(state)}
              >
                {state}
              </Button>
            ))}
          </div>
        </div>

        {logs.isLoading && <Skeleton className="mt-4 h-40 w-full" />}
        {logs.data && logs.data.length === 0 && (
          <p className="mt-4 text-sm text-muted-foreground">No deliveries recorded yet.</p>
        )}
        <ul className="mt-4 space-y-2">
          {logs.data?.map((row) => (
            <li key={row.id} className="rounded-xl border border-border/70 bg-card p-4 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`size-2 rounded-full ${row.ok ? "bg-ok" : "bg-destructive"}`} />
                <span className="font-medium">{row.endpoint_type}</span>
                <span className="text-muted-foreground">
                  {row.status_code ?? "no response"} · {row.attempts} attempt
                  {row.attempts === 1 ? "" : "s"}
                  {row.duration_ms != null ? ` · ${row.duration_ms}ms` : ""}
                </span>
                <span className="ml-auto text-xs text-muted-foreground">
                  {new Date(row.created_at).toLocaleString()}
                </span>
              </div>
              <p className="mt-2 font-mono text-xs break-all text-muted-foreground">
                {row.callback_url}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {[row.event, row.hire_ref, row.employee_email, `via ${row.source}`]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
              {row.error && <p className="mt-1 text-xs text-destructive">{row.error}</p>}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
