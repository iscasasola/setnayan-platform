## 2026-07-16 · feat(founder-seats): up to 10 owner-granted founder accounts — all features comped, token-free vendor inquiries, server-asserted founder badge

Owner-locked 2026-07-16 (corpus `Founder_Account_Token_Free_Inquiry_2026-07-16.md`): up to 10
owner-granted platform-founder seats (Ice + Cale first; "we will fill it up later").

- **Migration `20270818135217_founder_seats.sql`** — `founder_seats` table (seat_no CHECK 1..10 =
  server-enforced cap; RLS at CREATE; self/admin read only, writes service-role only), definer
  helpers `user_holds_founder_seat` + `event_host_holds_founder_seat` (mirror
  `event_host_is_internal`'s host scoping), `vendor_event_unlocks.comp_reason`, and founder-comp
  branches in BOTH unlock RPCs (`unlock_vendor_event` + `unlock_vendor_event_hold`): a
  founder-hosted event's inquiry is token-free for the vendor — unlock row at 0 tokens +
  `comp_reason='founder'`, no wallet debit, NO lead hold (nothing to settle/release), comped rows
  excluded from the verified weekly quota. FREE-tier gate intentionally unchanged. Seat 1 seeded
  to the owner account.
- **Entitlements** — `eventSkuActive` ORs in `eventHostHoldsFounderSeat`: founder-hosted events
  own EVERY in-app SKU with no order/comp ("all features already paid for"), exactly like §10a
  internal hosts. Deliberately a SEPARATE flag from `is_internal` (internal may later cover
  non-founder staff; the vendor-facing "founder" claim must only ever be true for granted seats).
  Vendor money untouched — founders pay vendors directly.
- **Vendor signal** — server-asserted (never profile-editable) "Setnayan Founder" chip on the
  vendor thread header + pre-accept note ("…not just a client… accepting is token-free"), and the
  `vendor_inquiry_received` notification/email leads with the founder line (deliberately exempt
  from anonymization-until-accept: the founder signal is the one identity fact the owner wants
  revealed pre-accept; takes precedence over returning-client copy).
- **Admin** — `/admin/founder-seats` (Accounts nav group): fixed 10-seat board, grant-by-email /
  revoke via service-role actions + `admin_audit_log` rows (`founder_seat_grant/revoke`).

SPEC IMPACT: corpus `Founder_Account_Token_Free_Inquiry_2026-07-16.md` + `DECISION_LOG.md`
already carry the decision (2026-07-16 rows); the "stamp comp_reason on service_orders" proposal
landed instead as the §10a-style entitlement OR (no orders written) + `comp_reason` on
`vendor_event_unlocks` — the doc's implementation-note deviation is called out in the PR body.
