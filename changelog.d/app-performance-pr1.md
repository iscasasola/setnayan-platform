## 2026-07-03 · feat(admin): App Performance cockpit — PR 1 (route + menu slot + Live charts)

Owner lock 2026-07-03: App Performance is **1 of the 6 admin menus**. This PR
lands the cockpit's foundation (plan: spec corpus
`0023_admin_console/App_Performance_Plan_2026-07-03.md`):

- **New surface `/admin/app-performance`** — one-page operator cockpit: context
  strip (Users · Vendors · Services · Total events · Total editorials · Uptime ·
  Error rate) + **Growth** zone (new users/vendors/services/events small
  multiples · sales split 3 ways in PESOS [Setnayan AI / vendor subs+tokens /
  all other] · completed services via the `event_vendors` completion handshake ·
  first-pick rate w/ min-N floor · reviews + avg rating · events-by-type ·
  normalized index=100 growth overlay · period-over-period movers leaderboard)
  + **Stability** zone (live `/api/health/deep` probe · abuse-reports stacked
  trend · honestly-muted needs-wiring cards for error rate/p95/Web Vitals/uptime
  history). Every card tagged Live or Needs-wiring; nothing simulated.
- **New fetcher `lib/admin/app-performance-stats.ts`** — sibling to
  `growth-stats.ts` (extend, don't fork): bounded 2×-window reads over
  `orders` + `vendor_subscriptions` + `vendor_token_purchases` (pesos,
  realized-only), `event_vendors` (completion + `selection_match_rank`),
  `vendor_reviews`, `user_reports`, `event_editorial`; per-section error
  degradation; `sampled` row-cap flags. `growth-stats.ts` exports
  `bucketBoundaries`/`toPoints`/`entityBase` for reuse.
- **Nav: the Insights menu is renamed "App Performance"** (desktop sidebar
  group key `funnels` kept for localStorage continuity; the cockpit leads the
  group). Mobile: cockpit joins the More umbrella (Insights' existing slot per
  the 2026-06-21 ≤5 reroster). Registry slot
  `admin.sidebar.app-performance` added so `/admin/menus` can manage it.
  `/admin/insights` + `/admin/more` landing grids lead with the cockpit card.
- **Premium animation**: scroll-into-view reveal + SVG stroke draw-in +
  count-up numbers (`CockpitFx`) — animates once, transform/opacity only;
  no-JS and `prefers-reduced-motion` render final state.

⚠ Flagged for owner: re-promoting App Performance to a dedicated 6th mobile
tab would reverse the 2026-06-21 ≤5-tab reroster — left under More pending an
explicit call. Action Center = PR 2 · Expenses & Receipts (`platform_expenses`
migration) = PR 3.

SPEC IMPACT: none beyond the already-committed plan doc + decision-log rows
(2026-07-03) in the spec corpus — this PR implements them.
