## 2026-09-20 · feat(monogram): ONE reveal, for a mark made either way — the 2026-06-23 lock overruled

Owner: *"it should be one reveal for both only"*, then — asked to overrule the
lock explicitly rather than have it inferred — *"overrule it."*

The 2026-06-23 decision put the reveal picker INSIDE the Vector Studio
(*"improve THIS animate the reveal … not a separate feature"*), retiring the
standalone picker. That was right while letters were the only source of a mark.
It stopped being right the moment an uploaded logo could BE the mark: a picker
that lives in the letters editor cannot serve a mark that came from a file, and
the upload panel had grown a SECOND picker — one field
(`monogram_studio_config.anim`) with two writers, neither visible from the other
door.

**The reveal is now its own step**, after the mark exists, whichever way it was
made. It plays each effect on the couple's OWN mark, auto-playing on selection
(the complaint was "i cannot see the different monogram animation effects", and
a still frame answers nothing), with the tempo chips and a "Keep this reveal"
that writes the same `anim` field the studio panel wrote — so every surface
already reading the reveal keeps reading it.

**The ₱500 unlock renders directly beneath it**, which also settles the price
placement question: the money sits under the thing it buys. Owner: *"all
animations cost the 500. but uploading or creating a monogram is free."*

**The tempo table moved out of the engine first.** `quick: 3s · classic: 6s ·
ceremonial: 10s` was a local const inside `engine.ts`. The new step needs those
same numbers, and a second copy would have shown one duration in the preview and
played another — so it is now `ANIM_TEMPO_TIMINGS` in
`lib/monogram-studio-shared.ts`, imported by both. Extracting it BEFORE writing
the second consumer is the whole point.

The upload panel keeps showing the couple's logo with its piece and colour
counts — that was a real gap and it stays — but its reveal chips are gone, and
it points down to the one reveal instead.

SPEC IMPACT: **`DECISION_LOG.md` row added 2026-09-20** recording the overrule,
what it replaces, and the part that is unfinished.

### NOT FINISHED — stated rather than glossed

The studio's own `#animbox` panel is still in the DOM and still visible. The
engine binds listeners to it in three places (`$('animbox')` at the chip loop,
the accordion toggle and the click handler), so removing it can break the editor
outright, and hiding it is a one-line CSS change that needs a BROWSER to verify
the editor still mounts — which this session could not run (no `.env.local` in a
worktree, and the paper.js composition only exists at runtime).

So the shared step is authoritative, but a couple in the studio can still see
the old panel. The consolidation is one step short, and that step needs a live
check rather than another typecheck.

### CI follow-up · no local alias for a shared name

`lint:dup-rule` caught the first fix: extracting the tempo table left
`const ANIM_TEMPOS = ANIM_TEMPO_TIMINGS` in `engine.ts`, an alias kept so the
two call sites would not need touching. That alias SHADOWED the exported
`ANIM_TEMPOS` from the very module the file now imports — and they are different
values: the tempo NAMES (`['quick','classic','ceremonial','custom']`) versus the
TIMINGS map.

One identifier meaning two things in one file is how the next reader picks the
wrong one. The alias is gone and both call sites use `ANIM_TEMPO_TIMINGS`
directly. The guard was right; the convenience was not worth it.
