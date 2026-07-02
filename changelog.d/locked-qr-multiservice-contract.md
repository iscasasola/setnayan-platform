## 2026-07-02 · feat(vendor): Locked QR — multi-service, contract pick, date rules, two photos, completeness gate

Second Locked-QR pass (owner iteration), on top of the Name·Date·Amount rework.

**Generator** (`locked-qr-generator.tsx`)

- **Event-date label is event-type-aware** — reads the chosen event type ("Wedding
  date", "Birthday date", …), falling back to "Event date" (there are many event
  types, not just weddings).
- **Date-collision advisory** — when the event date is picked, a server action
  (`checkVendorDateConflict`) checks the vendor's own `vendor_calendar_blocks`
  (manual + booking-derived) and warns if that day is already blocked/booked.
  Advisory only — never blocks issuing.
- **Downpayment ≤ total** — inline error + gate (also enforced server-side).
- **Multiple services** — the service picker is now multi-select chips; the deal
  is one booking covering all chosen services (primary service sets the
  `event_vendors` category, the full set is stored on the token).
- **Payment dates bounded** — each schedule date must be between today and the
  event date (`min`/`max` + validation), with an inline error when out of range.
- **Two photos** — proof of payment (REQUIRED, gates issue) + an optional
  remembrance keepsake photo.
- **Contract pick (REQUIRED)** — choose one of the vendor's saved contracts;
  empty state points to Contracts when the vendor has none.
- **Generate** unlocks only when service(s), event date, scope, total,
  downpayment (≤ total), the full schedule (₱0 remaining, all dates in range), a
  contract, and the payment proof are all present.

**Schema** (migration `20270427844373`) — three additive, backward-compatible
columns on `vendor_locked_qr_tokens`: `vendor_service_ids` (JSONB, the full leaf
set), `source_contract_id` (FK → `vendor_contracts`, ON DELETE SET NULL),
`remembrance_r2_key`.

**Issuance** (`issueLockedQr`) — resolves the multi-select refs to categories
(primary = first), validates the chosen contract belongs to the vendor, requires
proof + contract, rejects downpayment > total, and stores the new columns. New
`checkVendorDateConflict` server action for the advisory.

**Claim** (`vendor/lock/[token]/actions.ts`) — on the first successful lock, the
chosen template contract is copied into a fresh, event-bound `vendor_contracts`
row for the couple (`sent_for_signature`, same R2 file), via the admin client.
Self-swallowing so a copy hiccup never undoes the lock.

Also wired `contracts` through both generator entry points (My Shop inline +
`/invite`).

⚠ Deploy note: migration `20270427844373` must be applied (`supabase db push`)
after merge — the issuer writes the three new columns.

SPEC IMPACT: Locked QR now records multiple services per deal, a required
payment-proof photo + optional remembrance photo, and a vendor-chosen contract
that materializes onto the couple's booking (sent-for-signature) at scan; date
rules (event date ≥ today; schedule dates within [today, event date]) and a
date-conflict advisory added. No pricing/SKU change. Corpus DECISION_LOG row
appended.
