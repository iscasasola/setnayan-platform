## 2026-09-18 · fix(guest-session): the guest login cookie is now extended on activity

The `setnayan_guest_session` cookie was minted once — at redeem/claim/QR
rotation — and never re-set on an ordinary page read. A guest who first
joined well before the wedding and kept returning across the up-to-30-day
post-event window could still hit the flat 60-day expiry and get logged out
mid-event, with no way back in but a fresh QR scan.

`middleware.ts` now runs a sliding-window refresh on every request: once a
verified `setnayan_guest_session` cookie has less than half its max age
(30 of 60 days) left, it is re-signed with the same payload and a fresh
60-day expiry, using the existing shared `resolveGuestSessionSecret()` /
`signGuestSession()` from `lib/guest-session.ts`. No DB call is added —
`readGuestSession()`'s qr_token/deleted_at revalidation stays the one
chokepoint that can revoke a session; this only decides whether to extend a
cookie a real page read will still re-check on its own next use.

Does not touch `setnayan_wall_display` (`lib/live-wall.ts`) — that cookie is
LAU-40's separate finding, owned by S13 (#5593).

SPEC IMPACT: None.
