## 2026-07-13 · feat(dashboard): in-place drawer for Studio detail · Orders · Activity

Owner directive 2026-07-13 ("build the in-place drawer"): the second half of the "isolated loading, only what needs to load" rollout, for the surfaces where an accordion can't fit because the destination is a real page, not revealable data.

- **New `@drawer` parallel-route slot** on the event layout (`[eventId]/layout.tsx` + `@drawer/default.tsx`) with `(.)`-intercepting routes. A SOFT navigation to an interceptable URL renders the destination in an in-place sheet OVER the current page — the page beneath stays mounted, only the intercepted segment loads, no full-screen route swap, no full re-fetch of the current page. A hard load / shared URL / refresh renders the FULL page instead (the interceptor doesn't run), so the drawer is **purely additive and fail-safe**.
- **New `<SectionDrawer>`** (`_components/section-drawer.tsx`) — right-anchored sheet, full-width on mobile; backdrop + ✕ + Esc dismiss (pops the intercepted history entry via `router.back()`); locks background scroll; moves focus into the panel; `role="dialog"` + `aria-modal`.
- **Three interceptors**, each COMPOSING the real page component (one source of each view, no duplication):
  - `(.)studio/about/[addon]` → the App-Store detail (`AddOnDetailView`) as a sheet over the Studio grid.
  - `(.)orders` → the couple Orders list (composes `orders/page.tsx`).
  - `(.)activity` → the Activity feed (composes `activity/page.tsx`).
  These are reached from the Studio grid rows and the Overview "Open orders / See all recent activity" links, so those taps now open in place instead of reloading the screen. Heavy full-editor sections (guests, seating, vendor build) intentionally keep navigating.

Chassis verified in an isolated dev harness (no auth): sheet slides in (`translate-x-0`, `max-w-xl`), backdrop `rgba(27,26,23,0.4)`, `document.body` scroll-locked, focus moved into the panel, Esc closes + restores scroll, console clean. `tsc --noEmit` + `next lint` green.

⚠️ The interception against the REAL authenticated sections could not be driven in this environment (no Supabase creds / no real event) — **verify on the Vercel preview before merge** (open a Studio detail, Overview → Open orders, Overview → See all recent activity; confirm each opens as a sheet and a hard refresh of the URL still renders the full page). This PR is intentionally NOT set to auto-merge.

SPEC IMPACT: continues the 2026-07-13 "expand in place / isolated loading" direction (DECISION_LOG 2026-07-13 · [[project_setnayan_overview_council_redesign]]). No schema, no pricing, no locked-SKU impact.
