# Event-Triggered Emails

Send branded emails from `myrecoverypassport.com` when key events happen, with admin-editable templates in the Content Hub.

## Events covered

| Event | Recipient | Email |
|---|---|---|
| Role granted (admin / peer / participant) | The user | "You've been given access as {role}" |
| Role removed | The user | "Your {role} access was removed" |
| Peer application approved | The peer specialist | "You're approved — sign in to your caseload" |
| Peer application rejected | The peer specialist | Decision notice with next steps |
| Milestone unlocked | The participant | Celebration email with the milestone name |
| Card level up | The participant | "You reached {level}" |

Emails only go to users with a real address — accounts still on a placeholder intake address are skipped silently.

## Step 1 — Email domain setup

Sending requires a verified sender subdomain (e.g. `notify.myrecoverypassport.com`). You'll complete a short setup dialog; DNS verification runs in the background and doesn't block the rest of the build.

## Step 2 — Email infrastructure

Set up the queue, send log, suppression list, and unsubscribe handling, plus the app-email send function and unsubscribe page styled to the app's teal/amber brand.

## Step 3 — Admin-editable templates

New tile and page at `/admin/content/email-templates`:
- Lists the six event templates
- Edit subject line and body copy, with a live preview
- Insert placeholders like `{{first_name}}`, `{{role}}`, `{{milestone_name}}`, `{{app_url}}`
- Toggle each event's email on or off
- Send a test email to yourself

Copy lives in the database, so wording changes never need a code deploy. The visual shell (logo, colors, footer) stays in code so every email looks consistent.

## Step 4 — Wiring the triggers

Each event fires the email from server-side code alongside the existing in-app notification, so email and bell stay in sync. Role changes and peer approvals fire from a secure backend function (they need to look up the user's email address); milestone and level-up emails fire when the milestone is unlocked.

## Technical notes

- New table `email_templates` (event_key, subject, body_markdown, enabled) with admin-only write RLS and grants; seeded with default copy for the six events.
- Lovable's built-in email infrastructure (`setup_email_infra` + `scaffold_transactional_email`); no third-party provider or API keys.
- A single `send-transactional-email` function handles all sends; one generic React Email template renders DB-stored copy.
- New edge function `send-event-email` (service-role) resolves recipient email from `auth.users`, checks the template's enabled flag, and invokes the send function with an idempotency key.
- `AdminUsersPage` role grant/remove and the peer approve/reject actions call `send-event-email` after the existing mutation succeeds; failures toast but never block the role change.
- Milestone/level-up sends hook into the existing milestone unlock path next to `recalculate_card_level`.
- No changes to existing tables, RLS on user data, intake, or assessments.
