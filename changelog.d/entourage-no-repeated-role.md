## 2026-09-30 · fix(entourage): the heading says the role — no "Ninong" under every name; Secondary Sponsors grouped by role

Owner, verbatim, looking at the invitation's Principal Sponsors: *"the sub text
Ninong can be removed"*. A role now prints beside a name on the guest page only
where nothing else says it (`roleBesideName` in `apps/web/lib/entourage.ts`):
Principal Sponsors, Bride's Crew & Groom's Crew, Flower Girls and a Maid of
Honour / Best Man under their own heading draw names only; the role stays as
`sr-only` text for screen readers. Sections whose heading cannot tell names
apart keep it (Parents, Immediate Family, Bearers, The Ceremony, The Nikah, a
Matron of Honour). The guest's own "You are …" line (`roleLabel`) is unchanged.

Secondary Sponsors (owner, same day) are drawn BY ROLE — one small sub-heading
("Candle", "Veil", "Cord", "Coin"), the pair(s) under it on one line, no role
beside any name. Stacked (B) is the default; inline "Candle: names" (A) is a
`roleLayout` option on `EntourageSection`, not yet exposed in the Maker. The
printed Entourage card (`printedEntourageLines` in `apps/web/lib/print-layout.ts`)
groups them the same way (muted sub-heading line) and no longer appends
"· Candle Sponsor". Guarded by
`apps/web/app/[slug]/_components/the-heading-says-the-role.test.ts`.

SPEC IMPACT: DECISION_LOG.md row (2026-09-30, entourage role repetition +
Secondary Sponsors by role) — applied directly in the corpus.
