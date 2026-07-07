## Fill in the missing Admin Content Hub tiles

`/admin/content` currently shows 6 tiles, but 10 admin content editors are wired up in the router. Comparing router → hub:

| Route | Page | Tile today? |
|---|---|---|
| `/admin/content/milestones` | AdminMilestonesPage | yes |
| `/admin/content/mi-prompts` | AdminMiPromptsPage | yes |
| `/admin/content/crisis-protocol` | AdminCrisisProtocolPage | yes |
| `/admin/content/note-templates` | AdminNoteTemplatesPage | yes |
| `/admin/content/plan-templates` | AdminPlanTemplatesPage | yes |
| `/admin/content/resources` | AdminResourcesPage | yes |
| `/admin/content/assessment` | AdminAssessmentDomainsPage | **missing** |
| `/admin/content/agreements` | AdminAgreementsPage | **missing** |
| `/admin/content/programs` | AdminProgramsPage | **missing** |
| `/admin/content/protocols` | AdminProtocolsPage | duplicate — see note below |

### Change

Edit `src/pages/AdminContentHubPage.tsx` — add three tiles to the `SECTIONS` array following the existing icon/title/description/link pattern:

- **Assessment Rubric** → `/admin/content/assessment`
  "Manage the 10 recovery capital domains and their level descriptions." Icon: `ClipboardCheck`.
- **Program Agreements** → `/admin/content/agreements`
  "Manage the program agreements participants review and acknowledge." Icon: `FileSignature`.
- **Programs** → `/admin/content/programs`
  "Manage the programs (respite, sober living, treatment, outpatient) participants can be enrolled in." Icon: `Building2`.

Suggested tile order (groups intake/rubric together, ops content at the end):
Programs, Milestones, Assessment Rubric, MI Prompt Library, Recovery Plan Templates, Note Templates, Crisis Protocol, Program Agreements, Resource Listings.

### Note on `/admin/content/protocols` (AdminProtocolsPage)

This page overlaps with `AdminCrisisProtocolPage` **and** `AdminNoteTemplatesPage` — it edits the crisis protocol and the note-template guiding prompts in one page. It looks like a legacy combined editor left over from before those two were split out (prompts 3 and 4 built the dedicated pages). It has a route but no link anywhere.

I recommend **not** adding a tile for it. Options:

1. **Leave the route in place, no tile** (safe, zero risk of breaking a bookmark). Default recommendation.
2. **Delete the route + file** in a follow-up cleanup (cleaner, but separate from this task).

I'll go with option 1 unless you say otherwise.

### Test

1. `/admin/content` shows 9 tiles.
2. Click Assessment Rubric, Program Agreements, and Programs → each lands on its editor with no redirect.
3. Existing 6 tiles still work.
