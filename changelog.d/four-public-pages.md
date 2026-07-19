## 2026-07-09 · feat(launch): name + preview the public site as 4 pages

Implements the owner's **R5 · Option A** decision (2026-07-09): package the EXISTING
one-URL public-site phase engine as four NAMED, previewable pages — **Save-the-Date ·
RSVP · Day-of · Editorial** — that the couple manages from the Launch section. This is
packaging + naming, NOT a new engine and NOT four new route files.

- New pure mapping module `apps/web/lib/public-site-pages.ts` — maps each of the four
  existing `LifecyclePhase` values (`save_the_date` / `rsvp` / `event` / `editorial`,
  from `lib/invitation-widgets.ts`) to `{ key, name, blurb, phaseParam, Icon }`.
- `apps/web/app/dashboard/[eventId]/launch/page.tsx` renders the four as PREVIEW CARDS:
  each has a "Preview" link to `/[slug]?phase=<phaseParam>` (opens the real, already
  Mood-Board-styled public page in that phase — the `?phase=` override is honored for
  the event's own signed-in hosts) and an **Active now** badge computed with the SAME
  `getLifecyclePhase(event.event_date)` the public engine uses, so the couple sees which
  page the live QR resolves to right now.
- Reuses the existing engine + `?phase=` param. No new public routes, no engine changes,
  no schema changes. `[slug]/page.tsx` is untouched. One small added read on the Launch
  page (`events.slug, event_date`) — the only data the preview cards need.

SPEC IMPACT: None (implements the owner-locked R5 Option A build decision; no SKU,
schema, or pricing change).
