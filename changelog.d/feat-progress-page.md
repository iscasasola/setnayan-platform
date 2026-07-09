## 2026-07-09 · feat(dashboard): Decisions & Progress page

- New couple surface **`/dashboard/[eventId]/progress`** — "Decisions & Progress",
  a production port of the approved session prototype
  (`setnayan-decisions-progress.html`, 2026-07-09). Sections: serif hero
  (days-out · decisions-open · current stage) · at-a-glance bento (countdown /
  decisions / budget-committed / guests rings via the shared `ProgressRing`) ·
  the six-stage journey rail (Dreaming → After; per-stage Done / Still-to-do
  panels with "Set na 'yan ✓" chips) · the decisions board (Book a vendor /
  Pick an option / Settle a payment / Fill a role) · four "Around your event"
  doorstep cards (team · conversations · services · schedule).
- All data is real + RLS-scoped, mirroring the Overview's defensive query
  patterns: `fetchGuestsByEvent`/`computeGuestStats`, lean `event_vendors` +
  orders selects, `buildCockpitModel` (decisions), `pickTodaysOneThing`,
  `summarize` (paperwork), `fetchUpcomingItems`, `countUnread`, plus ONE new
  lean query for `pending_payment` orders (the cockpit intentionally omits
  that kind). New pure lib `lib/progress-stages.ts` (+ unit tests) builds the
  journey stages deterministically.
- **AI dual state**: extras (Suri briefing strip · Today's one thing ·
  priority-ranked decisions · What's-next deadline rail · render-only "Suri on
  watch" via the pure `setnayan-ai-triggers` engine · wine/champagne premium
  skin, page-scoped) render only when Setnayan AI is active for the viewer —
  the Overview's exact resolution (`isSetnayanAiActiveForUser` +
  paywall/per-user flags + `getEventHostAiSubscription`) — OR when an
  internal account (`users.is_internal`) passes `?suri=preview`
  (render-only override; flips no flags, charges nothing).
- Nav: additive "Progress" sub-item under Home in the desktop sidebar
  (`customer-nav-config.ts`), the customer menu SSOT (`lib/customer-menu.ts`
  children + Home active/section matches), and the nav-slot registry defaults
  (`customer.home-subnav.progress`).
- Cut from the prototype (demo-only / not derivable): fixture switcher, fake
  AI toggle, upsell-teaser flip trick, watch-guard fixtures, the
  recent-activity section (already owned by the Overview), and the
  "Pick a quote" framing is generalized to "Pick an option" (saved-but-unlocked
  categories from the cockpit — quote rows aren't modeled).

SPEC IMPACT: None (new app surface within the shipped dashboard architecture;
design source = the 2026-07-09 session prototype; no schema, pricing, or SKU
changes).
