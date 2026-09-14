## 2026-09-15 · feat(guests): Ninong and Ninang replace the plain Principal Sponsor role

Owner ruling, verbatim: *"we can now successfully remove the Principal Sponsor role
since we already alloted the Ninong and Ninang to each Principal Sponsor. This will
be the same rule across all other weddings."*

**Retired from every picker.** `principal_sponsor` is no longer offered or
self-claimable in `WEDDING_ROLE_SET`, no longer in the bulk-assign vocabulary, no
longer the mind map's default for the Principal Sponsors branch, and no longer the
role in the CSV import template. A principal sponsor is a Ninong or a Ninang.

**Retired, not forgotten.** Postgres has no `ALTER TYPE … DROP VALUE`, so the enum
value outlives the ruling. Every READ path keeps understanding it — the seating
tier, the role-group mapping and ordering, `INNER_CIRCLE_ROLES`, the editorial
voices, the emcee script — because a row written before the ruling must still
group, sort and seat correctly. Deleting it from those too would turn an old row
into the `invalid_role` error the owner already hit once.

**The last two writers, both fixed.** The capture bar's bare `sponsor` token and
`sponsorGuestRole()` on the dormant `/sponsors` page were the only remaining ways
back into the dead role. Guests carry no gender, so neither can resolve the half on
its own; asked directly, the owner chose **Ninong** for both, so the two doors agree.

**A wrong honorific deleted rather than patched.** `sponsorRoleHonorific()` derived
ninong/ninang from `side` — which is which family a sponsor stands with, not whether
they are a godfather or a godmother. It addressed every bride-side godfather as
"ninang", in a letter, by name. It survived only because `/sponsors` has never held
a row. It now says "principal sponsor", which is true of everyone, and the docblock
says what to build if the warmer word is wanted back.

**A live defect found on the way (`lib/guests.ts`).** The 2026-09-14 split never
added the two new roles to `INNER_CIRCLE_ROLES`, so `defaultInvitedToForRole`
stopped recognising a principal sponsor: a Ninong added after the split defaulted to
THREE blocks where the role they replaced got FIVE. Measured on the live roster:
**37 of 38 principal sponsors sat at three blocks** — no after-party, no rehearsal
dinner — and no screen said so, because the chips render whatever is stored. Fixed
for all three roles. The 37 existing rows are NOT rewritten: `invited_to_blocks` is
host-editable and one row already differs, so overwriting could erase a real choice.

**Data.** 8 live rows still held the retired role, all on the public `Maria & Jose`
demo, split by the seed's own notes (which already read "Ninong; bride's uncle") and
paired by surname through `pair_guests`. 0 live rows hold it anywhere now. The seed
script is fixed so a re-seed cannot reintroduce it.

**Guards.** `lib/a-split-role-keeps-its-standing.test.ts` (new) asserts the general
property the omission broke: roles sharing a role group must agree about inner-circle
standing, so the next role split is told rather than trusted. Sanctioned exceptions
carry a reason and a date, and the test fails if an exception goes stale. On its
first run it found a second instance — `witness` vs `wali`/`imam`/`wakil` in the
Nikah principals — which is left open and surfaced, because it is a judgement about
a Muslim ceremony and not a refactor's to make (0 live rows). `role-sets.test.ts`
and `bulk-role-vocabulary.test.ts` now assert the retirement in both directions;
`guest-pairing.db.test.ts` keeps asserting the enum value still works, with the
reason written down so it is not tidied away.

Verified: 15,678 unit tests pass · typecheck clean · 31 CI lint guards green (runner
proven able to report a red) · all guards sabotage-verified.

SPEC IMPACT: `DECISION_LOG.md` — new row for the 2026-09-15 retirement and the
"unspecified principal sponsor is a Ninong" rule.
