## 2026-08-22 · feat(story): challenge answers get their own column

> Owner, 2026-08-21: *"the papic challenges can have their own part on the
> story/editorial."*

**"What We Asked"** — a new section on the couple's story page: the question a
guest was asked on the night, and what they did about it. Placed beside the other
guest voices (Kwento's whispers, the Letters to the Editor), because that is what
it is: the guests talking, in their own words.

🔑 **THIS IS WHY THE RUNNING ORDER WAS REBALANCED.** A board of ten pure photo
errands would leave this column permanently empty — the change and its feed had
to ship together.

### 🔒 Four consent gates, and they are not interchangeable

A public web page carrying video of somebody's guests. Every gate fails closed:

1. `consent_to_share` — the guest ticked "share this" **on the answer**.
2. `consent_to_public` — the guest ever agreed their captures may be **public at
   all**. Asked once, separately.
3. the capture is screened `clean` and not hidden.
4. the guest has not opted out of photos for this event — the same veto every
   other Papic surface honours.

⚠ **Gate 1 alone is the tempting shortcut and it is wrong.** Ticking "share this"
on a greeting means the COUPLE may see it. It does not mean a page anybody can
open may carry your face. Collapsing the two would be **indistinguishable from
working** on every event that exists today, because production holds zero
answers.

Also fail-closed: a rejected read resolves with `{ error }` and never throws, so
every step degrades to `[]` and the section *hides* rather than rendering a
partial list that reads as "these are all the answers". An unresolvable media
ref is an absence, not a broken tile. A clip plays from its compressed **web**
copy, never the original, which still carries the geo the outbound rule strips.

### Guards

10 assertions, **every gate mutation-proved to be load-bearing on its own** —
turn one off and it must refuse. Plus a source guard that reads the loader and
requires all six filters **in the query chain**, comments stripped: without it,
loosening the real query would leave the mirrored predicate passing and this file
still reporting that consent is enforced.

🪤 **THREE HARNESS FAILURES IN ONE SITTING, ALL THE SAME FAMILY.**
`npx tsx --test "app/[slug]/…"` printed **"# tests 0 … # fail 0"** — `[slug]` is
a glob character class, so it ran nothing and exited green. Then `git checkout --`
on a bracketed path silently did nothing (git reads brackets as a **pathspec
glob**), so sabotages accumulated and every later result was contaminated. Then
the literal-pathspec restore worked *too well* — data.ts was **uncommitted**, so
it reverted to before the loader existed and destroyed ~100 lines of my own work,
which had to be rebuilt. **Commit before mutating; restore from an explicit file
backup, never from git; and verify the restore, not just the sabotage.**

Also fixed: an `eslint-disable-next-line` pushed out of range by a three-line
comment, so the rule warned anyway — a suppression nobody can evaluate.

SPEC IMPACT: `0012_papic/Papic_Games_and_Vendor_Missions_Spec_2026-07-21.md` §10
— the challenge-answers column and its four gates. `DECISION_LOG.md` 2026-08-22.
