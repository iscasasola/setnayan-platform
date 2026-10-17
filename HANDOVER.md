# HANDOVER — rd/pro-regate · started 2026-10-18 ~02:20 PHT by the controller

THE RULING (corpus DECISION_LOG 2026-10-16, "ALL ANIMATE, EFFECTS, STYLES AND ACCENTS ARE EVENT HUB PRO ◆" — read it:
`git -C ~/Documents/Claude/Projects/Setnayan show origin/main:DECISION_LOG.md | /usr/bin/grep -n "ALL ANIMATE, EFFECTS"`;
never edit/pull that checkout). Owner verbatim: "all animate, effects, styles, accents are pro". Plus the same night:
everything in Style is Pro (colour, size, font, style cards on a part); free events keep the theme's defaults; FREE EVENTS
KEEP WHAT THEY ALREADY PUBLISHED (nothing changes for guests on live pages; only NEW changes need Pro).

BUILD — with the SHIPPED Pro pattern, never a new one: tried free in the Maker, named at ✓ Apply (the existing
pay-at-Apply list), and an event's unlock covers everyone on it (memory: an unlock belongs to the event). Find the shipped
pieces first (Rule 0): lib/hub-pro-effect-view.ts, hub-draft.ts (mainGroundChange etc.), the stage-animate / stage-style
tools, how Shimmer/effects/accents already name themselves at Apply. Gate:
 1. every Animate choice (Build in · Action · Build out, Movement, the entrance) on every part;
 2. every effect (Shimmer, Glow, Word by word, Spread, Develop, Curtain, Light leak, Ken Burns, Parallax, Drift, …);
 3. every Style choice on a part (colour, size, font, style cards);
 4. every Accent.
GRANDFATHER: a free event's already-published choices keep rendering for guests and stay in the draft; only a CHANGE to
a non-default value is a Pro item at Apply. Prove it with a test on a published free event fixture.
Words: use the existing ◆ / Apply copy; do not invent new offer copy (`/features must say what ships`).
Proof: 375 px WebKit iPhone 13 shots: a free event trying a Style + an effect → ✓ Apply names them as Pro; a Pro event
→ no Pro list; a free event with old published choices → guest page unchanged. Light + dark.
Shots → ~/Documents/Claude/Projects/shots-2026-10-18/<pr>/. Changelog fragment changelog.d/rd-pro-regate.md.
Never open the owner's cale-ice Maker (it is Pro anyway); use the lab / a seeded lab event.

---
## BUILDER LOG (rd/pro-regate)

### Rule 0 — what exists · what is missing · the delta
- EXISTS: the one gate `planHubDraftApply` (lib/hub-draft.ts) → refused items → named at ✓ Apply by
  `hubDraftProEffects` (lib/hub-pro-effects.ts) → Apply sheet (website/_components/apply-pro-sheet.tsx). The event's
  unlock = `ownsPro` measured by the caller (covers everyone on the event). Grandfather is built into `refChange`
  (same value = 'none', back to default = 'remove', both free; only add/change is Pro).
- ALREADY PRO before this branch: a part's MOTION (`HUB_ELEMENT_PRO_FIELDS = ['motion']`) incl. Shimmer + the six
  effects; scene motion keys (`HUB_CANVAS_MOTION_KEYS`, reveal, during/leak, mediaMotion), the Cover entrance;
  Decorations/accents (`accentsTurnOn`, ART_KIT_IS_PRO = true); Love Story Pro looks (`lib/scene-style-pro.ts`).
- MISSING (the 2026-10-16 ruling): a part's Style — font · colour · size · weight · B/I/U · align · width · spacing,
  text runs' font/colour/size — and every style card (scene `canvas.style`, fixed parts' picks, Post Event looks…)
  are still FREE at Apply. Plus any Animate value the explore pass finds un-compared.
- DELTA: widen the gate's Pro fields (one list) + the style-card facet; name them at Apply with existing words;
  ◆ on the newly-Pro controls the shipped way (label " ◆", `pro: true` on a card); tests incl. grandfather fixture.

### Done so far (server gate — lib/hub-draft.ts · hub-look-pro.ts · scene-style-pro.ts · post-event-draft.ts · hub-pro-effects.ts)
1. `HUB_ELEMENT_PRO_FIELDS` = motion + font · color · size · weight · italic · underline · align · width · leading ·
   tracking (free: hidden, word, format). Runs' font/colour/size = a `el:<part>:runs` facet (compared by the letters).
2. `PRO_SCENE_STYLES` = every style that is not the default on EVERY stage drawing it — generated, test recomputes it
   from the registry. Cards get ◆ automatically via `sceneStylesOn`.
3. Dress code `palette` / `dos` looks = 'look' facets. Cover photo Parallax = `groundMotion` facet.
4. Fixed-part style cards (`fixed-style`) Pro unless default. Post Event scene style card Pro (stored only when not
   the recommended). Camera look Pro unless Classic. Fixed blocks' motion Pro (backgrounds stay free).
5. Reply pages: a line's c/f/s/l + i/v, a card's / group's i/v Pro (`rsvpLookGrowing`); grounds, words, order free.
6. Apply sheet names all of it: "Colour · Size · Schedule", the card's own name, "Camera look · Your brand",
   "Animation" for blocks, "Style"/"Animation" on RSVP.

### PRODUCT CALLS made (record; flag to owner)
- Look (the page's own font / colours / buttons) stays FREE — the ruling names Style on a PART; Look is not a part.
- Love Story Chapters/Essay/Years become Pro too (10-17 named only Timeline + Swipe cards; the 10-16 "everything in
  Style" answer covers every non-default card).
- A card that is one stage's default but changes another stage (Gallery: Mosaic/Grid) counts as Pro once stored.
- Card / block / RSVP backgrounds stay free (Background is its own tool; colour is free, media already Pro).
- Accents' guest render is already gated on Pro (ART_KIT_IS_PRO, shipped 10-16 with the feature) — nothing published
  before it to grandfather; left as is.

### NEXT
- run targeted tests; fix re-aimed old tests (free-vs-pro-redrawn, a-fixed-block-has-its-own-motion, …)
- ◆ in the Maker: Colour/Size/Width labels, fixed/Post Event/camera/palette cards, RSVP rows, Drift + Ken Burns
- grandfather test fixture; lab `?pro=1`; 375 px WebKit shots; changelog fragment; PR
