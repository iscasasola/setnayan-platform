## 2026-07-15 · fix(admin): token-bands copy honesty — flat-1 burn + ₱200 locks reflected

Rewrote stale user-facing copy around the `/admin/pricing?tab=token-bands`
surface so it matches the shipped locks (2026-07-11 flat-1-token-per-connection
lock + 2026-07-15 PR #3138 flat ₱200/token). Copy only — no behavior, schema, or
route changes.

- `admin-nav-descriptions.ts` (`token-bands` nav item + Money-hub card): was
  "Vendor token pricing bands by location tier." (wrong twice — bands are burn
  counts not pricing, and location-tiering is retired) → now describes the
  per-inquiry burn as flat 1 everywhere since the 2026-07-11 lock, editable only
  to change the platform-wide burn.
- `pricing/_surfaces/token-bands-surface.tsx` header: dropped the "banded by the
  wedding's region" / "Pending owner ratification" / min-wage framing; now states
  the flat 1 token (₱200) per connection policy, that the table is the
  platform-wide emergency lever the `unlock_vendor_event` RPC reads, and that per
  the owner lock the base gate is never raised above 1.
- `app-performance/_components/action-center.tsx` watch-list: "Vendor token bands
  — Mint/adjust packs from Token bands …" pointed pack minting at the wrong
  surface → now "Vendor token packs — Mint/adjust token packs in Pricing …".

SPEC IMPACT: None
