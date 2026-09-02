# Changelog fragment — collected into CHANGELOG.md by scripts/changelog-collect.mjs

## 2026-09-02 · fix(venue): the dress-code crowd shuffles instead of rotating, and rejects a colour it cannot paint

Two follow-ups to the same-day seated-crowd dress code (#5096), both found by an
adversarial audit of the shipped code rather than by anything failing.

### 1 · A 4-colour dress code walked a table as a mechanical rotation

`hashId` is FNV-1a, whose final `Math.imul` never mixes high bits downward. So
`% n` for a **power-of-two** `n` reads only the low `log2(n)` bits — and those
barely change between consecutive seat keys. Measured over 40 tables: seat `s`
wore the same colour as seat `s+4` **100.0%** of the time. A round table read as
a mechanical ABCD rotation rather than a mixed room.

This was the common case, not an edge case: `PALETTE_LIMITS.guest` allows 3–6
colours, and the one live event using this feature has exactly 4.

Fixed with Fibonacci hashing (Knuth 6.4) before the modulo. Repeat rate drops to
**0.0%** at size 4 and **26.6%** at size 2 (random ≈ 25% / 50%); the 250-seat
spread is 66/60/62/62 against an ideal 62.5.

> ⚠ **The obvious fix is wrong in JavaScript, and shipping it would have been
> worse than the bug.** `(h ^ (h >>> 16)) % n` looks correct and is broken: `^`
> yields a **signed** int32, the fold goes negative, `negative % n` is negative,
> `options[-1]` is `undefined`, and the colour silently disappears — measured
> spread 65/35/33/35 with colours simply missing. This was written, run, and
> caught by the distribution test before it left the worktree. Multiply-and-shift
> is unsigned by construction (`>>> 16`), which is why it is used.

### 2 · A 3-digit hex was choosable but unpaintable

`guestAttireColor` validated with this module's shared `HEX`, which accepts
`#abc`. Downstream, `MANNEQUIN_TINT_RE` (`lib/figure-sit-bake.ts`) is 6-digit
only — so a 3-digit colour was **chosen here and silently painted white there**:
a colour the couple picked vanishing with no error anywhere.

Now validated by a dedicated `GUEST_ATTIRE_HEX` (6-digit only, matching the
renderer). Deliberately **not** a change to the shared `HEX`, which is
load-bearing for `resolvePalette` / `resolvePaletteFromRoles` and the room
materials. `sanitizeRolePalette` already stores 6-digit only, so this rejects
nothing real — it closes the gap for a future caller that skips sanitization.

### The first version of the cycle guard was vacuous — and sabotage proved it

It asked only whether **one** seat in twelve broke the cycle, and the raw-FNV
sequence happens to break once. It therefore **passed against the exact bug it
was written to catch**. Rewritten as a rate over 40 tables, with the threshold
placed from measured values rather than guessed.

| Sabotage | Before rewrite | After rewrite |
|---|---|---|
| raw FNV modulo (the rotation bug) | ❌ passed 9/9 | ✅ 1 fail |
| the signed-xor fold (colours vanish) | — | ✅ 3 fails |
| loosen back to 3-or-6 digit hex | — | ✅ 1 fail |

🔑 **A guard that has never failed has not been tested.** This one shipped green
and useless for the length of one commit.

### Not changed

An audit also measured `guestAttireColor` re-filtering the palette per seat
(~250 array allocations per memo run). Left as is: it is build-time, sub-millisecond,
and inside a memo that already allocates 250 `Matrix4`s. Recorded so it is a
measured decision rather than an oversight.

Existing crowds reshuffle once — colours were assigned ~20 minutes earlier on a
single event, so there is no meaningful churn.

Verified: typecheck ✅ · lint ✅ · 11,885 unit tests ✅ · all 29 CI guards ✅

SPEC IMPACT: None. Implementation quality only; the 2026-09-02 owner decision
recorded in `DECISION_LOG.md` for #5096 is unchanged.
