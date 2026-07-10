## 2026-07-10 · feat(dashboard): event sidebar → Plan/Go-live sections, Explore→Merkado, Overview, wine + badges

Restructured the couple EVENT dashboard nav to match the approved design
prototype (`setnayan-overview-energy.html`, the "Energy, not skin" couple
sidebar). Couple nav ONLY — vendor + admin doorways untouched.

- **Two labelled sidebar sections** (was one header-less `root` group):
  - **Plan** — Overview · Guests · Merkado · Studio · Budget
  - **Go live** — Launch (the couple's live personal website)
  Launch moved out of the Plan items into its own `golive` group (only rendered
  when `websiteEnabled`, so no empty heading). Every route + sub-item stays
  reachable — this is a regroup + relabel + restyle, not a removal.
- **Explore → Merkado** (label only). Key `explore` + route
  `/dashboard/[eventId]/vendors` + activeMatch unchanged. Renamed in the desktop
  sidebar config, the mobile SSOT (`lib/customer-menu.ts`), and the nav-registry
  defaults (`customer.sidebar.explore` + `customer.bottom-nav.explore`).
- **Home → Overview** (label only) for the event-home item. Route (base) +
  exact-match sentinel unchanged; its sub-items (Checklist · Schedule · Messages
  · Contracts · Refer a couple) intact. Renamed in the sidebar config, mobile
  SSOT, and registry defaults (`customer.sidebar.home` + `customer.bottom-nav.home`).
- **Wine active-state** — the nav primitives already source the `--m-nav-active`
  (Rich Mulberry WINE) token from the #2945 wine-chrome flip; the new section
  headings render via `SidebarSection` in `--m-slate-2` per the same system. No
  gold state remained to fix. SETNAYAN brand mark left as-is (separate change).
- **Live badges (real data, never fabricated):**
  - Guests item → live guest head-count (new lean `countGuestsByEvent` HEAD
    count, fail-soft → null → badge omitted), neutral tone.
  - Overview › Messages child → unread-thread count already loaded by the layout
    for the topbar bell, orange/attention tone.
  Studio active-services badge omitted (data not cheaply available).

The desktop sidebar and mobile bottom-nav/fab stay consistent with the SSOT
(`lib/customer-menu.ts`); the bottom nav reads Overview · Guests · Merkado ·
Studio (Budget already lives inside the Merkado takeover; Launch reachable via
the Studio section sub-nav on mobile).

SPEC IMPACT: The two renames are owner-approved product naming — surfaced for
sign-off: the couple event menu now reads **Overview** (was Home) and
**Merkado** (was Explore); the couple event sidebar is organised into **Plan**
and **Go live** sections per the `setnayan-overview-energy.html` design. No
schema/route/SKU/pricing change.
