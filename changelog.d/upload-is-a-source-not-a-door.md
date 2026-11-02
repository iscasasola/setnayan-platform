## 2026-09-20 · feat(monogram): an uploaded logo can BE the letters — frames, colours and the reveal apply to it

Owner 2026-09-20: *"it means we want to replace the letter with the upload a
photo. that is it. they can add frames for free on their uploaded monogram and
reveal … they will be able to see the effect and unlock that animation."*

So the upload stops being a parallel destination and becomes a SOURCE for the
one studio. This is the shape Canva and Wix use (upload is a tab inside the
editor); the earlier front-door split followed Adobe Express and Looka, chosen
because the two paths wrote different columns — the columns were driving the
product instead of the other way round.

**It needed less than it looked.** `base[i]` is just a paper item per piece and
`lp(i)` clones and transforms it; `glyphPath()` already builds letters by calling
`paper.project.importSVG(...)`. An uploaded mark's pieces take the same slots, so
frames, ornaments, colours and the reveal work on them unchanged — none of that
code asks what a letter says, it indexes `base`, `st` and `order` by position.

Two things the swap genuinely needed:

- **Normalisation.** An uploaded mark arrives in its own viewBox while every
  glyph is drawn at FS around the origin, so a 512-unit logo lands ~3.4x
  oversized and the frames — which size themselves off the letters' bounds —
  wrap something off-screen. ONE factor for the WHOLE mark, never per piece:
  scaling pieces individually would destroy the proportions and relative
  placement the couple's designer drew.
- **Per-piece starting state.** `lp()` assigns `p.position`, an ABSOLUTE point,
  not an offset. Caught before shipping: `tx/ty = 0` on every piece would have
  stacked the whole logo on the origin and collapsed it into a pile. Each piece
  starts at its OWN centre, unscaled — the letter defaults (ampersand at 0.62,
  letters spread along x by `offX`) would have taken a finished logo apart the
  moment it opened.

Reachable now: with a logo uploaded and no studio design yet, the design door
opens ON the logo. Saving writes the composition; the original file is never
overwritten — it stays the archived source it was made from, and only the
re-rendered version is used (owner: "yes keep it. and only use the rerendered
version of the uploaded photo").

Measured before touching anything — of 11 events in production: 0 have both
marks, 1 has an upload only, 0 have a studio mark only. So nothing in production
changes shape under this, and the precedence flip it implies costs nothing today.

SPEC IMPACT: None yet — the flip itself is not in this change.

### Still to come (deliberately NOT in this PR)

- The resolver still prefers `uploaded ?? studio`. Under this model it becomes
  `studio ?? uploaded` (the composition is the mark; the upload is the fallback
  for anyone who has not composed yet). 0 events are affected today.
- One shared reveal step for both sources — currently the picker lives inside
  the Vector Studio for letters and as chips in the upload panel. Consolidating
  reverses the 2026-06-23 lock and is flagged for sign-off.
- Whatever precedence machinery is dead once the flip lands (the `data-mark`
  switch, the side-by-side compare) should be retired rather than left as a
  second mechanism that disagrees.
