## 2026-07-31 · feat(emcee): the script layer — what a host will SAY at each moment

Finishes the WIP on `claude/emcee-script-layer` rather than restarting it (per the standing note on
that stream). The branch held one unmerged commit, purely additive, **211 commits behind main**.

**The model: a layer, not a document.** The emcee does not author a script file — he annotates the
couple's night. Three things already sit on a schedule block; this adds the fourth:

| source | what it is | whose |
|---|---|---|
| `event_schedule_blocks.label` | what happens, and when | couple |
| `event_schedule_blocks.notes` | what they want said | couple |
| `BLOCK_CUE` (`lib/emcee-script`) | the shared prompt for the type | ours |
| **`vendor_block_scripts.body`** | **what HE will say** | **his** |

Because his line is attached to a `block_id` and not to a position in a document, **the couple can
move dinner and his script moves with it** — the thing a Word file can never do.

**Vendor-private, deliberately.** Exactly one policy: the owning vendor (plus admin). Not the
couple, not the coordinator, not another supplier on the same event. The couple booked a host, not
a manuscript; his working copy ("slow, full names, Atty. first, pause for applause") is craft, and
showing it to them changes what he is willing to write down. Mirrors `vendor_client_notes`, the
shipped precedent for a vendor's private working material.

### 🔴 The catch that made this more than a port

**The WIP migration's prefix was dead on arrival.** `20271020117627` now sits *below* the applied
head in prod (`20271027100000`), and a migration below the head **never runs** — it would have
merged green, deployed clean, and created nothing. Re-allocated via `pnpm migration:new` to
**`20271027606042`**. This is exactly the "verify the OBJECT, never read merged as live" trap the
Song Desk contract warns about, met from the other direction.

Dependencies re-verified against prod before porting (the branch predates 211 commits):
`event_schedule_blocks.block_id` exists · `current_vendor_ids()` returns `SETOF uuid` ·
`vendor_block_scripts` does not already exist · `BLOCK_CUE` and `ScheduleBlockType` still export.

### What the WIP already got right (kept as-is)

RLS enabled at `CREATE TABLE` time · the mandatory `REVOKE ALL … FROM anon, authenticated` before
the narrow re-grant (no `anon` grant at all) · `current_vendor_ids()` rather than an invented
predicate · `ON DELETE CASCADE` from both `events` and `event_schedule_blocks` (a script for a
moment that no longer exists is worse than no script) · `UNIQUE (block_id, vendor_profile_id)` so
two hosts on one wedding each keep their own.

### What this PR adds

**The test suite the module asks for.** `emcee-script-layer.ts` justifies being a pure module on
the grounds that "a decision is only trustworthy if a test can hold it down" — and shipped with
none. 14 tests, two of which protect a person rather than a property:

- **`publicFacing` fails toward SILENCE.** A booked vendor reads the full timeline, private blocks
  included; a private block's note is *context*, never copy. Asserted for `undefined`, `null`, `0`,
  `1`, `'true'`, `'false'`, `{}` — only a real `true` reads public. The failure mode being defended
  against is a host reading a surprise into a live microphone.
- **An orphan is promoted, never dropped.** A sub-block whose parent was RLS-filtered still
  appears, because silently losing a moment from a host's running order is the worst thing this
  module can do.

Plus ordering (time → `sort_order` → id, both directions), nesting, whitespace-only bodies not
counting as written, a script whose block was deleted, duplicate rows resolving last-wins without
leaning on the DB constraint, `unanswered` (they asked, he hasn't answered), and totality — an
empty timeline and an unparseable date both return rather than throw.

**Exposure baseline regenerated in the same PR**, per the standing rule that the freeze fails on
any policy change. The diff is 9 new facts and reads correctly: **`anon=-` on every column**,
`authenticated` table privilege gated behind the vendor-scoped policy.

### Not in this PR

No UI. This is the layer and its storage; his prep page and his day-of desk become renderers over
`buildScriptWorkbook`, in their own PR.

### Verification

`tsc --noEmit` **exit 0, 0 errors** (single run at 8 GB — the default heap OOMs on this repo and a
crashed run's error count is not a result) · `next lint` clean · **`test:unit` 5,854/5,854** ·
`lint-exposure-baseline` OK · migration replayed cleanly in the PGlite harness (1006/1006 applied)
during baseline generation.

SPEC IMPACT: None — implements the owner's 2026-07-29 ask (*"help the emcees … creating their
scripts, and plotting of the planned scripts for each part of the event"*) already recorded in
`DECISION_LOG.md`. No pricing, no schema outside the new table, no policy change to any existing
object.
