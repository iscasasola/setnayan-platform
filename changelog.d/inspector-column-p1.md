## 2026-07-15 · feat(ux): desktop inspector column — shared primitive + Studio + Overview decisions

The owner's "Finder-columns" interaction, phase 1. On desktop (≥xl) clicking a
list/catalog item now SELECTS it and opens a sticky right-side **inspector
column** instead of navigating — the selection is reflected in the URL
(`?inspect=<id>`), so refresh/share restores it. Below xl behaviour is unchanged
(the column is hidden; rows navigate to their standalone routes / sheets).

**Shared primitive — `app/_components/inspector/inspector-column.tsx` (client).**
- `useInspector(paramKey)` binds selection ↔ the `?<paramKey>=` search param
  (search-param changes deliberately do NOT remount `[eventId]/template.tsx`, so
  the route-entrance animation does not replay).
- `InspectorLayout` is the 2-column flex shell + context provider. It drives the
  master's width transition (`--sn-ease` 320ms via the rail's `flex-basis`), holds
  optimistic open state so the animation fires before the server round-trip, and
  restores focus to the triggering row on close. `hasSelection` (server truth)
  gates the resting open state so an unknown/stale id renders closed, never a
  blank rail.
- `InspectorTrigger` is a row: an anchor that navigates below xl / on
  modified clicks, but selects-into-the-inspector on a plain desktop click (or a
  button, in `href`-less render-only mode for no-action rows).
- `InspectorColumn` is the sticky glass `.sn-tile` panel (radius 20, own scroll,
  max-height viewport-minus-chrome): `role="complementary"`, `.sn-eye` eyebrow,
  scaled title, ✕ close + "Open full page ↗", body keyed by selection with the
  new `.sn-lens-swap` remount animation. Esc + ✕ close; focus moves to the panel
  heading on a user-initiated open (never on a cold refresh/share load). Reduced
  motion drops the width transition + lens-swap. The panel is the ONE blurred
  surface the inspector adds (its body sections stay opaque).

**Studio.** Catalog rows whose click lands on the shared `/studio/about/<key>`
detail page become inspector triggers; the inspector body reuses
`AddOnDetailView` in a new `variant="inspector"` (its buy/CTA flow unchanged) —
owned rows (deep-link to the tool), opensDirect, coming-soon, and detail-less
rows keep navigating. The standalone `/studio/about/[addon]` route is untouched.

**Overview (event Home).** Decision-board `.sn-row`s open the inspector showing
that decision's facts, amount/chip, and its OWN CTA (same action, same room);
"Suri on watch" rows open a read-only inspector with the alert in full (they
carry no action today, so the inspector carries none). The "Around your event"
band cards stay pure navigational doorways (#3188); the Big Day focal is
untouched.

SPEC IMPACT: None. New presentation of existing data/actions/routes — no schema,
pricing, SKU, copy-fact, or flag change. Phases 2/3 extend the same primitive to
Guests + Merkado.
