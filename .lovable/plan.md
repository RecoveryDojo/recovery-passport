## Goal
Republish the app so Will (and everyone on `recovery-passport.lovable.app` / `myrecoverypassport.com`) gets the current frontend bundle, including the peer intake flow with the **Start Intake** button.

## Why this fixes it
- `src/pages/CaseloadPage.tsx` renders the Start Intake button unconditionally for any authenticated user on `/caseload` — there is no role, program, or approval gate hiding it.
- Backend pieces of the intake system (tables, RLS, edge functions like `create-intake-participant`, `complete-intake-session`, `update-participant-email`) deploy immediately, but frontend code only reaches the live URL on publish.
- Will is on the live domain, so he's loading a bundle from before the intake work landed. A fresh publish updates the live bundle; a hard refresh in his browser then pulls the new assets.

## Steps
1. Run the security scan and confirm no unresolved critical findings block publish.
2. Publish the project to the existing Lovable URL — no slug change, no visibility change, no metadata rewrite (title/description are already project-specific).
3. Report back the live URL and tell you to have Will hard-refresh (Cmd/Ctrl+Shift+R) on `recovery-passport.lovable.app` or `myrecoverypassport.com`. The custom domain serves the same bundle, so both will update together.

## Out of scope
- Any code changes to the caseload page or intake flow.
- Visibility, slug, or custom-domain changes.
- Role/permission changes for Will.