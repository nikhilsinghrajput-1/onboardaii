import { auth, defineMcp } from "@lovable.dev/mcp-js";

import decideApprovalTool from "./tools/decide-approval";
import getHireTool from "./tools/get-hire";
import listHiresTool from "./tools/list-hires";
import listPendingApprovalsTool from "./tools/list-pending-approvals";

const projectRef = import.meta.env['VITE_SUPABASE_PROJECT_ID'] ?? "project-ref-unset";

export default defineMcp({
  name: "onboard-genie",
  title: "Onboard Genie",
  version: "0.1.0",
  instructions:
    "Tools for Acropolis onboarding. Use `list_hires` to see new hires and their provisioning progress, `get_hire_onboarding` for one hire's full task detail, `list_pending_approvals` for tasks waiting on a human, and `decide_approval` to approve or reject one.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listHiresTool, getHireTool, listPendingApprovalsTool, decideApprovalTool],
});
