## 2026-08-17 · fix(doors): the two doors the first pass missed, and the rule that would have found them

PR #4484 ported ten doors onto `<DoorShell>` and pinned them with a guard whose
door list was **hand-enumerated**. That list was a list of the doors I thought
of, and it was short by two:

- **`/host/accept/[token]`** — the co-host invitation. Its wrapper was
  byte-identical to the Samahan one being deleted three files away, and it
  carried the same two `text-terracotta` eyebrows (3.37:1 on cream, AA fail).
  The Samahan file's own comment says it *"mirrors /host/accept/[token]"*.
- **`/[slug]/welcome`** — the +1 guest confirming their name after scanning a
  QR. Its wrapper differed from `JoinShell`'s by one word (`gap-8` vs `gap-6`)
  and it carried one gold eyebrow.

Both are now on `<DoorShell>`. Gold-as-text across all twelve doors: **0**.

**The real fix is the new rule.** `doors-are-designed.test.ts` now also matches
the SHAPE of the defect rather than the names on a list: no `page.tsx` outside
the three authenticated trees may open a full-height, centred, single-column
frame of its own. Measured at 0 offenders once both doors were ported, so it is
a wall, not a ratchet.

🪤 **It matches `<div>` as well as `<main>`, and that is not belt-and-braces.**
The first cut matched `<main>` only. An adversarial pass rebuilt a door's frame
as a `<div>` around the shell and the rule stayed GREEN — and widening it
immediately surfaced `[slug]/welcome`, a REAL missed door that frames its page
exactly that way. **The evasion and the genuine miss were the same blind spot.**

Mutation-checked: sabotage landed 0→1 centred div-frames, `not ok 4 - no public
page hand-rolls a centred card page frame` fired by name, restore → 8 pass.

SPEC IMPACT: None.
