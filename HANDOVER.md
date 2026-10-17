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
