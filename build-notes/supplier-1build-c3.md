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
  `app/admin/help/page.tsx` (origin line), `lib/erasure/coverage.ts` + `lib/export-coverage-guardrail.test.ts`.
- `clients/[eventId]/_pages/context.ts` — a BYTE-IDENTICAL copy of L2's (from `origin/claude/supplier-1build-l2`
  @ 1fd157a8fd) so my bodies typecheck on my branch; identical add/add merges cleanly. `_pages/forms.tsx` and
  `_pages/report.tsx` are add/add against L2's stubs — **take C3's version**. `_pages/report-form.tsx` is new.

## NEEDS FROM OTHER LANES

- **L2**: (1) mount is unchanged — `FormsPage`/`ReportPage` keep `PickedPageProps`. (2) Since "What they told you"
  (`CoupleAnswers`) now draws on Forms (v113), drop it from Details so it is not shown twice. For a HOST the Script fold
  also shows the answers — L2/controller decide whether Forms hides `CoupleAnswers` for a host (needs a `showScript` /
  `isHost` flag in `PickedPageContext`). (3) `ReportPage` renders `shipped` below the form (L2 aliases the old Activity
  tab to `report`) — moved, not lost; drop it if L2 gives the activity feed another home.
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
5. `scripts/lint-server-action-budget.mjs` CEILING — the base sits at exactly 1232/1232. C3 adds **+2**:
   `formsAction` (one dispatcher for four ops) and `submitSupplierReport`. Needs a fresh `vercel build` count per the
   script's own rule — controller call. (Admin suggestions pane will add +1 more if built — see Where I stopped.)
6. Port / screens baselines as the controller regenerates on the merged tree.

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
- Full DB suite: first run reached ~290/526 before the background limit killed it; the rest is re-running (see below).

## Where I stopped

(updated at each push — see the bottom of this file)
