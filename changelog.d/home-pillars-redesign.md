## 2026-07-03 · feat(home): manifesto + 5-pillar content/look redesign; every hero dock tile gets a jump target

- **Manifesto** — the positioning statement now renders as a word-cascade ink
  reveal (each word rises from faint grey to ink, staggered left-to-right, when
  the section scrolls in); the "keep it, for life." finale is serif-italic with
  a gold underline sweep. Copy unchanged (owner-locked positioning).
- **Pillar sections** — new editorial header: serif gold numeral · hairline ·
  serif-italic Filipino name · small-caps English role (per the
  `<name> · <role>` convention), replacing the flat tracking-caps label.
  Headlines updated to the owner-authored hooks from
  `03_Strategy/Pillar_Positioning_Copy_2026-06-30.md` (Suri: "You are the
  host, not the coordinator." · Tiangge: "Supporting cast — there when you're
  ready, invisible when you're not.") and defs re-distilled from the owner's
  long-form manifestos (the flagged pending copy port). Locked claims kept:
  0% commission, Suri paid-tier note, free-floor honesty tags.
- **Choreography** — all content sections (pillars, Real Stories, pricing,
  download, close) get a staggered rise-in on scroll (IntersectionObserver +
  CSS, same pattern as the footer crawl-in); widget frames and feature cards
  polished (gold-wash circular icons, hover lift, softer shadows). All motion
  gated behind `prefers-reduced-motion: no-preference`.
- **Hero dock jump targets** (owner request) — all five dock tiles now land
  somewhere on the page: Ala ala → its section, Suri → the Suri section,
  and Papic / Panood / 3D Plan → the Likha section with their feature card
  pre-selected + centered in the carousel (new `PillarHero.feat` field;
  previously those three had `sectionId: null` and dumped to the top of the
  content).

SPEC IMPACT: DECISION_LOG.md row 2026-07-03 (homepage pillar redesign + dock
jump targets); the owner positioning copy is now live on the homepage —
`03_Strategy/Pillar_Positioning_Copy_2026-06-30.md` port note satisfied.
