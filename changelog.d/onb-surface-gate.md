## 2026-06-28 · feat(dashboard): event-type-aware surfaces — hide wedding-only tools for non-wedding events

Owner-approved 2026-06-28. A non-wedding event (birthday, debut, …) was shown
wedding-only tools — Monogram, Whole Website / Event page, Save-the-Date, RSVP —
in the Studio hub + nav, even though its `event_type_profiles.enabled_surfaces`
excludes those surfaces. The profile system existed but the dashboard never
consulted it. Now it does, driven entirely by the admin-editable profile (so it's
reversible per type from /admin/event-types/[type]/profile), with wedding
byte-identical (its profile enables ALL surfaces).

- `lib/add-ons-catalog.ts` — `AddOnEntry` gains an optional `surface`; tagged on
  the 6 wedding-only add-ons (save-the-date → save_the_date · rsvp → rsvp · event/
  editorial/landing-page → website · animated-monogram → monogram). Universal
  in-app services (Papic, Panood, SDE, Pakanta, Setnayan AI, mood board, seating…)
  stay untagged → shown for every type.
- `studio/page.tsx` — resolves the event profile and filters the hub by
  `surfaceEnabled(profile, a.surface)`; a section that empties out simply hides.
- `customer-nav-config.ts` (desktop sidebar) — the Studio **Event page / Website /
  Launch** children gate on `websiteEnabled`; **Monogram** gates on a new
  `monogramEnabled`. `customer-menu.ts` (mobile docked sub-nav) gates the Website
  anchor + Event-page route on `websiteEnabled`.
- `layout.tsx` resolves `monogramEnabled` and threads it (alongside the existing
  `websiteEnabled`) to `CustomerSidebar`.
- `monogram/page.tsx` — backstop: a direct URL to the monogram maker redirects to
  the dashboard when the event type doesn't enable the surface (defense-in-depth;
  the website/launch page already had the equivalent).
- New `lib/add-ons-catalog.test.ts` (surface-tagging guard).

Zero blast radius: 0 non-wedding events exist in prod, and wedding enables every
surface → its nav/hub/pages are unchanged. typecheck + lint (incl. nav-icon +
bottom-nav guards) clean; 648 lib tests green.

SPEC IMPACT: None — consumes the existing (admin-editable) enabled_surfaces profile on the dashboard; no schema/SKU/pricing change.
