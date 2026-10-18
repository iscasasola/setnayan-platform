# HANDOVER — rd/background-overlay-effects · started 2026-10-18 ~19:35 PHT by the controller

(Controller's original brief is in git history: `git show 11a86a409d:HANDOVER.md`.)

## RULE 0 FINDING (builder, 2026-10-18) — the overlay ALREADY SHIPS; the brief's list is superseded twice
- `lib/ambient-effects.ts` (one engine, CSS-only, zero requests, zero guest JS, reduce-motion = finished still,
  readable band) + `app/[slug]/_components/ambient-effect.tsx` (one layer) + `_lib/main-ground-layer.tsx`
  `effectOver` (laid in `<MainGround>`) + Studio › Look › Background › Effects carousel
  (`website/editor/_components/background-effects.tsx`: live miniatures over the CURRENT background, How much ▾,
  Colour ▾). Storage `config_json.main.effect {kind, intensity, colour?}` — exactly the restudy's key.
  Commits d7322e2478 · 0d4fccf661 (2026-10-08) · f6225a35f1 (2026-10-14) · 96db538699 (2026-10-17).
- The set: restudy (8: Petals · Butterflies · Confetti · Sparkles · Lanterns · Capiz · Gilded dusk) was REPLACED by
  DL 2026-10-08 "LOOK ROUNDS 4–5" (six; butterflies/confetti set aside — amendment § 2.A "Why five, not seven"),
  then by DL 2026-10-14 "EFFECTS + ATTIRE DESIGN APPROVED": **Soft haze · Bokeh lights · Gold dust ◆ · Petal drift ◆ ·
  Lanterns ◆ · Gold shimmer ◆ · Light leak ◆ · Film grain ◆** (Capiz dropped; stored capiz/sparkles read as
  haze/dust). That is what ships. "None · Soft haze · Bokeh lights" = the first three cards visible at 375 px.
  → Building the restudy's list would reverse two owner rulings. NOT doing it.
- IntersectionObserver / Save-Data: the layer is `position:fixed` (never off-screen while the page shows; hidden tabs
  already stop CSS animation) and fetches nothing (Save-Data has nothing to save). Adding JS would put a script on
  every guest page against the engine's "zero JS" rule. Said in PR, not built.

## THE REAL DELTA (what this branch builds)
DL 2026-10-16 "ALL ANIMATE, EFFECTS, STYLES AND ACCENTS ARE EVENT HUB PRO ◆" + the #6623 pattern (tried free in the
Maker, named at ✓ Apply; free events keep what they published):
1. All eight effects Pro ◆ (`AMBIENT_EFFECT_IS_PRO` — Soft haze, Bokeh were free).
2. A ◆ effect is WRITTEN to the draft (like Parallax), not "tried on the sample, never written + See Pro note":
   `effectMayApply`/`effectProNote`/the trying state + note leave; `mainGroundChange` (lib/hub-draft.ts) counts the
   effect (refChange → grandfather: a live effect = no change; taking it off = free; new/changed = Pro).
3. Apply sheet names it by its own name (`hub-pro-effects.ts` main line: "Lanterns" / "Photo background · Lanterns").
4. Guest render: no visible change. The render gate keeps refusing only the six kinds that were ALWAYS Pro (a free
   event could never publish them); Soft haze / Bokeh published while free keep drawing.
5. Guards updated (the-effects-are-picked-on-the-sample, the-look-sample-is-the-guest-look, eight-and-cost-nothing)
   + a new one; sabotage each.

## STATE
- [ ] 1–5 code  - [ ] targeted tests + sabotage  - [ ] walk 375 (lab) + shots → shots-2026-10-18/<pr>/
- [ ] fragment changelog.d/rd-background-overlay-effects.md  - [ ] draft PR, label, auto-merge off, CI green
