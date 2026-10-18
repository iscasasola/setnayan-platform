# HANDOVER — rd/background-overlay-effects · started 2026-10-18 ~19:35 PHT by the controller

Look restudy row 8, the part #6639 did NOT build. CONTRACT: corpus BACKGROUND_RESTUDY_2026-10-08_fable.md (approved DL
2026-10-08 "restudy is good"), row 8 + the "Effects — two kinds" paragraph, and prototype
prototypes/background_restudy_2026-10-08_fable.html (the Effects sheet: "ON TOP · ONE AT A TIME" cards + "How much").
#6639 (merged) built "The picture" (Parallax ◆ + Blur ▾). MISSING: the OVERLAY — Overlay cards on top of whatever source:
None · Petals ◆ · Butterflies ◆ · Confetti · Sparkles · Lanterns ◆ · Capiz glow ◆ · Gilded dusk ◆, each card showing the
effect moving over the CURRENT background; Intensity ▾ Subtle · Standard · Lavish ("How much" in the prototype — use the
prototype's words). Storage `config_json.main.effect {kind, intensity}` (no migration). One ambient engine
`lib/ambient-effects.ts` reusing the reveal petal/butterfly systems and the celebration particle systems in a slow,
looping, under-the-words layer in `<MainGround>`; Lanterns + Sparkles new particle systems; Capiz/Gilded from
SPATIAL_THEMES. IntersectionObserver + prefers-reduced-motion + Save-Data stop. Pro per the doc (◆ ones Pro via the
#6623 pattern: tried free, named at ✓ Apply).
NOTE: today's Effects panel shows "None · Soft haze · Bokeh lights" — find where those come from (Rule 0) and reconcile
with the doc's list (the doc is the contract; keep any shipped one the doc doesn't name only if removing it would break
saved events — say which in the PR).
Keep the Maker first-load budget (≈0.1 KB left; the engine and cards lazy-load; never raise it). Phone first 375 px,
side-by-side vs the prototype. Never open the owner's cale-ice Maker. Commit + push after EVERY step; HANDOVER current —
the account may stop you any time. Own walk folder (scratchpad/overlay-walk/).
Shots → ~/Documents/Claude/Projects/shots-2026-10-18/<pr>/. Fragment changelog.d/rd-background-overlay-effects.md.
