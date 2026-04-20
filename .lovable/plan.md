

# Make the caseload card actually navigable and intuitive

## What changes (UX)

**On the caseload list (`/caseload`):**
- **Tapping the participant card itself opens the detail page.** No more accordion expand. One tap = go to chart.
- **The `…` menu becomes a prominent "Quick Actions" button** with label + icon (not a tiny dot icon). Sits top-right of each card.
- **Quick Actions menu items deep-link straight to the right tab** on the detail page:
  - "Log check-in" → opens the check-in sheet (unchanged)
  - "View journey" → `/caseload/:id?tab=journey`
  - "Add note" → `/caseload/:id?tab=notes`
  - "Unlock milestone" → `/caseload/:id?tab=journey#milestones`
  - "View care team" → `/caseload/:id?tab=care-team`
- **Card surface shows the most useful at-a-glance info inline** (no expand needed): name, level, program, days, milestones progress, last check-in age, mood dot, status pill. Same data you saw before but visible without expanding.
- **Remove the accordion entirely.** No chevron, no expand state, no inline "View Full History" link.

**On the detail page (`/caseload/:id`):**
- **Read `?tab=` from the URL** so the deep-links above land on the right tab.
- **Make the 5 tabs more readable** — currently `text-xs` and cramped on the 5-column grid. Increase to `text-sm`, add icons next to labels (Overview 📋, Journey 🏆, Engagement 💬, Care Team 👥, Notes 📝) so peers can scan visually.
- **"Journey" tab gets a brief subtitle** under the tab list when active: "Active plan steps, milestones, and assessments" — so first-time users know what's there.

## What this fixes (mapped to your concerns)

| Your complaint | Fix |
|---|---|
| "I don't easily see Journey tab" | Tabs become bigger with icons; deep-link from caseload menu lands you directly on Journey |
| "The 3 dots need to be much more prominent" | Replaced with a labeled "Actions" button (icon + word) that's clearly clickable |
| "None of this is intuitive" | Tapping the card now does what users expect (opens the chart). No hidden accordion. |
| "Tremendous training needed" | Each menu item names the destination ("View journey", "Add note") so peers learn by reading |

## Files touched (4)

1. `src/components/CaseloadParticipantCard.tsx` — remove accordion, make whole card a `<Link>` to `/caseload/:id`, show key stats always-visible, replace `…` with labeled Actions button
2. `src/components/caseload/QuickActionsMenu.tsx` — relabel "Actions" button (visible word + icon), add `?tab=` query params to all destination links
3. `src/pages/CaseloadParticipantDetailPage.tsx` — read `?tab=` from `useSearchParams` to set `defaultValue` on Tabs; bump tab labels from `text-xs` to `text-sm` with icons; add hash scroll for `#milestones`
4. *(no DB changes, no new components)*

## Verification

1. 🔵 Peer → `/caseload` → tap a card → lands on detail page with Overview tab open
2. 🔵 Peer → `/caseload` → tap "Actions" → "View journey" → lands on detail page with **Journey tab already selected**
3. 🔵 Peer → `/caseload` → tap "Actions" → "Unlock milestone" → lands on Journey tab, scrolled to milestones section
4. 🔵 Peer → `/caseload` → tap "Actions" → "Log check-in" → check-in sheet opens (no navigation)
5. Confirm the card no longer expands inline — one clean tap = full chart

