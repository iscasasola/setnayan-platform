## 2026-09-14 · feat(guests): Principal Sponsor splits into Ninong and Ninang

Owner directive, verbatim: "we want them separated Principal Sponsor (Ninong)
and Principal Sponsor (Ninang) instead of Ninong/Ninang so it will be easier to
pair". Filipino principal sponsors stand and process in PAIRS, and one role
could not say which half of a pair a sponsor was.

`guest_role` gains `principal_sponsor_ninong` + `principal_sponsor_ninang`
(additive, own migration, no BEGIN/COMMIT — a new enum value cannot be
referenced in the transaction that adds it).

🔑 THE OLD VALUE IS KEPT AND NOT BACKFILLED. 47 guests on the live roster hold
`principal_sponsor`, and GENDER IS NOT STORED — `side` is which family, not who.
There is no honest rule that splits them, so a migration must not guess; the
plain role now reads as "not yet specified" and stays assignable.

🪤 Related bug this makes visible (NOT fixed here): `event-sponsors.ts ›
sponsorRoleHonorific` derives the honorific from side — `side === 'groom' →
'ninong'`, `side === 'bride' → 'ninang'` — so a Ninong on the bride's side is
addressed as "ninang" on the invitation. That surface (`/sponsors`, 0 rows on
every event) was not the one the owner chose; flagged, not silently rewritten.

Registries joined: the GuestRole union, ROLE_LABELS, ROLE_TO_GROUP,
ROLE_IMPORTANCE (whose `as Record<…>` cast defeats exhaustiveness — verified at
runtime that all 34 roles rank), WEDDING_OFFERED, WEDDING_SELF_CLAIMABLE,
tier1Roles, the bulk picker, the emcee script order, the mood-board role→group
switch, and the editorial voices list.

Capture-bar win: `ninong` and `ninang` now tag the SPECIFIC role, so
"Bob Cruz ninong" lands as a Ninong. A bare `sponsor` cannot know which half and
deliberately stays unspecified.

SPEC IMPACT: None — no locked decision covers the principal-sponsor role shape.
