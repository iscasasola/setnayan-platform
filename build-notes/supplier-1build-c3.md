# C3 · Forms + Report — build notes (THE ONE BUILD, 8 Nov 2026)

**FORMS-DATA PUSHED** — `claude/supplier-1build-forms-data` @ `92170c1109` (2026-11-07 ~23:55 UTC).
Contains ONLY: the three migrations below, their two db tests, the erasure/export register rows for
`form_templates.updated_by`, the `supplier_report` notice type's TS half (`lib/notifications.ts`, `lib/push-levels.ts`),
and `lib/vendor-forms.ts` (+ test) — the pure rules, and the code writer `gates-have-handles` asks for `is_required`.

| Migration | What |
|---|---|
| `20271325118550_a_shop_keeps_a_library_of_forms.sql` | `vendor_forms`, `vendor_questions` widened (form_id NULL = the shipped set), `vendor_form_service_links`, `event_form_sends`, `form_templates`, `category_form_suggestions`; RLS at CREATE; same-shop triggers |
| `20271325290605_a_supplier_report_says_where_it_came_from.sql` | `help_messages.origin_vendor_profile_id / origin_event_id / origin_page` + `help_messages_origin_guard` (BEFORE INSERT OR UPDATE OF the three) |
| `20271325510297_supplier_report_notice_type.sql` | `notification_type` + `'supplier_report'` (own file: an enum value can't be used in the txn that adds it) |

Replay: all migrations apply on PGlite. DB tests run: both new tests green (and each sabotaged once → red:
dropping the chat-thread clause turned 4 tests red; not forcing `user_id` turned the reporter test red). See
"Checks" for the full-suite status.

---

## Done (C3 branch `claude/supplier-1build-c3`)

- `lib/vendor-forms.ts` — pure rules · `lib/vendor-forms.server.ts` — reads (`readShopForms`, `readBookedCardIds`,
  `readEventForms`, `readFormSuggestions`), each returns `unread` on a refused part (never drawn as empty).
- `app/vendor-dashboard/forms/actions.ts` — ONE dispatcher `formsAction` (save · retire · use · send).
- `app/vendor-dashboard/forms/_components/form-maker.tsx` — the Form Maker.
- `app/vendor-dashboard/forms/_components/forms-page-body.tsx` — sent forms + answers · library · booked-card forms ·
  thumb row (Load a form · ＋ New form) · the Forms Maker sheet (your forms · Suggested for · Also useful for).
- `app/vendor-dashboard/clients/[eventId]/_pages/forms.tsx` — the page body (server).
- `lib/vendor-forms-on-booking.server.ts` — `sendLinkedFormsForBooking` + `notifyHostsOfForm`; wired into
  `runDepositAcknowledgedEffects` (`lib/deposit-acknowledged-effects.server.ts`, inside the acknowledged branch, logged
  like the gift door).
- `lib/vendor-tier-caps.ts` — `formMediaUploads` (Pro · Ultra) + `formVideoLinks` (Solo · Pro · Ultra).
- The nine shipped `vendor_questions` readers carry `.is('form_id', null)` (listed below); the couple's answer action
  (`question-answers-actions.ts`) widens to "the default set OR an item of a form sent into this event".
- Report: `lib/supplier-report.ts`, `clients/[eventId]/report-actions.ts` (`submitSupplierReport`),
  `_pages/report.tsx` + `_pages/report-form.tsx`, `lib/help-message-notify.server.ts` (the /help admin loop, extracted;
  `/help` keeps `chat_message`), `/admin/help` shows "Report from <shop> · <event> · <page>".
- Couple side: `dashboard/[eventId]/vendors/[vendorId]/workspace/_components/supplier-forms-card.tsx` (server) +
  `supplier-form-answers.tsx` (client) — each sent form is its own section in the supplier's room, under "{SHOP} asks";
  answers by type with the house Field template only (`TypedRow` words · `ChosenRow` pick / checkmarks), posted to the
  shipped `saveSupplierAnswers` (`answer:<id>` + `base:<id>`, two hosts never overwrite). Video links: YouTube/Vimeo
  play INSIDE (no-tracking iframe, as the supplier page draws), others open outside. Media files: shown via
  `displayUrlForStoredAsset` (public bucket only). Mounted beside `SupplierQuestionsCard` in the workspace page.
- Media files (Pro · Ultra): the Maker's media item uses the shipped `FileUpload` (compress-first) into
  `vendors/<shop>/forms` in the PUBLIC media bucket — the same home and tenancy as a card's showcase photos; the save
  re-checks every ref with `parseClientRef` pinned to that folder. Kept while the form exists (§4).
- `lib/form-media-sweep-core.ts` + `lib/form-media-sweep.server.ts` — job `form-media-sweep` (registry row in
  `lib/periodic-job-registry.ts`, daily, retention): deletes ONLY uploads no item references (live or retired) that are
  over a day old; fired with `after()` from the Forms page.
- Admin › Categories › a tile › "Suggested forms" (`_components/form-suggestions-pane.tsx` + `form-suggestions-editor.tsx`,
  dispatcher `app/admin/categories/form-suggestion-actions.ts` `formSuggestionsAction`: template_new · suggest_add ·
  suggest_remove; service role; every write in `admin_audit_log`). Ships EMPTY and says "No suggested forms for <tile> yet".
  Suggestions key on TILES (`service_categories`); the supplier's read maps a card's canonical service key to its tile
  through `canonical_service_taxonomy`.
- `/dev/forms-lab` (+ its `the-lab-never-ships.test.ts`) — the real bodies on fixtures: `?m=forms|load|maker|new|report|couple`.

## Files I touched OUTSIDE my §3.2 rows (one-line edits the brief assigns to C3)

- The nine reader filters: `activities/questions-section.tsx`, `activities/question-actions.ts` (4 chains),
  `clients/[eventId]/_components/couple-answers.tsx` (**L2's dir**), `clients/[eventId]/_components/script-tab.tsx`
  (**L2's dir**), `messages/[threadId]/_components/questions-send-panel.tsx` (**C2's dir**),
  `messages/[threadId]/questions-actions.ts` (**C2's dir**), `dashboard/[eventId]/schedule/_components/host-questions.tsx`,
  `dashboard/[eventId]/vendors/[vendorId]/workspace/_components/supplier-questions-card.tsx`,
  `dashboard/[eventId]/vendors/[vendorId]/workspace/question-answers-actions.ts`. Each is ONE `.is('form_id', null)`
  line (the brief's "the nine readers filter form_id is null"); at integration keep both sides.
- `lib/deposit-acknowledged-effects.server.ts` (one call + its record function), `lib/vendor-tier-caps.ts` (two keys),
  `lib/notifications.ts` + `lib/push-levels.ts` (the new type's rows), `app/help/actions.ts` (loop → shared helper),
  `app/admin/help/page.tsx` (origin line), `lib/erasure/coverage.ts` + `lib/export-coverage-guardrail.test.ts`,
  `lib/periodic-job-registry.ts` (one row), `app/admin/categories/_components/category-panels.tsx` (one PanelFold in
  `CategoryPanel`), `dashboard/[eventId]/vendors/[vendorId]/workspace/page.tsx` (mounts `SupplierFormsCard`).
- `clients/[eventId]/_pages/context.ts` — a BYTE-IDENTICAL copy of L2's (from `origin/claude/supplier-1build-l2`
  @ 1fd157a8fd) so my bodies typecheck on my branch; identical add/add merges cleanly. `_pages/forms.tsx` and
  `_pages/report.tsx` are add/add against L2's stubs — **take C3's version**. `_pages/report-form.tsx` is new.

## NEEDS FROM OTHER LANES

- **L2**: (1) mount is unchanged — `FormsPage`/`ReportPage` keep `PickedPageProps`. (2) Since "What they told you"
  (`CoupleAnswers`) now draws on Forms (v113), drop it from Details so it is not shown twice. For a HOST the Script fold
  also shows the answers — L2/controller decide whether Forms hides `CoupleAnswers` for a host (needs a `showScript` /
  `isHost` flag in `PickedPageContext`). (3) `ReportPage` renders `shipped` below the form (L2 aliases the old Activity
  tab to `report`) — moved, not lost; drop it if L2 gives the activity feed another home.
- **L2** (Details "Forms · sent to this couple", item 19): read it with `readEventForms(supabase, { eventId,
  vendorProfileId, library, cards, bookedCardIds })` from `lib/vendor-forms.server.ts` (→ `sent[]` with title ·
  answered · total); "＋ Send a form" can open `/vendor-dashboard/clients/<id>?tab=forms`.
- **L2** (port guard): `app/admin/_components/port-guard-reach.test.ts` fails on the new `_pages` folder convention
  ("Unaccounted: _pages") — L2 owns `_pages/`; add it to `PRIVATE_SUBDIRS` (it holds actions/links) in L2's change.
- **C2**: `gates-have-handles` flags `chat_message_hearts.hearted` (no writer yet) on the merged `-data` — C2's chat work.
- **L1** (registries): `lib/page-home.ts` — the Form Maker sheet + the Forms/Report bodies (back target = Clients list).
- **C2**: none (`chat-*` untouched; `messages/[threadId]` got only the one filter line in two files).
- **C4**: the Shop "Makers → Forms door" should open `/vendor-dashboard/clients/...?tab=forms` or the library; there is
  no standalone `/vendor-dashboard/forms` page yet (only actions + components live under it). Tell me if C4 wants one.

## Generated-file / Ugat needs (controller, on the merged tree)

Measured failing on my branch ONLY because these are controller-owned:
1. `supabase/security/exposure-surface.baseline.txt` — `exposure-freeze.db.test.ts`: +53 authenticated capabilities
   (the five new tables' columns and the new `vendor_questions` / `help_messages` columns). Regenerate.
2. `apps/web/tests/db/user-fk-behaviour.generated.txt` — `form_templates.updated_by SET NULL nullable -> users`.
   `UPDATE_FK_BEHAVIOUR=1 pnpm --filter @setnayan/web test:db`.
3. `lib/ugat/graph.ts` — `ugat-concept-coverage`: "vendor_forms [hub] — 3 tables reference it". Add the joints from
   B2 §3 "Ugat entries": "Shop → its forms → the event's answers" (TYPE-VENDORS × TYPE-EVENTS; claims `table vendor_forms`,
   `fk vendor_forms.vendor_profile_id → vendor_profiles`, `fk vendor_questions.form_id → vendor_forms`,
   `table vendor_form_service_links` + FKs, `table event_form_sends` + FKs to events / vendor_forms / chat_threads,
   columns `vendor_questions.item_kind · answer_type · is_required`; writtenBy `formsAction` (save/send),
   `sendLinkedFormsForBooking`; guardedBy the policies + `a-form-reaches-only-its-event.db.test.ts`; trap "form_id NULL
   is the shipped set — every shipped reader filters it"), "Taxonomy → suggested forms" (TYPE-TAXONOMY:
   `form_templates`, `category_form_suggestions` + FK to `service_categories`), and "Shop → report → admin inbox"
   (`fk help_messages.origin_vendor_profile_id → vendor_profiles`, `fk help_messages.origin_event_id → events`).
4. `supabase/migrations.manifest.txt` — three new files.
5. `scripts/lint-server-action-budget.mjs` CEILING — the base sits at exactly 1232/1232. C3 adds **+3** (measured
   1235): `formsAction` (one dispatcher, four ops), `submitSupplierReport`, `formSuggestionsAction` (one admin
   dispatcher, three ops). Needs a fresh `vercel build` count per the script's own rule — controller call. If the
   budget is the binding limit, `submitSupplierReport` can fold into `formsAction` as an op (−1).
6. `lib/ugat/screens.generated.json` (`check-ugat-screens`: stale — new `/dev/forms-lab` route + the new pages' doors),
   the port baseline, `lib/admin-map/*.generated.ts` (Categories "Suggested forms" fold, Help inbox origin line).
7. `scripts/lint-no-card.mjs --update-baseline` — 3 files went BELOW baseline (lower only; optional).
8. Ugat: also a joint for the `form-media-sweep` job if the map lists jobs.

## Recorded choices (spec silent; each follows a written ruling)

- **Photo upload is not in the type CHECK.** §9 #13 says types = v113's dropdown; §4 says photo-upload answers OUT
  ("text answers only"). A type the DB accepts but no answer path serves would be a box the couple cannot fill. Adding
  it later is one CHECK swap + one list entry.
- **Report notice = new type `supplier_report`, in-app only.** §5.4 "admin in-app notice only, no email"; the /help
  form's `chat_message` IS on `EMAIL_ENABLED_TYPES`, so reusing it would email.
- **Shipped answer box = `long_answer`** (the column default) — `supplier-answers-form.tsx` draws `TypedRow long`.
- **FK `ON DELETE` for a form's items and sends = NO ACTION (not RESTRICT)** — a shop deletion cascades the form, its
  items and its sends in one statement; RESTRICT would block that mid-cascade. A direct delete of a sent/itemed form is
  still refused (db test 6). No DELETE grant on `vendor_forms` either.
- **"Own live form" on a send is a trigger, not a policy clause** — a policy reading `vendor_forms` from
  `event_form_sends` recursed through `vendor_forms_sent_couple_select` ("infinite recursion detected").
- **The booking-moment send notifies the hosts in-app** (`supplier_questions_sent`, same as Send to chat).

## Open questions (money / owner — left unbuilt)

- None new. B2 Q3 (form media retention) is ruled by spec §4 ("kept while the form exists + cleanup sweep").

## Request counts

- Clients › Forms: wave 1 — library 5 + booked cards 2 (service role, scoped to this shop × event) + plan 1 + profile
  (request-cached); wave 2 — this event's sends 1 (+3 when any were sent) + suggestions 1–4 (category read; stops at
  1 when the shop has no cards) + starters (taxonomy, cached); the three shipped sections keep their own reads
  (1 + 3 + 2).
- Clients › Report: 0 new reads (the request-cached profile).

## Checks

- `node scripts/preflight.mjs --base origin/claude/supplier-1build-base --only types,lint,guards,pins` — green except
  `lib/export-coverage-guardrail.test.ts` **T12**, which fails on the BASE already (#7373's `vendor_profiles.find_lock_*`
  / `is_findable` not in the export projection) — not C3's.
- `a-held-shop-name-holds-its-core.db.test.ts` "a held name BLANK" fails on the BASE too (measured with my migrations
  moved out) — not C3's.
- Full DB suite, all 526 files (two runs: 1–~290, then 280–526 + re-runs): every failure is one of —
  (a) the three controller-owned generated files above (`exposure-freeze`, `ugat-concept-coverage`, `user-fk-behaviour`);
  (b) BASE failures not caused by C3: `a-held-shop-name-holds-its-core` ("held name BLANK") and `ugat-both-ends`
  (`shop_name_is_held` rpc-no-caller) — both fail with my migrations removed / in base-owned code;
  (c) `gates-have-handles` (`vendor_questions.is_required`) — FIXED in `-c3` (the save names it), green on re-run.
  ⚠ `-forms-data` ALONE still trips (c), because the writer lives in `-c3`; it clears when `-c3` merges.
- Guards added, each sabotaged once and watched red: `lib/the-shipped-question-set-stays-the-set.test.ts`,
  `lib/forms-send-on-booking-from-every-door.test.ts`, `lib/form-media-obeys-the-plan.test.ts`, `lib/vendor-forms.test.ts`
  (types ↔ CHECK), `tests/db/a-form-reaches-only-its-event.db.test.ts`, `tests/db/a-report-names-only-your-shop.db.test.ts`.
- Gestures proved in Chromium at 375 px with touch emulation (`/dev/forms-lab?m=maker`): ⠿ pointer drag moved row 1
  below row 3; a real touch swipe-left revealed Remove; Remove took the row out; Undo put it back
  (`build-notes/c3-form-maker-swipe.png`, `c3-form-maker-undo.png`). Not on a real iPhone (cloud lane — controller).

## Proof (375 px, v113 left · built right)

`build-notes/c3-forms-page.png` · `c3-form-maker-new.png` · `c3-forms-load-sheet.png` · `c3-report-page.png`; built only:
`c3-form-maker-edit.png` · `c3-couple-answers.png`. Differences from v113, each deliberate:
- The fields are the house Field template (`TypedRow`: name left, pill right) — `lint-field-template` forbids raw boxes;
  v113 drew bare inputs.
- Rows are a soft fill, no border — `lint-no-card` forbids bordered rounded boxes.
- The thumb row's main verb is the house round (＋ / ⚑) with its word as the accessible name; v113 drew a worded pill.
- "Suggested for Photo & Video" shows the honest empty line (§9 #13 — the suggestion data ships empty).
- The shipped "Questions for the couple" is MOVED unchanged above (its old look); v113 restyled it (icon tiles,
  Answered/Open pills). Restyling it is allowed (SHIPPED = move/restyle) but was not done — next step if wanted.
- No "Past reports" list on Report (INVENTED in the parts map).

## Full preflight (2026-11-08, `node scripts/preflight.mjs --base origin/claude/supplier-1build-base`, 26m 54s)

20 rows failed on the first full run. Fixed in C3 (`a5e3be990a`), each re-run green: shared reveal-on-open in the Maker
and the sent-form rows · the sweep deletes through `cleanupDelete` + a new `vendorFormMediaScope` · no `router.refresh()`
after an action that revalidated · `formatCount` on every count · "first payment", never "deposit" · every Supabase
`error` read in the admin action · the uploader no longer takes the reserved `gallery` layout · the shipped-set guard
accepts `.not('form_id', …)` (the sweep reads the library explicitly).
Left, NOT C3's to fix (owner in brackets): server-action budget 1235/1232 (controller) · `ugat/screens.generated.json`,
`admin-jobs` generated checklist, exposure baseline, FK-behaviour map, Ugat concept map (controller, generated) ·
`export-coverage` T12 and `shop-name-hold` / `ugat-both-ends` `shop_name_is_held` (BASE) · `port-guard-reach` `_pages`
(L2) · `gates-have-handles` `chat_message_hearts.hearted` (C2, after merging `-data`).

## Where I stopped

**2026-11-08 ~03:00 UTC · `claude/supplier-1build-c3` @ `d56116a5cb` (pushed; `-data` merged; `-foundation` not out yet).**
Every item of the C3 lane block is built, proved at 375 px against v113 (screenshots above) and pushed.
Exact next steps, in order:
1. When `origin/claude/supplier-1build-foundation` appears: merge it; if the thumb row / sheet z tokens changed, nothing in
   C3 sets a raw z-index (Sheet + SupplierThumbRow only) — re-render `/dev/forms-lab` at 375 px to confirm.
2. Optional polish (allowed, not required): restyle the MOVED shipped "Questions for the couple" (`questions-section.tsx`)
   to v113's look (icon tiles · Answered/Open pills). It is shared with `/vendor-dashboard/activities#questions`.
3. If the controller wants the action budget back by one: fold `submitSupplierReport` into `formsAction` as `op=report`.
Waits on: controller (generated files, budget), L2 (`_pages` in the port guard; drop `CoupleAnswers` from Details),
L1 (`page-home` rows), C2 (hearts writer).
