import { defineTool } from "@lovable.dev/mcp-js";
import { supabaseForUser, unauthenticated } from "../supabase";

export default defineTool({
  name: "list_my_milestones",
  title: "List my milestones",
  description: "List all milestones for the signed-in participant with their status and unlock dates.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    if (!ctx.isAuthenticated()) return unauthenticated();
    const sb = supabaseForUser(ctx);
    const { data: profile } = await sb
      .from("participant_profiles")
      .select("id")
      .eq("user_id", ctx.getUserId())
      .maybeSingle();
    if (!profile) return { content: [{ type: "text", text: "No participant profile." }], isError: true };

    const { data, error } = await sb
      .from("participant_milestones")
      .select("id, status, unlocked_at, milestone_definitions(name, description, category, points)")
      .eq("participant_id", profile.id);
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: { milestones: data },
    };
  },
});
