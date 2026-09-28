## 2026-09-28 · feat(hero): Designs 2–4 — The Marquee · The Crest · The Letter, each a starting point whose parts are tap-to-edit

The Maker's Hero page gets ONE **Design** dropdown (`PickMenu`): Design 1 The
Card (the shipped hero, the default, byte-identical) · 2 The Marquee (the names
are the art, a small mark between two rules) · 3 The Crest (the couple's logo in
a double ring, the names on one line under it like a seal) · 4 The Letter
(ranged left, anchored low, the mark in the corner). Drawn from the approved
`prototypes/hero_scene_templates_2026-09-25.html`; Design 5 was dropped by the
owner. A pick lays out the SAME parts — eyebrow · mark · names · joiner · line ·
date · time, and the Happening-now pill — in `PahinaMasthead`, on every stage
and both mastheads (the card and the hero-photo one), with long names wrapping
on a 375px phone. Every part keeps its `data-el` key and motion hook, so it is
the same tap-to-edit element in every design (`lib/element-style.ts`, nothing
new), and the couple's per-part edits ride across designs untouched
(`withHeroDesign` changes only `design`).

Stored as `canvas.design` on the hero row (`invitation_widgets.config_json`,
beside `elements`) — no table, no column, no migration; drafted whole through
`hubDraftAction`, live at Apply. Contract: `lib/hero-design.ts`.

The Letter's names sit low, so the navigator tile (and any cover cut from the
hero's top) would show no names: the rendered hero now carries
`data-hero-design`, and `buildTileDocument` pins The Letter's tile to the foot
(`TILE_ANCHOR_BOTTOM_CSS`) — the finding recorded with the design set.

First visit: `customer_hero_designs_v1` mini-tour on the Hero page. Dev-only
`/dev/hero-lab` draws all four designs on fixture words with the prototype's
own logo, in any theme, for phone/desktop checks with no database.

Tests: `lib/hero-design.test.ts` (per design: every part renders and is an
editable element; wrapping is never forbidden; edits reach the part and survive
a design change; The Card is byte-identical; the contract; the tile anchor;
source guards on every masthead mount, the one dropdown and the tour).

⚠ OPEN (controller): whether picking a design is Pro. The decision rows are
silent and the 2026-09-25 Pro list names fonts, colours, media and motion, not
the arrangement of the free card's own parts — so it ships FREE. To gate it,
add `'design'` to `HUB_CANVAS_LOOK_KEYS` (`lib/hub-look-pro.ts`); nothing else.

SPEC IMPACT: None (implements DECISION_LOG 2026-09-26 "HERO TEMPLATES: DESIGN 5 IS DROPPED" and "A HERO DESIGN IS A STARTING POINT" as written).
