import { createFileRoute } from "@tanstack/react-router";

import { applyDecision } from "@/lib/decisions.server";
import { verifySlackSignature } from "@/lib/ops.server";

type SlackAction = { action_id?: string; value?: string };
type SlackInteraction = {
  type?: string;
  user?: { id?: string; name?: string; username?: string };
  actions?: SlackAction[];
  response_url?: string;
};

export const Route = createFileRoute("/api/public/slack/events")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const raw = await request.text();

        // URL verification handshake happens before any signature check.
        if (raw.startsWith("{")) {
          try {
            const json = JSON.parse(raw) as { type?: string; challenge?: string };
            if (json.type === "url_verification" && json.challenge) {
              return new Response(json.challenge, {
                headers: { "content-type": "text/plain" },
              });
            }
          } catch {
            /* fall through to normal handling */
          }
        }

        if (request.headers.get("x-slack-retry-num")) {
          return new Response("ok");
        }

        const verdict = verifySlackSignature(
          raw,
          request.headers.get("x-slack-request-timestamp"),
          request.headers.get("x-slack-signature"),
        );
        if (verdict === "no_secret") return new Response("ok");
        if (verdict === "invalid") return new Response("Invalid signature", { status: 401 });

        const params = new URLSearchParams(raw);
        const payloadRaw = params.get("payload");
        if (!payloadRaw) return new Response("ok");

        let payload: SlackInteraction;
        try {
          payload = JSON.parse(payloadRaw) as SlackInteraction;
        } catch {
          return new Response("ok");
        }

        const action = payload.actions?.[0];
        if (!action?.value || !action.action_id) return new Response("ok");
        if (action.action_id !== "approve_task" && action.action_id !== "reject_task") {
          return new Response("ok");
        }

        const decision = action.action_id === "approve_task" ? "approved" : "rejected";
        const who = payload.user?.username ?? payload.user?.name ?? payload.user?.id ?? "Slack user";

        try {
          const result = await applyDecision({
            taskId: action.value,
            decision,
            note: `${decision === "approved" ? "Approved" : "Rejected"} from Slack by ${who}`,
            decidedByLabel: `${who} (Slack)`,
            channel: "slack",
          });
          return Response.json({
            response_type: "ephemeral",
            replace_original: false,
            text: result.ok
              ? `Recorded: ${decision} by ${who}.`
              : (result.message ?? "Nothing to do."),
          });
        } catch (error) {
          console.error("Slack decision failed", error);
          return Response.json({
            response_type: "ephemeral",
            text: "Could not record that decision — check the dashboard.",
          });
        }
      },
    },
  },
});
