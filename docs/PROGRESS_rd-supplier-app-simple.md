# P4 — Supplier phone app (Today · Customers · Shop · More) — PROGRESS

Branch `rd/supplier-app-simple` (base origin/main 49693bf3c). Spec: DECISION_LOG 2026-10-01
"THE SUPPLIER PHONE APP — APPROVED, WITH THE THREE RECOMMENDED ANSWERS"; prototype
`Setnayan/prototypes/supplier_app_simple_2026-10-01_fable.html`.

⚠ WIP — stopped mid-build on controller order (moving to a cloud session). NOTHING has been
typechecked, linted or tested yet. No PR opened.

## Done (uncommitted-then-WIP, unverified)
- `app/_components/next-card.tsx` — the ONE Next card, lifted verbatim from the host's
  `home-first-screen.tsx`; host now renders `<NextCard marker="data-home-next" …>` (same markup).
- `lib/supplier-today.ts` — pure picker: run_day > answer (needsAnswer[0]) > unread (desk
  incomplete) > setup (first-steps current) > findable > tomorrow > fee > payday > clear;
  `eventsThisWeek` ("5+" when the 5-row upcoming read is all inside the week); `owedToYouPhp`
  (expected − confirmed, null when payday unmeasured → "—").
- `app/vendor-dashboard/_components/supplier-today-first-screen.tsx` (server) — shop line ·
  Next card · three linked numbers · Coming up (3) · "See everything" → `#today-all`.
- `app/vendor-dashboard/page.tsx` — Today rebuilt: status notices → first screen → MiniTour
  `vendor_today_v1` (after `vendor_welcome_v1`) → `#today-all` "Everything else" holding every
  old block in order (findability, first steps, award, payout nudge, fee bills, desk, free note,
  nothing-to-answer, ongoing, upcoming). Focal tile + KPI bento REMOVED from page.
- `overview-sections.tsx` — `VendorTodayFocal`, `VendorEnergyStats`, `EnergyKpi`, `EarnedTile`,
  `CashFlowTile` deleted (now unused) + their imports.
- `lib/tours.ts` — `vendor_today_v1`, `vendor_customers_v1` added; welcome tour "My Shop" → "Shop".
- `lib/vendor-more-rows.ts` — ONE list for More (Calendar · Earnings & payday · Messages ·
  Insights[slot bottom-nav.performance] · Event Hub[slot bottom-nav.onday] · Notifications ·
  Plan[webOnly]) + `VENDOR_MORE_MATCH` + `vendorMoreRows()`. No "Settings" row (no such page —
  explain in PR).
- `more-services-sheet.tsx` (host, #6205) — accepts `MoreSheetRow` (optional `sub`, optional
  resolved `Icon`); supplier bar lazy-imports the SAME sheet.
- `vendor-bottom-nav.tsx` — bar = Today · Customers · Shop · More (key `more`, onSelect opens
  sheet, href /vendor-dashboard/more); performance/onday tabs removed; `/more` + `/notifications`
  moved from Shop's activeMatch to More; new `storeShell` prop (layout passes it).
- `vendor-nav-destinations.ts` — rail = Today · Customers · Shop · More (keys overview ·
  customers · shop · more). `vendor-rail-context.tsx` lights More on VENDOR_MORE_MATCH; CAPTION.
- `lib/nav-registry-defaults.ts` — sidebar customers/shop labels → "Customers"/"Shop"; new slots
  `vendor.sidebar.more` (sortOrder 3) + `vendor.bottom-nav.more` (sortOrder 6, MoreHorizontal).
- `app/vendor-dashboard/more/page.tsx` — redirect replaced by a server page drawing
  `vendorMoreRows` (owner/admin only).
- `clients/surface.tsx` — shipped "Import an outside client · free" `<details>` gets
  `id="import-outside"` + `open={search.add==='outside'}`; no-pools fallback note.
- `customers/_components/customers-pick.tsx` — client PickMenu wrapper (router.push to option
  href) for Filter ▾ / Show ▾. NOT YET MOUNTED.

## Not done
1. **Customers redraw** (`customers-roster.tsx` + `customers/page.tsx`): title + round +
   (`?open=clients&add=outside#import-outside`) + ⋯ (`<details>`, links to `?open=messages|
   clients|availability|proposals|contracts#customer-tools` and `#calendar`; NO `<li>` — the
   roster render test counts `<li>` = 20 rows) · search + Filter ▾ · counts line + Show ▾
   (`?show=next|money|date`; non-chosen columns `hidden lg:block`) · rows with status pill + one
   next-step Link (Reply/Answer/Follow up/Send a quote/See the day). Remove lane pill row.
   Pass Filter/Show as ReactNode SLOTS from page.tsx — `useRouter` throws in the roster's
   renderToStaticMarkup test. Wrap FeatureAccordion in `<div id="customer-tools">`. Mount
   `<MiniTour tourKey="vendor_customers_v1" />`.
2. Tests: rewrite `the-today-page-speaks-to-every-supplier.test.ts` (render
   SupplierTodayFirstScreen; craft words; owed number; guard = first `<a`/`<button` is inside
   `data-today-next`; + page.tsx source-order guard), `a-count-you-can-tap-goes-somewhere.test.ts`
   (retarget from EnergyKpi to the three numbers), `vendor-nav-boundary.test.ts` (cite approval
   row; bar = 4 keys; More rows from one module), `vendor-rail-context.test.ts` (keys/labels/order
   now 4), `the-room-is-called-the-event-hub.test.ts` (onday tab gone from bar — Event Hub now a
   More row), `the-roster-pages.test.ts` (chips → counts line), `marketplace-mini-tour.test.ts`
   probably fine. Add a supplier-today picker unit test. Sabotage each new guard once.
3. `more/loading.tsx` comment/skeleton (list, not 8-tile grid).
4. Run from apps/web: typecheck, lint, every `node scripts/lint-*.mjs` in ci.yml; regenerate
   `port-control-baseline.json` with `pnpm port:baseline` (focal/bento controls removed on
   purpose: `#whats-new` focal CTA, `/vendor-dashboard/messages`, `/clients`, `/earnings` KPI
   links — check which are actually reported lost).
5. Budgets: server actions untouched (1225 → 1225, measured before). Shared bundle: main CI
   measured 202.0KB (job 110162083924); no local exact-bytes baseline was taken (build stopped).
   New client code: customers-pick.tsx (route chunk), sheet change (lazy chunk), bottom-nav
   (vendor layout chunk) — none should be in the shared set, but the webpack runtime chunk map can
   move a few bytes; read the PR's "bundle size check" job.
6. changelog.d/rd-supplier-app-simple.md (SPEC IMPACT: None), PR routine per prompt (draft,
   do-not-auto-merge label, disable auto-merge if armed).

## Gotchas found
- `vendor-dashboard/more` was a redirect to Today (retired 2026-07-16) — now a real page again.
- Nav registry labels come from CODE defaults; DB holds only overrides, so the label rename
  needs no migration.
- Shipped outside-client add lives only in Clients section (`?open=clients`) and in Calendar
  "Availability" — both are `<details>` forms; the + reuses the Clients one.
- `EVENT_MENU_ICONS` (lib/customer-menu.ts) deliberately NOT extended — it rides the event
  layout chunk and the Maker JS budget had 2.7KB headroom.
- Worktree-isolated agent sandbox refuses `cd` elsewhere / complex heredocs; write scripts to the
  scratchpad and run them by path.
