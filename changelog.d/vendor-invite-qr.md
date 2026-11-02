## 2026-06-30 · feat(vendor/crm): vendor → couple invite QR (the viral import loop)

Owner-locked flow 2026-06-30: a vendor shows/sends an **invite QR**; the couple
scans it and joins as a real client. This is the couple-driven other half of the
free-import workstream (the calendar-block import was freed in #2448) — and the
viral acquisition loop: the vendor's QR onboards the couple onto Setnayan and
lands the vendor on the couple's shortlist.

Flow (exactly as owner specified): scan → if **signed out**, sign up (returns to
the invite via `?next`); if **signed in**, pick one of your events (or create one
if you have none); the vendor is imported into **that event's Explore shortlist**
(an `event_vendors` row — the same target as the marketplace "Save" button).

- **`/vendor-invite/[slug]`** (new public route, noindex) — resolves the vendor
  from the public `business_slug`, shows vendor identity, and renders the
  auth-aware action: sign-up/sign-in CTA · "create your event" · or an event
  picker → claim. `actions.ts` `claimVendorInviteToEvent` verifies the user hosts
  the chosen event, then imports idempotently.
- **`/vendor-dashboard/invite`** (new) — the vendor's shareable QR (via
  `renderUrlQrSvg`) + copyable link + how-it-works; gated behind a published
  profile. Plus a free "Invite a couple" CTA banner on the vendor home.
- **`lib/vendor-couple-invite.ts`** (new) — `buildVendorInviteUrl`,
  `coerceVendorCategory`, `listHostEvents` (both membership models), and
  `importVendorToEventShortlist` (idempotent `event_vendors` insert,
  `source='host_manual'`, reception-anchor recompute — mirrors saveVendorToPicks).
- **create-event `next` support** (additive) — `createWeddingEvent` honors a
  `safeNext()` return path so the no-event couple can create their event and land
  back on the invite to finish. Threaded through the inline event-type picker;
  default redirect unchanged when `next` is absent. (Wedding type routes through
  `/onboarding/wedding`, which doesn't yet carry `next` — graceful fallback: they
  land on their new event and can reopen the vendor link.)

No new table + no token cost (the vendor advertising themselves isn't a
per-recipient secret — keyed on `business_slug`). The relationship that
review-on-import later attaches to IS this `event_vendors` row.

SPEC IMPACT: New couple-facing surface `/vendor-invite/[slug]` + vendor
`/vendor-dashboard/invite`. Reuses `event_vendors` (no migration). Logged in
DECISION_LOG.md (2026-06-30) + memory project_setnayan_vendor_import_crm_workstream.
Still queued: review-on-import wiring (1 couple-authed review per imported event).
