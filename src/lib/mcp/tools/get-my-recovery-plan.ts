import { defineTool } from "@lovable.dev/mcp-js";
import { supabaseForUser, unauthenticated } from "../supabase";

export default defineTool({
  name: "get_my_recovery_plan",
  title: "Get my recovery plan",
  description: "Fetch the signed-in participant's current recovery plan with its phases and action steps.",
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
      .from("recovery_plans")
      .select("*, plan_phases(*, plan_action_steps(*))")
      .eq("participant_id", profile.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    if (!data) return { content: [{ type: "text", text: "No recovery plan yet. Complete an assessment first." }] };
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: { plan: data },
    };
  },
});
