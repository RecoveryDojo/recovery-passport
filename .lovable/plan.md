# Fundraiser Deck Plan

A self-playing PowerPoint loop for the fundraiser laptop. Built in three stages: seed the demo, capture real screenshots from inside the live app, then assemble a branded 60-slide deck.

## Stage 1 — Seed 6 months of demo content

Expand the existing `demo-seed` edge function so the app looks like an org that has been running since November. All demo accounts use `@demo.recoverypassport.org` emails and stay tagged via `app_config.demo_user_ids` for one-click cleanup later.

**Cohort (12 users)**
- 1 admin: Director persona (Pat Reyes)
- 3 peer specialists: Maria (certified, full caseload, all CRPS hours logged), Daniela (in-training, partial hours), James (recently approved)
- 8 participants spread across stages:
  - 2 all-star (180+ days, full plan, 10+ milestones, passport shared with employer/landlord)
  - 2 veteran (90 days, phase 3 active, 7 milestones)
  - 2 starter (45 days, phase 2, 4 milestones, one with crisis check-in + supervisor feedback)
  - 1 rookie (14 days, phase 1, intake just done, first assessment)
  - 1 day-one (intake today, empty state)

**Per participant, 6 months back-dated where applicable**
- Weekly check-ins (mood trend, MI techniques, contact mode mix)
- Progress notes (general, crisis, milestone, transition types)
- Assessments at intake, 30/60/90 day with scores trending upward
- Recovery plan via `generate_recovery_plan` RPC, then phase progression + completed steps
- Milestone unlocks back-dated, then `recalculate_card_level` per participant
- Payment ledger (charges + payments) for 2 participants
- Agreement acknowledgments
- Notifications history
- 1 shared passport link + consent record (for the all-star personas)
- 1 referral to a community partner (Jasmine → sober living)

**Per peer**
- CRPS hours auto-logged from check-ins via `log_checkin_crps_hours`
- Manual hours, training, supervised categories
- Self-care checks (one flagged for Daniela)
- Supervisor feedback entries from admin

**Admin-side**
- Audit log entries for passport views, peer approvals, payment edits
- 2 pending peer approvals + 1 pending profile edit awaiting review

## Stage 2 — Capture screenshots live

Use the browser tool to log in as each persona at the published preview URL and screenshot every key route at mobile (375px) and a few at desktop. Saved to `/mnt/documents/deck-shots/`.

**Participant routes** (capture for 3 personas — all-star, crisis, day-one to show range):
/card, /plan, /milestones, /assessment/history, /check-ins, /passport-config, /resources, /agreements, /payments, /peers/browse, /profile

**Peer specialist routes** (Maria + Daniela):
/caseload, /caseload/:id, /caseload/:id check-in form, /caseload/:id notes, /caseload/:id plan tab, /crps, /self-care, /notifications, /peer-profile, pending-approval holding screen (James)

**Admin routes** (Pat):
/admin (dashboard), /admin/participants, /admin/participants/:id, /admin/peers, /admin/peer-review, /admin/peers/:id, /admin/reports, /admin/audit, /admin/payments, /admin/programs, /admin/agreements, /admin/milestones, /admin/assessment-domains, /admin/plan-templates, /admin/mi-prompts, /admin/protocols, /admin/resources, /admin/docs, /admin/users

Roughly 50-60 source screenshots; deck uses ~45 of the strongest.

## Stage 3 — Build the .pptx

60 slides, 16:9, looped playback ready. Branded with the palette + logo from your upload (waiting on that image — I'll pull the exact hex values from it before generating).

**Section A — Mission & problem (5 slides)**
1. Cover (logo + tagline + REF)
2. The recovery problem (stat slide)
3. Why a passport (concept)
4. The Catcher's Mitt program intro
5. What Recovery Passport is (one-line + device hero)

**Section B — Participant journey (15 slides, 3 personas × 5)**
For each of Marcus (all-star), Jasmine (crisis-to-recovery), Tasha (day one):
- Persona intro card
- Their baseball card / today view
- Their recovery plan progress
- Their milestones + assessment trend
- Their passport / shared link

**Section C — Peer specialist toolkit (12 slides)**
- Caseload health overview
- Participant detail drilldown
- Logging a check-in (MI prompts)
- Writing a progress note (template)
- Crisis protocol surface
- Unlocking a milestone
- Recovery plan editing
- CRPS hours dashboard
- Competency milestones
- Self-care check-in
- Notifications inbox
- Pending-approval / onboarding

**Section D — Admin oversight & reporting (12 slides)**
- Admin dashboard
- Participants table + filters
- Peer roster + approval queue
- Profile-edit review
- Reports page (key metrics)
- Audit log (compliance proof)
- Payments ledger
- Programs & agreements
- Milestone & assessment configuration
- Plan templates
- MI prompt library
- Resource directory + community partners

**Section E — Compliance, impact, CTA (6 slides)**
- 42 CFR Part 2 compliance (consent + redisclosure)
- Audit trail / data security
- Impact stats from the seeded 6 months (#participants, #check-ins, #milestones, #CRPS hours, #passports shared)
- Quote / testimonial slide (placeholder)
- Where the funds go
- Closing / how to support

**Build mechanics**
- Use the bundled `pptx` skill with `pptxgenjs`
- Embed all images as base64 (per skill requirement)
- Wrap mobile screenshots in a phone bezel mockup, desktop shots in a browser frame
- Branded title/section dividers; consistent footer with logo
- Output `/mnt/documents/recovery-passport-fundraiser.pptx`
- Visual QA: convert to PDF, render every slide as JPG, inspect for overflow/contrast/missing-image issues, fix and re-render until clean

## Cleanup
After delivery, the demo cohort stays loaded so your boss can also do live walk-throughs at the event. The existing `demo-seed clear` action removes everything tagged in `app_config.demo_user_ids` whenever you're ready.

## Open items before I start
- **Brand image** — waiting on your upload so I can pull exact hex + logo into the master slide
- **Tagline / org name to display on cover** (e.g. "Recovery Passport — powered by Recovery Epicenter Foundation")
- **Closing CTA** — donation URL, QR, or just a "Thank you / contact" slide?
