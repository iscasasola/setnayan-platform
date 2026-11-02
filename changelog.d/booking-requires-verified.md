## 2026-07-24 · feat(booking): require vendor verification to lock

Owner rule (2026-07-24): "they can only book customers if they are verified." A
couple may only BOOK / LOCK a **marketplace** vendor once that vendor's
`vendor_profiles.verification_state = 'verified'`. This is the gate that keeps
the "first N booked customers free → then 5%" model attached to real, verified
businesses (verification now requires DTI + business permit — the
registration-number work in #3633 / migration `20270925937630`).

What landed (defense-in-depth — the DB trigger is the real enforcement, the
app-side checks give friendly UX):

- **DB hard guard** — migration `20270927437859_booking_requires_verified_vendor.sql`
  adds `enforce_booking_requires_verified_vendor()` + a `BEFORE INSERT OR UPDATE`
  trigger on `event_vendors`. It fires ONLY on the transition INTO a confirmed
  status (`contracted`/`deposit_paid`/`delivered`/`complete`) for a row with a
  non-null `marketplace_vendor_id`, and raises `check_violation`
  (`vendor_not_verified: …`) unless the profile is verified. This is the one
  choke point every write path funnels through: `finalizeVendor` (UPDATE +
  slot-acquire RPC), the wizard INSERTs (`completeVendorPickFromMarketplace`,
  `lockBoothToEvent`), and the package cascade (`lockPackage`). SECURITY DEFINER
  (public RLS on `vendor_profiles` is verified-only). RLS untouched.
- **Grandfathering** — the trigger skips any UPDATE where `OLD.status` was
  already confirmed, so existing `contracted` rows (and their lifecycle
  advances / edits) are never re-checked; a vendor demoted AFTER a lock keeps
  that lock. Off-platform / manual vendors (`marketplace_vendor_id IS NULL`)
  carry no verification concept and are never gated. Non-booking statuses
  (`considering`/`shortlisted`) pass.
- **Server-side friendly gates** — `finalizeVendor` returns a new
  `vendor_not_verified` result (before any write, and before the coordinator
  propose-lock branch so a coordinator can't even propose an unverified vendor);
  `lockPackage` returns a new `vendor_not_verified` result; the two wizard lock
  actions throw a friendly message. All read via the admin client and the shared
  `isMarketplaceVendorBookable` helper in `lib/vendor-verification.ts`.
- **UI surfacing** — the couple's Lock tab (`build-locked` → `AccordionLockButton`)
  shows a small "Verifying — can't lock yet" pill for a known-unverified
  marketplace vendor and short-circuits the tap to the friendly message; the
  pending-lock-proposals strip and the package lock modal render the same
  explanation. Reuses the existing enrichment `is_verified` flag.
- **Tests** — `lib/vendor-verification.test.ts` (pure + mocked-client helper,
  fail-closed) and `tests/db/booking-requires-verified.db.test.ts` (trigger
  end-to-end: verified locks, unverified/pending/demoted/rejected blocked on
  INSERT + UPDATE transitions, off-platform + shortlist pass, grandfathering of
  an existing lock through a later demotion).

SPEC IMPACT: Booking now requires vendor verification (owner-locked
2026-07-24) — a marketplace vendor cannot be `contracted` until
`verification_state = 'verified'`. Logged at the bottom of `DECISION_LOG.md`;
the code + this migration are canonical.
