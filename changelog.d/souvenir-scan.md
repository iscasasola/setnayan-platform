## 2026-06-28 · feat(guests): souvenir-table QR station (day-of giveaway tracking)

A guest's personal QR is scanned on the day for two things: photographers/Papic
crew **tag** them (already built), and the **souvenir/favor table** confirms
they received their giveaway (new). This adds the souvenir half.

- New migration `20270316014670_guest_souvenir_claims` — a table mirroring
  `guest_checkins` exactly (its own table, not a `guests` column, so it stays
  operable by coordinators while guest writes remain couple-only). Same
  couple+coordinator RLS actor pair. **Applied to prod** (ledger row synced).
- New station at `/dashboard/[eventId]/guests/souvenirs` — couple/coordinator
  scan a guest QR (jsQR, same scanner as the check-in desk) or search by name,
  then confirm "souvenir given." Idempotent (double-scan = no-op), undo
  supported, live `received / total` count. Cross-linked from the check-in desk.
- Server actions `markSouvenirReceived` / `undoSouvenirReceived` mirror the
  check-in actions (membership-gated friendly errors over the RLS security layer).

No personal data is exposed by the scan — it's an operational confirmation, so
no new RA 10173 surface. The manual photographer/crew tagging half already
ships via the Papic capture flow.

SPEC IMPACT: Logged in `DECISION_LOG.md` (event-day hub program — souvenir
station). New table `guest_souvenir_claims`. Iteration `0031_day_of_guest` /
`0001` guest area are the reference homes.
