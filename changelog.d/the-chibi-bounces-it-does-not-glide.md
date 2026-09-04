## 2026-09-04 · feat(venue-3d): the chibi bounces — it does not glide

`guest-venue-3d.tsx` carried this warning:

> ⚠ NO GAIT ON THE CHIBI PATH. The chibi rig is jointless below the neck…
> an avatar figure **GLIDES** where the blob runs. That is a real regression in
> motion, and it is why `NEXT_PUBLIC_FIGURE_CHIBI` **must NOT be flipped on**
> until the rig spec's § 11 pose PR lands.

⚠ **THAT FLAG IS `"true"` IN PRODUCTION** (verified via `vercel env pull`). So
the regression the comment warns about has been live: any guest who made an
avatar slid across the floor without moving.

🔑 **THE CONSTRAINT NEVER APPLIED TO A HOP.** A leg cycle needs joints — that is
why merging legs, shoes and outfit into single buffers (the fix that killed the
ball-joint read) killed the walk. A hop needs no joints at all: it is a
whole-body translate and scale. So the very merge that removed the walk left the
bounce completely available, and the figure stops sliding **without re-opening a
single seam**. This is not the § 11 pose work; it is motion that does not need
legs.

**`chibiHop(phase, amp)` in `lib/figure-rig.ts`** — pure, no three.js, no React,
following that file's own discipline so the motion is testable without a GPU.
`|sin|` gives a real ground contact at each zero rather than a hover; squash is
strongest at landing and gone by the apex, with xz widening as y flattens so the
figure never reads as deflating.

**It lands rather than freezing.** The gait clock stops the instant the walk
ends, so reading it raw would park the figure mid-air at whatever height the last
frame caught. `amp` eases to 0 on arrival and `chibiHop` returns exact neutral
there. Reduced motion gets no bounce at all — this is decoration, not
information.

**Only the chibi is wrapped.** `venue-avatars.ts` guarantees a guest without an
avatar renders exactly as before, and the blob has its own gait already.

🪤 **Three sabotages exposed problems — two in the sabotages, one in the guard.**
"Hover instead of hop" used `0.5 + 0.5·sin`, which still reaches exactly 0, so it
landed and was never a hover. "amp 0 not neutral" removed an early return that is
redundant — the math already yields neutral at amp 0 — so its absence is not a
defect. The real hole: the wrapper assertion read only the FIRST
`<ChibiBounce>` span, so a second wrapper around the blob stayed green. It now
COUNTS wrappers and requires exactly one.

That is the third first-match assertion this week to report on code it was not
about. `indexOf` answers a question about the first occurrence, which in a
1400-line file is rarely the one being asked about.

SPEC IMPACT: None — motion only. Movement direction per character direction
(Heritage walks · chibi bounces · Kokeshi and Soft One-Piece glide · Blocky Kit
walks) is owner-set, 2026-09-04.
