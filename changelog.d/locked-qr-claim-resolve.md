## 2026-07-02 · feat(vendor-dashboard): Locked QR scan freezes the scope + resolves the couple's date (PR3)

The couple-facing half of the Locked QR — a scan now records what they availed
and settles their wedding date.

- **Migration `20270426215000`** — `CREATE OR REPLACE vendor_claim_locked_qr`:
  (a) freezes `service_description` onto the booking via `event_vendors.notes`
  (COALESCE — a legacy NULL never wipes a note); (b) FINALIZES the agreed date —
  stamps `events.event_date` from the token and clears `date_candidates` /
  `date_window` / `date_mode`, done before the schedule so `before_event`
  due-dates anchor to the agreed date. No-op for legacy tokens (event_date NULL).
- **Scan page** (`/vendor/lock/[token]`) now shows the **agreed wedding date** +
  the **"what you availed"** scope in the deal summary, and — per host event —
  a resolution line before locking in: *finalizes an option* / *sets your first
  date* / *changes your date*, plus a truthful **"N of M shortlisted services may
  not be free then"** warning computed from `getVendorAvailableDays` (fails OPEN
  per vendor — never invents an unavailability, per the no-fabricated-numbers rule).

SPEC IMPACT: Vendor dashboard § Locked QR claim — booking now carries scope +
resolves the date. Logged in DECISION_LOG.md (2026-07-02). ⚠ Migrations
`20270426214000` + `20270426215000` NOT yet applied to prod — `supabase db push`;
code degrades gracefully pre-migration (legacy behaviour).
