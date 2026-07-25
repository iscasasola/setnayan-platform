## 2026-07-12 · feat(design): Atelier reskin Phases 4+5 — dashboards go macOS glass + background-videos re-linked

The structural finale of the 2026-07-12 design finalization — the dashboards
take the kit's glass treatment, all from the centralized token layer:

- **Frosted sidebar (all three doorways):** the `--m-sidebar-*` family flips
  from the 2026-07-09 dark obsidian island to the Atelier frosted panel —
  rgba(255,255,255,.45) glass + blur(24px) saturate(1.5) + warm shadow, warm
  ink text, hairline dividers. `.sn-sidebar` paints it once; couple, vendor,
  and admin follow.
- **Gold-only accents (kit rule 2):** the wine/violet doorway accent fork is
  retired — sidebar active states read gold-700/gold-500 in every doorway;
  `.sn-sidebar--violet` remains as a hook but resolves to the same gold. The
  dark-panel contrast lift for the AccountSwitcher initials is gone with the
  dark panel.
- **Ambient backdrop:** SidebarShell's page wrapper swaps solid paper for
  `.sn-ambient` (warm wash + three soft radial tints, fixed attachment); the
  sticky top bar becomes a frosted glass strip. Content cards stay solid for
  readability — glassifying individual cards can iterate per-surface later.
- **/admin/background-videos re-linked** into the Studio sidebar lane beside
  Hero video (page-layer audit owner decision #3, additive only) — the live
  homepage-hero upload tool is reachable from nav again. Closes the last of
  the audit's five admin owner-decisions.

Verified: tsc + lint clean; real-browser CSS probe confirms ambient
#F2EFE8+radials, sidebar rgba(255,255,255,.45)+blur(24px), warm ink #1B1A17,
gold-700 accent in both default and violet scopes.

SPEC IMPACT: corpus DECISION_LOG.md 2026-07-12 design-finalization row.

**Addendum — typography consistency pass + production 500 fix (same PR):**

- **One type system on every chrome page.** The root `--font-display/--font-sans/
  --font-mono` now resolve Hanken Grotesk / Space Mono (the editorial faces
  moved to `--font-editorial-*`), so marketing pages that used plain
  `font-display`/`font-sans` utilities (/about, /help, legal, blog, …) finally
  match the rest — verified: /about h1+body compute Hanken (was Cormorant/
  Manrope). The guest exclusion is now EXPLICIT: a new `app/[slug]/layout.tsx`
  wraps the whole invitation/event tree in `.sn-editorial` (display:contents),
  which restores Cormorant/Manrope/DM Mono — verified both directions in-browser.
- **/how-it-works production 500 FIXED** (pre-existing — live site 500s today;
  page untouched since PR #2831): the Server Component page passed a render-prop
  FUNCTION as a client component's children ("Functions are not valid as a child
  of Client Components"). The hero moved into the client motion island as
  `<HowItWorksHero />`; route verified 200.
