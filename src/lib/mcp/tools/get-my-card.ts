import { defineTool } from "@lovable.dev/mcp-js";
import { supabaseForUser, unauthenticated } from "../supabase";

export default defineTool({
  name: "get_my_card",
  title: "Get my Recovery Card",
  description: "Fetch the signed-in participant's Recovery Card: card level, days engaged, program, and profile summary.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    if (!ctx.isAuthenticated()) return unauthenticated();
    const sb = supabaseForUser(ctx);
    const { data, error } = await sb
      .from("participant_profiles")
      .select("id, display_name, card_level, days_engaged, program_id, created_at, programs(name, type)")
      .eq("user_id", ctx.getUserId())
      .maybeSingle();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    if (!data) return { content: [{ type: "text", text: "No participant profile found for this user." }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: { card: data },
    };
  },
});
