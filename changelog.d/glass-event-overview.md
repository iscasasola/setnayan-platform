## 2026-07-15 · feat(design): event Overview recomposition — The Big Day focal, glass bento, motion (Glass PR-2)

Recomposes the couple's most-lived surface (`/dashboard/[eventId]`) into the
Atelier-Glass language landed by Glass PR-1 (#3251), consuming the shipped kit
(`.sn-tile` / `.sn-tile-dark` / `.sn-row` / `.sn-eye` / `.sn-h1` / `.sn-sec`,
`sn-bloom` / `sn-page-enter` / `sn-ring-sweep`, `CountUp`, ProgressRing `sweep`)
rather than re-inventing it. The owner-locked section ORDER (hero → bento →
overlays → decisions → band → journey rail; Status→Act→Navigate) and every data
source, action, route, copy-fact and feature flag are unchanged — real data or
nothing.

- **New "The Big Day" obsidian focal** (`.sn-tile-dark`, blooms last) directly
  under the hero: countdown `CountUp` (Space Mono 46px), date · venue (mono),
  `% planned` gold bar (vendor-categories-locked share) with a single shimmer
  pass, veil + capiz flourishes (reduced-motion `display:none`). When Setnayan
  AI is active the Suri briefing sentence + chips render INSIDE this tile
  (gold-300 "Suri · your briefing" eyebrow); "Today's one thing" becomes a
  gold-hairlined `.sn-tile` below.
- **Retires the R7 half-broken AI skin**: the `from-mulberry-700 via-mulberry
  to-mulberry-600` briefing gradient strip AND the separate page-scoped premium
  veil are gone (mulberry interpolated across re-pointed gold values). The
  obsidian focal is now the single premium presence — one `.sn-tile-dark` per
  view (§ 1.3).
- **At-a-glance bento** → four `.sn-tile`s with `.sn-eye` labels, gold
  ProgressRing sweeps, `CountUp`/Space-Mono numerals, `.sn-reveal` stagger
  (header → 4 tiles → focal bloom = the 6-element cap; below-fold static).
  **Budget tile copy disambiguated** (owner screenshot 2026-07-15): the old
  sub "of ₱2,250,000 committed" read as if the budget were committed — now the
  mono value is the COMMITTED amount, the sub reads "committed · of ₱X
  budget", and the ring carries %-of-budget. Same data sources.
- **Decisions board** → `.sn-tile` group panels, items = `.sn-row` (no blur),
  warm-semantic chip tones (inline sn vars), one gold-filled primary CTA per
  group (rest gold-outline).
- **Around-your-event band** keeps the owner's 2026-07-13 expand-in-place
  `ExpandCard` (now glass; the plan's "#3188 stretched-link doorways stay" line
  predates that directive — actions unchanged, skin only) + Conversations glass
  tile; **journey rail** → glass `.sn-tile` panel, gold rings, `sn-ring` gold
  ripple on the CURRENT stage node only (box-shadow — the node never scales),
  mono %s.
- **Day-of mode**: the DayOfModeGrid "Happening now" card becomes the obsidian
  `.sn-tile-dark` INSTEAD of the Big Day focal (which steps down to glass via a
  new `dayOfActive` prop) — still exactly one dark tile per view. Day-of
  "Planning" pill moved off `bg-cream` onto glass.
- **New `dashboard/[eventId]/template.tsx`** — wraps children in `.sn-page-enter`
  for the per-navigation soft rise (§ 2a); search-param changes don't remount,
  so filters never replay the entrance. **R8 verdict: suppression ADDED** —
  the rise starts at opacity 0 and the VT's incoming pane is a live capture,
  so the mobile bottom-nav slide would carry a near-transparent pane for its
  first frames; `html:active-view-transition .sn-page-enter { animation:none }`
  (globals.css) lets the slide BE the entrance.
- **Shell polish**: customer sidebar section labels → `.sn-eye` gold eyebrows
  via a new opt-in `eyebrow` prop on the shared `SidebarSection` (vendor/admin
  doorways untouched until PR-6/PR-8); day-of "Planning" pill is a flat white
  tint (no nested blur inside the frosted topbar, § 1.6).
- `m-serif` retired from this surface; numerals/dates/₱ → Space Mono; eyebrows →
  `.sn-eye`. Blur budget honored (glass tiles only, rows opaque, ≤8 blurred per
  viewport). `lint:radius` clean; typecheck + lint + local production build pass.

Files: `app/dashboard/[eventId]/_components/event-dashboard.tsx`,
`app/dashboard/[eventId]/page.tsx`, `app/dashboard/[eventId]/layout.tsx`,
`app/dashboard/[eventId]/template.tsx` (new),
`app/dashboard/[eventId]/_components/expand-card.tsx`,
`app/dashboard/[eventId]/_components/customer-sidebar.tsx`,
`app/dashboard/[eventId]/_components/day-of-mode/whats-happening-card.tsx`,
`app/dashboard/[eventId]/progress/_components/journey-rail.tsx`,
`app/_components/nav/sidebar-section.tsx`, `app/globals.css` (R8 rule).

Out-of-scope finding queued for the event long tail (Glass PR-4): the Studio's
purple "Setnayan AI" hero card + purple Mood Board icon chip are HEX-LITERAL
poster gradients in `lib/add-ons-catalog.ts` (`setnayan-ai` entry ~L230-237,
`mood-board` entry ~L727-731), rendered by
`app/dashboard/[eventId]/studio/_components/service-poster.tsx` — a separate
mechanism from the retired Overview mulberry skin; untouched here.

SPEC IMPACT: None — pure design recomposition per App_Wide_Glass_Rollout_Plan_2026-07-15.md § 3.1 / § 5 PR-2 (routes, data, actions, copy-facts, flags all unchanged). Retires the R7 mulberry AI-skin gradients as the bug fix.
