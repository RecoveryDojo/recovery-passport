import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, unauthenticated } from "../supabase";

export default defineTool({
  name: "log_self_care_check",
  title: "Log a self-care check",
  description: "Record a self-care check-in (mood, energy, stress on a 1-5 scale) for the signed-in user. Auto-flags if stress >= 4 or mood <= 2.",
  inputSchema: {
    mood: z.number().int().min(1).max(5).describe("Mood 1 (low) to 5 (great)"),
    energy: z.number().int().min(1).max(5).describe("Energy 1 (drained) to 5 (energized)"),
    stress: z.number().int().min(1).max(5).describe("Stress 1 (calm) to 5 (overwhelmed)"),
    notes: z.string().max(2000).optional().describe("Optional free-text notes"),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  handler: async ({ mood, energy, stress, notes }, ctx) => {
    if (!ctx.isAuthenticated()) return unauthenticated();
    const sb = supabaseForUser(ctx);
    const is_flagged = stress >= 4 || mood <= 2;
    const { data, error } = await sb
      .from("self_care_checks")
      .insert({ user_id: ctx.getUserId(), mood, energy, stress, notes: notes ?? null, is_flagged })
      .select()
      .single();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: `Logged self-care check${is_flagged ? " (flagged for follow-up)" : ""}.` }],
      structuredContent: { check: data, is_flagged },
    };
  },
});
