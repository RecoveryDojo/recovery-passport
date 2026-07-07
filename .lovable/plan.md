# Plan Templates — default to Universal

## Change
On `/admin/content/plan-templates`, default the **Program Type** dropdown to **Universal** on page load, so admins immediately see the seeded 30/60/90-day and 6-month templates instead of an empty "No template for this combination" screen.

Keep every other program type selectable. No schema changes. No behavior changes to how plans are generated.

## Files touched
- `src/pages/AdminPlanTemplatesPage.tsx` — change initial `programType` state from `"respite_house"` to `"universal"`.

## Test
- Open `/admin/content/plan-templates` — page lands on Universal / 30 Day with the seeded steps visible.
- Switching to any other Program Type still works.
