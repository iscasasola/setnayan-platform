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

## 2026-09-14 · feat(guests): guests can be paired — the column finally has a reader

`guests.pair_with_guest_id` has existed since the FIRST guests migration
(20260513010000, 2026-05-13) as a bare self-FK with no index, no constraints,
and — verified 2026-09-14 — NO CODE ANYWHERE THAT READ OR WROTE IT. A designed
slot never built. Filipino entourages walk in pairs (groomsman↔bridesmaid,
ninong↔ninang), which is what the owner asked for.

A pair is MUTUAL and EXCLUSIVE. Mutuality is not expressible as a row
constraint (each row is checked alone), so both halves are written in ONE
statement by the new `pair_guests` / `unpair_guest` SQL functions — two
round-trips from the app would leave a window where A points at B and B points
at nobody. What CAN be a row constraint is: `guests_no_self_pair` and a partial
UNIQUE so two guests cannot both claim the same partner.

⚠ THE FK IS LEFT SINGLE-COLUMN ON PURPOSE. A composite
(event_id, pair_with_guest_id) FK would enforce same-event pairing, but its
ON DELETE SET NULL would try to null the NOT NULL event_id — so deleting a
paired guest would be REFUSED rather than unpairing their partner (a SET NULL
behaving like RESTRICT). Same-event pairing is checked inside `pair_guests`
instead, and a db test asserts the delete really does go through.

UI: "Pair these 2" appears in the bulk bar at EXACTLY two selected — "pair
these 3" has no meaning, and pairing the first two of a larger selection would
be guessing which two the host meant. Each paired guest's row shows
"walks with <name>" plus an unpair control.

🔑 A PAIR THAT NOTHING RENDERS IS NOT A PAIR. `pair_with_guest_id` was not even
in `GUEST_FIELDS`, so writing it without adding the read and the row line would
have left the host unable to tell a paired guest from an unpaired one — the
exact write-with-no-render failure this codebase has shipped before.

11 db tests against replayed SQL cover: both halves written, both halves
cleared, re-pairing releasing BOTH old partners, idempotent re-pair, self-pair
refused twice (function and CHECK), a stolen partner refused, cross-event
pairing refused, and delete-unpairs-partner.

Also corrected: the comment above the bulk role list described the
picker/validator divergence as a deliberate quirk to preserve. It was a defect
a host could hit.

SPEC IMPACT: None.
