## 2026-11-20 · fix(fees): the new-client free window is a setting, and its length is said only in the supplier's app

Migration `20271356623783_the_new_client_free_window_is_a_setting.sql` + the TypeScript twin. Stacked on the 20 Nov
booking-fee rulings (`20271356196197`).

- **Rule 0 — the 12-month arm already shipped.** `booking_fee_attribution_for` (16 Nov, `20271352882666` →
  `20271353556136`) already frees a verified shop's import that created the client's account
  (`booking_fee_import_created_account`, dated by `booking_fee_import_at`) on every event of that client, and the
  existing-account case is the event's one free import slot. No second exemption and no new timestamp were added.
- **The delta.** The window was typed into SQL (`NOW() - INTERVAL '12 months'`). It is now
  `platform_settings.booking_fee_new_client_free_months` (12), read by `booking_fee_new_client_window_covers(import_at,
  at)`; the attribution is otherwise verbatim. Free while the import is less than N months before the booking; at
  exactly N, and after, the fee. Missing settings → the fee. TypeScript twin: `newClientWindowCovers`
  (`lib/booking-fee-lock.ts`), checked instant-for-instant against the SQL in the DB test.
- **Amendments keep their basis** (already true, now pinned): a booking waived inside the window stays waived when
  amended after it (`import_noop`), and a booking billed after it is not freed by a later wider setting.
- **Words.** `lib/booking-fee-who-words.ts`: the public rule is the owner's own sentence (19 Nov PROMOTION PAGES (4)):
  "New to Setnayan, or you're the first to bring their event? They book you free." — no length named. The supplier's
  own app names the length from the setting: `feeNewClientLine` / `feeFreeRuleInApp` on the fee notice before Agree
  and on Booking fees (a new line with an ⓘ). The schedule carries `newClientFreeMonths`; `BOOKING_FEE` does not, so an
  unread setting names no months. Admin › Pricing shows the window under the form (read-only). The public lines that
  still named a length are fixed: For Suppliers' earn block ("for 12 months", "for a year") and the December post.

SPEC IMPACT: None — implements specs DECISION_LOG 2026-11-16 "IMPORTED CLIENTS: A NEW ACCOUNT IS FREE FOR ONE YEAR",
2026-11-20 "BILLING MUST FOLLOW THE RETIRED COPY" and 2026-11-19 "PROMOTION PAGES" (4) as ruled. Not changed (flagged
on the PR): the Add a client sheet's words in `lib/own-clients.ts` still type "12 months" / "for a year" (in-app,
pinned byte-for-byte to its drawing).
