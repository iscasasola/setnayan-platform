# PROGRESS — rd/features-pages (P10 slices c + d + SEO tagging)

Stopped mid-build on 2026-10-01 by the controller (local Mac → moving to a cloud session).
**Nothing on this branch has been typechecked, linted or tested yet.** Base: origin/main 49693bf3c.

## Done (written, unverified)
- **Registry (one list)** `apps/web/lib/feature-pages/`
  - `types.ts` — `FeaturePageEntry` type, `FEATURE_SLUGS` (44 slugs, closed list), price/shot/try types.
  - `index.ts` — `FEATURE_GROUPS` (5), `FEATURE_PAGES` (assembled from 6 group files), helpers
    (`featurePage`, `featurePaths`, `featureHref`, `featuresInGroup`), `FEATURES_LASTMOD`, `ECOSYSTEM_CHAINS`.
  - `price.ts` — pure: catalogue codes → label ("Free" / "₱X" / "From ₱X" / "Free · upgrades from ₱X" /
    "See pricing") + schema.org Offer/AggregateOffer; unreadable catalogue → no Offer.
  - `seo.ts` — pure: `featureMetadata` (title, description, canonical, hreflang en-PH/tl-PH/x-default,
    OG + Twitter image), `featureJsonLd` (Organization, WebPage, BreadcrumbList, SoftwareApplication+Offer,
    FAQPage, HowTo), `featuresHubItemList`.
  - Group files **EMPTY STUBS**: `plan-a.ts plan-b.ts invite.ts day-memories.ts suppliers-a.ts suppliers-b.ts`.
- **Feature page** `apps/web/app/features/_feature-page.tsx` (server component, no client code, no cards),
  `_feature-price.ts` (one cached read of both catalogues, all rows), `_icons.ts` (EVENT_MENU_ICONS + extras).
- **Routes** `apps/web/app/(shell)/features/[slug]/page.tsx` + `app/(shell)/tl/features/[slug]/page.tsx`
  (inside (shell) for the front-door chrome; no route directives; notFound(); NO loading.tsx on purpose).
  ⚠ Unverified that Next accepts `(shell)/features/[slug]` beside `app/features/page.tsx` and
  `(shell)/tl/features/[slug]` beside `app/tl/features/page.tsx` — check in the first build.
- **Hub rewrite** `app/features/_PageBody.tsx`: Hero (≤5-word H1 + one line) → `_FeatureGroups.tsx`
  (5 groups from the registry, icon · line · Try it · live price) → `_Ecosystem.tsx` (connected map from
  `ECOSYSTEM_CHAINS`) → WhySetnayan → HowItWorks → FinalCTA (copy rewritten: the old "Setnayan Team will
  contact you within 24 hours with a quote" was the concierge flow, not what the button does).
  Deleted: `_AnchorNav` (a pill row), `_StickyMobileCTA`, and the six catalogue sections
  (`_PlanningToolkit _Communications _VendorsLedger _DayOfApparatus _OutsourcingPacing _Compliance`) —
  superseded by the registry. `one-explainer-page.test.ts` anchor-nav test replaced by an id-survives test.
- **Sitemap** `app/sitemap-features.xml/route.ts` (every EN + TL page, hreflang xhtml:link, lastmod =
  FEATURES_LASTMOD) + added to the `sitemap.xml` index.
- **llms.txt** `lib/llms-txt.ts`: "## Feature pages" section from the registry (`llmsFeaturePages`,
  `llmsFeatureRoutes`); a feature priced by an `UNLISTED_UNTIL_PROVEN` code (Patiktok) — or naming one —
  is left out. `lib/llms-txt.test.ts` link-allow test now also allows `llmsFeatureRoutes()`.
- **SEO audit** `lib/seo/health-checks.ts` KNOWN_PUBLIC_ROUTES derives every feature EN + TL path.
- **robots.ts** unchanged (AI answer engines already allowed '/', training bots blocked) — asserted by test.
- **Guards** (written, NOT run, NOT yet sabotage-checked):
  - `app/features/features-tagging.test.ts` — walks every slug × locale: unique title/description +
    lengths, canonical, hreflang, OG/Twitter image on disk, full JSON-LD graph, no Offer when unreadable,
    one H1 / H2 sections / H3 FAQ / alt / answer-first (renderer source), hub one H1 + ItemList, ecosystem
    links, routes have no loading.tsx, sitemap, llms (no Patiktok), KNOWN_PUBLIC_ROUTES, robots.
  - `app/features/features-page-says-what-ships.test.ts` — banned-phrase scan now also reads
    `lib/feature-pages/*.ts`; added: evidence paths exist · Try/More links open real pages · price codes
    appear in a migration (and only setnayan-ai may read inactive rows) · shots on disk + alt + not banned ·
    no "vendor"/"website"/typed ₱ in copy · EN/TL counts match (3 steps, 3–5 different, 3–6 FAQ, 2–5
    works-with) · a feature with a product page uses that product's STUDIO_APPS name.

## Not done
1. **All 44 feature entries** (the six group files are empty). Brief for writing them: `docs/FEATURE-BRIEF.md`
   (self-contained; includes the prod catalogue codes snapshot 2026-10-01). Assignments:
   - plan-a.ts: budget, guest-list, seat-plan, 3d-plan, schedule, checklist, date-picker
   - plan-b.ts: mood-board, traditions-guide, contracts, marketplace, compare, setnayan-ai
     (setnayan-ai price: codes SETNAYAN_AI,_B,_C,_D + `inactiveRowsArePrices: true`)
   - invite.ts: event-hub, save-the-date-video, logo-maker, wedding-march, e-gifts, music-maker, groups, helpers
   - day-memories.ts: door-check-in, run-the-day, papic, live-watch, patiktok, gallery, alaala, real-stories
   - suppliers-a.ts: supplier-shop, -services, -inquiries, -bookings, -contracts, -earnings, -performance
   - suppliers-b.ts: supplier-team, -verified-badge, -photo-watch, -real-stories, -partnerships,
     -tax-documents, -subscriptions, -papic-challenges
   If a listed feature does not really ship, remove its slug from `FEATURE_SLUGS` (and any ECOSYSTEM_CHAINS use).
   Note `name.en` must equal STUDIO_APPS name when `moreHref` is that product page (e.g. Event Hub, not
   "Event Hub Maker").
2. Run: typecheck, lint, every `node scripts/lint-*.mjs` step in ci.yml, the touched tests
   (features/*, lib/llms-txt.test.ts, app/(shell)/*.test.ts, spotlights-are-real, cookie-banner test that
   mentions the deleted _StickyMobileCTA).
3. Regenerate baselines with their generators (they list the deleted section files):
   `scripts/port-control-baseline.json`, `scripts/no-card.baseline.txt` (+ any other that fails).
4. Sabotage-check each new guard once (list in the test header) and record in the PR.
5. Bundle: prove shared client bundle unchanged (server components only; no SiteChrome edit). Compare the
   PR's CI `bundle-size-check` against main's. Server actions: unchanged (none added) — `node
   apps/web/scripts/lint-server-action-budget.mjs` was 1225/1225 before.
6. Route budget: this adds 3 routes (`(shell)/features/[slug]`, `(shell)/tl/features/[slug]`,
   `sitemap-features.xml`) — mention in the PR.
7. `changelog.d/rd-features-pages.md` — SPEC IMPACT: None.
8. PR routine: `gh pr create --base main --draft` → `gh pr edit <n> --add-label do-not-auto-merge` → when
   green `gh pr ready <n>` → if `autoMergeRequest` not null, `gh pr merge <n> --disable-auto`. Never merge.

## Next step
Fill the six group files from `docs/FEATURE-BRIEF.md` (one helper per file is fine), then run typecheck +
the features tests and fix what they find.
