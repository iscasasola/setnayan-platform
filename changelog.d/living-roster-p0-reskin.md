## 2026-07-11 · feat(guests): Living Roster reskin (P0) — summary-facet bar + roster-as-hero + remove stage-nav stepper

P0 of the owner-approved "Living Roster" redesign of the couple Guests page
(corpus memory `project_setnayan_guests_living_roster.md`) — the VISIBLE
RESKIN only. Behavior-preserving: zero server-action / data-fetch / route
change, same URL filter params (`q · rsvp · view · group · team · tag · sort ·
gview`), same filter results. This PR only re-presents the same data.

- **Summary IS the facet bar** (`page.tsx`) — the standalone stat strip (GUEST
  TARGET / PAX POOL / CONFIRMATIONS) and the left SIDE / VIEW / GROUPS facet
  rail are folded into ONE horizontal `SummaryFacetBar`: the pax + confirmations
  meters headline it, then Side / RSVP / View / Group / Tags each render as a
  labelled row of count-bearing filter pills (the live counts now sit ON the
  pills, per the prototype), with the active-filter breadcrumb at the foot. Each
  pill is a plain server `<Link>` that rewrites the SAME params the old
  strip/rail did. Retires `SummaryStrip` + `FacetsSidebar` + `FacetGroup`.
- **Roster-as-hero** — the list is now full-width; the 240px facet column is
  gone (filtering rides the bar above). Group headers ("Bride & Groom", tiers)
  kept. Rows leaned (py-2.5) to match the prototype; same columns/data
  (name/side/role/groups/rsvp/contact) and static side/role/rsvp chips.
- **Stage-nav stepper RETIRED** — the Build ▸ Invite ▸ Confirm ▸ Seat ▸ Day-of
  lifecycle ribbon is removed from the page and `lifecycle-ribbon.tsx` deleted;
  its steps live in the left nav + the roster's own affordances. `guest-journey.ts`
  comment updated (it's still the source of truth for the sidebar + mobile sub-nav).
- **Champagne-gold editorial tokens + motion** — facet pills use the existing
  `terracotta` (= champagne gold) token for their active wash; one new `.gl-*`
  block in `globals.css` adds the on-mount `gl-settle` (fade+rise) for the bar +
  roster, a ONE-SHOT that plays on entry and NOT on filter re-renders (App-Router
  reconciles rather than remounts), frozen by the existing global
  `prefers-reduced-motion` rule.
- **Groups management preserved** — `GroupsSidebar` gains a `layout="inline"`
  variant (horizontal pills + kebab rename/delete + "New group") reusing its
  existing server actions + state machine unchanged.
- **Mobile untouched** — `mobile-guest-carousel.tsx` + the roster's mobile grid
  render as before.
- Verified: `tsc --noEmit` clean · `next lint` 0 errors (no warnings in changed
  files) · `lib/guests.pax.test.ts` + `lib/guest-stories.test.ts` 15/15 green.

DEFERRED to later phases (unchanged this PR): dual-mode Add/Find capture bar
(P2) · inline chip editors for RSVP/side/role (P2) · reactive RSVP→seat loop /
held-seat chips (P3) · self-join "needs you" inline reconcile (P2) · undo-toast
replacing confirm dialogs (P1) · 3-mode Roster/Groups/Day-of switch (later) ·
full mobile redesign (later).

SPEC IMPACT: None (behavior-preserving reskin; the stage-nav stepper is retired
in the app — its journey stages still live in `lib/guest-journey.ts` for the
sidebar + mobile sub-nav). Tracks P0 of the owner-approved Living Roster
redesign per corpus memory `project_setnayan_guests_living_roster.md`.
