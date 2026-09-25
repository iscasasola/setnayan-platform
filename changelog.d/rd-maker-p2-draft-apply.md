## 2026-09-25 · feat(event-hub): edit as a draft — Apply, Restore, Reset; try Pro, pay at Apply

Event Hub Maker Phase 2 (`EVENT_HUB_MAKER_BUILD_PLAN_2026-09-25.md` § Phase 2;
DECISION_LOG 2026-09-24 "EDIT … AS A DRAFT: Apply · Restore · Reset to default",
2026-09-25 "Try then pay" and "Pro in the iPhone app: NOT YET").

Until now every Event Hub writer wrote the live columns guests read. Now:

- **`event_site_drafts`** (migration `20271246169682_event_site_drafts.sql`) —
  one row per event, RLS at CREATE TABLE. Hosts = `current_couple_event_ids()`
  ∪ `current_moderator_event_ids()` (the two sources `requireHostMembership`
  accepts) plus `is_admin()`. ⚠ **Deliberately NOT `current_event_ids()`**, which
  the build plan named: that helper returns the event for every member type,
  guests included, so an invited guest would read the unpublished draft. Proven
  as real `authenticated` sessions in
  `tests/db/a-guest-cannot-read-the-draft.db.test.ts` (with an anti-vacuity test
  that the guest IS such a member). No `updated_by` column (the plan named one):
  a user id there needs erasure/user-delete handling for no reader.
- **`lib/hub-draft.ts`** (pure) — shape, sanitising (every value through the
  parser its live writer uses; canvas through `sanitizeHubCanvas`), merge +
  ten-step Undo, the host-preview overlays, the Apply plan (fixed order, each
  key classified by the one look rule `lib/hub-look-pro.ts`), Reset per stage.
  **`lib/hub-draft-store.ts`** (server-only) moves the rows.
- **ONE new server action** — `hubDraftAction(eventId, formData)` in
  `app/dashboard/[eventId]/website/hub-draft-actions.ts`, intents
  `save | apply | restore | reset | undo`. **Apply is the Pro gate**: without
  active Event Hub Pro every Pro key is refused and STAYS in the draft (so the
  couple who tried it can pay and Apply again — the plan said "clears the row";
  keeping them is what makes try-then-pay work); in the store shell a Pro key is
  never applied ("Apply on the web"). A drafted background must still be the
  couple's own photo; "Shown" still needs content. Apply is idempotent and only
  trims the draft after every write succeeded.
- **The existing writers gain a draft door**: a form carrying `draft=1`
  (`HUB_DRAFT_FIELD`, or `<HubDraftField />`) sends `setWidgetMotion`,
  `setWidgetBackground`, `setWidgetCrop`, `setSectionMode`, `moveWidgetUp/Down`,
  `saveRsvpBackdrop` and `clearRsvpBackdrop` to the draft after their own
  validation, skipping only their Pro gate. Without the field they behave
  exactly as before. Open browsing, the launch pin, address and visibility stay
  live by design.
- **The host sees the draft, guests see live** — `app/[slug]/page.tsx` reads the
  draft only for `?editor=1`, through `loadHostPreviewDraft` (host check), and
  lays it over its own copies of the event row and widget rows.
- **Mounted in the Maker toolbar** — `launch/page.tsx` passes
  `applySlot={<HubDraftDock eventId />}` (server: `hub-draft-dock.tsx`) to the
  Phase 1 shell; the compact client `HubDraftToolbar`
  (`website/_components/hub-draft-bar.tsx`) shows the Draft badge + Apply in the
  bar and Undo · Restore · Reset (for the stage `useMaker()` is on) plus the
  last outcome in one menu. `HubDraftField` is the hidden `draft=1` input for
  forms. Price only from `platform_retail_catalog_v2` via `formatV2Sku`; none
  fetched or shown in the store shell.

Not in this PR (named, not hidden): the page colours / face / art direction are
painted by `[slug]/layout.tsx`, which cannot see `?editor=1`, so they are not
draftable yet (a drafted colour would be a save the preview never shows); draft
media uploads (open decision D6); custom-section words and `toggleWidgetVisibility`
stay live. ⚠ **The Maker's own forms do not post `draft=1` yet**, so its edits
still go live until they carry `<HubDraftField />` — and the navigator's eye also
writes `is_visible` through `toggleWidgetVisibility`, which has no draft door yet.

Guards: `lib/hub-draft.test.ts` (17), `lib/hub-draft-wiring.test.ts` (5),
`tests/db/a-guest-cannot-read-the-draft.db.test.ts`; `hub-look-is-pro.test.ts`
still green (10 gated, 0 missing).

SPEC IMPACT: `EVENT_HUB_MAKER_BUILD_PLAN_2026-09-25.md` Phase 2 — RLS uses the
couple ∪ moderator helpers instead of `current_event_ids()`; no `updated_by`;
Apply keeps refused Pro keys in the draft instead of clearing the row; only
`rsvp_backdrop` among `events` columns is draftable until the layout can overlay
a draft. Recorded in the corpus DECISION_LOG (2026-09-25 row).
