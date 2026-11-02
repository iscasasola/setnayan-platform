## 2026-09-06 · feat(papic): G3 — the vendor-portfolio Papic surface

Follow-on to G2 (PR `claude/vendor-portfolio-papic-ledger`, #5201): the vendor
dashboard now spends the credits G2's ledger already grants.

**Buy the pack.** `buyVendorPapicPortfolioPack` mints an apply-then-pay order
(`vendor_papic_portfolio_pack`, `orders.event_id` + `vendor_profile_id` set),
re-checking the booking (`fetchVendorRoomEvents`) and the live catalog price
before minting — the client never sends a price. The activation hook that
grants the credits on admin approval already shipped in G2
(`grantVendorPapicPortfolioPack`); this PR only mints the order.

**Import into a PRIVATE portfolio album.** New table
`vendor_papic_portfolio_photos` (migration slug `vendor_papic_portfolio_photos`)
— one credit imports one finished photo, for the supplier's OWN business page.
Deliberately a THIRD table, not a fourth spend-source bolted onto
`vendor_papic_captures`: an import is not a camera event. New ingest route
`/api/vendor/papic-portfolio-import` mirrors every other Papic route's shape
(credit check → R2 upload under its own prefix,
`papic/vendor-{id}/portfolio/{eventId}/…` — never the host gallery's, never the
on-the-day capture lane's → insert under the vendor's own RLS client → always-on
background NSFW screen). No guest-consent gate and no event-day window: nobody
is photographed here, and a supplier curates their portfolio whenever they
like.

**ONE meter, TWO spend doors.** `fetchVendorPapicPortfolioCredits` now folds
BOTH the on-the-day capture spend (`vendor_papic_captures`) and the new
portfolio-import spend into a single `spent`/`left`, so the readout a supplier
sees never disagrees with either surface that draws on it. A hidden row
(NSFW-blocked or taken down) on EITHER side does not count, mirroring the
existing capture-spend convention exactly.

**Proven, not asserted.** `tests/db/vendor-papic-portfolio-is-not-the-host-gallery.db.test.ts`
— a portfolio import never touches `papic_photos` (the host gallery); RLS: the
supplier reads only their own album, the couple reads none of it, an unbooked
vendor cannot import for someone else's event, and a session cannot rewrite
its own NSFW screen result; anon holds no grant at all. Unit coverage for the
"one meter, two doors" arithmetic (`vendor-papic-grants.test.ts`) and the
album's visibility rule (`vendor-papic-portfolio-album.test.ts`).

Ugat joint J49 extended with the new table's claims (fourth table on the same
joint).

SPEC IMPACT: `DECISION_LOG.md` — record G3 as shipped under the 2026-09-05
"VENDOR-PORTFOLIO PAPIC" row, noting the album is a THIRD table (not a
`vendor_papic_captures` extension) and that its spend folds into the same
ledger total G2 built.
