# Navigation Audit + Fix Plan

## What I found

### How admins sign in (today)
There is no admin-specific entry point. The public landing page shows two big buttons — "I'm in Recovery" and "I'm a Peer Specialist" — plus a small low-contrast link at the bottom: "For staff and supervisors →" pointing at `/login`. `/login` is a single shared form; after sign-in the role decides the destination (`/card`, `/caseload`, `/admin`). Admins cannot self-register at all — an account is created as participant or peer and then promoted in the database. Nothing in the UI communicates that.

### Reachability gaps by role

Participant bottom nav has 5 items: My Card, My Plan, Resources, Passport, Profile.
Not in the nav: Milestones, Check-ins, Progress dashboard, Assessment (take/history), Agreements, Payments, Browse Peers, My Intake. Those pages exist and are routed, but the only way in is a card or button somewhere on another screen — or typing the URL.

Peer bottom nav has 4 items: Caseload, Check-Ins, My Progress, Profile.
Not in the nav: Self-care check (`/crps/selfcare`), active intake sessions, intake packets. Intake work is reachable only by drilling into a specific participant.

Admin sidebar has 9 items, but the mobile bottom bar renders only the first 5 — on a phone, Intake Packets, Reports, Audit Log and Docs are unreachable. The Content hub is a tile grid of 12 sub-editors with no sub-navigation, so moving between two editors means going back to the hub each time.

### Other friction
- Sign out lives only inside each role's profile page; it is not in any header.
- The header on every role says only "Recovery Passport" / "Admin" — no indication of who is signed in.
- No breadcrumbs on deep admin routes (`/admin/content/instruments/:id`, `/admin/intake-sessions/:id`), so the only way back is the browser button.

## Proposed fixes

1. Landing page: replace the buried staff link with a clear third path — "Staff sign in" — that goes to `/login`, and add a short line on `/login` explaining that admin access is granted by an administrator, not by signing up.
2. Universal account menu in the header for all three roles: shows name/email and role, with links to Profile, Notifications, and Sign out.
3. Participant nav: keep 5 slots, make the 5th a "More" sheet listing Milestones, Progress, Check-ins, Assessments, Agreements, Payments, My Intake, Browse Peers, Profile.
4. Peer nav: add a "More" sheet with Self-care check, Active intakes, and Profile; surface an "In-progress intakes" entry on the caseload screen.
5. Admin mobile: replace the truncated 5-item bar with 4 primary items plus a "More" sheet containing the full sidebar list.
6. Admin content hub: add a persistent sub-nav (tabs or secondary rail) shared by all 12 content editors, so switching editors is one click.
7. Breadcrumbs on nested admin and peer detail routes.

## Technical notes
- All work is presentation-layer: `LandingPage.tsx`, `Login.tsx`, the three layout components, a new `AccountMenu` component, a new `MoreSheet` component (shadcn `Sheet`), and a shared `ContentSubNav` for `/admin/content/*`.
- No routes are added or removed, no schema, RLS, or query changes.
- Nav item lists get centralized in one module per role so nav and "More" stay in sync.
