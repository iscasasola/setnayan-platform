## 2026-07-15 · feat(design): event long-tail Atelier-Glass sweep (Glass PR-4)

Apply the §4 coherence contract from the Atelier-Glass rollout across every
remaining `dashboard/[eventId]/**` route not covered by PR-2 (Overview) /
PR-3a (Guests + Schedule) / PR-3b (Vendors + Budget + Checklist). Pages sit on
the warm `.sn-ambient` wash: opaque `bg-cream`/`bg-white` panel fills →
`.sn-tile` (single panels/form sections) or `.sn-row` (list rows, dashed
empty-states, sub-panels inside a blurred tile — no nested blur); page heroes →
`.sn-eye` eyebrow + `.sn-h1` (retires `m-serif`/`font-serif`/`m-display-tight`/
`text-3xl font-semibold`); hand-rolled `font-mono … uppercase` labels →
`.sn-eye`; headline numerals/₱/counts → Space Mono; warm semantics replace
emerald/amber one-offs. Every data source, server action, route, copy-fact and
feature flag is unchanged — real data or nothing.

- **Studio hub (true recomposition).** `studio/page.tsx` header → `.sn-eye` +
  `.sn-h1`; coordinator/vendor suggestion strips + Alaala framing + Recommended /
  Set-up-&-manage / section lists → `.sn-tile` glass (list containers wrap ONE
  blurred tile, opaque divided rows inside — §1.6 blur budget). The flat-sidebars
  "Set up & manage" reachability block (#3257) is preserved and restyled. The
  **Setnayan AI featured hero + its icon chips were a retired-mulberry (literal
  purple) island** — retired in `lib/add-ons-catalog.ts`: the `setnayan-ai`
  poster `linear-gradient(#2A1330→#8B4A93)` + `bg-purple-100/15 text-purple-100`
  chip → warm obsidian-to-gold `#17160F→#6B5324` + `bg-cream/20`; the same purple
  island on `music-creator` retired identically. Studio is a section page → no
  obsidian focal (§1.3); the AI hero reads gold-on-obsidian, on-language.
- **Messages (recomposition).** Index: header → glass; follow-gate + start-thread
  panels → `.sn-tile`; empty/archived states → `.sn-row`; thread view header bar
  → `.sn-tile`, back-link → `.sn-eye`.
- **Orders (recomposition).** Index: header → glass, order rows → `.sn-row` (mono
  ₱ + status pills). Detail: status header + payment-instructions + log-payment +
  payment-log sections → `.sn-tile`; BDO/GCash sub-panels → `.sn-row` (no nested
  blur; QR holders keep `bg-white` for scannability).
- **Seating.** Summary stat numerals → Space Mono; Walima/seat-shortfall notes →
  warm `success-*`/`warn-*` semantics; walkthrough header → glass. The 3D
  seat-plan editor + lab canvas left intact.
- **Long-tail contract sweep** (~66 routes): `website/**`, `studio/**` sub-pages,
  and the misc pages (activity, alaala, clearance, contracts, date-selection,
  details, disputes, documents, event-page, event-qr, find-date, for-you,
  galleries, hosts, invitation, launch, live, manpower, monogram, more, pabuya,
  paperwork, progress, refer, sponsors, today) — header + eyebrow + panel/row
  contract application; guest-site preview markup inside editor pages untouched.
  Retired routes (`design`, `orders/new`) are redirect stubs, unchanged.

Blur budget respected (list containers = one blurred tile, rows/table-rows/
sub-panels opaque); no `.sn-tile-dark` on any section page; `lint:radius` clean
(named tokens / sn-* only); reduced-motion covered by the global freeze; excluded
scopes (`app/[slug]`, guest-tree editorial, marketing) untouched. typecheck +
lint + lint:radius + local prod build pass.

SPEC IMPACT: None (design re-expression only; the plan lives at
`~/Documents/Claude/Projects/Setnayan/App_Wide_Glass_Rollout_Plan_2026-07-15.md`
§4 coherence contract + §5 PR-4).
