# Changelog fragment — collected into CHANGELOG.md by scripts/changelog-collect.mjs

## 2026-09-02 · feat(venue): the seated crowd wears the couple's dress code on the public walk

The couple sets a guest dress-code palette on the Mood Board. The 2D reception
scene has always rendered "guests in a mix of them" (`reception-scene.ts`
`guestPalette`). The **3D guest walk — the surface the ₱1,500 3D Plan is charged
for — ignored it entirely**: every seated stranger was an untinted white
mannequin, so the couple's dress code reached the drawing and never reached the
room their guests actually walk.

**The fix needed no RPC change, no migration, and no new privacy surface.**
`SeatedInstance.color` already existed and is documented, verbatim, as "Outfit
tint (mood-board attire colour)"; `InstancedSeatedCrowd` already drives it
through `setColorAt`. The public walk already had the palette client-side
(`scene.rolePalette`, used for room materials since v7). The one call site
simply passed `color: null`.

New `guestAttireColor(rolePalette, seatKey)` in `lib/seating-3d.ts` resolves a
colour from `role_palette.guest`, keyed by seat. `hashId` is now exported from
`lib/figure-rig.ts` and reused rather than duplicated — one hash for every
"same id → same look, forever" decision in the figure system.

### ⚠ This supersedes half of the 2026-06-26 venue privacy lock — owner-decided 2026-09-02

The lock read "seated occupants are NEUTRAL untinted mannequins (anonymised
strangers … no per-guest attire/hair, no names beyond the RPC contract)". It was
recorded **only in code** — `DECISION_LOG.md` has no row for it — and carried the
note "Q5 unanswered", so the question had been raised once and never resolved.
Surfaced to the owner rather than changed quietly; the owner chose to dress the
whole crowd.

**The lock's PURPOSE is intact, and that is the whole design:**

- the colour comes from the **couple's** approved palette, never from anything
  about the person in the chair;
- it is keyed off the **seat**. Two different people in one chair at two events
  get the same colour; one person moved between chairs gets two. Nothing about
  an individual is encoded or recoverable;
- `public_venue_scene` still sends occupancy as `{table, seats}` with **no
  identity**. Unchanged — no migration in this PR.

**The rest of the lock still holds:** no per-guest hair, no role/side/RSVP
tinting, no names beyond the RPC contract.

### The guard

`lib/the-crowd-wears-the-dress-code-not-an-identity.test.ts` pins the two
properties that matter, and was verified by sabotage rather than by going green:

| Sabotage | Caught |
|---|---|
| key the tint off `nameBySeat` instead of the seat | ✅ 1 fail |
| invent a colour when the couple set no dress code | ✅ 2 fails |
| let an unapproved colour into the crowd | ✅ 4 fails |

Distinct failure counts, so the tests discriminate rather than all collapsing
together. The source guard pins the **one** call site to `` `${t.id}:${i}` `` and
rejects an argument mentioning guest/name/photo/rsvp/side/role — the specific
future edit that would silently re-open the lock.

**No guest palette → `null` → the old white mannequin, byte-identical.** Every
event whose couple never set one renders exactly as before.

Verified: typecheck ✅ · lint ✅ · 11,878 unit tests ✅ · all 29 CI guards ✅.

SPEC IMPACT: `DECISION_LOG.md` — new row recording the owner's 2026-09-02
supersession of the "neutral untinted mannequins" half of the 2026-06-26 venue
privacy lock, and the seat-keyed reasoning that leaves its purpose intact.
Applied directly per the 2026-06-04 standing authorization.
