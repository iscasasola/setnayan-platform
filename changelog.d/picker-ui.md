## 2026-08-10 · feat(preservation): the couple can see and choose what stays sharp

Owner: *"they can pick which one to preserve. where we will see the preserved
photo/video."* The foundation (the mark, the point accounting, the per-capture
sweep) landed in #4299; this is the half a person actually uses.

### What ships

- **A "Kept sharp" filter** beside All / Photos of us / Untagged / Videos — the
  "where we will see the preserved" half of the ask.
- **A line above the grid**: *"148 of 200 kept at full resolution · 31%"* with a
  bar. Shown to EVERYONE, not just payers, so being over what you bought is
  legible before it matters rather than six months later.
- **A gem on each tile** — green when kept, dark when released. One tap.
- **A write path** (`setCapturePreserved`) that is couple-only, scoped to the
  event on both the read and the write, and refuses a capture whose original has
  already gone.

### 🗣 The wording carried more risk than the code

This is the one control in the product where a couple can quietly cost
themselves something, so:

- **Nothing says "delete" or "remove".** Releasing lets the original be replaced
  by the compressed copy that already exists; the photo stays in the gallery for
  five years either way. A test fails if the word "delete" appears in the action.
- **The tooltip warns before the tap**, not after: *"it stays in your gallery,
  just smaller, and that cannot be undone later."*
- **An already-compressed capture renders as a plain, unclickable marker.** The
  server refuses it too — but a control that accepts a tap and changes nothing is
  the thing worth not building.

### Derived, never re-typed

The meter counts through `papicCaptureCost` and `PRESERVATION_BLOCK_POINTS`, the
same constants every camera spends against, so the bar can never disagree with
what a capture actually cost.

Vendor documentation captures are excluded — those are the vendor's own files on
their own retention, not the couple's to hold.

### Verified

**7317 / 7317** unit tests · **926 / 926** database tests · `tsc --noEmit` clean ·
19 lint scripts pass.

🪤 The database suite first reported 5 failures — **an artefact of running it
from the repo root instead of `apps/web`**, where those tests resolve their
paths. A wrong-directory failure and a real failure look identical in the output.
Re-run correctly: 926/926. Worth recording because it is the same shape as the
exposure-baseline miss earlier the same day: a result that looks like a verdict
and is actually a fact about how it was invoked.

SPEC IMPACT: `DECISION_LOG.md` 2026-08-10 — applied and pushed.

### Revised 2026-08-10 — four defects fixed before review

1. 🚨 **The meter counted the capped gallery array.** `fetchPapicGallery` caps
   each source at 120, so at any real wedding "N of M kept" and every percentage
   built on it were wrong — and wrong in the direction that looks plausible, the
   kind a couple never questions. It now takes `fetchPreservationTotals`, a
   server-side exact count over the whole event, and renders **nothing** when
   that count is unavailable. **A number a couple cannot check is worse than no
   number.**
2. **A failed count no longer reads as zero.** A rejected Supabase query resolves
   with `{ error }` and a null count — it never throws. Reading that as 0 would
   tell a couple they are keeping **none** of their photos, the single most
   alarming thing this screen could say, at the moment it is least true.
3. **Vendor captures are excluded from both halves.** They belong to the
   supplier, are never preservable by the couple, and counting them inflated the
   denominator so the couple appeared to be keeping less of their own event than
   they were. Already-compressed captures are excluded too — there is nothing
   left to keep, so counting them as "not kept" invites a choice that no longer
   exists.
4. **`eventId` is now REQUIRED.** It was optional, so a caller that forgot it
   silently rendered a gallery with no preserve toggle, no sparkle and no meter —
   no build error, no visible cause.

**And the copy now matches the owner's ruling of 2026-08-10.** The percentage of
a one-year allowance is gone (preservation is a **paid** option whose price is
not set — a share of an allowance nobody bought is a fiction) and so is
"forever" (retired 2026-08-07). What it says is what is true: everything is kept
at full size until three months after the event ends, and releasing something
only changes its size.

⚠ A first cut of the guard banned the word "delete" outright and flagged the
sentence *"nothing is ever deleted"* — the exact reassurance the owner asked for,
twice. **It bans the CLAIM, not the word.**

Mutation-tested six ways, baseline green, every sabotage verified applied:
counting the capped array again (2 fail) · a failed count becoming zero · a limit
in the counter · vendor captures counted · "forever" returning · `eventId` made
optional again.

### Priced 2026-08-10 — the owner set the model

Owner, verbatim: *"papic has number of papic credits. 1 credit = 1 photo, 8
credits = 10 sec video. the preservation will follow those. 500/year for every
5000 credits worth of preserved photo and video."*

That closes the open price question, and it is the **same unit a couple already
buys shots in** — 5,000 credits is 5,000 photos, or 625 videos, or any mix.

🔑 **A COUNT OF ITEMS IS NOT A BILL.** The meter had to be re-weighted before it
could state a price: one 10-second video costs **eight** times a photo, so "412
kept" says nothing about what is owed. `fetchPreservationTotals` now counts each
source **per media kind** — the kind column differs between the two tables
(`photo_type` vs `media_type`), and one shared literal would have silently
counted one table's clips as photos — and weights them with the capture path's
own `papicCaptureCost`.

The meter now shows credits held against the block they fall in, and what that
costs per year. Every figure derives from `PRESERVATION_BLOCK_POINTS`,
`PRESERVATION_BLOCK_PHP` and `PAPIC_POINTS_PER_CLIP`; nothing is re-typed.

⚠ **Three of the first four sabotages went straight through the guard**, and
that is the finding worth recording. It asserted that `keptCredits` and
`blocksNeeded(` *appeared* — so switching the bill to `blocksNeeded(totals.kept)`,
which bills a video as a photo and undercharges by up to eight times, passed
green because the words were still on screen elsewhere. **"Keep the call, discard
its result" beats every presence check.** It now asserts the exact expression,
that the peso figure is the derived one, and that the credits are weighted in the
counter. All four sabotages then failed as they should.

⚠ A separate false alarm: the guard flagged `bg-success-500` as a hard-coded
₱500. Class names are stripped before looking for numbers — a guard that cries
wolf on a colour token teaches you to skim past it.

Mutation-tested: bill by item count (caught) · yearly price typed into the copy
(caught) · block size typed into the copy (caught) · credits left unweighted
(caught) · video cost typed in (caught) · plus the six from the earlier revision.

### Owner ruling 2026-08-10 — everyone can choose, so the price is CONDITIONAL

Owner: *"they can choose which should be preserved."* The picker is open to every
couple, paid or not — what they pick decides the cost. No gate, which is what
already shipped here: the toggle renders on every non-vendor capture.

🚨 **But that exposed a wording problem worth fixing before anyone saw it.**
Everything is kept **by default** — a couple picks what to RELEASE — so a couple
who has done nothing still has every capture selected. The meter said *"Keeping
this much at full size costs ₱500 a year"*, which presents a **bill** for a
selection they never made, covering a period that is **free**.

It now names the included window first, then states the figure conditionally:
*everything is kept at full size until three months after your event ends — that
part is included. After that, keeping this much would be ₱500 a year.*

Guarded: the copy must say "would be", must name the free window as included,
must state when it ends in the owner's own words, and a bare "costs ₱X a year" is
rejected. Mutation-tested both ways — restoring the standing-bill wording, and
dropping the free-window sentence — each caught.
