import { auth, defineMcp } from "@lovable.dev/mcp-js";
import getMyCard from "./tools/get-my-card";
import listMyMilestones from "./tools/list-my-milestones";
import listMyCheckins from "./tools/list-my-checkins";
import logSelfCareCheck from "./tools/log-self-care-check";
import getMyRecoveryPlan from "./tools/get-my-recovery-plan";

// Direct Supabase host is required as the OAuth issuer (mcp-js validates it
// against the discovery document — the .lovable.cloud proxy will not match).
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "recovery-passport-mcp",
  title: "Recovery Passport",
  version: "0.1.0",
  instructions:
    "Tools for a Recovery Passport participant. Every tool acts as the signed-in user via Supabase RLS. Use `get_my_card` for the participant's card, `list_my_milestones` for milestone progress, `list_my_checkins` for recent weekly check-ins, `get_my_recovery_plan` for the active plan, and `log_self_care_check` to record a mood/energy/stress check-in.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [getMyCard, listMyMilestones, listMyCheckins, logSelfCareCheck, getMyRecoveryPlan],
});
