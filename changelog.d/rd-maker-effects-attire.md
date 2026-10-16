## 2026-10-14 · feat(maker): the eight approved Effects, and the Attire figures — two picks per mixed role, one figure for Studio and guest page

Owner, 2026-10-14 (DECISION_LOG "EFFECTS + ATTIRE DESIGN APPROVED"; prototype `prototypes/maker_effects_and_attire_2026-10-14_fable.html`),
then the same day his pick of the AI-drawn attire figures over the hand-drawn SVG ones.

**Effects** (Studio › Look › Background › Effects, `lib/ambient-effects.ts`) — translated from the prototype's "Proposed" kinds and `spawn()`:
Soft haze · Bokeh lights (free) · Gold dust ◆ · Petal drift ◆ · Lanterns ◆ · Gold shimmer ◆ · Light leak ◆ · Film grain ◆. Slow cycles, fade
in/out, depth by blur; the readable band, How much ▾, Colour ▾ and the reduce-motion still kept.
- Gold shimmer glints on the NAMES — the shipped foil-names technique (`[data-hub-foil]`), the one non-compositor animation, one heading only.
- Film grain is three in-page SVG noise frames (no image); only their opacity steps.
- Capiz glow and Sparkles are gone: a stored one is READ as Soft haze / Gold dust (`HUB_MAIN_EFFECT_RETIRED`) — `main.effect` is JSON on the
  hero row, so there is no column to migrate; the couple's next write stores the new kind.

**Attire** (Studio › Mood Board & Dress Code › Attire):
- One block per role (name · arrives · its people · note · its photos), as drawn.
- Two picks — men / women — for VIP · Immediate Family, Principal Sponsors, Secondary Sponsors and Guests; boys / girls for Bearers &
  Flower Girl. Each pick has its own Wear ▾ and its own colours. The first pick is stored where it always was
  (`dress_code_config[tier][key].style` + `role_palette`); the second in `dress_code_config.women` (`lib/attire-rows.ts`) — not
  `role_palette`, a closed vocabulary that would drop it. The older dress-code form carries it through its whole-config rebuild.
- ONE figure component (`app/_components/role-figure.tsx`) for the Studio and the guest's dress code: the garment's drawing
  (`public/attire/<garment>.webp`, 7–9 KB) with the role's colour laid over it through the garment's mask, multiplied. The artwork is behind
  one seam, `lib/attire-figures.ts`. "Not said yet" is a dashed silhouette.
- A guest sees their own pick (a ninang the women's; else the couple's gown/suit for them on the guest list, `guests.attire`) — both when
  the page cannot tell.
- The Entourage board is gone from Attire (its photos stay stored; `wedding_party` stays the silent palette fallback).

SPEC IMPACT: None — implements the 2026-10-14 approved design; DECISION_LOG row already recorded by the controller.
