import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const channelInput = z.object({
  orgId: z.string().uuid(),
  hireId: z.string().uuid(),
});

export const createHireChannel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => channelInput.parse(input))
  .handler(async ({ data, context }) => {
    const { assertOrgMember } = await import("./connections.server");
    const { ensureHireChannel } = await import("./slack-channels.server");
    await assertOrgMember(context.supabase as never, data.orgId, context.userId);
    return ensureHireChannel(data.orgId, data.hireId);
  });
