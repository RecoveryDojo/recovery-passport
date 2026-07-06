import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, unauthenticated } from "../supabase";

export default defineTool({
  name: "list_my_checkins",
  title: "List my weekly check-ins",
  description: "List the signed-in participant's recent weekly check-ins, most recent first.",
  inputSchema: {
    limit: z.number().int().min(1).max(50).default(10).describe("Max number of check-ins to return"),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit }, ctx) => {
    if (!ctx.isAuthenticated()) return unauthenticated();
    const sb = supabaseForUser(ctx);
    const { data: profile } = await sb
      .from("participant_profiles")
      .select("id")
      .eq("user_id", ctx.getUserId())
      .maybeSingle();
    if (!profile) return { content: [{ type: "text", text: "No participant profile." }], isError: true };

    const { data, error } = await sb
      .from("weekly_checkins")
      .select("*")
      .eq("participant_id", profile.id)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: { checkins: data },
    };
  },
});
