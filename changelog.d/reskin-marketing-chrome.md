## 2026-07-03 · feat(marketing): every public page now wears the new website's chrome — glass nav + reskin footer with the pinned-footer interaction

The reskin homepage's links no longer "jump to the old website": all public
marketing, legal, help, and download pages now render the ELN-reskin shell.

- `site-nav.tsx` REWRITTEN as the homepage's floating glass nav ([logo] ·
  Prices · Download · Vendors · [Sign in]) — the four items open the SAME
  overlays the homepage ships (HomeOverlays), fed by a new lazily-fetched
  `/api/home-pricing` route (live catalog, s-maxage=300). Old 6-link row nav +
  PromoBar retired. Labels stay nav-registry-driven (4 new
  `public.site-nav.*` slot defaults; the 6 old link slots stay seeded-but-inert).
- Split route sets so the site is FULLY independent of the old chrome. The
  glass NAV renders on the top-level marketing/legal/support routes (`/privacy`
  `/terms` `/refunds` `/cookies` `/acceptable-use` `/help` `/download`
  `/waitlist` added). The shared FOOTER renders on a broader set
  (`isMarketingRoute`) that also covers the article/reading DETAIL pages
  (`/blog/[slug]` `/help/[slug]` `/tour`) — so those pages retire the old
  `_SiteFooter` yet KEEP their own bespoke masthead / sample ribbon (the glass
  nav never doubles their header). `/realstories/[slug]` is untouched (its
  immersive edition design already ships zero old-site chrome). The
  `.hr-chrome-nav` wrapper reserves the fixed pill's band (92px / 84px mobile)
  so content clears the floating nav; `/explore` renders the nav in-flow so its
  own sticky marketplace search bar owns the top.
- Doubled-header cleanup on the newly-shared routes: stripped the page-local
  `Header` on `/privacy`, the `<header>` on `/help`, and `LegalHeader` +
  `LegalFooter` from `LegalLayout` (terms/refunds/cookies/acceptable-use) — the
  inter-policy links live in the ReskinFooter's Legal column.
- Overlays render unconditionally with nullable pricing: Download / Sign in /
  demos work instantly; Prices / Setnayan AI / Vendors gate on a resolved
  `pricing` and retry the `/api/home-pricing` fetch if opened before it lands.
- NEW persistent `SiteFooterChrome` (root layout, after {children}) renders the
  ONE shared `ReskinFooter` (extracted from HomeReskin's private HomeFooter) on
  every marketing page. Pinned-footer interaction (owner 2026-07-03): clicking
  a footer link pins the footer — it survives the navigation as a fixed bottom
  sheet so footer-to-footer hops never lose it; pressing anything in the top
  nav (or any non-footer navigation — in-page link, Back, reload) unpins it and
  animates it back down (reduced-motion respected). In-memory module-scoped pin
  store in `footer-pin.ts` (survives soft nav for the `/`→marketing handoff,
  auto-clears on hard reload so the sheet never gets stuck open unprompted).
- Stripped the forked old-footer implementations from ~24 pages (`_SiteFooter`
  incl. features/_PageBody + blog/[slug] + tour, `_sections.Footer` on
  about/tl-about, `page-tail.Footer` on for-vendors, inline footers on
  privacy/how-it-works/tl-how-it-works/pricing/help/waitlist, and the legacy
  `SiteHeader` on download + waitlist).
- OLD-CHROME DECOMMISSION (owner: "make the new website purely independent from
  the old one") — the old marketing chrome is now unreachable AND deleted so the
  two can't silently coexist:
  - Deleted `app/_components/marketing/_sections.tsx` (the entire old homepage:
    PromoBar + old Nav + old Footer + ProblemSection/ForCouples/… — zero
    importers after the reskin homepage shipped).
  - Deleted `app/_components/site-header.tsx` (old `SiteHeader`) and
    `app/features/_sections/_SiteFooter.tsx` (old feature footer) once their
    last consumers (download/waitlist, blog[slug]/tour) migrated.
  - Deleted `app/_components/auth/sign-in-modal.tsx` (the old nav's
    `SignInButton`/`SignInModal` — the glass nav uses the overlay sign-in).
  - Gutted `LegalLayout` to a body-only scaffold (removed `LegalHeader` +
    `LegalFooter`); removed the orphaned `Footer`/`FooterCol` from
    `for-vendors/_components/page-tail.tsx`.

SPEC IMPACT: DECISION_LOG.md row appended (corpus) — public-site chrome
unified onto the reskin shell; the old marketing nav/footer/homepage components
are deleted, not just unreferenced.
