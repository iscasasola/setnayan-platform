## 2026-11-08 · feat(supplier): Forms + Report — the Form Maker, the library, auto-send on booking, the supplier Report (THE ONE BUILD · lane C3)

- **Schema** (`-forms-data`): `vendor_forms` (a shop's library; retire, never delete) · `vendor_questions` widened as
  the item table (`form_id` NULL = the shipped "Questions for the couple" set, unchanged; `item_kind` · `answer_type`
  = the v113 type dropdown minus Photo upload · `is_required` · `options` · `media_keys` · `video_url`; same-shop
  triggers) · `vendor_form_service_links` (pick as many) · `event_form_sends` (supplier sends into an event it talks
  to; `on_booking` is the service role's) · `form_templates` + `category_form_suggestions` (admin, ship EMPTY) ·
  `help_messages` origin columns + `help_messages_origin_guard` trigger (own shop · an event that shop talks to ·
  user_id = the signed-in reporter; every /help insert untouched) · `notification_type` gains `supplier_report`
  (in-app only, NOT on EMAIL_ENABLED_TYPES).
- **Form Maker** (`app/vendor-dashboard/forms/_components/form-maker.tsx`): Title · items (tap opens in place, swipe
  left removes with Undo, ⠿ pointer drag reorders) · Add… ▾ (Question line · Media files · Video link; locked kinds
  name their plan — FORM MEDIA BY PLAN) · Link to service card (pick as many) · pinned Save to library + Send to chat.
- **One dispatcher** `formsAction` (save · retire · use a suggestion · send) — the server-action budget is at its
  ceiling.
- **Auto-send on booking**: `sendLinkedFormsForBooking`, called only from `runDepositAcknowledgedEffects` (guarded).
- **Clients › Forms** (`_pages/forms.tsx`): the shipped Questions for the couple (moved) · forms sent to the couple
  with their answers · the library · forms added from the booked cards · Load a form / ＋ New form.
- **Couple side**: the couple's answer action accepts the items of a form sent into their event.
- **Clients › Report** (`_pages/report.tsx`): Subject · Note · origin chips · Submit report → /admin/help with
  "Report from <shop> · <event> · <page>"; admins told in-app only. The /help admin loop is shared
  (`lib/help-message-notify.server.ts`).
- **Guards**: the nine shipped `vendor_questions` readers filter `form_id IS NULL`
  (`lib/the-shipped-question-set-stays-the-set.test.ts`), the booking-moment send has one home
  (`lib/forms-send-on-booking-from-every-door.test.ts`), types pinned to the DB CHECK (`lib/vendor-forms.test.ts`),
  two behavioural db tests (`a-form-reaches-only-its-event`, `a-report-names-only-your-shop`) — each sabotaged once.

SPEC IMPACT: None to the corpus from this lane — it builds B2 §2.6/§2.7/§3 as written. Two recorded choices (see
build-notes/supplier-1build-c3.md): "Photo upload" is left out of the type CHECK (§4 text answers only), and the
Report's admin notice is a new in-app-only type `supplier_report` (the /help `chat_message` type emails).
