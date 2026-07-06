## Goal

Introduce transactional ("app") emails triggered by key events (peer approval, peer request received, milestone unlocked, etc.) AND give admins a **Content → Email Templates** tab where they can edit the subject line and body copy for each template — without a code deploy.

---

## Scope — events that will trigger email (v1)

Recipients per the interdependency map:

| Event | Recipient | Template key |
|---|---|---|
| `peer.approved` | Peer specialist | `peer-approved` |
| `peer.rejected` | Peer specialist | `peer-rejected` |
| `peer_request.created` | Peer specialist | `peer-request-received` |
| `peer_request.responded` (approved / declined) | Participant | `peer-request-approved` / `peer-request-declined` |
| `participant.assigned_peer` | Participant | `peer-assigned` |
| `milestone.unlocked` | Participant | `milestone-unlocked` |
| `supervisor_feedback.created` | Peer specialist | `supervisor-feedback` |
| `agreement.published` | All participants in program | `agreement-updated` |

All continue to fire the existing in‑app notification too — email is additive, not a replacement.

---

## Prerequisites (one‑time setup, done automatically)

1. Set up an email domain (user completes the DNS handoff dialog).
2. Provision email infrastructure (pgmq queues, send log, suppression list, unsubscribe tokens, queue worker + cron).
3. Scaffold the transactional email edge function + template registry.

If the user hasn't set up a domain yet, we present the setup dialog first and continue automatically once done.

---

## Admin CMS tab — "Email Templates"

New page at `/admin/content/email-templates`, added to the Admin Content nav alongside Programs / Milestones / Agreements / etc.

**List view** — table of every registered template:
- Template key (e.g. `peer-approved`)
- Display name ("Peer application approved")
- Recipient role
- Subject line (editable inline preview)
- Last edited by / at
- Status: **Default** (using code copy) or **Customized** (overridden by admin)

**Editor view** (per template):
- Subject line (single line)
- Preheader / preview text
- Body — rich text with a small toolbar (bold, italic, links, bullets). Rendered inside the branded email shell (header logo, footer, unsubscribe) — admins only edit the middle content, never the chrome.
- Variable chips the admin can insert into subject or body: `{{first_name}}`, `{{peer_name}}`, `{{milestone_name}}`, `{{link}}`, etc. Available variables depend on the template.
- **Send test email** button — sends to the admin's own address using sample data.
- **Reset to default** — clears the override and reverts to the code‑shipped copy.

**User preferences (out of scope for v1)**: no per‑user "email on/off" toggles beyond the required one‑click unsubscribe footer link the platform adds automatically. Can add later if desired.

---

## Per‑user opt‑out

The platform automatically appends an unsubscribe footer + one‑click token URL. We'll build the branded unsubscribe confirmation page at the assigned path so recipients land on Recovery Passport, not a raw function URL.

---

## Technical details

**New table** `email_template_overrides`
- `template_key TEXT PRIMARY KEY`
- `subject TEXT`
- `preheader TEXT`
- `body_html TEXT` (sanitized on write — allowlist of tags: p, strong, em, a, ul, ol, li, br)
- `variables JSONB` (which template variables this template supports — reference only)
- `updated_by UUID REFERENCES users(id)`
- `updated_at TIMESTAMPTZ`
- RLS: `SELECT` for authenticated (edge function reads via service role anyway); `INSERT/UPDATE/DELETE` admin‑only via `get_user_role() = 'admin'`.
- Grants per the public‑schema rules.

**Template resolution order** inside `send-transactional-email`:
1. Look up `email_template_overrides` row by `template_key`.
2. If present → render the branded React Email shell with the override's subject + `body_html` interpolated with `templateData`.
3. Else → fall back to the code‑shipped React Email template.

**Registered templates** (`supabase/functions/_shared/transactional-email-templates/`):
One `.tsx` per template in the scope table above, each exporting `template` with `component`, `subject`, `displayName`, `previewData`. Registry updated. Body of each template imports the shared branded shell so overrides and defaults look identical.

**Emit → send wiring**: extend `emitEvent()` (or add a thin `sendEmailForEvent()` helper called alongside it) so each event in the scope table invokes `send-transactional-email` with the right `templateName`, `recipientEmail`, `idempotencyKey`, and `templateData`. Idempotency key = `${event}-${target_id}` so retries never duplicate.

**Recipient email lookup**: peers/admins → `users.email`; participants → `users.email` via `participant_profiles.user_id`.

**Test‑send endpoint**: new edge function `preview-email-template` that renders a template with `previewData` and sends to the calling admin's own email. Admin‑only guard.

**CMS UI**:
- `src/pages/AdminEmailTemplatesPage.tsx` — list.
- `src/pages/AdminEmailTemplateEditorPage.tsx` — editor.
- Rich text via a lightweight editor (Tiptap already fits the stack; no new heavy dep beyond that). Sanitize on save.
- Sidebar nav entry added to `AdminLayout` under Content.

**What we won't touch**
- Existing in‑app notification flow stays exactly as it is.
- Auth emails (signup / password reset) are out of scope for this task — separate flow if you want them branded later.

---

## Open questions before I build

1. Confirm the v1 event list above — anything to add or drop? (Payments? Referrals to participant?)
2. Should admins be able to **add brand‑new template keys** from the CMS, or only edit the fixed catalog we ship? (Recommend: fixed catalog — new keys require code because they need a trigger site.)
3. Do you want a per‑user "email me for X" preferences screen now, or defer until after v1?
