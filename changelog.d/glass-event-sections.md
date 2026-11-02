## 2026-07-15 · feat(design): event core sections re-expression — Guests + Schedule (Glass PR-3a)

Re-express the two highest-traffic event sections into the Atelier-Glass language
landed by Glass PR-1 (#3251) + PR-2 (#3256), consuming the shipped kit
(`.sn-tile`/`.sn-row`/`.sn-eye`/`.sn-h1`, `sn-lens-swap`/`sn-chip-pop`/`sn-bar`,
Space Mono numerals). Every data source, server action, route, copy-fact and
feature flag is unchanged — real data or nothing. Split from the full PR-3
(Vendors/Budget/Checklist ship as PR-3b) to keep review size sane.

- **Guests (Living Roster).** The owner-built composition (2026-07-11) is
  untouched — facet bar, roster-as-hero, inline chip editors, reactive seat
  chips, capture bar, all data/actions/routes stay; the "Invite guests" + "Share"
  header buttons (#3249) stay in place. Re-expression only: header → `.sn-eye`
  + `.sn-h1` with mono count; SummaryFacetBar wrapper → glass panel; pax meter →
  `sn-bar` gold fill + mono readouts; facet LensPills → solid-gold active state
  with `sn-chip-pop` + mono counts; roster body → `.sn-lens-swap` on facet change
  (keyed remount; selection lives in module-singleton stores so it survives);
  desktop roster `<table>` → ONE glass wrapper with opaque rows (§1.6 blur
  budget); avatar side-gradients (bride → gold family, groom → info-slate, both →
  blend) with side dots; warm RSVP pill tones (attending success · maybe warning
  · pending neutral · declined danger); mono seat chips (gold-100 suggested);
  capture bar + mobile sticky filter strip → glass.
- **Schedule.** Header → `.sn-eye` + `.sn-h1`. Event-day view recomposed: new
  "Next up" glass strip (imminent block, mono time) → timeline of `.sn-row`
  blocks with a gold now-line accent on the imminent block; add-block form +
  emcee strip → glass. Journey/preparation composed timelines left intact.

Blur budget: desktop Guests viewport = facet bar + capture bar + roster wrapper
(3 blurred panels, well under the ~8 cap); rows never blurred. `m-serif` retired
on both pages; numerals → Space Mono; warm semantics only (bride/groom identity
= gold / info-slate families). typecheck + lint + lint:radius + lint:legibility
+ local prod build pass; reduced-motion covered by the global freeze.

SPEC IMPACT: None (design re-expression only; the plan lives at
`~/Documents/Claude/Projects/Setnayan/App_Wide_Glass_Rollout_Plan_2026-07-15.md`
§3.1 "Top sections" + §5 PR-3).
