# Screenshot Capture — Self-Validating

Yes. The right fix isn't "don't make the mistake" — it's "make the script verify every shot before saving it." Here's how I'll do it.

## The validation gate (per route)

Before saving any screenshot, the Playwright script will check, in order:

1. **URL check** — after `page.goto(route)`, confirm `page.url()` ends with the expected path (not `/login`, not `/`, not `/404`).
2. **Body check** — assert the rendered page does NOT contain the strings `"404"`, `"Page not found"`, `"Oops"`, or `"Sign in"` when we expect to be authenticated.
3. **Marker check** — wait (up to 8s) for a known DOM marker for that route (e.g. `[data-testid="card-page"]` or a known heading like `"Your Card"`). If it never appears, the route is broken or behind a different gate.
4. **Loading check** — wait for any `Loader2` spinner to disappear and for `networkidle` so we don't capture mid-skeleton states.

If any check fails: log `SKIP route=/x reason=...`, do NOT save the file, move on.

## Per-persona recovery

For each persona login:

- Navigate to `/login`, fill creds, submit
- Wait for redirect off `/login` (timeout 10s)
- If still on `/login` after timeout → log `LOGIN FAILED persona=marcus`, skip persona
- After login, capture the persona's home route as a sanity check before fanning out

## Coverage map (with expected post-login route + DOM marker)

| Persona | Routes |
|---|---|
| Marcus (all-star participant) | `/card`, `/plan`, `/milestones`, `/checkins`, `/passport`, `/resources`, `/payments` |
| Jasmine (crisis) | `/card`, `/checkins` (crisis flag visible) |
| Tasha (day-1) | `/card`, `/agreements`, `/profile/setup` |
| Devon (mid) | `/card`, `/plan` |
| Maria (certified peer) | `/caseload`, `/caseload/:id`, `/crps`, `/self-care`, `/notifications` |
| Daniela (in-training peer) | `/self-care` (flagged), `/caseload` |
| Kim (pending peer) | holding screen |
| Pat (admin) | `/admin`, `/admin/users`, `/admin/peers`, `/admin/audit`, `/admin/programs` |
| Public passport | `/passport/demo-marcus-lmfbx737` |

Each row = one log line in the output report so you can audit what was captured vs. skipped.

## Output

- Shots saved to `/tmp/shots/{persona}/{route-slug}.png` at 390×844 (mobile) and 1280×800 (desktop where it adds value)
- Capture report saved to `/tmp/shots/_report.txt` listing OK / SKIP / FAIL per route
- I'll show you the report before I start building the deck

## Then

Once the report is clean, build the 60-slide REF-branded `.pptx` using only verified shots, with bezel frames and design slides filling the rest.

## Ready to switch back to build mode?

If yes, hit "Implement plan" and I'll run the capture script + show the report before touching pptxgenjs.
