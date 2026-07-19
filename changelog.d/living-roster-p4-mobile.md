## 2026-07-11 · feat(guests): Living Roster P4 — mobile 3-mode parity + a11y/motion polish

Brings the couple **Guests MOBILE surface** onto the Living Roster, completing the
redesign (desktop P0–P3 already merged). The five-tab `.sn-seg` swipe carousel
(Summary · Search · Add · Customize · Journey) is retired for the prototype's
single scrolling control surface.

- **`mobile-guest-carousel.tsx`** — rewritten as one sticky surface: masthead
  (`N guests` + Invite native-share/copy + Needs-you badge → `/guests/claims`),
  pax-target meter, a passive Build → Invite → Confirm → Seat → Day-of progress
  ribbon, a **3-mode segment Roster / Groups / Day-of**, RSVP filter pills, a
  grid/list **density toggle**, and the bulk-select Customize row. Every control
  is a URL-driven `<Link>`/`buildHref` — Roster = `?sort=importance`, Groups =
  `?sort=group`, Day-of routes to the dedicated `/guests/checkin` desk, density
  writes `?density=list`. **NO second param encoder** — the same q/rsvp/view/
  group/team/tag/sort/gview contract the desktop facet bar emits. Removed the
  rAF-driven `AnimatedCount` count-up (it bypassed `prefers-reduced-motion`).
- **`guest-list-multiselect.tsx`** — the phone card grid now matches the desktop
  rows: self-joiners render a blush **MobileSelfJoinCard** (Keep/Link/Remove via
  the same claim actions), every card carries the reactive **SeatChip** + a
  **one-tap RSVP cycle** (`RsvpChipEditor mobileCycle`), and the density toggle
  swaps the photo grid for a compact **MobileListRow** list (reads `?density`).
- **`page.tsx`** — threads `joinUrl` into the carousel (all P0–P3 props preserved).
- **a11y/motion** — `aria-pressed` on the Add toggle, `aria-selected`/`role=tab`
  on the mode segment, `aria-current` on nav/RSVP/density Links (avoids the
  aria-pressed-on-link antipattern), the app's global 2px focus ring on nav pills
  + the gold `ring-terracotta` on chips/cards; the `gl-settle` mount motion and
  all Tailwind transitions are frozen by the universal `prefers-reduced-motion`
  block (no new keyframe needed).

Deferred (flagged in the PR, not built): branded QR PNG on the paywalled
CUSTOM_QR_GUEST SKU, dress-code real Mood-Board palette, and unifying the desktop
List/Mind-map switcher with the mobile 3-mode segment.

SPEC IMPACT: None — completes the Living Roster redesign of the couple Guests
surface (mobile half); no schema, SKU, or pricing change. The 3-mode segment
supersedes the mobile Journey/List·Mind-map switcher; mind-map on mobile stays
reachable via `?gview=map` (with a "Back to roster" escape hatch), its toggle
unification deferred to a follow-up.
