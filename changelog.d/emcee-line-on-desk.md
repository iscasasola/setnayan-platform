## 2026-08-01 · feat(emcee): his own line, on the day-of desk

Item 6 of the owner-locked spec (`Emcee_Script_Layer_LOCKED_BUILD_SPEC_2026-08-01.md`). Closes the
loop: he writes his lines in prep, and on the night they are on the desk he is actually holding.

**One block type added to a shipped surface. Nothing else on the desk moves.** The Stage-Script desk
(`stage_script`) already renders the couple's program — cue card, running script, announcements.
This threads in `vendor_block_scripts`: his own words for this wedding, scoped to his profile under
the caller's client, so the table's vendor-private RLS is the only thing deciding the read.

It appears in three places, each for a reason:

- **Under the now-block** — his words sit closest to the moment, because it is what he needs fastest.
- **Under NEXT** — so he can pre-read while the current moment is still running.
- **Once per row in the running script** — a block with no line of his shows nothing extra. **The
  desk never nags mid-show;** counting what is unwritten belongs to prep.

### Typography is the safety control

On a **public** moment the line is set in the reading serif at the largest size on the card — it is
read at arm's length under stage lighting, and the eye learns that serif means *say this*.

On a **private** moment that typography is deliberately **withheld**: ink plate, UI face, a "not for
the mic" chip. A half-second glance in a dark hall can never mistake staging notes for copy. This
works **with** the shipped `PrivateBadge` above it, not instead of it.

Colour carries none of that meaning — strip every hue and the say / don't-say boundary is still
legible from the words and the shapes. (`--color-gild` is already redefined for the obsidian theme,
so the treatment survives the dim-room register without a second code path.)

### The one change to the pure module

`StageCueBlock` gains **`blockId`** — purely additive, and it earns its place: without an id on the
cue block a renderer would have to match on the **label**, and two moments in one wedding can share
one ("Toasts"). That would put a host's line on the wrong moment while he is holding a live
microphone. Two new tests pin it, including that two identically-labelled moments stay distinct.

### Degradation

The lines read is **best-effort**: a failure there must never cost him the desk. The couple's program
is the load-bearing half, so if his lines cannot be read the desk renders exactly what it did before
this feature existed. A read failure and an empty library are the same value here **deliberately** —
both mean "nothing to add", and neither is a reason to withhold the program he is on stage to run.

### Verification

- `tsc --noEmit` **exit 0, 0 errors** (8 GB heap — the default OOMs on this repo)
- `next lint` clean on all three touched files
- **`test:unit` 5,921 / 5,921** (2 new)
- No migration, no policy change, no new table.

SPEC IMPACT: None — implements item 6 of the locked spec as written.
